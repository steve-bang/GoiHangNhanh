# Kế hoạch #0: Đo G-4 "kill khi đang quay" trên iOS và Android thật

> **Đề xuất kỹ thuật, 2026-11-03** (bản 2, sau khi đọc mã `expo-camera` 58.0.12), thuộc [reliability-priorities.md](reliability-priorities.md). Người dùng đã duyệt hướng này; chưa đo trên thiết bị, chưa viết mã.

## 1. Bối cảnh

`recoverInterruptedRecordings` (`src/features/packing/domain/recording-controller.ts`) coi video đang ghi mà app bị kill là `unrecoverable`, với lý do app không biết tên tệp tạm do `expo-camera` đặt và không được đoán (bất biến 5). Chưa ai biết tệp tạm sau kill **có phát được không**. Kết quả quyết định hạng mục 3 trong `reliability-priorities.md`.

## 2. Đã xác minh khi đọc mã và tài liệu (bản 2)

| Nền tảng | Phát hiện | Nguồn |
|---|---|---|
| iOS | `AVCaptureMovieFileOutput` ghi `.mov` (không phải `.mp4`) vào `cache/Camera/` | `node_modules/expo-camera/ios/Current/CameraVideoRecording.swift` |
| iOS | Mã không đặt `movieFragmentInterval` nên dùng mặc định 10 giây; Apple nêu phim ghi dở phát được đến đoạn cuối đã ghi | Tài liệu Apple `movieFragmentInterval` |
| Android | CameraX `Recorder` + `FileOutputOptions` ghi `Camera*.mp4` vào cache. CameraX ghi MP4 chuẩn, không có tuỳ chọn ghi theo đoạn (**hiểu biết, chưa có nguồn xác nhận**) | `.../android/.../ExpoCameraView.kt:354` |
| Cả hai | Thư mục tạm **biết trước** (`cache/Camera/`), chỉ tên tệp không biết | như trên |

Giả thuyết còn lại cần đo trên máy thật: **H1** iOS sau kill vẫn phát được, mất tối đa ~10 giây cuối; **H2** Android sau kill thường hỏng; **H3** kiểu kill khác nhau cho kết quả khác nhau.

## 3. Cách đo: dev build, không thêm màn hình chẩn đoán

Cách MP4/MOV được ghi **không phụ thuộc** bản debug hay release, nên dev build đủ để đo; không cần màn hình chẩn đoán trong bản staging (bỏ phương án (a) của bản 1) và không cần chờ build EAS `staging` (S-1…S-3b).

- **Android:** quay, kill, rồi `adb shell run-as <package> ls cache/Camera` và kéo tệp (`run-as ... cat` hoặc `adb exec-out`).
- **iOS:** Xcode → Window → Devices and Simulators → chọn app → Download Container; xem `AppData/Library/Caches/Camera/`.
- Kéo về máy tính, kiểm bằng trình phát ngoài và `ffprobe` (có `moov` không, thời lượng).
- Thiết bị theo ma trận ở `release-checklist.md`: iPhone đời cũ ở sàn D-2 + iPhone mới; Android RAM ≤ 4 GB + Android phổ biến tại VN.

## 4. Kịch bản kill (mỗi máy, ít nhất 3 lần, quay 60 giây và 5 phút)

| ID | Kịch bản | Lưu ý |
|---|---|---|
| K1 | Vuốt tắt app khi đang quay | iOS: app xuống nền trước, mã V1-11 dừng và lưu có chủ đích; ghi nhận hành vi thật |
| K2 | Android: `adb shell am force-stop <package>`; iOS: dừng từ Xcode | |
| K3 | Thiếu bộ nhớ: mở app nặng, đo xem hệ điều hành có giết app không | Ghi nhận có/không xảy ra |
| K4 | **Mất nguồn**: pin cạn hoặc tắt cưỡng bức | Kịch bản thực tế đáng lo nhất khi app ở foreground |
| K5 | Kill ngay sau Dừng, lúc đang chuyển tệp vào thư mục bền hoặc băm | Kiểm nhánh phục hồi hiện có |

Ghi cho mỗi lần: máy, hệ điều hành, thời lượng đã quay, có tệp tạm không, kích thước, phát được không, thời lượng phát được, mất bao nhiêu giây cuối, trạng thái trong app sau khi mở lại (`interrupted`, `unrecoverable`, `RECOVERY_FOUND_FILE`). Đo ngay sau mở lại app và đo lại sau 24 giờ (hệ điều hành có thể dọn cache).

## 5. Việc rẻ làm song song (không phụ thuộc số đo)

1. **Nhịp tim phiên:** cập nhật `last_alive_at` vào SQLite mỗi vài giây khi đang quay (cần migration v17 hoặc cột trên bảng phiên/tệp). Sau kill, app biết đã quay đến giây nào và ghi trung thực "bị ngắt khoảng mm:ss", kể cả khi tệp hỏng. Không thay đổi trạng thái tệp; không tuyên bố đủ video.
2. **Pin thấp:** `runPrecheck` (`precheck.ts`) **đã chặn** khi pin ≤ `MIN_BATTERY_LEVEL` (10%, giá trị tạm, `recording-policy.ts:83`) và không cắm sạc. Việc còn lại là **đo mức hợp lý** trên máy thật (mất nguồn thường xảy ra trước khi đồng hồ pin về 0) và cân nhắc cảnh báo mềm ở mức cao hơn (ví dụ 20%) trong lúc đang quay. Cần BA duyệt câu chữ.
3. Sửa hai tài liệu cũ nói "iOS có thể giữ tệp" như giả thuyết chưa có cơ sở (xong ở bản này).

## 6. Phục hồi tệp tạm bằng so sánh thư mục (quyết định SAU khi có số đo)

Nếu số đo cho thấy tệp sau kill còn dùng được:

- Khi bắt đầu quay, lưu danh sách tệp trong `cache/Camera/` vào SQLite (cùng bản ghi phiên/tệp).
- Sau kill, đếm tệp mới so với danh sách đã lưu: đúng **một** tệp mới thì gán cho phiên đang `recording`; nhiều hơn một hoặc không có thì không gán, vẫn `unrecoverable`.
- Phiên **luôn** `interrupted`; không bao giờ coi là video đủ; không dựng video giả (bất biến 6).
- Chạm bất biến 5 ("không tự liên kết"): đây là suy luận xác định (một phiên quay tại một thời điểm) nhưng **cần người dùng duyệt** và ghi vào `decisions.md` trước khi làm.

## 7. Nếu Android hỏng (quyết định SAU khi có số đo)

| Hướng | Ưu | Nhược |
|---|---|---|
| Quay theo đoạn: dừng và quay lại mỗi 1–2 phút, mỗi đoạn là một tệp bằng chứng của cùng phiên | Mô hình dữ liệu đã cho nhiều tệp cho một phiên; chuẩn ngành (app xã hội, dashcam); không cần module native | Có khoảng hở ngắn giữa các đoạn → phải ghi trung thực "có hở"; đụng luồng quay và UI |
| Module native Media3 `FragmentedMp4Muxer` | Một tệp liền, mất tối đa vài giây cuối | Tốn hàng tuần; chưa xác nhận hành vi khi kill |
| Giữ cảnh báo Q-24b + giảm thiểu | Rẻ | Mất cả đoạn đang quay khi kill |
| Foreground service loại camera (Android) | Giữ tiến trình khi chuyển app, cuộc gọi | Khai báo quyền và Play Console; không chống được mất nguồn |

## 8. Ngưỡng quyết định

| Kết quả đo | Hành động hạng mục 3 |
|---|---|
| Cả hai phát được, mất tối đa ~10 giây cuối | Làm mục 6 (cứu tệp), không cần module native |
| iOS phát được, Android hỏng | Mục 6 cho iOS; Android chọn ở mục 7 theo tần suất kill đo được |
| Cả hai hỏng | Mục 7 cho cả hai, hoặc giữ cảnh báo và hoãn sau v1 |
| Không ổn định | Đo thêm trên nhiều máy trước khi quyết |

## 9. Rủi ro

- Máy ít, kết quả không đại diện: ghi rõ giới hạn.
- iOS kill bằng vuốt tắt thật ra là "xuống nền rồi bị dừng"; không tái hiện được kill đột ngột như mất nguồn. Cần K4.
- Nhận định về CameraX không ghi theo đoạn chưa có nguồn: bước đo Android là bằng chứng quyết định.
- Quyền riêng tư: kéo tệp quay thử về máy tính chỉ dùng video thử, không dùng dữ liệu thật.

## 10. Hoàn thành khi

- Bảng ≥ 4 máy × K1…K5 trong `testing.md`, kèm kết luận theo mục 8; cập nhật G-4 trong `release-checklist.md`.
- `ffprobe` xác nhận từng kết luận "phát được".
- Cập nhật `reliability-priorities.md` (hạng mục 0 xong, hạng mục 3 có quyết định).
- Nếu làm mục 5.1 hoặc 6: `npm run check` pass, có migration và test.
