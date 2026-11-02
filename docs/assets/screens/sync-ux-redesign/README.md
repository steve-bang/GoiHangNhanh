# Ảnh Trung tâm đồng bộ (UI-F01): trước và sau thiết kế lại

Chụp bằng bản **web** react-native-web, cổng giả, phiên `signed_in`. **Không phải ảnh iOS/Android**: font, vùng an toàn, bóng, chữ lớn hệ thống và kéo-làm-mới thật khác thiết bị thật.

- `before-*`: nhánh `docs/ux-architecture-redesign`.
- `after-*`: nhánh `feat/sync-ux-redesign` (**đã gồm Gói A**: khối trạng thái tổng, hàng Cài đặt tải lên mở sheet, chip xếp Lỗi trước, hàng tệp gọn có vạch trạng thái). Ảnh `after-*` chụp ở 390x1100 và 320x1100 (kể cả `after-empty`, trong khi `before-empty` là 390x844 / 320x568).

| Tệp | Trạng thái | Cách có được |
|---|---|---|
| `before|after-empty-390x844`, `-320x568` | Máy chưa có tệp | Bản web nguyên bản (không vá) |
| `before|after-data-390x1100`, `-320x1100` | Có tệp (1 đang tải, 2 chờ, 2 lỗi), chưa chọn bộ lọc (sau: tự mở **Lỗi**, trước: **Đang tải lên**) | **Bản sao vá có công tắc theo URL** (`/sync?data`), thư mục tạm, không có trong repo |
| `before|after-data-errorfilter-*` | Cùng dữ liệu, bộ lọc **Lỗi** (sau: một nút Thử lại, thông tin chạm được) | Như trên, rồi bấm chip "Lỗi" |
| `before|after-loading-*` | Đang đọc danh sách | `/sync?loading` (bản sao vá: không bao giờ xong) |
| `before|after-error-*` | Không đọc được danh sách | `/sync?error` (bản sao vá: ném lỗi) |

Dữ liệu tệp là do bản vá tạo (không phải dữ liệu thật, không có trong mã của repo); ảnh minh họa bố cục, không thay cho test (`SyncCenterScreen.test.tsx`).

Các trạng thái bổ sung (cùng dữ liệu vá, thêm một tệp do tài khoản khác tạo và một tệp đã xác minh):

| Tệp | Trạng thái | Cách có được |
|---|---|---|
| `before|after-offline-*` | Đang mất mạng (sau: tóm tắt + thông báo mất mạng; bộ lọc Lỗi tự mở) | `/sync?data&offline`: `useConnectivity` trong bản sao vá trả `online: false` |
| `before|after-waiting-foreign-*` | Bộ lọc "Chờ tải lên" kèm nhóm "Do tài khoản khác tạo trên máy này" (không có nút) | `/sync?data`, bấm chip "Chờ tải lên" |
| `before|after-uploaded-*` | Bộ lọc "Đã tải lên" (tệp đã xác minh, bấm cả hàng mở hồ sơ) | `/sync?data`, bấm chip "Đã tải lên" |

Chưa chụp được: đang chờ Wi‑Fi, kéo để làm mới thật, màn Chi tiết lỗi (UI-F02). Chúng được kiểm bằng test.

Ảnh thêm cho bản sau: `after-settings-*` (sheet **Cài đặt tải lên** mở từ hàng cài đặt, chứa câu "Ứng dụng chỉ tải lên khi đang mở…" và công tắc Chỉ tải khi có Wi‑Fi; không có ảnh `before` tương ứng vì bản cũ để công tắc ở đầu màn). Bản sau dùng bộ dữ liệu vá có thêm một tệp lỗi thứ hai (7 tệp) để thấy nút "Thử lại tất cả". Hàng chip bản sau cuộn ngang nhẹ: ở 390dp chip "Đã tải lên" bị cắt mép phải.
