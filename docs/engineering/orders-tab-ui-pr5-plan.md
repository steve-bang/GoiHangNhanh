# Kế hoạch PR5 "Sửa đơn" (ORD-08), phạm vi thu hẹp

> Trạng thái: **làm theo quyết định của người dùng** (Q-22ah): **bỏ lịch sử thay đổi** (thay Q-22c); chỉ sửa đơn CHƯA có phiên; không UI-E05, không Xóa đơn. Nhánh `claude/orders-tab-ui-pr5` rẽ từ `claude/orders-tab-ui-pr4`; #22, #24, #25, #26 chưa merge nên PR xếp chồng (base `claude/orders-tab-ui-pr4`). Bản kế hoạch đầu (có `order_changes`, `revision`, `ORDER_CONFLICT`, migration v3) **đã bị thay thế**; phần đó giữ ở mục 7 như cách mở khóa sau này.

## 1. Hiện trạng (đã xác minh trong mã)

- Chi tiết (UI-E02) chỉ đọc, chưa có đường sửa đơn. Chỗ duy nhất sửa dữ liệu hôm nay là số lượng một dòng ở UI-C01 (`updateLineQuantity`), bị khóa khi đơn có phiên (`ORDER_HAS_SESSION`).
- Ảnh chụp đơn của phiên (`snapshot_json`) không có đường ghi nào sau khi tạo phiên. `orders` không có cột phiên bản/`updated_at`; không có bảng lịch sử.

## 2. Phạm vi

| Trường | Sửa | Ghi chú |
|---|---|---|
| Mã đơn | **KHÓA** (chỉ đọc + chú thích) | Mã đơn là khóa tìm kiếm, nằm trong ảnh chụp phiên/bằng chứng |
| Nguồn bán | Có (`OrderSourcePicker`) | Đổi nguồn gây trùng -> hộp trùng, không gộp |
| Mã vận đơn | Có (thêm/sửa/xóa) | Trùng đơn khác -> hộp trùng, có *Vẫn lưu thay đổi* |
| Dòng sản phẩm | Có: sửa tên/variant/SL, thêm, xóa | Không bắt buộc có sản phẩm (bất biến 10); variant thiếu tên báo lỗi; không gộp variant; không đổi thứ tự |
| Ghi chú, tên shop, kiện | Không | Không có trường / kiện thêm ở UI-C01 |

**Chỉ khi đơn chưa có phiên nào.** Đơn đã có phiên: chi tiết hiện câu "Đơn đã bắt đầu quay nên chưa sửa được thông tin." thay cho nút Sửa; route sửa của đơn đó chỉ hiện câu này; kho từ chối `ORDER_HAS_SESSION`. Ảnh chụp phiên: không đổi (không có phiên để đổi; test giữ nguyên dữ liệu liên quan).

## 3. Hợp đồng kho

`OrderStore.updateOrder(shopId, orderId, edit)` với `edit = { source, trackingCode, lines: OrderLine[] }` (toàn bộ dòng sau khi sửa): MỘT giao dịch (SQLite) / kiểm trước khi ghi (bộ nhớ); `ORDER_NOT_FOUND` khi không có/shop khác; `ORDER_HAS_SESSION` khi đã có phiên; dòng phải thuộc đơn, ID dòng mới không được trùng dòng đơn khác (sai -> `ORDER_SAVE_FAILED`, rollback); cập nhật khóa mã vận đơn; xóa dòng không còn, cập nhật/thêm dòng theo thứ tự. Không migration, không cột mới, không `revision`. Domain thuần `buildOrderEdit`/`isEditUnchanged` (`domain/update-order.ts`).

## 4. Màn hình

Route con `ROUTES.orderEdit = subRoute('/orders/[orderId]/edit', 'orderDetail', 'UI-E02', true, true)` (Q-22g/Q-20k, `hideTabBar`; `routes.test` cập nhật; `nav.subTitles.orderEdit`). `EditOrderScreen` tái dùng `QuickOrderLineEditor`, `OrderSourcePicker`, `OrderMatchSheet` (thêm prop đổi nhãn nút/câu giải thích). Nút phụ *Sửa thông tin đơn* ở chi tiết. Dirty + `ConfirmDialog` (state `exit`); Lưu: validate, khóa, chống bấm đôi, shop lúc bấm; thành công -> toast + quay chi tiết; lỗi giữ form.

## 5. Câu hỏi (đã chốt / để BA)

| Câu | Trạng thái |
|---|---|
| Bỏ lịch sử, chỉ sửa khi chưa có phiên | **Người dùng đã quyết định** (Q-22ah) |
| Mã đơn khóa | Đã duyệt (Q-22c giữ phần này) |
| *Vẫn lưu* khi trùng, chặn cứng hay không | Chờ người dùng/BA (cùng Q-22ad) |
| Câu chữ mới (khóa sửa, bỏ thay đổi, lưu lỗi) | Chờ BA |
| Cách mở khóa sửa đơn đã quay | Mục 7; người dùng quyết khi cần |

## 6. Tệp, test, commit

Tệp: `domain/update-order.ts` (+ test), `domain/order-store.ts`, `data/{memory,sqlite}-order-store.ts`, `data/create-order-store.ts`, `data/order-store.contract.ts`, `ui/EditOrderScreen.tsx` (+ test), `ui/OrderDetailScreen.tsx` (nút/khóa), `ui/OrderMatchSheet.tsx` (nhãn/câu tùy chọn), `src/app/(tabs)/orders/[orderId]/edit.tsx`, `core/navigation/routes.ts` + `routes.test.ts`, i18n `screens.json`/`nav.json`. Test: hợp đồng cả hai kho (cập nhật đúng đơn/dòng/khóa tìm kiếm, xóa hết dòng, đơn đã có phiên bị từ chối + ảnh chụp nguyên vẹn, shop khác/không có, rollback khi lỗi giữa chừng); màn (mã khóa, lưu đúng, phiên tạo sau khi mở, validate, bấm liên tục, lỗi + thử lại cùng ID, trùng nguồn/mã vận đơn, thoát dở, shop khác, đổi shop); router thật (Chi tiết -> Sửa -> Lưu -> chi tiết/danh sách mới; thanh tab ẩn). Commit: 1) kho `updateOrder` + domain + test; 2) màn + route + nút; 3) tài liệu.

## 7. Cách mở khóa sau này (không làm ở PR5)

Bảng append-only `order_changes` (một bản ghi cho mỗi trường đổi, giá trị trước/sau, `data_origin`, ghi trong cùng giao dịch với `updateOrder`), có thể kèm `orders.revision` + `ORDER_CONFLICT` (câu ORD-16) và trigger chặn UPDATE/DELETE; sau đó bỏ điều kiện "chưa có phiên" ở `updateOrder`, thêm cảnh báo "video và ảnh chụp đơn của phiên đã quay giữ nguyên" và (tùy chọn) màn UI-E05. Cần migration v3 chỉ thêm ở cuối (không có cách đạt bất biến 7 mà không có chỗ lưu mới).

## 8. Rủi ro, chưa kiểm chứng

Rủi ro: người dùng không sửa được đơn đã quay (hệ quả Q-22ah); `updateOrder` xóa/thêm dòng cần giao dịch đúng trên `expo-sqlite` thật; không phát hiện xung đột (chỉ một màn sửa/lần). Chưa kiểm chứng: thiết bị, giao dịch SQLite thật, bàn phím che nút Lưu, chữ lớn, Back phần cứng.
