# Ảnh Đơn hàng (UI-E01, danh sách): trước và sau thiết kế lại

Chụp bằng bản **web** react-native-web, cổng giả, phiên `signed_in` (`scripts/screens/capture.cjs` cho ảnh mặc định; một script Playwright ngoài repo cho ảnh có đơn). **Không phải ảnh iOS/Android**: font, vùng an toàn, bóng, chữ lớn hệ thống và bàn phím khác thiết bị thật. Viền đen quanh ô tìm trong ảnh "không có kết quả" là viền focus mặc định của trình duyệt web.

- `before-*`: nhánh `docs/ux-architecture-redesign`.
- `after-*`: nhánh `feat/orders-ux-redesign`.

| Trạng thái | Tệp (thêm `-390x844`, `-320x568`; mặc định có thêm `-360x800`) | Cách có được |
|---|---|---|
| Danh sách rỗng | `before-default-*`, `after-default-*` | Bản web nguyên bản (kho bộ nhớ trống) |
| Có 3 đơn | `before-data-*`, `after-data-*` | Tạo 3 đơn qua màn Tạo đơn nhanh trong chính bản web |
| Không có kết quả | `before-noresults-*`, `after-noresults-*` | Gõ từ khóa không khớp sau khi có 3 đơn |

Chưa chụp: đang tải, lỗi tải, tải thêm lỗi, kéo làm mới, trạng thái tắt do chưa biết cửa hàng (chỉ có ở chế độ Firebase). Các trạng thái này được kiểm bằng test (`OrdersListScreen.test.tsx`).
