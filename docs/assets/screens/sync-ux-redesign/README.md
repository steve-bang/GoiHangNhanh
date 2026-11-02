# Ảnh Trung tâm đồng bộ (UI-F01): trước và sau thiết kế lại

Chụp bằng bản **web** react-native-web, cổng giả, phiên `signed_in`. **Không phải ảnh iOS/Android**: font, vùng an toàn, bóng, chữ lớn hệ thống và kéo-làm-mới thật khác thiết bị thật.

- `before-*`: nhánh `docs/ux-architecture-redesign`.
- `after-*`: nhánh `feat/sync-ux-redesign`.

| Tệp | Trạng thái | Cách có được |
|---|---|---|
| `before|after-empty-390x844`, `-320x568` | Máy chưa có tệp | Bản web nguyên bản (không vá) |
| `before|after-data-390x1100`, `-320x1100` | Có tệp (1 đang tải, 2 chờ, 2 lỗi), chưa chọn bộ lọc (sau: tự mở **Lỗi**, trước: **Đang tải lên**) | **Bản sao vá có công tắc theo URL** (`/sync?data`), thư mục tạm, không có trong repo |
| `before|after-data-errorfilter-*` | Cùng dữ liệu, bộ lọc **Lỗi** (sau: một nút Thử lại, thông tin chạm được) | Như trên, rồi bấm chip "Lỗi" |
| `before|after-loading-*` | Đang đọc danh sách | `/sync?loading` (bản sao vá: không bao giờ xong) |
| `before|after-error-*` | Không đọc được danh sách | `/sync?error` (bản sao vá: ném lỗi) |

Dữ liệu tệp là do bản vá tạo (không phải dữ liệu thật, không có trong mã của repo); ảnh minh họa bố cục, không thay cho test (`SyncCenterScreen.test.tsx`).

Chưa chụp được: offline, đang chờ Wi‑Fi, kéo để làm mới, bộ lọc "Đã tải lên", nhóm tệp của tài khoản khác, màn Chi tiết lỗi (UI-F02). Chúng được kiểm bằng test.
