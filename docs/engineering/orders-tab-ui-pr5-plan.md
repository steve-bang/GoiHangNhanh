# Kế hoạch PR5 "Sửa đơn" (ORD-08)

> Trạng thái: **kế hoạch, chờ người dùng chốt các câu chặn ở mục 5.** Chưa có mã, chưa mở PR. Nhánh `claude/orders-tab-ui-pr5` rẽ từ `claude/orders-tab-ui-pr4`; #22, #24, #25, #26 **chưa merge vào main** nên PR5 sẽ xếp chồng (base `claude/orders-tab-ui-pr4`). **Phạm vi theo yêu cầu người dùng: CHỈ sửa đơn; KHÔNG làm màn Lịch sử thay đổi UI-E05, KHÔNG làm Xóa đơn.** Q-22c đã duyệt "làm lịch sử rồi cho sửa, mã đơn vẫn khóa": giữ phần *ghi* lịch sử (bất biến 7), bỏ phần *màn xem* (ghi ở mục 3 và 5).

## 1. Hiện trạng (đã xác minh trong mã)

- **Không có đường sửa đơn.** Chi tiết (`OrderDetailScreen`, UI-E02) chỉ đọc, không có nút Sửa. Chỗ DUY NHẤT sửa dữ liệu đơn hôm nay là *số lượng của một dòng* ở Xác nhận đơn (UI-C01, `OrderPreviewScreen`), qua `OrderStore.updateLineQuantity`.
- **Khóa sửa nằm ở kho:** `updateLineQuantity` ném `ORDER_HAS_SESSION` nếu đơn đã có BẤT KỲ phiên nào (SQLite: `SELECT ... FROM packing_sessions WHERE order_id = ?`; bộ nhớ: `sessionsOf(...)`), vì chưa có bảng lịch sử (bất biến 7). Câu hiển thị: `errors:ORDER_HAS_SESSION` "Đơn này đã bắt đầu quay nên chưa sửa được số lượng." UI-C01 hiện "đơn đã bắt đầu quay nên chưa sửa được" (`screens:preview.quantityLocked`).
- **Ảnh chụp đơn của phiên:** `buildPackingSession` lưu `snapshot` (mã, nguồn, mã vận đơn, các dòng, số kiện) trong `packing_sessions.snapshot_json` tại lúc bắt đầu quay; không có đường nào ghi vào nó sau đó (docs/04 A03: "thay đổi sau thời điểm bắt đầu quay không sửa ngầm ảnh chụp").
- **Schema:** `orders` không có cột phiên bản/`updated_at`; `order_lines` có `position`; migration hiện có v1 (đơn, dòng, kiện, phiên) và v2 (`search_history`, PR3). Không có bảng lịch sử thay đổi. `Order`/`OrderLine` mang `dataOrigin` (`entered_by_user`).
- **Trùng:** `findOrdersByCodes` + `classifyMatches` (domain/duplicates.ts) cho tạo đơn (cùng mã+nguồn, hoặc cùng mã vận đơn); `OrderMatchSheet` chế độ `duplicate` (PR4) hiện đơn đã có, có lối phụ *Vẫn tạo đơn mới*.
- **Mã UI/route:** `ROUTES.orderHistory` (`/orders/[orderId]/history`, UI-E05) đã có là placeholder (không làm ở PR5); **chưa có** route sửa đơn.

## 2. Phạm vi trường được sửa

| Trường | Cho sửa | Ghi chú |
|---|---|---|
| Mã đơn | **KHÓA**, hiển thị chỉ đọc kèm chú thích | Lý do: mã đơn là khóa tìm kiếm và nằm trong ảnh chụp của các phiên/bằng chứng đã có; đổi mã làm đứt đối chiếu. Chú thích: "Mã đơn không đổi được sau khi đã tạo." (không nói "đã liên kết bằng chứng": câu ORD-08 "Mã đơn này đã được liên kết với bằng chứng…" chỉ cần khi mã sửa được; bản mặc định mã khóa nên không dùng, chờ BA nếu muốn đổi mã) |
| Nguồn bán | Có (`OrderSourcePicker`) | Đổi nguồn có thể tạo trùng (cùng mã + nguồn mới) -> kiểm trùng như PR4, hiện đơn đã có, không tự gộp |
| Mã vận đơn | Có (thêm/sửa/xóa) | Trùng mã vận đơn đơn khác -> cảnh báo ORD-14, có lối *Vẫn lưu* vì mã vận đơn có thể chung cho kiện gộp (cùng quy tắc Q-22ad) |
| Dòng sản phẩm | Có: sửa tên, variant, SL; thêm dòng; xóa dòng; thứ tự (lên/xuống hoặc giữ thứ tự nhập, chốt ở câu f) | Dùng `QuickOrderLineEditor`; không bắt buộc có sản phẩm (xóa hết dòng -> *Chưa khai báo sản phẩm*, bất biến 10); variant mà thiếu tên vẫn báo lỗi; không gộp variant |
| Ghi chú, tên shop | **Bỏ** | `Order` không có trường; kho đơn không có tên shop (Q-22p). Không đổi schema vì mục này |
| Kiện | Không sửa ở PR5 | Thêm kiện vẫn ở UI-C01 (`addPackage`) như hôm nay |

**Đơn đã có phiên/bằng chứng:**
- Vẫn sửa được (đó là mục đích của Q-22c) **nhưng ảnh chụp của các phiên cũ tuyệt đối không đổi** (không có đường ghi vào `snapshot_json`; có test). Phiên mới (nếu bắt đầu quay sau khi sửa) chụp dữ liệu MỚI.
- Hiện cảnh báo trên form khi đơn đã có phiên: "Đơn này đã bắt đầu quay. Thay đổi chỉ áp dụng cho đơn; video và ảnh chụp đơn của phiên đã quay giữ nguyên." (câu mới, chờ BA).
- **Đơn có phiên đang ghi** (`recording`/`saving_local`): chặn sửa (an toàn, hướng bảo thủ; hôm nay chưa có phiên ghi thật nên chưa xảy ra): "Đơn đang được quay. Hãy kết thúc phiên rồi sửa." (mã mới đề xuất, chờ BA; xem câu e).

## 3. Lịch sử tối thiểu (bất biến 7) và cách phát hiện xung đột

**Mô hình lưu.** Migration **v3, chỉ thêm ở cuối** `MIGRATIONS`:
- Cột mới `orders.revision INTEGER NOT NULL DEFAULT 1` (tăng 1 mỗi lần sửa) + `orders.updated_at_device INTEGER` (NULL = chưa sửa lần nào). `ALTER TABLE ... ADD COLUMN` giữ nguyên dữ liệu cũ.
- Bảng append-only `order_changes`: `id TEXT PK, shop_id TEXT NOT NULL, order_id TEXT NOT NULL REFERENCES orders(id), revision_after INTEGER NOT NULL, changed_at_device INTEGER NOT NULL, field TEXT NOT NULL, line_id TEXT NULL, before_json TEXT NULL, after_json TEXT NULL, data_origin TEXT NOT NULL`; chỉ mục `(shop_id, order_id, changed_at_device)`. Một lần sửa sinh **một bản ghi cho mỗi trường đổi** (`source`, `tracking_code`, `line_added`, `line_removed`, `line_changed` với giá trị trước/sau của tên/variant/SL/vị trí), cùng `revision_after` để gom thành một "lần sửa".
- **Append-only:** hợp đồng `OrderStore` KHÔNG có hàm sửa/xóa `order_changes` (không `updateChange`/`deleteChange`); SQLite có thể thêm trigger `BEFORE UPDATE/DELETE ... RAISE(ABORT)` để chống sửa lén cả khi code khác chạm vào (có test). "Ai" = thiết bị này, người dùng đang đăng nhập chưa có `uid` trong kho đơn cục bộ (Q-17d) nên ghi `data_origin = 'entered_by_user'` và chưa có cột người sửa (ghi chú chờ BA khi có đa người dùng/Firebase; không bịa).

**Hợp đồng `OrderStore` mới (thêm, không đổi hàm cũ):**
```ts
updateOrder(shopId, input: {
  orderId; expectedRevision: number;
  source: OrderSource; trackingCode: string | null;
  lines: readonly { id?: OrderLineId; name; variant|null; quantity; }[]; // id vắng = dòng mới
  nowDevice: number; ids: { lineId(): OrderLineId; changeId(): string };
}): Promise<{ details: OrderDetails; changed: boolean }>
```
- MỘT giao dịch: đọc đơn theo `shopId`, so `revision` với `expectedRevision` (lệch -> ném `ORDER_CONFLICT`), kiểm không có phiên đang ghi, tính khác biệt, cập nhật `orders`/`order_lines` (xóa/thêm/sửa/xếp lại `position`), ghi `order_changes`, tăng `revision`, đặt `updated_at_device`. **Không có thay đổi** -> không ghi gì, `changed: false`. Lỗi giữa chừng -> rollback, không để dở (có test chèn lỗi).
- `listOrderChanges(shopId, orderId)` (CHỈ đọc, dùng cho test và UI-E05 sau này; PR5 **không có màn xem**).
- Mã lỗi mới đề xuất (chờ BA, đưa vào `core/errors/codes.ts` + docs/04): `ORDER_CONFLICT` ("Đơn hàng đã thay đổi. Hãy tải lại trước khi lưu." theo ORD-16) và `ORDER_RECORDING_IN_PROGRESS`. `ORDER_NOT_FOUND` (đã có) cho đơn không còn/thuộc shop khác.
- Kho bộ nhớ cài tương ứng; `create-order-store.ts` bọc hàm mới; `listOrders`/`getOrder` không đổi hình dạng `OrderDetails` (thêm `order.revision` vào `Order`, mặc định 1; `buildOrder` đặt 1).
- **Idempotent/xung đột:** nếu lần lưu trước đã ghi xong nhưng kết quả mất, lần thử lại mang `expectedRevision` cũ sẽ gặp `ORDER_CONFLICT`; để không báo nhầm, `updateOrder` so cả nội dung: nếu đơn hiện tại đã bằng bản người dùng định lưu thì trả `changed: false` (coi như thành công), không ghi bản lịch sử thứ hai.

**Lưu lịch sử mà chưa có màn xem có chấp nhận được không?** Có, với điều kiện ghi đủ và đọc được bằng `listOrderChanges`: bất biến 7 yêu cầu *lưu* (nhật ký kiểm toán), không yêu cầu màn xem; dữ liệu mất mới là lỗi không sửa được, còn thiếu màn thì bổ sung sau không mất gì. Phương án thay thế "chỉ cho sửa khi chưa có phiên (như hôm nay), không lịch sử" rẻ hơn (không migration) nhưng **không đạt Q-22c** (đơn đã quay vẫn là chỗ cần sửa nhất: nhập nhầm SL/nguồn sau khi quay) và tạo áp lực làm lịch sử sau. **Khuyến nghị: ghi lịch sử tối thiểu ở PR5 (migration v3), chưa có UI-E05.** Hệ quả: một migration và một hợp đồng kho mới; không thể "gỡ" sau khi phát hành (như v2).

## 4. Màn hình

- **Route:** `ROUTES.orderEdit = route('/orders/[orderId]/edit', 'UI-E02', true)` kèm `parent: orderDetail` và `hideTabBar` (route con theo Q-20k/Q-22g: không mã UI mới, `nav.subTitles.orderEdit`); tệp `src/app/(tabs)/orders/[orderId]/edit.tsx`; cập nhật `routes.ts`, `routes.test.ts` (route con, cờ `hideTabBar`), `nav.json`.
- **`EditOrderScreen`** (`features/orders/ui/EditOrderScreen.tsx`, giao diện theo mockup 08): mã đơn chỉ đọc (nền xám nhạt + chú thích), hàng *Nguồn bán hàng* mở `OrderSourcePicker` (sheet), các `QuickOrderLineEditor` (+ *Thêm sản phẩm khác*, xóa dòng), ô *Mã vận đơn (nếu có)*; footer *Hủy* + *Lưu thay đổi* (mockup: hai nút cạnh nhau). Không Ghi chú.
- **Mở từ chi tiết:** nút phụ *Sửa thông tin đơn* ở `OrderDetailScreen` (docs/09 UI-E02: "sửa thông tin là hành động phụ"; CTA chính vẫn *Quay đóng gói*/*Xem bằng chứng*). Hiện cả khi đơn đã có phiên.
- **Trạng thái form:** nạp bản đơn + `revision` khi mở (đang tải / không còn / lỗi đọc dùng câu chi tiết). `dirty` = khác bản đã nạp; thoát (Hủy/Back/cử chỉ) khi dirty -> `ConfirmDialog` "Bạn có thay đổi chưa lưu. Bỏ thay đổi?" (dùng `useConfirmBeforeLeave` + state `exit` như PR4, bài học Q-22af).
- **Lưu:** kiểm tra (variant thiếu tên, SL > 0); khóa nút + chống bấm đôi (`savingRef`); `shopIdRef` lấy lúc bấm; nếu đổi nguồn/mã vận đơn gây trùng đơn KHÁC -> `OrderMatchSheet` `duplicate` (xem đơn hiện có / *Vẫn lưu* / quay lại sửa; không gộp); thành công -> `back` về chi tiết (chi tiết nạp lại khi lấy focus) + toast "Đã cập nhật thông tin đơn."; không có thay đổi -> nút Lưu tắt và/hoặc thoát không ghi; lỗi lưu giữ form: "Chưa lưu được thay đổi. Bạn thử lại nhé."; `ORDER_CONFLICT` -> khung "Đơn hàng đã thay đổi. Hãy tải lại trước khi lưu." + nút *Tải lại* (nạp bản mới, hỏi trước khi bỏ phần đang sửa: hiển thị hai bản không tự ghi đè); đơn không còn/shop khác -> `ORDER_NOT_FOUND` màn "Không tìm thấy đơn" (không lộ dữ liệu); đổi shop trong lúc sửa -> form đóng (như chi tiết, không giữ dữ liệu shop cũ).

## 5. Lệch quy tắc và câu hỏi cần chốt (Q-22 tiếp: `ah`..)

| # | Mockup/đặc tả lệch hoặc chưa rõ | Câu hỏi | Mặc định đề xuất | Chặn PR5? |
|---|---|---|---|---|
| ah | ORD-08 mockup có *Ghi chú*, dấu * ở Sản phẩm, *Phân loại* dạng chọn | Chỉ sửa trường có dữ liệu; sản phẩm không bắt buộc (bất biến 10); không Ghi chú | Như đề xuất | Không |
| ai | Lịch sử: Q-22c (đã duyệt) nói "làm bảng lịch sử rồi cho sửa"; người dùng nay chỉ muốn sửa đơn, không UI-E05 | Ghi lịch sử (migration v3 + `order_changes`) nhưng không có màn xem? Hay chỉ sửa khi chưa có phiên, không lịch sử? | **Ghi lịch sử, không màn xem** (mục 3) | **Chặn** (quyết định migration + hợp đồng kho) |
| aj | Mã đơn khóa vs đặc tả ORD-08 ("Mã đơn này đã được liên kết với bằng chứng…" hàm ý mã có thể sửa) | Giữ mã khóa (Q-22c) | Khóa, chú thích riêng | Không (đã duyệt) |
| ak | Phát hiện xung đột "Đơn hàng đã thay đổi": dữ liệu cục bộ một thiết bị, xung đột chủ yếu giữa hai lần mở form (hoặc sau này đa thiết bị) | Dùng `revision` + `ORDER_CONFLICT` ngay bây giờ (rẻ, đúng ORD-16, sẵn cho Firebase)? | Có | **Chặn** (thêm cột + mã lỗi mới ở docs/04) |
| al | Đơn đang có phiên GHI | Chặn sửa (mặc định) hay cho sửa? Hôm nay chưa có phiên ghi thật | Chặn bằng `ORDER_RECORDING_IN_PROGRESS` | Không |
| am | Thứ tự dòng sản phẩm | Cho đổi thứ tự (nút lên/xuống) hay giữ thứ tự nhập, chỉ thêm/xóa? | Giữ thứ tự, chỉ thêm/xóa/sửa (ít giao diện; thứ tự không ảnh hưởng nghiệp vụ) | Không |
| an | Cảnh báo "đơn đã bắt đầu quay" trên form và câu `ORDER_CONFLICT`, `ORDER_RECORDING_IN_PROGRESS` | BA duyệt câu và mã lỗi mới (docs/04, `codes.ts`) | Dùng câu mục 4 | Không (đề xuất BA song song) |
| ao | Đổi nguồn/mã vận đơn gây trùng | Cho *Vẫn lưu* như PR4 (khôi phục hành vi cũ chờ BA)? | Có (cùng Q-22ad) | Không |
| ap | UI-C01 vẫn cho sửa số lượng (`updateLineQuantity`, khóa khi có phiên) | Giữ nguyên ở PR5 (không đụng), hay bỏ khi Sửa đơn đã có? | **Giữ nguyên**; gỡ ở PR sau khi Sửa đơn ổn | Không |

**Chặn PR5:** ai (có ghi lịch sử không) và ak (revision + mã lỗi). Nếu người dùng chọn "chỉ sửa khi chưa có phiên, không lịch sử": bỏ migration/`order_changes`/`ORDER_CONFLICT` (hoặc giữ `revision` nhẹ), `updateOrder` ném `ORDER_HAS_SESSION` khi có phiên; PR nhỏ hơn nhiều nhưng đơn đã quay không sửa được.

## 6. Tệp, i18n, test, commit, rủi ro

**Tệp thêm/sửa**
- `domain/types.ts` (`Order.revision`, `updatedAtDevice`), `domain/order-store.ts` (`updateOrder`, `listOrderChanges`, kiểu `OrderChange`), `domain/build-order.ts` (revision 1), `domain/update-order.ts` mới (hàm thuần `diffOrder(before, after)` -> danh sách `OrderChange`; test thuần), `domain/index.ts`.
- `data/sqlite-migrations.ts` (v3), `data/sqlite-order-store.ts`, `data/memory-order-store.ts`, `data/create-order-store.ts`, `data/order-store.contract.ts`, `data/sqlite-order-store.test.ts` (nâng cấp v2 -> v3 giữ dữ liệu, trigger append-only).
- `ui/EditOrderScreen.tsx`, `ui/use-edit-order.ts` (nạp, dirty, lưu), `ui/OrderDetailScreen.tsx` (nút Sửa), `ui/index.ts`, `src/app/(tabs)/orders/[orderId]/edit.tsx`, `core/navigation/routes.ts` + test, `core/i18n/locales/vi/{screens,nav,errors}.json`, `core/errors/codes.ts` (mã lỗi mới).
- Tài liệu: `layout.md`, `decisions.md` (Q-22 ah..ap), kế hoạch chung, docs/09 UI-E02 (nút Sửa), docs/04 (mã lỗi mới, chờ BA), `CLAUDE.md` mục Trạng thái.

**Test**
- Hợp đồng (SQLite + bộ nhớ): sửa nguồn/mã vận đơn/dòng ghi đúng MỘT nhóm bản ghi `order_changes` (cùng `revision_after`) trong cùng giao dịch; không đổi gì -> không ghi; lỗi chèn giữa chừng (ép lỗi khi ghi lịch sử) -> đơn không đổi; `expectedRevision` lệch -> `ORDER_CONFLICT`, không ghi; hai lần sửa liên tiếp tăng revision 1 -> 3; shop khác -> `ORDER_NOT_FOUND`, không lộ; **đơn có phiên: `snapshot_json` của phiên không đổi sau sửa** (so sánh byte); phiên đang ghi -> `ORDER_RECORDING_IN_PROGRESS`; không API sửa/xóa lịch sử và trigger chặn UPDATE/DELETE; migration v2 -> v3 giữ đơn, dòng, phiên, lịch sử tìm.
- Màn: mở từ chi tiết; mã đơn chỉ đọc; dirty + hộp bỏ thay đổi + thoát dở không ghi; Lưu hợp lệ -> quay chi tiết có toast và dữ liệu mới; bấm Lưu liên tục chỉ một lần ghi; lỗi lưu giữ form + thử lại không tạo hai bản lịch sử (idempotent: lần thử lại sau khi đã ghi trả `changed:false`); xung đột -> câu ORD-16 + Tải lại không ghi đè; đổi nguồn gây trùng -> hộp trùng, không gộp; không còn đơn/shop khác; đổi shop giữa chừng; variant thiếu tên; xóa hết dòng -> *Chưa khai báo sản phẩm*; chi tiết hiện dữ liệu mới và danh sách làm mới; router thật: Chi tiết -> Sửa -> Lưu -> Back về chi tiết/danh sách, thanh tab ẩn ở form.

**Commit (mỗi bước `npm run check` xanh):** 1) domain thuần (`diffOrder`, kiểu, lỗi) + test; 2) migration v3 + hợp đồng kho cả hai kho + test; 3) `EditOrderScreen` + hook + route/`routes.test` + nút Sửa; 4) xung đột, trùng, dirty, đổi shop + test màn/router; 5) i18n dọn, tài liệu, CLAUDE.md.

**Rủi ro:** (a) migration v3 với `ALTER TABLE` trên dữ liệu người dùng thật (chỉ thêm cột/bảng, có test nâng cấp; không gỡ lại được); (b) trigger append-only có thể cản sửa dữ liệu hỏng về sau (dùng migration mới nếu cần); (c) `updateOrder` phức tạp (xóa/thêm/xếp lại dòng, diff): bù bằng hàm thuần có test và test hợp đồng; (d) đơn đã quay nay sửa được: người dùng có thể tưởng video cũng đổi, cần câu cảnh báo rõ và BA duyệt; (e) cùng lúc PR2/PR3/PR4 chưa merge: `Order.revision` đụng `types.ts`/`build-order.ts`; chuỗi PR dài, rebase kỹ; (f) `ORDER_CONFLICT` trên một thiết bị hiếm gặp: giá trị chủ yếu cho đa thiết bị sau này.

**Tiêu chí xong:** sửa được nguồn, mã vận đơn, dòng sản phẩm của đơn (cả đơn đã có phiên) mà ảnh chụp phiên cũ không đổi; mọi lần sửa có đúng một nhóm bản ghi lịch sử append-only trong cùng giao dịch; mã đơn khóa; xung đột/trùng/lỗi/thoát dở xử lý đúng; không UI-E05, không Xóa đơn; hợp đồng có test cả hai kho; `npm run check` xanh.

**Chưa kiểm chứng được:** migration v3 trên SQLite thật của thiết bị, giao dịch/rollback trên expo-sqlite thật, bàn phím che nút Lưu, chữ lớn, Back phần cứng/cử chỉ, ảnh render web (có thể chụp bằng cách trong `docs/assets/screens/orders-v2/README.md`).
