# Ảnh thẻ khôi phục dữ liệu (V1-30, PR #97)

**Lưu ý trung thực:** đây là ảnh render **bản web (react-native-web, Chromium, 390x844 @2x, cổng giả)**, **không phải ảnh iOS/Android thật**. Font, bóng, vùng an toàn, chữ lớn trên thiết bị có thể khác. Chưa kiểm chứng trên thiết bị; chưa chạy với Firestore thật.

## Cách chụp

`node scripts/screens/capture.cjs` với nhánh nháp cục bộ không đưa vào repo. Thay đổi tạm chỉ có ở nhánh nháp: (1) kho đơn/tệp bộ nhớ nạp ba đơn mẫu giả (mã DH-10231…) khi URL có `?seed=normal`; (2) ép trạng thái khôi phục khi URL có `?restore=running|running0|waiting|failed|done` (không chạy khôi phục thật vì cổng giả không có Firestore). Dữ liệu mẫu chỉ để chụp.

## Danh sách ảnh

| Ảnh | Trạng thái |
|---|---|
| `01-home-restoring` | Trang chủ: đang lấy lại, đã về 12 đơn (vòng quay) |
| `02-orders-restoring-with-data` | Tab Đơn hàng: đang lấy lại, đã có đơn |
| `03-orders-empty-restoring` | Máy trống: thẻ + "Đang lấy lại đơn hàng của bạn" thay "Chưa có đơn hàng nào" |
| `04-home-waiting-network` | Chờ có mạng, tự tiếp tục (không nút) |
| `05-home-failed-retry` | Lỗi, có nút "Thử lại" |
| `06-home-done` | "Đã lấy lại 34 đơn hàng" (tự ẩn sau 6 giây) |

## Lỗi phát hiện khi chụp (đã sửa trong PR này)

- Nút "Thử lại" dính vào dòng chữ phía trên (thẻ không có khoảng cách giữa các khối): đã thêm khoảng cách.
- Trạng thái lỗi dùng biểu tượng mây tải lên, dễ hiểu nhầm là đang tải: đổi sang biểu tượng cảnh báo.

## Nhận xét còn lại

- Câu chữ mới chờ BA duyệt (C-1).
- Thẻ "Đã lấy lại N đơn hàng" ở ảnh 06 chụp với dữ liệu giả; số liệu thật phụ thuộc Firestore.
