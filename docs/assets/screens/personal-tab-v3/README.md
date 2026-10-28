# Ảnh đối chiếu PR-A: token và thành phần dùng chung (tab Cá nhân, board 07)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium), không phải ảnh chụp trên iOS/Android thật. Đây **không phải màn của app**: là một khung thử tạm (tệp route chỉ có ở bản sao ngoài repo, không commit) ghép các thành phần mới với dữ liệu minh họa để so với board. Font, vòng focus (khung đen quanh nút đầu tiên của hộp thoại là vòng focus của trình duyệt, không có trên thiết bị), bóng, vùng an toàn và chữ lớn trên thiết bị thật có thể khác. Chưa chụp ở chữ lớn (Dynamic Type/font scale), chưa chạy trên thiết bị.

| Ảnh | Nội dung |
| --- | --- |
| `pr-a-components-390x844.png` | Năm khung 390x844 ghép ngang: (1-3) cuộn khung thử: `HeroCard` kèm huy hiệu, sáu tông `IconTile`, ba `MetricTile` xếp dọc + một dạng hàng, sáu `StatusCard` (đang tải 70%, đã xác minh, lưu trên máy, đám mây, sắp hết hạn, lỗi), hai `Checkbox` (chọn, viền đỏ), `TextField` có bộ đếm và ô nhiều dòng, `ErrorState variant="card"`, `EmptyState` có/không nút; (4) `ConfirmDialog` có icon, hai nút dọc; (5) `ConfirmDialog` có icon, hai nút cạnh nhau |
| `pr-a-board-reference-crops.png` | Khung tương ứng cắt từ board 07 (phóng 2x): 4a, 7b, 1c, 1d và dải trạng thái khung 21 |

**Ảnh chưa chụp lại sau đợt sửa review:** không có trình duyệt/khung thử trong môi trường này. Hai thay đổi nhìn thấy được (nếu có): glyph `cloud`/`document`/`person`/`play`/`warning-solid` đã bỏ khỏi bảng icon (ô `MetricTile` trong ảnh có thể đang dùng icon này), và `HeroCard` thêm `badgeLabel` (chỉ ảnh hưởng trợ năng, không đổi hình). Cần chụp lại khi dựng màn dùng `MetricTile` (PR-F).

## Khác biệt so với board (ghi trung thực)

- **Hero:** nền phẳng `brand.deep`, không chuyển sắc (Q-21a). Huy hiệu là `StatusBadge` tông success (chữ xanh trên nền xanh nhạt), gần với chip xanh sáng của board.
- **Hộp thoại:** icon nằm trong ô tròn nền nhạt (`IconTile`), board vẽ biểu tượng đặc không nền. Glyph là Ionicons gần nghĩa (board là túi/máy quay có dấu tích). Nút phụ ở hàng cạnh nhau có viền xanh, board là nền xám-teal nhạt không viền.
- **Ngoại tuyến:** glyph `unlink-outline`; board vẽ dây/ổ cắm bị ngắt (không có glyph giống hệt).
- **Thẻ trạng thái:** icon trong ô tròn nền nhạt (board: vòng viền); viền thẻ `border.default` như `Card` (board viền mint nhạt; Q-21g đã sửa cho khớp mã: `border.default`, vì `border.field` đậm hơn và sẽ đổi tông mọi thẻ khác). Nhãn mặc định là nhãn chuẩn docs/09 ("Đã xác minh", "Đã lưu trên máy"), không phải "Đã đồng bộ"/"Lưu trên thiết bị" của board, để không nói mạnh hơn trạng thái thật. Thẻ "Đang quay video" (nền hồng, chấm đỏ, đồng hồ) **chưa dựng**: không phải trạng thái bằng chứng và màu đỏ chấm quay chỉ là ngoại lệ D-18 của riêng chấm ghi hình; chờ quyết định khi dựng màn quay. "Đã hết thời hạn lưu" dùng tông `danger`, "Lưu trên đám mây" dùng tông xanh dương.
- **Ô số liệu:** không có chấm cam ở ô "Đang chờ đồng bộ".
- **Hộp kiểm:** viền chưa chọn dùng `text.secondary` (>= 3:1), không dùng `border.default` (~1.5:1) như bảng token đề xuất.
- **Bộ đếm** đếm theo độ dài thật (D22), không phải "20/50" của board.
