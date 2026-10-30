# Kế hoạch PR V1-20 store-listing-docs (chỉ tài liệu)

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.1, 1.2, 3.3 V1-20, 7.1 (k), 7.5; [release-checklist.md](../release-checklist.md).

## Mục tiêu

Soạn sẵn mọi nội dung con người sẽ dán vào App Store Connect và Google Play Console cho bản v1.0, trung thực theo bất biến 11 và khớp hành vi thật của app (hoặc hành vi theo kế hoạch của PR V1-xx chưa hợp nhất, có ghi rõ).

## Tệp

| Tệp | Nội dung |
|---|---|
| `docs/store/listing.md` (mới) | Tên, phụ đề, mô tả ngắn/dài, từ khóa (đếm byte), danh mục, phân loại độ tuổi, URL, giá/khu vực, danh sách ảnh chụp theo cỡ bắt buộc |
| `docs/store/privacy-declarations.md` (mới) | Apple App Privacy, Google Play Data safety theo từng loại dữ liệu; mục "không thu thập"; Privacy Manifest iOS (required reason API); việc phải đối chiếu trước khi điền |
| `docs/store/review-notes.md` (mới) | Ghi chú cho người duyệt Apple (tiếng Anh, < 4000 byte) và Google App access; mã vạch mẫu; quyền; xóa tài khoản; không mua trong app |
| `docs/engineering/release-checklist.md` | F-9, S-7, C-4, P-2, P-3 trỏ tới các tệp mới; thêm S-8 (báo cáo quyền riêng tư của bản build), G-12 (ảnh tải lên không chứa GPS) |
| `docs/engineering/v1-release-plan.md` | V1-20: ghi đường dẫn mới `docs/store/` |
| `docs/engineering/decisions.md` | `#### Q-29 / V1-20 — store-listing-docs` |
| `docs/README.md` | Thêm dòng mục lục "Tài liệu nộp store" |
| `CHANGELOG.md` | Một dòng Added |

## Thiết kế nội dung

- Không viết điều app chưa làm như đã làm. Mỗi câu phụ thuộc PR chưa hợp nhất (V1-09, V1-11, V1-12, V1-14/15, V1-16, V1-17, V1-18, V1-21) có đánh dấu **[theo V1-xx]** và bảng "phải đối chiếu lại trước khi nộp".
- Không dùng tên sàn (nhãn hiệu của bên thứ ba) trong tên, phụ đề, từ khóa (App Review 2.3.7).
- Vị trí: không thu thập (chỉ xử lý trên máy). Không ghi âm. Crash/ID cài đặt chỉ khi V1-16 có trong v1.
- Giới hạn ký tự lấy từ trang Apple đọc được trực tiếp; trang Google Play Console Help bị chặn trong môi trường này: ghi rõ là chưa đọc trực tiếp, phải kiểm lại.

## Migration / Rules / mã

Không.

## Test

Không (tài liệu). Kiểm: prettier do điều phối chạy; tự đếm ký tự/byte cho tên, phụ đề, mô tả ngắn, từ khóa (ghi cách đếm).

## Ảnh

Không có thay đổi giao diện.

## Rủi ro

- Khai báo sai so với SDK thật (Firebase) -> bị từ chối hoặc khai báo không trung thực: thêm bước đối chiếu trang công bố dữ liệu chính thức của Firebase và báo cáo quyền riêng tư của Xcode (S-8).
- Nội dung phụ thuộc PR chưa hợp nhất: bảng đối chiếu.
- Tên miền/email còn giữ chỗ: App Review 2.1(a) từ chối URL giữ chỗ; ghi điều kiện D-4.

## Tự review

Vòng 1 (bất biến 1–11, rủi ro dữ liệu, kích thước):
- Bất biến 11: bản nháp mô tả có câu "lưu trữ an toàn"/"bằng chứng" có thể hiểu là bảo đảm pháp lý -> đã bỏ "an toàn", thêm câu "không bảo đảm kết quả khiếu nại" và câu mã băm.
- Bất biến 6: ảnh chụp store phải từ app thật với dữ liệu demo tự tạo, không ghép ảnh/không dùng bản web cổng giả -> đã ghi.
- Kế hoạch gốc đặt một tệp `docs/engineering/store-listing.md`; yêu cầu điều phối là ba tệp `docs/store/` -> theo yêu cầu điều phối, cập nhật tham chiếu.
- Khai "Device ID" và "Crash" không gắn danh tính có thể bị coi là khai thiếu -> ghi phương án dự phòng (khai "gắn") nếu trang Firebase hoặc pháp lý yêu cầu.
- Kích thước: chỉ tài liệu, ba tệp mới + sửa nhỏ.

Tự review: đã chấp nhận. Điểm đã sửa: bỏ từ "an toàn", bỏ tên sàn khỏi từ khóa, tách ghi chú duyệt sang tiếng Anh để vừa 4000 byte, thêm S-8/G-12.
