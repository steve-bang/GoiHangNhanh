# Ảnh màn hình tab Cá nhân (PR 1–4)

Ảnh chụp các màn tab Cá nhân đã làm trên nhánh `claude/personal-tab-pr4-shop`, để xem và review giao diện khi chưa chạy được bản native.

> Đây là ảnh "trước" của PR 4b. Ảnh sau khi chỉnh theo góp ý designer: [`../personal-tab-v2/`](../personal-tab-v2/README.md). Lỗi thẻ Gói bị bóp chữ ghi ở cuối tệp này đã được sửa ở PR 4b.

**Lưu ý trung thực:** đây là ảnh render **bản web** (react-native-web trong Chromium) trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**. Dữ liệu (họ tên, email, "Shop minh họa") là giả lập. Font, đổ bóng, vùng an toàn, bàn phím và hành vi cử chỉ trên thiết bị thật có thể khác. Hai cỡ: 360x800 và 390x844.

## Danh sách ảnh

Tên ảnh theo dạng `NN-tên-WxH.png`; mỗi ảnh có hai cỡ.

| Nhóm | Ảnh | Trạng thái |
| --- | --- | --- |
| 01 Cá nhân (UI-I01) | `01-profile-full` | Đầy đủ (hồ sơ, shop, gói, menu) |
| | `01-profile-full-scrolled` | Cuộn xuống cuối (menu, Đăng xuất) |
| | `01-profile-loading` | Đang tải (skeleton ở thẻ hồ sơ và thẻ shop) |
| 02 Sửa họ tên | `02-edit-name-initial` | Ban đầu (chưa có họ tên, nút Lưu tắt) |
| | `02-edit-name-filled` | Đã nhập tên, nút Lưu bật |
| | `02-edit-name-empty` | Ô trống, nút Lưu tắt (màn không hiện lỗi chữ ở trạng thái này) |
| 03 Đổi mật khẩu | `03-password-initial` | Ban đầu |
| | `03-password-mismatch` | Lỗi "Hai mật khẩu chưa khớp nhau" |
| | `03-password-wrong-current` | Lỗi "Mật khẩu hiện tại chưa đúng" |
| 04 Đăng xuất | `04-signout-confirm` | Hộp xác nhận |
| 05 Cài đặt shop (UI-I02) | `05-shop-settings-single` | Một shop, vai trò chủ cửa hàng |
| | `05-shop-settings-loading` | Đang tải (skeleton) |
| 06 Sửa tên cửa hàng | `06-shop-edit-initial` | Ban đầu |
| | `06-shop-edit-empty` | Lỗi "Tên cửa hàng không được để trống" |

## Cách chụp

1. Web export bằng cổng giả (cờ môi trường: `EXPO_PUBLIC_USE_FAKE_BACKEND=1`, `EXPO_PUBLIC_FAKE_SESSION=signed_in`):
   `npx expo export --platform web --output-dir <thư mục ngoài repo>`.
2. Repo chưa có `react-native-web` trong `package.json` nên export chạy trên **bản sao ngoài repo** có cài thêm `react-native-web@0.21.4` (`--no-save`); không đổi `package.json`/lockfile của repo.
3. Phục vụ tĩnh (có fallback về `index.html`), mở từng route (`/account`, `/account/edit-profile`, `/account/change-password`, `/account/shop-settings`, `/account/shop-settings/edit`) bằng Playwright + Chromium, chụp hai cỡ. Skeleton chụp ngay sau khi tải trang, trong lúc cổng giả còn trễ mô phỏng 450 ms. Các lỗi validation do thao tác nhập thật trên màn.
4. Không sửa mã tính năng để chụp.

## Chưa chụp

Các trạng thái này không bật được từ bản web mà không sửa mã (cổng giả chỉ có `failNext`/`shops` qua mã, không có cờ môi trường; kho cục bộ và trạng thái quay không dựng được từ giao diện):

- Cá nhân: lỗi một khu vực + nút thử lại.
- Sửa họ tên: lỗi lưu (cần `failNext`).
- Đăng xuất: hộp chặn "đang quay", hộp cảnh báo "chưa đồng bộ" (hôm nay số tệp chưa đồng bộ luôn là 0).
- Cài đặt shop: nhiều shop, không có quyền chỉnh sửa (cần cấu hình `shops`/`canEdit`).
- Chuyển cửa hàng (danh sách, hộp xác nhận, chặn đang quay, cảnh báo chưa đồng bộ): màn chỉ được mời khi có từ hai shop; cổng giả mặc định chỉ một shop.

## Vấn đề giao diện thấy trên ảnh

- Thẻ "Gói dịch vụ" ở Cá nhân: chữ bị bóp thành cột hẹp (360x800 gần như xuống dòng từng ký tự, 390x844 xuống dòng nhiều). Chưa xác định là lỗi riêng của bản web hay cả native; cần kiểm tra trên thiết bị thật.
