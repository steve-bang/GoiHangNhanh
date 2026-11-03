# Live Evidence Watermark: đánh giá hiện trạng và thứ tự làm

Ngày: 2026-11-03. Đối chiếu bản đặc tả "Live Evidence Watermark" (v1.0, do người dùng cung cấp) với app trên `main`. Đây là **đề xuất, chờ người dùng duyệt**; chưa phải quyết định D-xx hay Q-xx. Chỉ đọc nhanh các điểm chính, chưa đọc sâu từng module.

## 1. Spec và app hiện tại

| Hạng mục trong spec | Hiện trạng | Mức khớp |
|---|---|---|
| Video gốc bất biến, trạng thái tệp tách riêng, hash SHA-256, xác minh phía server | Có đủ (bất biến 3, 4; `file-state.ts`, `verifyEvidence`) | Khớp, chưa kiểm chứng trên thiết bị |
| Session ID và kiện tạo trước khi quay, mã đơn lấy từ phiên | Có (`recording-controller.ts`) | Khớp |
| Hàng đợi tải lên bền, trạng thái từng tệp, Sync Center, phục hồi sau kill | Có | Khớp |
| Gián đoạn camera hoặc vào nền thì đánh dấu `interrupted` | Có (V1-11) | Khớp |
| Mất mạng thì lưu cục bộ rồi tải sau | Có, dùng trạng thái mạng thật | Khớp |
| Kiểm toán, trigger `audit*Write`, Rules cô lập theo shop | Có | Khớp |
| **GPS khi quay đóng gói** | Chưa có. `platform/location.ts` có sẵn nhưng chỉ dùng cho **ảnh hàng hoàn** (timeout 3 giây, lưu 1 lần, không gửi lên máy chủ) | Lệch |
| **Watermark preview khi quay** | Chưa có | Thiếu |
| **Bản video burned-in watermark** | Chưa có. Không có thư viện xử lý video nào trong `package.json` | Thiếu, phần lớn nhất |
| Video thứ hai làm tài sản riêng, tải lên riêng | Chưa. Mô hình hiện tại: 1 phiên ứng với 1 video | Thiếu |
| `locationEvents`, `processingJobs` | Chưa | Thiếu |
| Phát hiện giờ thiết bị sai (LW-E11), giờ server nhận file | Chưa rõ, cần kiểm tra thêm | Chưa rõ |

## 2. Chỗ spec xung đột với quyết định đã chốt

1. **Quyền riêng tư và store.** `docs/09` UI-A05 ghi "không xin vị trí". `docs/store/` khai báo vị trí là "không thu thập" (điều kiện là mã không gửi vị trí). Nếu watermark ghi GPS lên video và video được tải lên thì phải sửa App Privacy / Data safety (liên quan G-12). Đây là quyết định của người dùng.
2. **Spec yêu cầu "giữ audio"**, trong khi O-09 hiện chọn quay không thu tiếng.
3. **Cấu trúc dữ liệu.** Spec dùng `organizations/{org}/shops/...`, app dùng `shops/{shopId}` với `members`. Không đổi theo spec; chỉ thêm `locationEvents` và các trường mới vào mô hình hiện tại.
4. **Mô hình tải lên.** Spec nói "Firebase Storage SDK", nhưng ADR-006 cho Storage từ chối mọi truy cập client và dùng URL ký. Giữ ADR-006.
5. **Tên thương hiệu.** Spec gọi sản phẩm là "Đơn Chứng", app là AmaBox (tên làm việc). Dòng "Powered by ..." theo quyết định D-1.
6. **Ngôn ngữ trung thực (bất biến 11).** Nhãn trên video và UI giữ tinh thần: GPS và timestamp chỉ là tín hiệu hỗ trợ, không chứng minh tính chân thực.

## 3. Thứ tự nên làm

**Làm trước (chặn mọi thứ khác):**

1. **Hoàn tất cổng thiết bị G-0…G-13 và V1-21.** Mọi native module hiện chưa chạy thật; watermark xây trên camera và hàng đợi chưa kiểm chứng thì rủi ro chồng rủi ro. Việc của con người trên thiết bị thật.
2. **Chốt các quyết định spec bắt buộc có trước khi code** (BA và người dùng): có thu thập GPS và đưa lên server không (kéo theo App Privacy / Data safety, G-12); audio có hay không (O-09); bản watermark bắt buộc hay tùy chọn; tên hiển thị "Powered by ..." (D-1).
3. **Spike xử lý video (rủi ro lớn nhất, chạy song song với mục 1).** FFmpegKit đã ngừng duy trì. Thử native Media3 (Android) và AVFoundation (iOS) qua module Expo cục bộ như `backup-exclusion`. Đo video dài và 1080p, giữ hướng và frame rate, chèn thời gian và vị trí thay đổi theo thời điểm, xử lý khi app vào nền (JS không chạy nặng được ở nền). Nếu spike không ra, phải đổi hướng Phase 1.

**Làm sau khi có quyết định (Phase 1 của spec, đã gọt cho khớp app):**

4. **GPS cho phiên đóng gói.** Tận dụng `location.ts`: xin quyền lúc bắt đầu quay (UI-LW01), 5 trạng thái, ngưỡng 100 m, cho quay khi không có GPS. Lưu `location_events` cục bộ (migration v17). Không cần video processing nên làm được sớm.
5. **Watermark preview** trên màn quay (chỉ lớp UI: giờ mỗi giây, GPS, mã đơn lấy từ phiên). Rẻ và có giá trị ngay, nhưng chưa phải burned-in.
6. **Mô hình hai tài sản mỗi phiên** (video gốc + watermark): file-state riêng, tải lên riêng, "Đã tải lên" chỉ khi đủ tài sản bắt buộc. Chạm vào Rules, `createUploadSession`, `verifyEvidence`, Sync Center.
7. **Tạo bản watermark** (module native từ spike, job có retry, phục hồi sau kill), rồi UI-LW05, LW06 (bộ chọn video gốc/watermark), LW07.

**Để sau:** App Attest, phát hiện mock location, xuất hồ sơ, ẩn tọa độ khi chia sẻ (Phase 3 của spec); đồng bộ `locationEvents` lên Firestore (chưa có đồng bộ nội dung hồ sơ).

## 4. Không cần theo spec

- Cấu trúc 12 tệp `docs/features/live-evidence-watermark/…`: gộp vào `decisions.md` và `plans/` như các PR V1.
- Đổi sang `organizations/…`, dùng Storage SDK trực tiếp từ client, hay `metadata.json` trong Storage.
- Bộ mã lỗi `LW-E01…E12`: ánh xạ vào `core/errors/codes.ts` hiện có, không tạo hệ thống mã song song.
- Trường `isMockLocation` và địa chỉ ngược từ tọa độ: bỏ ở bản đầu.

## 5. Bước tiếp theo đề xuất

Làm mục 1 và 2 ngay, mở spike cho mục 3. Nhờ `senior-ba` soạn câu hỏi chốt cho mục 2, và `senior-mobile-dev` viết kế hoạch spike xử lý video.
