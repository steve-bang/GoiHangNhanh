# Ảnh Cá nhân (UI-I01) và Bảo mật (UI-I05): trước và sau thiết kế lại

Chụp bằng bản **web** react-native-web, cổng giả, phiên `signed_in` (`scripts/screens/capture.cjs` cho ảnh mặc định; script Playwright ngoài repo cho ảnh cao). **Không phải ảnh iOS/Android**: font, vùng an toàn, bóng, chữ lớn hệ thống và bàn phím khác thiết bị thật.

- `before-*`: nhánh `docs/ux-architecture-redesign`.
- `after-*`: nhánh `feat/personal-ux-redesign`.

| Tệp | Nội dung | Cách có được |
|---|---|---|
| `before|after-default-*` (390x844, 360x800, 320x568) | Màn Cá nhân, một cửa hàng | Bản web nguyên bản. Cổng giả không có họ tên nên hiện khung "Chưa có họ tên" |
| `before|after-multishop-*` (390x844, 320x568) | Màn Cá nhân khi tài khoản có hai cửa hàng (sau: có hàng **Chuyển cửa hàng**) | **Bản sao vá** (thư mục tạm, không có trong repo): cổng giả trả thêm một cửa hàng |
| `before|after-multishop-tall-*` (390, 320 rộng, cao 1500) | Cùng trạng thái, chụp cả trang để thấy khối Bằng chứng và Đăng xuất (sau: ở 320 ba ô xếp cột) | Như trên |
| `before|after-security-*` (390, 320 rộng, cao 1500) | Bảo mật: hàng "Sắp có" ở sau (sau) so với ngay dưới Đổi mật khẩu (trước) | Bản web nguyên bản (route `/account/security`) |

Chưa chụp được: trạng thái offline/stale (giả lập mất mạng trên web không kích hoạt NetInfo), đang tải, lỗi, có họ tên. Các trạng thái này được kiểm bằng test (`ProfileScreen.test.tsx`, `SecurityScreen.test.tsx`).
