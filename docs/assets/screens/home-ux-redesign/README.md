# Ảnh Trang chủ (UI-B01): trước và sau thiết kế lại

Chụp bằng `scripts/screens/capture.cjs` (bản **web** react-native-web, cổng giả, phiên `signed_in`, 390x844 và 320x568 @2x; bản mặc định còn có 360x800).

**Không phải ảnh iOS/Android.** Font, vùng an toàn, bóng, chữ lớn hệ thống và bàn phím khác thiết bị thật.

- `before-*`: nhánh `docs/ux-architecture-redesign` (HEAD trước thay đổi).
- `after-*`: nhánh `feat/home-ux-redesign`.

| Trạng thái | Tệp (thêm `-390x844` hoặc `-320x568`) | Cách có được |
|---|---|---|
| Mặc định (số 0 của cổng giả) | `before-home-*`, `after-home-*` (thêm `-360x800`) | Cổng giả nguyên bản, không vá |
| Đang tải | `before-loading-*`, `after-loading-*` | Bản sao vá cho `loadTodayStats` không bao giờ xong |
| Lỗi đọc số liệu | `before-error-*`, `after-error-*` | Bản sao vá cho `loadTodayStats` ném lỗi |
| Có số liệu và có tệp lỗi | `before-data-*`, `after-data-*` | Bản sao vá cho `loadTodayStats` trả `{ packed: 5, uploaded: 3, needsAction: 2 }` |

Ba trạng thái cuối dùng **dữ liệu vá trong bản sao ở thư mục tạm** (không có trong mã của repo) vì bản web dùng kho bộ nhớ trống, không có cách gieo dữ liệu. Chúng minh họa bố cục, không thay cho test (`src/features/home/ui/HomeScreen.test.tsx`).

Ở bản cũ không có khối giữ chỗ khi tải, nút Thử lại, và khối "Bằng chứng cần theo dõi" nên ảnh `before-*` của các trạng thái đó chỉ cho thấy bản cũ hiện "–" hoặc số thường.
