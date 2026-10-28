# Ảnh render tab Đơn hàng (giao diện mới, PR1 + PR2 + PR3 + PR4)

**Lưu ý trung thực:** đây là ảnh render **bản web (react-native-web) trong Chromium**, **không phải ảnh chụp trên iOS/Android thật**. Font (Inter của trình duyệt, không phải SF/Roboto), vòng focus (khung đen quanh ô nhập là vòng focus của trình duyệt), bóng, vùng an toàn, thanh điều hướng hệ thống, bàn phím, chữ lớn (Dynamic Type/font scale) trên thiết bị thật có thể khác. **Chưa chụp ở chữ lớn.** Chưa kiểm chứng trên thiết bị.

## Cách chụp (không có trong repo)

Làm trong bản sao ngoài repo (không commit): nhánh `claude/orders-tab-ui-pr4` (gồm PR1 + PR3 + PR4) merge thêm `claude/orders-tab-ui-pr2` (chi tiết + bằng chứng; xung đột tài liệu và `screens.json` giải quyết tạm bằng cách gộp khóa), cài `react-native-web` + `@expo/metro-runtime` bằng `npm i --no-save`, `EXPO_PUBLIC_USE_FAKE_BACKEND=1 EXPO_PUBLIC_FAKE_SESSION=signed_in npx expo export --platform web`, phục vụ tĩnh và chụp bằng Playwright (deviceScaleFactor 2, ảnh gốc 720x1600 / 780x1688 / 640x1136). Thay đổi tạm chỉ có ở bản sao: (1) kho đơn bộ nhớ **nạp bảy đơn mẫu theo từng shop** (tham số `?seed=1`) và cờ ép lỗi/chờ đọc (`window.__shots`) để chụp trạng thái lỗi/đang tải; (2) `minWidth: 0` cho ô nhập của `SearchField` (xem lỗi web bên dưới). **Dữ liệu mẫu chỉ để chụp** (mã DH-10239…10245, mã vận đơn SPX0123456789 dùng chung hai đơn, hai đơn cùng mã DH-10245 khác nguồn, một đơn có phiên đang thực hiện, một đơn chưa khai báo sản phẩm, ba đơn nhiều nguồn); không có trong app/repo. Màn quét: **web không có camera** nên chụp trạng thái "cần dùng camera" + nhập thủ công, không phải khung quét thật.

## Danh sách ảnh (`<pr>-<mã UI>-<trạng thái>-<WxH>.png`; 360x800 và 390x844, thêm 320x568 ở các ảnh ghi chú)

| Nhóm | Ảnh (tiền tố) | Kích thước |
|---|---|---|
| PR1 UI-E01 | `pr1-UI-E01-list-data` (7 đơn, đủ nguồn) | 320, 360, 390 |
| | `pr1-UI-E01-list-empty` | 320, 360, 390 |
| | `pr1-UI-E01-list-loading`, `-list-error`, `-list-noresults`, `-list-search-typed` | 360, 390 |
| | `pr1-UI-E01-list-filter-sheet` | 320, 360, 390 |
| PR2 UI-E02 | `pr2-UI-E02-detail-multiline` (1 dòng), `-detail-multiline-3lines` (3 dòng, 320 cũng có), `-detail-undeclared`, `-detail-active-session` | 360, 390 |
| PR2 UI-E03 | `pr2-UI-E03-evidence-empty` (CTA Quay đóng gói) | 320, 360, 390 |
| PR3 UI-B02 | `pr3-UI-B02-scan-web-nocamera` (hộp xin quyền, web không camera), `-scan-permission-dismissed` (đóng hộp: khung "cần camera" + nhập thủ công + mẹo), `-scan-manual-sheet` | 360, 390 (nocamera và permission-dismissed có 320) |
| PR3 OrderMatchSheet | `pr3-OrderMatchSheet-one`, `-none`, `-many-ordercode` (320 cũng có), `-many-tracking`, `-error` | 360, 390 |
| PR3 UI-B03 | `pr3-UI-B03-search-recent` (320 cũng có), `-search-results`, `-search-empty`, `-search-error`, `-search-many-enter` | 360, 390 |
| PR4 UI-B04 | `pr4-UI-B04-form-empty`, `-form-validation-error`, `-form-filled-2lines`, `-confirm-step`, `-duplicate-sheet-ordercode` (cùng 320 ở form-empty và validation-error) | 320/360/390 |
| | `pr4-UI-B04-form-prefilled-code`, `-source-picker`, `-confirm-save-error`, `-duplicate-sheet-tracking`, `-leave-dialog` | 360, 390 |
| Tham chiếu | `mockup-*.png`: các khung cắt từ mockup `ab7b1e7b-image.png` (01, 02-03-04, 05-06, 07, 09-10, 13, 14-16), phóng 2x | |

**Không chụp được / chưa chụp:** camera quét thật (web không có), trạng thái "Đang ghi/Đang tải lên/Đã đồng bộ/Lỗi" ở UI-E03 (chưa có dữ liệu thật; chỉ có ở test), nhiều trạng thái ngoại tuyến (banner `useIsOffline` là khung tạm), chữ lớn, thiết bị thật, nửa dưới của chi tiết đơn (màn cuộn; ảnh chỉ cắt khung nhìn, phần Bằng chứng/Lịch sử nằm dưới).

## So với mockup: giống / lệch

| Khung | Giống | Lệch (ghi trung thực; xem `docs/engineering/decisions.md` Q-22) |
|---|---|---|
| 01 Danh sách | Tiêu đề; ô tìm + nút xanh *Tạo đơn*; chip; thẻ có logo nguồn bên trái, mã đơn đậm, nhãn trạng thái bên phải | Chip chỉ *Tất cả*/*Chưa có video* (mockup có *Chưa quay*/*Có bằng chứng*); không dòng "Đơn gần đây ⌄ / Lọc + Sắp xếp" (chưa có sắp xếp, Q-22h); nhãn luôn *Chưa có video* (mockup "Đã đồng bộ/Đang tải lên/Chưa có bằng chứng": chưa có dữ liệu thật); thẻ có nút *Quay ngay* và giờ ở chân thẻ (mockup giờ ở góc trên phải, không nút); thanh tab 5 mục (D-16), mockup 4 mục |
| 02 Tìm | Ô tìm có nút quét, "Tìm kiếm gần đây" + "Xóa tất cả", "Kết quả tìm kiếm" | Không nhãn "Dùng đơn" (Q-22aa, bất biến 5); kết quả có thêm nhãn bằng chứng, ngày tạo; không ảnh sản phẩm; lịch sử có nút x từng mục |
| 03 Quét | Header "Quét mã đơn hàng" + trợ giúp, nút *Nhập mã thủ công* + đèn pin tròn cùng hàng | Chỉ là khung "cần camera" trên web (không có khung 4 góc/nền camera); khối "Mẹo nhỏ" vẫn còn (mockup không có); đèn pin ẩn khi không có camera |
| 04 Kết quả quét | Dấu hiệu đã tìm thấy, thẻ đơn tóm tắt, *Xem chi tiết đơn* | Ô icon tông thương hiệu (không dấu tick xanh "đã xác minh"); không menu "Trường hợp khác" cố định: mỗi nhánh (không thấy, nhiều đơn trùng) là một hộp riêng khi dữ liệu rơi vào nhánh đó |
| 05 Tạo đơn nhanh | Mã đơn, hàng *Nguồn bán hàng* có chevron, sản phẩm, phân loại, số lượng, nút *Tiếp tục*, *Hủy* ở header | Không dấu * ở mã/nguồn/sản phẩm/số lượng; sản phẩm không bắt buộc (bất biến 10); nguồn mặc định *Khác* (câu "Chọn nguồn bán hàng nhé." không xảy ra); không ô *Ghi chú*; có nhiều dòng sản phẩm, gợi ý, mã vận đơn tùy chọn; số lượng là ô liền hai nút, không rộng hết hàng |
| 06 Xác nhận | Mã đơn, nguồn, danh sách sản phẩm, nút *Quay lại chỉnh sửa* + *Tạo đơn hàng* | Hai nút xếp dọc (mockup cạnh nhau); không ảnh sản phẩm, không *Shop*, *Ghi chú*, giá; có mã vận đơn + dòng "Thông tin do bạn nhập, không lấy từ sàn." |
| 07 Chi tiết | Mã đơn + nút sao chép, nguồn, sản phẩm/variant/SL, nhóm nút Quay đóng gói + Xem bằng chứng | Không *Shop ABC*, "Cập nhật", giá, "2 ảnh · 1 video"/"Đã đồng bộ" (không dữ liệu thật); không nút *Tiếp nhận hàng hoàn* (Q-22o); thêm khối Kiện hàng, Lịch sử; chưa có nút ⋯ |
| 09 Lọc và sắp xếp | Có bộ lọc theo nguồn, thời gian | Là bottom sheet chip (mockup là trang chọn thả xuống); không *Trạng thái bằng chứng/Trạng thái đơn/Sắp xếp* (chưa có dữ liệu/hợp đồng kho) |
| 10 Nguồn bán | Danh sách bốn nguồn có logo, dấu chọn | Là bottom sheet; không dòng "Nhập tên nguồn" (Order chưa có trường) và không nút *Tiếp tục* (chọn là đóng) |
| 13 Bằng chứng | Tiêu đề "Bằng chứng của đơn", mã đơn, hai nhóm Đóng gói/Hàng hoàn có số, nút *Quay đóng gói* | Chỉ có nhánh trống (chưa có tệp bằng chứng); mockup có thumbnail video/ảnh và nhãn trạng thái |
| 14/16 Trống, lỗi, trùng | Trống có icon tròn + CTA; lỗi dạng thẻ + *Thử lại* | Không có *Xóa đơn* (Q-22d); trùng mã dùng hộp *Đơn này đã có* + *Xem đơn hiện có* (chạm hàng) + *Vẫn tạo đơn mới* + *Quay lại chỉnh sửa* |

## Lỗi hiển thị / điểm cần xem khi nhìn ảnh

1. **Lỗi bố cục thật trên web, nên kiểm trên thiết bị:** ô tìm dùng `TextInput` `flex: 1` không có `minWidth: 0`; trên web nút quét ở cuối ô bị đẩy ra ngoài (không thấy) cho tới khi thêm `minWidth: 0` (đã thêm tạm trong bản sao, **chưa có trong repo**). Native có thể không bị, chưa kiểm chứng.
2. **Placeholder ô tìm bị cắt** ở danh sách UI-E01: "Tìm mã đơn, mã…" (360) và "Tìm mã đơ…" (320) vì hàng chung với nút *Tạo đơn*; 390 còn "Tìm mã đơn, mã vận". Mất chữ "mã vận đơn".
3. **320x568:** nhãn thanh tab bị cắt ("Trang", "Đơn", "Thông": có sẵn từ trước, không thuộc PR này); thẻ đơn và các hộp vẫn đọc được.
4. **Kết quả tìm và hộp chọn đơn trùng (360):** dòng sản phẩm một dòng nên "SL: n" và "và N sản phẩm khác" bị cắt thành "…" khi tên + variant dài (mất số lượng); mã vận đơn cũng cắt ("Mã vận đơn: G…").
5. **Hộp "Không tìm thấy đơn"/"Đơn này đã có":** hai nút *Quét hoặc nhập lại* / *Quay lại chỉnh sửa* và *Đóng* làm cùng việc (đóng hộp): thừa một nút.
6. **UI-B03 mở từ màn quét nhưng thanh tab sáng "Trang chủ"** (route nằm trong nhóm tab Trang chủ).
7. **Chi tiết đơn (ảnh ghép PR2 + PR1/3/4):** tiêu đề khối bằng chứng là "Bằng chứng đóng gói" dù PR2 đổi thành "Bằng chứng": do gộp tạm `screens.json` ưu tiên khóa của nhánh PR4 (kết quả gộp thật sự khi merge PR2 vào chuỗi PR cần kiểm lại).
8. Vòng focus đen quanh ô nhập (ảnh có ô đang focus) là của trình duyệt.
9. Chữ trên màn tạo đơn dùng nhóm `form*` nhỏ (13-14) nên ở 320 vẫn vừa nhưng chưa kiểm với chữ lớn hệ thống.
