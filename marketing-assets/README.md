# Tài sản marketing (bản mẫu chờ duyệt)

**Trạng thái:** mới có **2 ảnh mẫu** cho một màn đại diện (Danh sách đơn hàng, Instagram dọc). Các ảnh còn lại **chưa tạo**, chờ duyệt hướng thị giác. Chưa ảnh nào sẵn sàng đăng công khai (xem "Điều kiện trước khi đăng").

## Nguồn ảnh gốc

- Ảnh chụp từ **bản web cổng giả** của app (react-native-web, `EXPO_PUBLIC_USE_FAKE_BACKEND=1`, phiên `signed_in`), cỡ 390×844 @2x, **không dựng lại giao diện**. Đây không phải ảnh iOS/Android thật.
- Bản web xuất từ nhánh `feat/ui-polish-empty-sync` (commit `ccd15b4`, chưa merge). Màn Danh sách đơn hàng không bị nhánh đó thay đổi. Khi dựng bộ đầy đủ sẽ xuất lại từ `main`.
- **Dữ liệu mẫu** (5 đơn: `SP2611-48213`, `TT2611-90377`, `LZ2611-15520`, `SP2611-48307`, `DH-0042`, sản phẩm và mã vận đơn tự đặt) được nhập qua chính màn Tạo đơn nhanh của app. Không phải dữ liệu thật.
- Dựng lại: `node marketing-assets/_source/capture-orders.cjs <dist-web> marketing-assets/orders/original` rồi `node marketing-assets/_source/build.cjs` (cần Playwright, Inter).

## Hướng thị giác đề xuất

- Nền xanh mực `#0E2B3F` (token `slate 900` của app), chữ giấy `#FFF5F0`, nhấn cam `#FF6A45` (Bright Orange 500, tương phản trên nền ≈ 5:1), bìa carton `#D9A566` (chỉ cho miếng băng keo).
- Chữ: Inter Display đậm cho tiêu đề, Inter cho nội dung (cùng họ chữ với app).
- Một yếu tố đáng nhớ: miếng băng keo dán đầu khung máy (ảnh Showcase) và thẻ chú thích dạng tem có khuyết tròn (ảnh Feature Highlight).
- Ghi chú nhỏ "Dữ liệu mẫu. Bản đang phát triển." ở góc phải mỗi ảnh.

## Kiểm kê màn hình (Phase 1)

Nguồn: `src/core/navigation/routes.ts`. Giá trị marketing: Cao / Vừa / Thấp. "Chụp xác thực" = chụp được từ bản web mà không phải giả lập thiết bị.

| Module | Màn (mã UI, route) | Giá trị | Chụp xác thực | Ghi chú |
|---|---|---|---|---|
| Khởi đầu | Chào mừng UI-A02 `/welcome`, Đăng nhập UI-A03 `/sign-in` | Vừa | Có | Hình minh họa Chào mừng chứa logo Shopee/TikTok/Lazada; cần cân nhắc nhãn hiệu |
| Trang chủ và tạo đơn | Trang chủ UI-B01 `/home`, Tạo đơn nhanh UI-B04 `/quick-order`, Quét UI-B02 `/scan` | Cao | Trang chủ, Tạo đơn: có. Quét: không (web không có camera) | Trang chủ hiện số 0 vì chưa có phiên đóng gói |
| Đóng gói | Xem đơn UI-C01, Kiểm tra UI-C02, Quay UI-C03, Xác nhận UI-C04, Hoàn tất UI-C06 | Rất cao | **Không** cho C02 đến C06 | Bản web chỉ có chế độ xem trước (không camera); ghi video đang sau cờ, tắt mặc định, chưa kiểm chứng trên thiết bị |
| Đơn hàng | Danh sách UI-E01 `/orders`, Chi tiết UI-E02, Bằng chứng UI-E03, Xem lại UI-E04, Lịch sử UI-E05 | Cao | E01, E02: có. E03 đến E05 cần phiên có bằng chứng | **Màn mẫu đã chọn: E01** |
| Hàng hoàn | Danh sách UI-D01, Tìm đơn gốc UI-D02, Tình trạng ngoài D03, Quay D04, Kiểm hàng D05, Xác nhận D06, Hoàn tất D07 | Cao | D01 đến D03, D05 đến D07 có thể; D04 không | Đặc trưng sản phẩm (nhận hàng hoàn, không tự ghép đơn) |
| Đồng bộ | Trung tâm UI-F01 `/sync`, Chi tiết lỗi UI-F02, Dung lượng UI-F03 | Vừa | F01: có (rỗng nếu không có tệp); F02 cần tệp lỗi; F03 là khung | Trạng thái tệp trung thực, không có tải nền |
| Tranh chấp | Danh sách G01 đến Chi tiết G05 | Vừa | Có (cục bộ) | Chỉ trên máy, chưa có gói tệp xuất |
| Cá nhân | Cá nhân UI-I01, Dữ liệu bằng chứng, Cửa hàng I02, Bảo mật I05, Trợ giúp I06 | Thấp đến vừa | Có | Gói dịch vụ, Thành viên, Cài đặt thông báo đang ẩn |

## Ảnh đã tạo (mẫu)

Module: Đơn hàng. Màn: Danh sách đơn hàng UI-E01. Route nguồn: `/orders` (bản web cổng giả, đăng nhập giả, 5 đơn mẫu).

| Tệp | Cỡ | Loại | Tiêu đề |
|---|---|---|---|
| `orders/original/orders-list-780x1688.png` | 780×1688 | Ảnh gốc | |
| `orders/instagram-portrait/showcase-1080x1350.png` | 1080×1350 | A. Product Showcase | "Mọi đơn hàng, một danh sách rõ ràng." |
| `orders/instagram-portrait/feature-highlight-1080x1350.png` | 1080×1350 | B. Feature Highlight | "Đơn nào chưa có video? Lọc một chạm." |

### Poster (đa màn hình)

| Tệp | Cỡ | Nội dung |
|---|---|---|
| `orders/original/order-detail-780x1688.png` | 780×1688 | Ảnh gốc Chi tiết đơn (UI-E02), route `/orders/[orderId]`, đơn mẫu `SP2611-48307` |
| `poster/poster-1200x1800.png` | 1200×1800 (2:3) | Poster: tiêu đề "Mỗi đơn hàng, một hồ sơ rõ ràng.", hai màn thật (Danh sách đơn, Chi tiết đơn), ba ý ở dải tem |
| `poster/poster-2400x3600@2x.png` | 2400×3600 | Cùng poster, độ phân giải gấp đôi để in |

Ba ý ở dải tem đã đối chiếu: "Quét hoặc nhập mã" (ô tìm có nút quét, màn Tạo đơn nhanh), "Đơn, kiện, bằng chứng" (mục "Kiện hàng" và "Bằng chứng" trên Chi tiết đơn), "Nguồn dữ liệu rõ ràng" (dòng "Thông tin do bạn nhập, không lấy từ sàn").

### Mô tả tính năng và đối chiếu mã

| Nội dung ảnh | Đối chiếu | Trạng thái |
|---|---|---|
| Tìm theo mã đơn, mã vận đơn; có biểu tượng quét | Ô tìm của `OrdersListScreen` ("Tìm mã đơn, mã vận đơn…", nút quét) | Đã đối chiếu mã và ảnh chụp |
| Lọc đơn chưa có video | Chip "Chưa có video" trên danh sách đơn | Đã đối chiếu mã và ảnh chụp |
| Nguồn bán hiện trên từng đơn (Shopee, TikTok Shop, Lazada, Khác) | Biểu tượng và nhãn nguồn trên thẻ đơn | Đã đối chiếu mã và ảnh chụp |
| Mã vận đơn và tình trạng video của từng đơn | Dòng "Mã vận đơn: …" và nhãn "Chưa có video" trên thẻ đơn | Đã đối chiếu mã và ảnh chụp |

Mọi nhãn "Chưa có video" trong ảnh là trạng thái thật của app với dữ liệu mẫu (bản web không quay được). Ảnh **không** hứa ghi hình đã chạy.

## Điều kiện trước khi đăng công khai

1. Ghi video đóng gói còn sau cờ, chưa kiểm chứng trên iOS/Android thật (cổng thiết bị G, V1-21). Chưa nên đăng nội dung nói app "ghi hình".
2. Tên **AmaBox** là tên làm việc, chưa kiểm tra nhãn hiệu; tên miền, email hỗ trợ, URL pháp lý còn giữ chỗ (D-4). Ảnh không có liên kết hay nút cửa hàng.
3. Ảnh chụp chứa biểu tượng Shopee, TikTok Shop, Lazada của chính app: cần xác nhận cách dùng nhãn hiệu bên thứ ba.
4. Chữ trong ảnh là chữ của app, một phần còn chờ BA duyệt (C-1).
