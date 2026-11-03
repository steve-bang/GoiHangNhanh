# Kế hoạch #0: Đo G-4 "kill khi đang quay" trên iOS và Android thật

> **Đề xuất kỹ thuật, 2026-11-03**, thuộc [reliability-priorities.md](reliability-priorities.md). Đã được người dùng duyệt kế hoạch; chưa đo trên thiết bị.

## Context

`recoverInterruptedRecordings` (`src/features/packing/domain/recording-controller.ts:555`) hiện coi mọi video đang ghi mà app bị kill là `unrecoverable`: `expo-camera` tự đặt tên tệp tạm nên app không biết tệp ở đâu, và mã cố ý không quét thư mục tạm để đoán (bất biến 5). Chưa ai biết **tệp tạm sau kill có phát được không**, trên iOS và Android. Kết quả quyết định hạng mục 3 ([reliability-priorities.md](reliability-priorities.md)): chấp nhận và cảnh báo, giảm thiểu rẻ, hay viết module ghi MP4 phân đoạn (tốn hàng tuần). Đo trước khi cam kết. Đây là mục con của G-4 trong `release-checklist.md`; kết quả ghi vào `docs/engineering/testing.md` và ADR-020.

## Giả thuyết cần kiểm

- H1 (iOS): `expo-camera` dùng `AVCaptureMovieFileOutput` ghi MP4 theo đoạn (khoảng 10 giây) → tệp tạm sau kill vẫn phát được đến đoạn cuối đã ghi.
- H2 (Android): CameraX ghi MP4 chuẩn, phần `moov` ghi lúc dừng → tệp sau kill thường hỏng.
- H3: kiểu kill khác nhau cho kết quả khác nhau (vuốt tắt, hệ điều hành giết vì thiếu bộ nhớ, tắt nguồn/hết pin).

## Phạm vi

Chỉ đo và ghi kết quả. **Không** đổi hành vi app, không thêm quét thư mục tạm vào luồng phục hồi chính thức (đó là quyết định sau khi có số đo).

## Điều kiện và thiết bị (theo ma trận ở checklist)

- iOS: 1 iPhone đời cũ ở sàn D-2 + 1 iPhone mới. Android: 1 tầm thấp (RAM ≤ 4 GB) + 1 phổ biến tại VN (Samsung/Xiaomi/OPPO).
- Bản `staging` (ghi video bật, Firebase dev). Cần S-1…S-3 trước (tài khoản EAS, build staging đầu tiên, kèm S-3b Crashlytics). **Đây là điều kiện chặn**: chưa có build thì chưa đo được.
- Một người cầm máy; công cụ: cáp, `adb` (Android), Xcode/Finder để kéo container (iOS).

## Bước thực hiện

1. **Bản đo có công cụ chẩn đoán.** Bản `staging` kiểu release không cho `adb run-as` hay đọc container. Hai lựa chọn, đề xuất chọn (a):
   - (a) Thêm màn chẩn đoán chỉ bật qua cờ build (chỉ staging, không có ở production): liệt kê tệp video trong thư mục tạm/cache của app (tên, kích thước, thời điểm sửa), mở thử bằng `expo-video` để báo "phát được/lỗi", ghi kết quả. Không gửi dữ liệu đi đâu.
   - (b) Dùng dev build (debuggable) cho các lần đo, kéo tệp qua `adb run-as` / Xcode container. Nhanh hơn để làm nhưng đo trên bản không giống staging (mã debug, bộ nhớ khác).
2. **Kịch bản kill (mỗi kịch bản chạy trên từng máy, ít nhất 3 lần, thời lượng quay 60 giây và 5 phút):**
   - K1 Vuốt tắt app trong trình chuyển app khi đang quay.
   - K2 Android: `adb shell am force-stop <package>`; iOS: dừng từ Xcode (nếu dùng dev build).
   - K3 Thiếu bộ nhớ: mở nhiều app nặng/camera khác khi đang quay đến khi hệ điều hành giết app (ghi nhận có/không xảy ra).
   - K4 Rút pin/tắt nguồn cưỡng bức giữa lúc quay (nếu máy cho phép an toàn) hoặc pin cạn.
   - K5 Kill ngay sau khi bấm Dừng, lúc đang chuyển tệp vào thư mục bền (`persistRecording`) hoặc đang băm.
3. **Với mỗi lần kill**, ghi: máy, hệ điều hành, thời lượng đã quay trước kill, có tệp trong thư mục tạm không, kích thước, phát được không, thời lượng phát được, mất bao nhiêu giây cuối so với đã quay (dùng đồng hồ), cách hiện trạng thái trong app sau mở lại (phiên `interrupted`, tệp `unrecoverable`/`RECOVERY_FOUND_FILE`).
4. **Kiểm chứng nhánh phục hồi hiện có** (`RecordingRecovery.tsx`): tệp đã lưu bền theo ID (`evidence/<id>.<đuôi>`) mà chưa kịp băm/vào hàng đợi có được cứu đúng, không tự nhận đầy đủ không (phiên luôn `interrupted`).
5. **Kéo tệp về máy tính** để phát bằng trình phát ngoài và `ffprobe` (kiểm `moov`, thời lượng) để xác nhận kết luận "phát được" không chỉ dựa vào `expo-video`.
6. **Ghi kết quả** vào `docs/engineering/testing.md` (bảng thiết bị × kịch bản) và cập nhật G-4 trong `release-checklist.md`; quyết định hạng mục 3 theo ngưỡng dưới đây.

## Ngưỡng quyết định (đề xuất, cần người dùng duyệt)

| Kết quả đo | Hành động hạng mục 3 |
|---|---|
| Cả hai nền tảng: tệp sau kill phát được, mất tối đa ~10 giây cuối | Không cần module native. Thêm nhánh phục hồi cứu tệp tạm (ghi đường dẫn tạm vào SQLite lúc bắt đầu nếu lấy được); phiên vẫn `interrupted`. |
| iOS phát được, Android hỏng | Chỉ Android cần xử lý: giảm thiểu (chặn quay khi pin/dung lượng thấp, foreground service) hoặc module Media3 fragmented MP4. Chọn theo tần suất kill đo được. |
| Cả hai hỏng | Cân nhắc module ghi phân đoạn cả hai; hoặc giữ cảnh báo Q-24b + giảm thiểu rồi hoãn sau v1. |
| Kết quả không ổn định | Đo thêm trên nhiều máy trước khi quyết. |

## Việc cần mã (nếu chọn 1a), ước lượng nhỏ

- Màn/mục chẩn đoán sau cờ build staging, nằm trong lớp `platform` (đọc thư mục tạm qua `expo-file-system`), UI tối thiểu trong khu dev; không thêm chuỗi hướng người dùng cuối (đặt ở khu dev hoặc dùng i18n như quy ước).
- Test đơn vị cho hàm liệt kê/lọc tệp video; không cần test thiết bị tự động.
- Không đụng `recording-controller.ts`, `UploadRunner`, Rules, Functions.

## Rủi ro

- Phụ thuộc S-1…S-3b (build staging chưa từng chạy; iOS `useFrameworks: "dynamic"` chưa từng build) → có thể trễ.
- Máy ít, kết quả không đại diện; ghi rõ ràng giới hạn.
- Thư mục tạm có thể bị hệ điều hành dọn sau kill/khởi động lại → đo ngay sau mở lại app, rồi sau 24 giờ.
- Quyền riêng tư: chẩn đoán không gửi tệp/đường dẫn lên Crashlytics (tuân `crash-safe.ts`).

## Kiểm chứng kế hoạch hoàn thành

- Bảng kết quả ≥ 4 máy × K1…K5 có trong `testing.md`, kèm kết luận theo bảng ngưỡng.
- `ffprobe` xác nhận mỗi kết luận "phát được".
- Cập nhật `reliability-priorities.md` (hạng mục 0 xong; hạng mục 3 có quyết định) và G-4 trong `release-checklist.md`.
- `npm run check` pass nếu có thêm mã chẩn đoán.
