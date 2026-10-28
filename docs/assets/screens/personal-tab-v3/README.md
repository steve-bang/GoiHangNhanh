> **Cập nhật sau khi ẩn Gói dịch vụ (Q-21ag):** màn chính tab Cá nhân đã bỏ thẻ gói và mục menu "Gói dịch vụ". Các ảnh màn chính `pr-b-*`, `pr-c-*` (nếu có thẻ gói) và ảnh Gói dịch vụ `pr-e-*` là **bản lỗi thời** so với màn hiện tại (khung E vẫn là mã đã giữ, chỉ vào được bằng URL). **Chưa chụp lại màn chính mới:** môi trường làm việc không có Chromium/Playwright (không tải được trình duyệt), nên chưa có ảnh bản web của màn mới; cần chụp lại khi có môi trường (gồm `pr-g-13-*`, nay còn ba công tắc), theo cách ghi ở các mục dưới (bản sao ngoài repo, không sửa mã sản phẩm).

# Ảnh đối chiếu PR-A: token và thành phần dùng chung (tab Cá nhân, board 07)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium), không phải ảnh chụp trên iOS/Android thật. Đây **không phải màn của app**: là một khung thử tạm (tệp route chỉ có ở bản sao ngoài repo, không commit) ghép các thành phần mới với dữ liệu minh họa để so với board. Font, vòng focus (khung đen quanh nút đầu tiên của hộp thoại là vòng focus của trình duyệt, không có trên thiết bị), bóng, vùng an toàn và chữ lớn trên thiết bị thật có thể khác. Chưa chụp ở chữ lớn (Dynamic Type/font scale), chưa chạy trên thiết bị.

| Ảnh | Nội dung |
| --- | --- |
| `pr-a-components-390x844.png` | Năm khung 390x844 ghép ngang: (1-3) cuộn khung thử: `HeroCard` kèm huy hiệu, sáu tông `IconTile`, ba `MetricTile` xếp dọc + một dạng hàng, sáu `StatusCard` (đang tải 70%, đã xác minh, lưu trên máy, đám mây, sắp hết hạn, lỗi), hai `Checkbox` (chọn, viền đỏ), `TextField` có bộ đếm và ô nhiều dòng, `ErrorState variant="card"`, `EmptyState` có/không nút; (4) `ConfirmDialog` có icon, hai nút dọc; (5) `ConfirmDialog` có icon, hai nút cạnh nhau |
| `pr-a-board-reference-crops.png` | Khung tương ứng cắt từ board 07 (phóng 2x): 4a, 7b, 1c, 1d và dải trạng thái khung 21 |

**Ảnh `pr-b-1b..1e` đã chụp lại ở PR-F** (khung chờ/lỗi/ngoại tuyến/chưa có họ tên theo mã hiện tại). Bản sao ngoài repo có thêm tham số tạm `?state=loading|error|offline|noname` (cổng giả và `useIsOffline`), KHÔNG commit.

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

Ảnh `pr-b-1a-*` (4 ảnh) đã **chụp lại ở PR-C** với dòng "Chưa có số liệu" dưới nhãn ba ô bằng chứng (cổng giả có họ tên "Trần Văn Minh", cửa hàng "Shop Thời Trang" như board). Khung 1b khác ảnh ở trợ năng (mỗi thẻ một phần tử "Đang tải"), hình không đổi; ảnh 1b-1e chưa chụp lại.

---

# Ảnh đối chiếu PR-C: Sửa họ tên, Đổi mật khẩu, hộp thoại Đăng xuất (khung 2, 3, 4a-4c)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**. Chụp ở 320x568, 360x800, 390x844 (hệ số 2); **chưa chụp ở chữ lớn (font scale)**. Để chụp được các nhánh, bản sao ngoài repo có các thay đổi tạm KHÔNG commit: cổng giả đọc `?method=apple|google|password` (loại đăng nhập, họ tên "Trần Văn Minh", cửa hàng "Shop Thời Trang"), kho bộ nhớ đọc `?recording=1` (đang quay) và `?unsynced=3` (3 tệp chưa đồng bộ; trong app thật số này hôm nay luôn 0 và chưa có phiên đang ghi). Cách chụp như PR-B (export web trên bản sao ngoài repo có `react-native-web@0.21.4`, phục vụ tĩnh, Playwright + Chromium). Font, bàn phím và vòng focus của trình duyệt khác thiết bị thật.

| Ảnh | Nội dung |
| --- | --- |
| `pr-c-2-edit-name-{320x568,360x800,390x844}.png` | Khung 2: đã nhập "Trần Văn Minh", Lưu ngay dưới ô |
| `pr-c-2-edit-name-empty-*.png` | Ô trống (nút Lưu tắt vì chưa khác giá trị đã lưu) |
| `pr-c-3-password-*.png` | Khung 3: form ban đầu (tài khoản mật khẩu) |
| `pr-c-3-password-errors-*.png` | Bấm Lưu khi chưa nhập: lỗi tại từng ô, mật khẩu mới 3 ký tự |
| `pr-c-3-apple-*.png`, `pr-c-3-google-*.png` | Tài khoản Apple/Google: thẻ giải thích THAY form |
| `pr-c-4a-signout-confirm-*.png` | Khung 4a |
| `pr-c-4b-signout-recording-*.png` | Khung 4b (đang quay) |
| `pr-c-4c-signout-unsynced-*.png` | Khung 4c (còn 3 tệp chưa đồng bộ) |
| `pr-c-board-reference-2-4.png` | Khung 2, 3, 4a, 4b, 4c cắt từ board 07 |
| `pr-c-compare-board-vs-app-390.png` | Hàng trên: board; hàng dưới: app 390x844, cùng cột = cùng khung (3 là nhánh mật khẩu; thẻ Apple/Google ở ảnh riêng) |

## Checklist "giống design"

| Hạng mục | 2 | 3 | 4a | 4b | 4c | Ghi chú lệch |
| --- | --- | --- | --- | --- | --- | --- |
| Bố cục và thứ tự khối | đạt | lệch có chủ đích | đạt | đạt | đạt | khung 3: thẻ Apple/Google thay form (D18, Q-21s) |
| Thứ bậc chữ | đạt | đạt | đạt | đạt | đạt | |
| Màu thẻ/nền | đạt | gần (thẻ dùng `brand.soft`, board xanh nhạt hơn) | đạt | đạt | đạt | |
| Icon | - | đạt (mắt) | gần | gần | gần | icon hộp thoại trong ô tròn nền nhạt (Ionicons gần nghĩa, board là biểu tượng đặc) |
| Khoảng cách | gần | gần | gần | gần | gần | hộp thoại lề 24dp, board ~12dp (Q-21r) |
| Nút | đạt (Lưu dưới ô) | đạt | đạt (chính + viền đỏ) | đạt (một nút) | đạt (chính + phụ viền) | phụ 4c viền xanh đậm hơn board |
| Header | đạt | đạt | - | - | - | tiêu đề lệch trái, mũi tên trái |
| Thanh tab | ẩn (đạt) | ẩn (đạt) | hiện dưới lớp tối | như 4a | như 4a | board không vẽ thanh tab dưới lớp tối |
| Trạng thái | đạt | đạt (lỗi tại ô, Apple/Google, tải, lỗi tải) | đạt | đạt | đạt | |
| Chuỗi chữ | đạt (không có ô email) | lệch: "Tối thiểu 8 ký tự" (không "chữ và số", D29); thẻ nêu đúng Apple hoặc Google | đạt + dòng phụ về dữ liệu trên máy | đạt ("Hãy" thay "Vui lòng") | lệch: nêu số tệp thật và "Hãy đồng bộ xong rồi đăng xuất" | xem mục 6.3 của plan |


---

# Ảnh đối chiếu PR-D: Cửa hàng (khung 5, 6, 7a-7c)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**; 320x568, 360x800, 390x844 (hệ số 2); **chưa chụp ở chữ lớn**. Bản sao ngoài repo (không thêm phụ thuộc vào repo) có thay đổi tạm KHÔNG commit: cổng giả đọc `?shops=4|7` (Shop Thời Trang đang dùng, Mỹ Phẩm, Gia Dụng, Phụ Kiện bị khóa, thêm ba shop khi `7`), kho bộ nhớ đọc `?recording=1` và `?unsynced=3`. Tên "Shop Thời Trang" là dữ liệu giả lập. Thanh tab ở khung 5 vẫn hiện (xem lệch bên dưới).

| Ảnh | Nội dung |
| --- | --- |
| `pr-d-5-shop-settings-*.png` | Khung 5, tài khoản có từ hai cửa hàng (có hàng Chuyển cửa hàng) |
| `pr-d-5-shop-settings-single-*.png` | Khung 5, một cửa hàng (không có hàng Chuyển cửa hàng) |
| `pr-d-6-edit-name-*.png`, `-pristine-*`, `-error-*` | Khung 6: đã sửa (Lưu bật, 19/50); chưa sửa (Lưu tắt); 55 ký tự (báo lỗi tại ô) |
| `pr-d-7a-switch-list-*.png`, `-initial-*` | Khung 7a: đã chọn Shop Mỹ Phẩm (dấu tích phải, "Xác nhận" bật); chưa chọn (nút tắt) |
| `pr-d-7a-switch-search-*.png`, `-search-all-*` | 7a với 7 cửa hàng: ô tìm (đã gõ "do choi"; chưa gõ) |
| `pr-d-7b-switch-confirm-*.png` | Khung 7b |
| `pr-d-7c-switch-recording-*.png` | Khung 7c (đang quay) |
| `pr-d-7x-switch-unsynced-*.png` | Cảnh báo còn 3 tệp chưa đồng bộ (không có trong board; giữ theo Q-20o) |
| `pr-d-board-reference-5-7.png` | Khung 5, 6, 7a, 7b, 7c cắt từ board 07 |
| `pr-d-compare-board-vs-app-390.png` | Hàng trên board, hàng dưới app 390x844, cùng cột = cùng khung |

## Checklist "giống design"

| Hạng mục | 5 | 6 | 7a | 7b | 7c | Ghi chú lệch |
| --- | --- | --- | --- | --- | --- | --- |
| Bố cục và thứ tự khối | đạt | đạt | đạt | đạt | đạt | khung 5 không có dòng ID |
| Thứ bậc chữ | đạt | đạt | đạt | đạt | đạt | |
| Màu thẻ/nền | đạt | đạt | gần | đạt | đạt | Bị khóa dùng tông cảnh báo, không đỏ |
| Icon | gần | - | gần | gần | gần | Ionicons gần nghĩa; icon 7c không đỏ, không có khóa trên camera |
| Khoảng cách | gần | gần | gần | gần | gần | quy về token |
| Nút | đạt | đạt | đạt | đạt | gần | nút phụ có viền (board nền nhạt không viền); nút vô hiệu 7c dạng viền mờ |
| Header | đạt | đạt | đạt | - | - | |
| Thanh tab | lệch có chủ đích (hiện) | ẩn (đạt) | ẩn (đạt) | dưới lớp tối | như 7b | Q-21t |
| Trạng thái | đạt | đạt (đã sửa, chưa sửa, lỗi) | đạt (chưa chọn, đã chọn, tìm, không khớp) | đạt | đạt | |
| Chuỗi chữ | lệch | lệch | lệch | lệch | lệch | xem mục 6.4 của plan |

---

# Ảnh đối chiếu PR-E: Gói dịch vụ, Chi tiết gói, Lịch sử thanh toán (khung 8, 9, 10)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**; 320x568, 360x800, 390x844 (hệ số 2). Ba màn là nội dung tĩnh (chưa có dữ liệu gói), nên không cần dữ liệu minh họa. Bản sao ngoài repo (không thêm phụ thuộc vào repo) có hai thay đổi tạm KHÔNG commit: `Text` nhân cỡ chữ theo `?fs=1.6` (chỉ để chụp chữ lớn; icon không phóng theo), và cổng giả đọc `?named=1` như các PR trước.

| Ảnh | Nội dung |
| --- | --- |
| `pr-e-8-plan-{320x568,360x800,390x844}.png` | Khung 8 Gói dịch vụ |
| `pr-e-9-plan-detail-*.png` | Khung 9 Chi tiết gói |
| `pr-e-10-payment-history-*.png` | Khung 10 Lịch sử thanh toán |
| `pr-e-{8-plan,9-plan-detail,10-payment-history}-largetext-320x568.png` | Chữ lớn (1.6 lần) ở 320x568 |
| `pr-e-1a-main-with-plan-*.png` | Màn Cá nhân với thẻ gói đã mở được (huy hiệu "Sắp có", có mũi tên) |
| `pr-e-board-reference-8-10.png` | Khung 8, 9, 10 cắt từ board 07 |
| `pr-e-compare-board-vs-app-390.png` | Hàng trên board, hàng dưới app 390x844, cùng cột = cùng khung |

## Checklist "giống design"

| Hạng mục | 8 | 9 | 10 | Ghi chú lệch |
| --- | --- | --- | --- | --- |
| Bố cục và thứ tự khối | đạt | gần | đạt | khung 9: thẻ mint bao cả quyền lợi và thời hạn; thêm hàng "Lịch sử thanh toán" |
| Thứ bậc chữ | đạt | đạt | đạt | |
| Màu thẻ/nền | đạt | đạt (mint `brand.soft`) | đạt | |
| Icon | gần | gần | gần | dấu tích Ionicons; ô icon `clipboard` tông trung tính; hóa đơn `receipt` không có mắt |
| Khoảng cách | gần | gần | gần | quy về token; không đường kẻ ngăn |
| Nút | gần | gần | - | "Nâng cấp gói" vô hiệu (board bật) + dòng "Sắp có" |
| Header | đạt | đạt | đạt | mũi tên trái, tiêu đề lệch trái |
| Thanh tab | hiện (Q-21t) | ẩn | ẩn | |
| Trạng thái | đạt | đạt | đạt | chưa có dữ liệu gói nên chưa dựng hết hạn/sắp hết hạn |
| Chuỗi chữ | lệch có chủ đích | lệch có chủ đích | lệch | không "Gói tiêu chuẩn", "Đang hoạt động", "Hỗ trợ 24/7", "Xem tất cả"; xem mục 6.5 của plan |

**Ảnh `pr-e-8*`, `pr-e-9*` đã chụp lại ở PR-F** (tiêu đề "Chính sách lưu trữ dự kiến").

# Ảnh đối chiếu PR-F: Dữ liệu bằng chứng, Thời hạn lưu (khung 11, 12) và dải trạng thái (khung 21)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**; 320x568, 360x800, 390x844 (hệ số 2) và chữ lớn 1.6 lần ở 320x568 (bản sao ngoài repo nhân cỡ chữ của `Text`; icon không phóng theo). Hai màn là nội dung tĩnh (chưa có tệp bằng chứng, chưa có dữ liệu gói). Bản sao ngoài repo (không thêm phụ thuộc) có thay đổi tạm KHÔNG commit: `?named=1`, `?fs=1.6`, `?state=...`. Khung 21 KHÔNG có ảnh app: không có màn tương ứng (xem plan mục 6.6).

| Ảnh | Nội dung |
| --- | --- |
| `pr-f-11-evidence-data-{320x568,360x800,390x844}.png` | Khung 11 Dữ liệu bằng chứng |
| `pr-f-12-retention-*.png` | Khung 12 Thời hạn lưu |
| `pr-f-{11-evidence-data,12-retention}-largetext-320x568.png` | Chữ lớn (1.6 lần) |
| `pr-f-1a-main-with-evidence-link-*.png` | Màn Cá nhân: tiêu đề khối "Dữ liệu bằng chứng" có "›" |
| `pr-f-board-reference-11-12-21.png`, `pr-f-board-reference-21-strip.png` | Khung 11, 12 và dải khung 21 cắt từ board 07 |
| `pr-f-compare-board-vs-app-390.png` | Hàng trên board, hàng dưới app 390x844 |

## Checklist "giống design"

| Hạng mục | 11 | 12 | Ghi chú lệch |
| --- | --- | --- | --- |
| Bố cục và thứ tự khối | gần | đạt | khung 11 thêm đoạn giải thích ba mục và hàng "Thời hạn lưu" (lối vào khung 12) |
| Thứ bậc chữ | đạt | đạt | |
| Màu thẻ/nền | gần | gần | khung 11: ba hàng trong một nhóm có đường kẻ (board: hàng có đường kẻ); khung 12: thẻ ghi chú nền trắng viền, icon xanh dương (không có tông thẻ xanh dương nhạt) |
| Icon | gần | gần | chấm cam đặc của board thay bằng ô icon tông cảnh báo; icon từng hàng chọn theo nghĩa |
| Nút | đạt | - | "Xem trung tâm đồng bộ" |
| Header | đạt | đạt | khung 11 đúng "Dữ liệu bằng chứng" (board đặt tiêu đề khung "Quản lý dữ liệu bằng chứng") |
| Thanh tab | ẩn | ẩn | route con `hideTabBar` |
| Chữ lớn | đạt | đạt | hàng thời hạn xuống dòng, giá trị rớt xuống dưới nhãn |
| Chuỗi chữ | lệch có chủ đích | lệch có chủ đích | "Chưa có số liệu"/"Chưa có thông tin" thay số; không "Gói tiêu chuẩn"; ghi chú khung 12 đổi câu (D19) |


**Ảnh `pr-f-12-*` đã chụp lại ở PR-G** với câu ghi chú mới theo D19 ("Theo chính sách dự kiến...").

# Ảnh đối chiếu PR-G: Cài đặt thông báo (khung 13) và Quyền riêng tư và bảo mật (khung 14)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**; 320x568, 360x800, 390x844 (hệ số 2) và chữ lớn 1.6 lần ở 320x568 (bản sao ngoài repo nhân cỡ chữ của `Text`; icon không phóng theo). Bản sao ngoài repo có tham số URL tạm (`state=savefail|loaderror|loading`, `method=google`, `fs=`) KHÔNG commit. Công tắc ở ảnh là cổng giả trong bộ nhớ.

**Chưa chụp lại ảnh `pr-g-13-*`:** sau khi đổi tiêu đề thẻ thành "Thông báo đẩy" kèm nhãn "Sắp có" (trước đó "Thông báo đẩy: sắp có", báo "sắp có" hai lần), môi trường làm việc không có Chromium/Playwright nên ảnh `pr-g-13-*` còn hiện tiêu đề cũ. Cần chụp lại theo cách ở trên khi có trình duyệt.

| Ảnh | Nội dung |
| --- | --- |
| `pr-g-13-notifications-{320x568,360x800,390x844}.png`, `...-largetext-320x568.png` | Khung 13: thẻ "Thông báo đẩy" kèm nhãn "Sắp có" + bốn công tắc (mặc định cổng giả). **Lỗi thời:** màn hiện tại chỉ còn ba công tắc ("Gói sắp hết hạn" ẩn theo cờ `plan`, Q-21ag); chưa chụp lại vì môi trường không có trình duyệt |
| `pr-g-13-save-error-*.png` | Bấm "Đồng bộ dữ liệu" khi cổng báo lỗi lưu: công tắc hoàn về Tắt, thẻ cảnh báo "Chưa lưu được cài đặt. Bạn thử lại nhé." |
| `pr-g-13-load-error-*.png` | Không tải được cài đặt (cổng chưa kết nối): thẻ lỗi + Thử lại, không công tắc |
| `pr-g-14-security-*.png`, `...-largetext-320x568.png` | Khung 14, tài khoản mật khẩu |
| `pr-g-14-security-google-*.png` | Khung 14, tài khoản Google: hàng Đổi mật khẩu chỉ là ghi chú |
| `pr-g-board-reference-13.png`, `-14.png`, `-13-14.png` | Khung 13, 14 cắt từ board 07 (phóng 4x, board độ phân giải thấp) |
| `pr-g-compare-board-vs-app-390.png` | Hàng trên board, hàng dưới app 390x844 |
| `pr-f-12-retention-*.png` | Chụp lại khung 12 (câu ghi chú D19 mới) |

## Checklist "giống design"

| Hạng mục | 13 | 14 | Ghi chú lệch |
| --- | --- | --- | --- |
| Bố cục và thứ tự khối | lệch có chủ đích | gần | 13: thẻ "Thông báo đẩy" kèm nhãn "Sắp có" ở ĐẦU (board: thẻ cam quyền bị từ chối ở cuối, không dựng vì chưa có adapter đọc quyền); ba công tắc hiển thị (board năm; bản chụp khung 13 còn bốn, lỗi thời, Q-21ag). 14: nhóm một thẻ có đường kẻ (board: mỗi hàng một thẻ); "Xóa tài khoản" tách nhóm riêng |
| Thứ bậc chữ | đạt | đạt | tiêu đề 14 xuống dòng ở 390px (chữ lớn hơn board) |
| Màu thẻ/nền | gần | gần | không thẻ cam; hàng khóa mờ |
| Icon | gần | gần | glyph Ionicons gần nghĩa, duyệt ở ảnh PR; "Xóa tài khoản" icon cảnh báo (board: thùng rác) |
| Nút | - | - | không nút "Mở Cài đặt" (không có thẻ quyền) |
| Header | đạt | đạt | mũi tên trái, tiêu đề lệch trái |
| Thanh tab | hiện | hiện | route gốc UI-I04/UI-I05 (Q-21t); Đổi mật khẩu (route con) ẩn |
| Trạng thái | đạt | đạt | 13: tải, lỗi tải, lỗi lưu, đang lưu (công tắc khóa); 14: tải/lỗi hồ sơ, tài khoản Apple/Google |
| Chữ lớn | đạt | đạt | nhãn và huy hiệu "Sắp có" xuống dòng |
| Chuỗi chữ | lệch có chủ đích | lệch có chủ đích | 13: bỏ "Tài khoản", "Cập nhật sản phẩm"; "Thời hạn lưu" -> "Dung lượng sắp đầy"/"Gói sắp hết hạn", thêm "Tải lên lỗi hoặc cần xử lý" (docs/09). 14: "Xác nhận 2 lớp" + "Sắp có" (board "Xác thực 2 lớp: Chưa bật"); mọi hàng chưa làm "Sắp có"; xem mục 6.7 của plan |

---

# Ảnh đối chiếu PR-H: Trợ giúp, bài hướng dẫn, liên hệ hỗ trợ, điều khoản (khung 15-18)

**Lưu ý trung thực:** ảnh render **bản web** (react-native-web trong Chromium) của màn thật trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**; 320x568, 360x800, 390x844 (hệ số 2) và chữ lớn (hệ số 1.6, chỉ 320x568, mô phỏng bằng tham số tạm). Bản sao ngoài repo (`react-native-web`, không đổi `package.json`) có sửa tạm KHÔNG commit: tham số URL `fs` (chữ lớn), `noname=1` (hồ sơ chưa có họ tên), `mail=1` (**giả lập** địa chỉ hỗ trợ để thấy nút Soạn email hỗ trợ ở trạng thái mở; trong app thật hôm nay luôn khóa), cổng giả có họ tên "Trần Văn Minh". Ảnh `pr-g-13-notifications-*` đã chụp lại theo mã hiện tại.

| Ảnh | Nội dung |
| --- | --- |
| `pr-h-15-help-center-*`, `...-largetext-320x568` | Khung 15: ô tìm, Danh mục (3, không "Cập nhật sản phẩm"), Bài viết đề xuất, lối Liên hệ/Điều khoản |
| `pr-h-15-search-results-*`, `pr-h-15-search-empty-*` | Tìm "video chua dong bo" (có kết quả); "thanh toan visa" (rỗng, có lối Liên hệ hỗ trợ) |
| `pr-h-15-category-*` | Danh sách bài của một danh mục (board không vẽ) |
| `pr-h-16-article-*`, `...-largetext-320x568`, `pr-h-16-article-no-video-*`, `pr-h-16-article-faq-*` | Khung 16: bài có "Tiếp theo"; bài quay (nói chưa ghi video, bài cuối nên không "Tiếp theo"); bài hỏi đáp (không phần các bước) |
| `pr-h-17-contact-locked-*`, `...-largetext-320x568` | Khung 17 thật hôm nay: thẻ "chưa gửi được", nút khóa |
| `pr-h-17-contact-simulated-errors-*`, `pr-h-17-contact-simulated-filled-*` | **Giả lập có địa chỉ**: lỗi từng ô khi bấm nút; đã điền |
| `pr-h-18-legal-*`, `...-largetext-320x568` | Khung 18: hai hàng khóa "Sắp có" kèm thẻ giải thích |
| `pr-h-board-reference-15-18.png`, `pr-h-compare-board-vs-app-390.png` | Khung 15-18 cắt từ board; hàng trên board, hàng dưới app 390x844 (15, 16, 17 thật, 18) |

## Checklist "giống design"

| Hạng mục | 15 | 16 | 17 | 18 | Ghi chú lệch |
| --- | --- | --- | --- | --- | --- |
| Bố cục và thứ tự khối | gần | lệch có chủ đích | lệch có chủ đích | gần | 15: thêm nhóm "Cần thêm trợ giúp?" (lối vào 17, 18); 16: không ảnh/nút phát (D26); 17: thẻ chưa có kênh, bỏ SĐT, thêm Chủ đề và Mã đơn (D14); 18: 2 hàng thay 4 |
| Thứ bậc chữ | đạt | đạt | đạt | đạt | |
| Màu thẻ/nền | gần | đạt | gần | gần | hàng khóa mờ; thẻ cảnh báo màu cam nhạt |
| Icon | gần | - | - | gần | Ionicons gần nghĩa |
| Nút | - | đạt | lệch có chủ đích | - | 16: "Tiếp theo" ghim đáy; 17: "Soạn email hỗ trợ" khóa (board "Gửi yêu cầu") |
| Header | đạt | đạt (tên danh mục) | đạt | đạt | |
| Thanh tab | hiện | ẩn | ẩn | ẩn | 15 là route gốc UI-I06; còn lại route con |
| Trạng thái | đạt | đạt | đạt | đạt | 15: có/không kết quả; 16: bài lạ; 17: khóa, lỗi ô, lỗi mở email; 18: khóa |
| Chữ lớn | đạt | đạt | đạt | đạt | xuống dòng, không cắt |
| Chuỗi chữ | lệch có chủ đích | lệch có chủ đích | lệch có chủ đích | lệch có chủ đích | bài viết do dev viết tạm; "Soạn email hỗ trợ"; "Chính sách quyền riêng tư"; bỏ "đổi trả", "dữ liệu" |

---

# Ảnh đối chiếu PR-I: Xóa tài khoản (khung 20)

**Lưu ý trung thực:** PR-I **chưa có ảnh bản web của màn thật**. Môi trường làm việc không có Chromium/Playwright (tải trình duyệt thất bại, cùng tình trạng ghi ở PR-G), nên chưa chụp 320x568, 360x800, 390x844, chữ lớn, các trạng thái điều kiện (đang kiểm tra, đang quay, còn tệp, là chủ cửa hàng, đọc lỗi), và chưa chụp lại `pr-g-13-save-error`/`pr-g-13-load-error`. Cần chụp theo cách của các mục trên (bản sao ngoài repo có `react-native-web`; không thêm phụ thuộc vào repo; không sửa mã sản phẩm) khi có trình duyệt. Hành vi hiện được kiểm bằng test cấu trúc (`DeleteAccountScreen.test.tsx`), không phải bằng mắt.

| Ảnh | Nội dung |
| --- | --- |
| `pr-i-board-reference-20.png` | Khung 20 cắt từ board 07 (phóng 4x, board độ phân giải thấp) |

## Checklist "giống design" (theo mã, chưa đối chiếu bằng ảnh)

| Hạng mục | 20 | Ghi chú lệch |
| --- | --- | --- |
| Bố cục và thứ tự khối | gần | icon, tiêu đề, câu dẫn, Điều kiện, hộp kiểm, nút đỏ như board; thêm khối "Dữ liệu sẽ ra sao", dòng "Sắp có", nút "Giữ tài khoản của tôi" |
| Icon | gần | cảnh báo trong vòng tròn nền nhạt (board: dấu chấm than đặc); trạng thái điều kiện là icon + chữ |
| Nút | lệch có chủ đích | nút đỏ LUÔN KHÓA (board bật); hộp kiểm không mở khóa |
| Điều kiện | lệch có chủ đích | bốn mục thật; tranh chấp "Chưa kiểm tra được"; bỏ "Đã đăng xuất khỏi tất cả thiết bị" |
| Header, thanh tab | đạt, ẩn | route con |
| Chuỗi chữ | lệch có chủ đích | "Xóa tài khoản?" và câu dẫn theo BA; không "xóa vĩnh viễn/không thể khôi phục" |
| Chữ lớn, 320/360/390 | chưa chụp | |
