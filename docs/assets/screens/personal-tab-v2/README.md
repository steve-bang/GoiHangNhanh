# Ảnh màn hình tab Cá nhân sau khi chỉnh theo góp ý designer (PR 4b)

Ảnh "sau" của nhánh `claude/personal-tab-ui-polish`. Ảnh "trước" (PR 1–4) ở [`../personal-tab/`](../personal-tab/README.md).

**Lưu ý trung thực:** đây là ảnh render **bản web** (react-native-web trong Chromium) trên **cổng giả**, **không phải ảnh chụp trên iOS/Android thật**. Họ tên, email, "Cửa hàng minh họa" và phiên bản "0.0.0" (đọc từ `app.json`) là dữ liệu giả lập/cấu hình. Font, đổ bóng, vùng an toàn, bàn phím, hành vi cử chỉ và việc ẩn thanh tab trên thiết bị thật có thể khác. Hai cỡ chính: 360x800 và 390x844; thêm hai ảnh 320x568 (`01-profile-named`, `05-shop-settings-single`) để kiểm tra màn hẹp.

## Danh sách ảnh

Tên theo dạng `NN-tên-WxH.png`.

| Nhóm | Ảnh | Trạng thái |
| --- | --- | --- |
| 01 Cá nhân (UI-I01) | `01-profile-full` | Chưa có họ tên ("Thêm họ tên"), đủ 5 nhóm; vừa một màn ở 360x800 và 390x844 |
| | `01-profile-full-scrolled` | Cuộn xuống cuối (cùng nội dung vì màn đã vừa) |
| | `01-profile-loading` | Đang tải: skeleton dựng theo hình thật (ảnh tròn/vuông + hai dòng) |
| | `01-profile-named` | Sau khi lưu họ tên (thẻ hồ sơ có tên in đậm, toast "Đã lưu họ tên." sau khi cổng xác nhận) |
| 02 Sửa họ tên | `02-edit-name-initial` | Ban đầu: email là ô chỉ đọc có khóa, nút Lưu tắt (chưa có thay đổi), thanh tab ẩn |
| | `02-edit-name-error` | Quá 50 ký tự, sau khi bấm Lưu: lỗi tại ô, nút Lưu vẫn bật |
| | `02-edit-name-filled` | Đã nhập tên hợp lệ |
| 03 Đổi mật khẩu | `03-password-initial` | Ban đầu: mô tả đầu trang, yêu cầu "Từ 8 ký tự" chưa đạt (vòng rỗng) |
| | `03-password-errors` | Bấm Đổi mật khẩu khi để trống: lỗi cụ thể ở cả ba ô (focus vào ô đầu) |
| | `03-password-requirement-met` | Yêu cầu "Từ 8 ký tự" đã đạt (dấu tích + chữ đậm) |
| | `03-password-mismatch` | Lỗi "Hai mật khẩu chưa khớp nhau" |
| | `03-password-wrong-current` | Lỗi "Mật khẩu hiện tại chưa đúng" từ cổng |
| 04 Đăng xuất | `04-signout-confirm` | Hộp xác nhận: "Ở lại ứng dụng" là nút chính, "Đăng xuất" viền đỏ |
| 05 Cài đặt cửa hàng (UI-I02) | `05-shop-settings-single` | Một cửa hàng: hàng thông tin, nhóm hàng thao tác (chỉ "Chỉnh sửa thông tin") |
| | `05-shop-settings-loading` | Đang tải (skeleton) |
| 06 Sửa tên cửa hàng | `06-shop-edit-initial` | Ban đầu, nút Lưu tắt (chưa có thay đổi) |
| | `06-shop-edit-error` | Xóa trống rồi bấm Lưu: lỗi "Tên cửa hàng không được để trống." tại ô |

## Cách chụp

Giống [`../personal-tab/README.md`](../personal-tab/README.md): export web bằng cổng giả (`EXPO_PUBLIC_USE_FAKE_BACKEND=1`, `EXPO_PUBLIC_FAKE_SESSION=signed_in`) trên **bản sao ngoài repo** có `react-native-web@0.21.4` (không đổi `package.json`/lockfile của repo), phục vụ tĩnh rồi dùng Playwright + Chromium mở từng route. Họ tên "Nguyễn Văn An" nhập thật trên màn rồi lưu qua cổng giả; lỗi validation do thao tác nhập thật. Không sửa mã tính năng để chụp.

## Chưa chụp được

Các trạng thái này không bật được từ bản web mà không sửa mã (cổng giả chỉ có `failNext`/`shops` qua mã):

- Cá nhân: lỗi một khu vực + nút thử lại; thẻ cảnh báo "dữ liệu đã lưu" khi ngoại tuyến và "chưa làm mới được".
- Sửa họ tên/Sửa cửa hàng: lỗi lưu từ cổng (cần `failNext`).
- Đăng xuất: hộp chặn "đang quay", hộp cảnh báo "chưa đồng bộ".
- Cài đặt cửa hàng: nhiều cửa hàng (hàng "Chuyển cửa hàng"), không có quyền chỉnh sửa; màn Chuyển cửa hàng và các hộp thoại của nó.
- Chữ lớn (Dynamic Type/font scale), chế độ tối, bàn phím mở: chưa chụp.
- Hành vi thật của việc ẩn thanh tab khi vào/ra form (chỉ kiểm chứng bằng router trong bộ nhớ ở unit test).

## Vấn đề giao diện còn thấy

- Hàng "Sắp có" bị làm mờ cả hàng (kể cả nhãn "Sắp có"), nhãn khá nhạt trên nền trắng; cần xem trên thiết bị thật và đo tương phản nếu muốn nhãn rõ hơn.
- Toast thành công đè lên thanh tab ở màn Cá nhân (hành vi sẵn có của `Toast`, ngoài phạm vi PR này).
- Nhãn thanh tab bị cắt ở 320px ("Trang", "Đơn", "Thông"): thanh tab có sẵn, ngoài phạm vi PR này.
