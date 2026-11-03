# Ảnh trạng thái "đang tải" và đổi tên màn tải lên (V1-31)

**Lưu ý trung thực:** đây là ảnh render **bản web (react-native-web, Chromium, 390x844 @2x, cổng giả)**, **không phải ảnh iOS/Android thật**. Vòng quay, font, bóng, vùng an toàn, "giảm chuyển động" của hệ điều hành trên thiết bị có thể khác. Chưa kiểm chứng trên thiết bị.

## Cách chụp

`node scripts/screens/capture.cjs` với nhánh nháp cục bộ không đưa vào repo; thay đổi tạm: kho đơn và kho tệp bộ nhớ nạp đơn mẫu giả (DH-10231…) với tệp ở các trạng thái đang tải, chờ, lỗi, đã tải lên, đã xác minh khi URL có `?seed=normal|uploading|mixed`. Thư mục `before/` chụp cùng dữ liệu mẫu trên `main` (trước thay đổi). Dữ liệu mẫu chỉ để chụp.

## Danh sách ảnh (sau thay đổi)

| Ảnh | Nội dung |
|---|---|
| `01-home-uploading` | Trang chủ: chỉ có tệp đang tải, khối "Đang tải lên" có vòng quay |
| `02-home-error-and-uploading` | Trang chủ: có lỗi + đang tải, giữ tiêu đề "Bằng chứng cần theo dõi" |
| `03-home-normal` | Trang chủ: không còn việc đang chạy, không hiện khối |
| `04-upload-screen-uploading` | Màn "Tải lên" (trước: "Đồng bộ"), bộ lọc Đang tải, dòng có vòng quay |
| `05-upload-screen-error` | Bộ lọc Lỗi |
| `06-upload-screen-waiting` | Bộ lọc Chờ tải (không vòng quay) |
| `08-account-evidence-data` | Tab Cá nhân: nút "Xem tiến độ tải lên" |
| `09-notifications-empty` | Tab Thông báo: "Lỗi tải lên xem ở màn Tải lên" |
| `before/*` | Cùng màn trên `main` (tiêu đề "Mở trung tâm đồng bộ", nhãn không có vòng quay) |

Không có ảnh Chi tiết lỗi tải lên (UI-F02): đường dẫn chi tiết cần mã việc thật mà dữ liệu mẫu chưa dựng đúng, ảnh chụp ra là trạng thái "Tệp này không còn cần xử lý" nên bị bỏ.

## Nhận xét khi nhìn ảnh

1. Ở `01`, tiêu đề khối "Đang tải lên" và nhãn "Đang tải lên" bên dưới **lặp chữ**; có thể đổi tiêu đề (ví dụ "Video đang tải") hoặc bỏ tiêu đề khi chỉ có một nhóm. Chưa sửa, chờ ý kiến.
2. Dải bộ lọc ở `04-06` bị cắt ở "Đã tải lên" (cuộn ngang, có sẵn từ trước).
3. Thẻ Trang chủ "Dữ liệu nằm trên máy này" ở các ảnh Trang chủ là **câu cũ**: câu mới nằm ở PR khôi phục dữ liệu (#97), chưa hợp nhất vào nhánh này.
4. Câu chữ mới chờ BA duyệt (C-1).
