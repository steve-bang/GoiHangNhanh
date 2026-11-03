# Ưu tiên độ tin cậy: video, tải lên và dữ liệu giữa các máy

> **Đề xuất kỹ thuật, 2026-11-03** (đánh giá của dev mobile, đối chiếu mã ở `main` `c4aa1c8`). Chưa có số liệu người dùng và chưa chạy trên thiết bị thật; các nhận định về hành vi native là **giả thuyết cần đo**. Chưa được người dùng duyệt. Không phải quyết định D-xx.

Bốn hạn chế đã biết ở CLAUDE.md ("Hạn chế đã biết còn mở"), Q-24a, Q-24b. Mục này xếp thứ tự ưu tiên.

## 1. Đối chiếu tài liệu với mã

| Hạn chế | Mã thực tế |
|---|---|
| Video mất khi app bị kill | Đúng. `expo-camera` tự đặt tên tệp trong thư mục tạm và `recordAsync` chỉ trả đường dẫn khi dừng. Kill lúc đang ghi thì mã không biết tệp ở đâu, đặt `unrecoverable`. Mã cố ý không quét thư mục tạm để đoán (`recording-controller.ts`, `recoverInterruptedRecordings`; bất biến 5). |
| Chưa có tải nền | Đúng. `app.json` không có `UIBackgroundModes`, foreground service hay WorkManager; `package.json` không có thư viện tác vụ nền. |
| Tải lại từ đầu mỗi lần thử | Đúng. `src/platform/resumable-upload.ts` mở phiên GCS rồi PUT nguyên tệp. Tên "resumable" dễ gây hiểu nhầm: client chưa hỏi offset hay dùng `Content-Range`. Video tối đa 1,9 GB (`recording-policy.ts`). |
| Dữ liệu chỉ trên máy tạo ra nó | Đúng. `src/api/firebase/remote-documents.ts` chỉ đọc theo ID cho bước đăng, không có luồng kéo danh sách về. |
| Chưa đồng bộ hai chiều | Đúng. |
| Chú thích lỗi thời | `src/platform/camera-recorder.tsx` vẫn ghi "ghi KHÔNG tiếng (`mute`), `microphonePermission: false`", trong khi `app.json` đã có quyền micro (commit O-09). Cần đối chiếu và sửa. |

## 2. Bảng ưu tiên

Tiêu chí: tác động nếu xảy ra (mất bằng chứng là mất đúng giá trị sản phẩm) → khả năng xảy ra với người dùng thật → chi phí.

| # | Hạng mục | Tác động | Khả năng xảy ra | Chi phí | Ưu tiên |
|---|---|---|---|---|---|
| 0 | Đo G-4 (kill khi đang quay) trên iOS và Android thật | Quyết định hạng mục 3 | Chắc chắn cần | Thấp (vài giờ, cần máy thật) | **P0** |
| 1 | Tải tiếp được (`Content-Range`, khối 8–16 MB, lưu URI phiên) | Cao | Cao (mạng chập chờn, video lớn) | Trung bình | **P0** |
| 3 | Video mất khi bị kill | Rất cao | Thấp đến trung bình (chưa đo) | Thấp nếu giảm thiểu; cao nếu viết module native | **P0 đo, P1 làm** |
| 4 | Khôi phục một chiều trên máy mới | Cao | Thấp mỗi người dùng nhưng chắc chắn xảy ra với một số người | Trung bình | **P1** |
| 2 | Tải nền thật (iOS `NSURLSession` background, Android WorkManager + foreground service) | Trung bình | Cao | Cao (hai nền tảng, native, khai báo store) | **P2** |
| 5 | Đồng bộ hai chiều đầy đủ | Thấp cho v1 | Chỉ khi có nhiều thành viên (O-03) | Rất cao | **P3** |

## 3. Lý do chính

- **Tải tiếp được (P0).** Giá trị trên chi phí cao nhất. Mỗi lần lỗi gửi lại từ đầu thì người dùng 4G thấy tệp kẹt "Đang tải lên". Cũng là nền cho tải nền sau này. Cần xác minh `expo-file-system` 58 có API đọc khối tệp phù hợp không; nếu không thì cần module native nhỏ. Phiên GCS sống khoảng một tuần: xử lý hết hạn bằng cách mở phiên mới. Khối là bội số 256 KiB.
- **Đo G-4 (P0).** Chưa có số đo thì chưa nên chọn giữa "chấp nhận và cảnh báo" với "viết module native" (chênh nhau hàng tuần công). Giả thuyết cần kiểm: iOS (`AVCaptureMovieFileOutput` ghi theo đoạn) có thể giữ tệp phát được; Android (CameraX, MP4 chuẩn) nhiều khả năng hỏng.
- **Giảm thiểu kill (rẻ):** chặn quay khi pin hoặc dung lượng quá thấp (kiểm `src/platform/device-condition.ts` xem hiện chặn hay chỉ cảnh báo), giữ sáng màn hình (đã có), cân nhắc giảm bitrate trên máy yếu. Cách bền: module ghi MP4 phân đoạn (iOS `AVAssetWriter` + `movieFragmentInterval`; Android Media3 `FragmentedMp4Muxer`).
- **Khôi phục một chiều (P1).** Phần đẩy lên đã có; thêm phần kéo `shops/{id}/orders|lines|packages|sessions|evidence` về SQLite, chỉ đọc, bản từ máy chủ không bị bản cục bộ ghi đè. Tệp video xem qua `getEvidenceReadUrl` (V1-29), không cần tải về. Phải tôn trọng "một máy một tài khoản" (V1-07) và không tạo tệp mồ côi cần tải lại. Chỉ cứu được phần đã lên máy chủ nên đứng sau hạng mục 1.
- **Tải nền (P2).** Lợi ích lớn nhưng đắt nhất; hệ điều hành vẫn có thể hoãn nên không hứa gì. Sau khi có tải tiếp được, phần hở còn lại giảm bằng giao diện (nhắc ở màn hoàn tất, thông báo cục bộ "còn N tệp chưa tải").
- **Hai chiều (P3).** Bằng chứng chỉ thêm vào nên ít xung đột; chỉ đơn và ghi chú tranh chấp sửa được (mới nhất thắng, có lịch sử). Giữ SQLite là nguồn sự thật, không bật persistence offline của Firestore song song.

## 4. Thứ tự đề xuất

1. G-4 đo kill (song song với bước 2).
2. Tải tiếp được.
3. Giảm thiểu kill rẻ; sửa chú thích `mute` lỗi thời.
4. Quyết định module native dựa trên số đo G-4.
5. Khôi phục một chiều.
6. Tải nền (v1.1).
7. Đồng bộ hai chiều (khi có thành viên).

## 5. Điều kiện và cảnh báo

- Xếp hạng chưa dựa trên số liệu người dùng. Nếu nhóm mục tiêu phần lớn là Android đời thấp, hạng mục 3 có thể lên P0 để làm.
- Giữ ngôn ngữ trung thực (bất biến 11): không hứa tải nền luôn hoàn tất; mã băm chỉ chứng minh tệp không đổi từ lúc tính.
- Cờ ghi video (`EXPO_PUBLIC_RECORDER_ENABLED`) vẫn tắt ở production đến khi cổng thiết bị G đạt (V1-21).
- Mọi thay đổi ở đây cần người dùng duyệt trước khi thành quyết định (Q-xx) hoặc PR V1-xx.
