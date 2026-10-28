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

---

# Ảnh đối chiếu PR-B: màn chính tab Cá nhân (UI-I01, khung 1a-1e)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật `/account` trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**. Để chụp được các trạng thái, bản sao ngoài repo có thêm hai thay đổi tạm KHÔNG commit: cổng giả đọc tham số URL (`named=1` họ tên "Trần Văn Minh" + cửa hàng "Shop Thời Trang" như board; `slow=1` chờ vô hạn; `fail=1` lỗi hồ sơ) và `useIsOffline` đọc `offline=1` (trong app thật hàm này luôn `false`, nên khung 1d chưa xảy ra trên máy). Họ tên/cửa hàng/email là dữ liệu giả lập. Font, vùng an toàn, thanh tab, font scale lớn trên thiết bị thật có thể khác; **chưa chụp ở chữ lớn**.

| Ảnh | Nội dung |
| --- | --- |
| `pr-b-1a-main-{320x568,360x800,390x844}.png`, `pr-b-1a-main-scrolled-390x844.png` | 1a: mặc định (có họ tên); bản "scrolled" cuộn xuống cuối |
| `pr-b-1b-loading-*.png` | 1b: đang tải, khung chờ theo hình mới |
| `pr-b-1c-error-*.png` | 1c: lỗi hồ sơ (thẻ lỗi trên khung chờ mờ), thẻ cửa hàng vẫn hiện |
| `pr-b-1d-offline-*.png` | 1d: ngoại tuyến và chưa có dữ liệu hồ sơ |
| `pr-b-1e-no-name-*.png` | 1e: chưa có họ tên (thay thẻ hồ sơ; phần còn lại giữ) |
| `pr-b-board-reference-1a-1e.png` | Khung 1a-1e cắt từ board 07 |
| `pr-b-compare-board-vs-app-390.png` | Hàng trên: board; hàng dưới: app 390x844, cùng cột = cùng khung |

## Checklist "giống design"

| Hạng mục | 1a | 1b | 1c | 1d | 1e | Ghi chú lệch |
| --- | --- | --- | --- | --- | --- | --- |
| Bố cục và thứ tự khối | đạt | đạt | đạt | đạt | đạt (Q-21e: giữ phần còn lại) | 1d/1e board là trống toàn màn; app giữ các khối thật bên dưới |
| Thứ bậc chữ | đạt | - | đạt | đạt | đạt | tiêu đề trạng thái trống dùng `sectionTitle` |
| Màu thẻ/nền | gần (hero phẳng, Q-21a) | đạt | đạt (nền lỗi `danger.bg`) | đạt | đạt | hero `brand.deep` không chuyển sắc |
| Icon | gần | - | đạt | gần | gần | glyph Ionicons gần nghĩa; ngắt kết nối `unlink-outline`; không chấm cam |
| Khoảng cách | gần (<= 4dp) | gần | gần | gần | gần | quy về token |
| Nút | đạt | - | đạt (nút chính) | đạt | đạt | nút phẳng |
| Header | lệch có chủ đích | như 1a | như 1a | như 1a | như 1a | không mũi tên quay lại, không icon phải (D28) |
| Trạng thái | đạt | đạt | đạt | đạt | đạt | |
| Chuỗi chữ | lệch có chủ đích | - | lệch | lệch | lệch | xem mục 6.2 của plan (huy hiệu, gói, câu lỗi, "Hãy" thay "Vui lòng") |

**Ảnh `pr-b-1a-*` chưa chụp lại sau review PR #15** (không có trình duyệt/react-native-web trong môi trường): ba ô "Dữ liệu bằng chứng" nay có thêm dòng "Chưa có số liệu" dưới nhãn; ảnh hiện còn là bản chỉ nhãn. Khung 1b khác ảnh ở trợ năng (mỗi thẻ một phần tử "Đang tải"), hình không đổi.
