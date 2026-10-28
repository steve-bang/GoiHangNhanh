# Kế hoạch PR4 "Tạo đơn" (ORD-05, 06, 10)

> Trạng thái: làm ngay theo yêu cầu, không chờ duyệt thêm. Luồng mới đã được người dùng duyệt ở `decisions.md` Q-22a (Tạo đơn nhanh -> Xác nhận -> **Tạo đơn hàng** -> Chi tiết đơn; đơn lưu độc lập với quay; Quay đóng gói nằm ở chi tiết). Nhánh `claude/orders-tab-ui-pr4` rẽ từ `claude/orders-tab-ui-pr3` (phụ thuộc PR1 + PR3; không lấy mã PR2).

## 1. Hiện trạng (đã xác minh trong mã)

- `QuickOrderScreen` (UI-B04, route `/quick-order`, cấp gốc, ẩn thanh tab): form một trang; hai nút *Lưu và xác nhận đơn* và *Bỏ qua, quay ngay*. Bấm là **lưu ngay** (kiểm trùng bằng `findOrdersByCodes` + `classifyMatches` rồi `saveNewOrder`), sau đó `push(orderPreview)` hoặc `useStartPacking.begin` (tạo phiên + mở màn quay). ID đơn/dòng/kiện sinh **mỗi lần bấm** (`buildOrder` gọi `IDS`), nên thử lại sau lỗi có ID khác; chống bấm đúp chỉ bằng `savingRef`. Shop lấy từ `useCurrentShopId()` ở lần render.
- Trùng mã: sheet riêng trong `QuickOrderScreen` (`duplicate-sheet`), có *Dùng đơn này* (sang UI-C01) và *Tạo hồ sơ mới* (vẫn tạo được đơn trùng).
- `OrderPreviewScreen` (UI-C01, `/order-preview?orderId=`): **đọc một đơn ĐÃ LƯU** bằng ID rồi *Kiểm tra camera và bắt đầu* (tạo phiên + mở màn quay), sửa số lượng khi chưa có phiên, thêm kiện. Người dùng vào từ: *Quay ngay* ở danh sách (UI-E01) và chi tiết (UI-E02), nút *Dùng đơn này* của sheet trùng, và (cũ) sau khi lưu ở UI-B04. Không có hằng `AFTER_CREATE_ROUTE`: điều hướng sau lưu nằm cứng trong `submit`.
- Nguồn bán chọn trong một `BottomSheet` bằng chip; mặc định *Khác / chưa xác định* (Q-17, không đoán nguồn).

## 2. Luồng mới và quyết định thiết kế

1. **Tách ORD-06 thành bước trong chính UI-B04, không dùng UI-C01 và không thêm route/mã UI.** Lý do: UI-C01 đọc đơn đã lưu theo ID và có nút bắt đầu quay (đúng với "Quay ngay" từ danh sách); ORD-06 là bước **trước khi lưu**, dữ liệu mới chỉ có trong state của form (truyền qua tham số route sẽ phải nhồi cả dòng sản phẩm vào URL và mất state khi quay lại chỉnh sửa). Giữ dữ liệu trong cùng màn làm "Quay lại chỉnh sửa" giữ nguyên toàn bộ dữ liệu mà không có chỗ nào để mất. `routes.ts`/`routes.test` không đổi. UI-C01 giữ nguyên cho đơn đã có.
2. **Tiếp tục** (ORD-05) chỉ **kiểm tra** (không lưu): mã trống "Nhập mã đơn hàng nhé."; mã không hợp lệ (quá dài/ký tự điều khiển) giữ câu cũ; số lượng không hợp lệ giữ "Hãy nhập số lượng hợp lệ."; variant mà thiếu tên giữ "Hãy nhập tên sản phẩm cho phân loại này." (tên sản phẩm **không bắt buộc**: bất biến 10; mockup có dấu * ở Sản phẩm: lệch ghi ở Q-22). Hợp lệ -> bước xác nhận.
3. **Tạo đơn hàng** (ORD-06): khóa khi đang gửi (`savingRef` + `loading`), **ID đơn/kiện sinh MỘT lần khi mở form** (`useRef`), ID dòng lấy từ bể ID cố định theo thứ tự dòng, nên thử lại không tạo hai bản ghi; trước khi lưu, nếu đơn với ID đó đã tồn tại (lần trước lưu xong nhưng kết quả mất) thì coi như đã tạo và mở chi tiết. **Shop lấy lúc bấm Tạo** (`shopIdRef.current`, không lúc mở form). Kiểm trùng (cùng mã đơn + cùng nguồn, hoặc cùng mã vận đơn) ở đúng bước này; trùng -> `OrderMatchSheet` chế độ `duplicate` (ORD-14: liệt kê đơn hiện có kèm nguồn bán/lý do khớp, *Xem đơn hiện có* = mở chi tiết đơn cũ; **không gộp, không tạo đè, không gắn gì vào đơn cũ**); **giữ lối phụ *Vẫn tạo đơn mới*** như bản cũ (ADR-011; mã vận đơn có thể chung cho kiện gộp nhiều đơn), dùng đúng ID đã sinh. Nội dung form đổi sau một lần lưu đã xong thì xoay bộ ID mới, không mở/ghi đè bản cũ (Q-22ad, Q-22af).
4. Thành công -> `replace` sang chi tiết đơn (UI-E02) bằng `orderId`: Back từ chi tiết về màn đứng trước form (danh sách đơn thì tự nạp lại khi lấy focus). Lỗi lưu -> ở lại bước xác nhận, giữ form, câu "Chưa tạo được đơn. Thông tin bạn nhập vẫn được giữ lại." + *Thử lại* (cùng ID).
5. **Bỏ nút *Bỏ qua, quay ngay***: đơn lưu độc lập với quay; quay bắt đầu từ chi tiết (*Quay ngay*, chỉ khi chưa có video). Hệ quả: không còn đường "tạo và vào màn quay ngay" từ UI-B04; thêm một chạm so với bản cũ, đã được duyệt ở Q-22a.
6. Đóng form (nút Hủy / Back / cử chỉ) khi có dữ liệu chưa lưu -> `ConfirmDialog` "Bỏ thay đổi?" (`useConfirmBeforeLeave`). Mã điền sẵn từ quét/tìm **không** tính là thay đổi.
7. **ORD-10 `OrderSourcePicker`** (`features/orders/ui/OrderSourcePicker.tsx`): danh sách một lựa chọn (Shopee, TikTok Shop, Lazada, Khác / chưa xác định) có logo, dấu chọn, `accessibilityRole="radio"`; chỉ là phân loại do người dùng chọn, không nói đã kết nối sàn. Không có ô "Nhập tên nguồn" (kiểu `Order` chưa có trường; không đổi schema ở PR này). Dùng ở UI-B04; sẵn để dùng lại cho lọc/sửa.

## 3. Thành phần/tệp

`ui/QuickOrderScreen.tsx` (viết lại theo hai bước), `ui/OrderSourcePicker.tsx` (mới), `ui/OrderMatchSheet.tsx` + `ui/use-order-lookup.ts` (thêm trạng thái `duplicate`), `data`/`domain` không đổi, i18n `screens.json` (`quickOrder.*`, `orderMatch.*`), test `QuickOrderScreen.test.tsx`, `app-navigation.test.tsx`, `OrderSourcePicker.test.tsx`. Tài liệu: `layout.md`, `decisions.md` Q-22, `CLAUDE.md`, docs/09 UI-B04/UI-C01 (BA chỉnh).

## 4. Ảnh hưởng docs/09 và ngoại lệ

- docs/09 UI-B04 ("Lưu và quay", "không thêm hộp thoại xác nhận riêng") và UI-C01 (xem nhanh trước khi quay) cần chỉnh theo luồng mới: ghi chú ngay trong docs/09 (chờ BA).
- Nhánh ngoại lệ: lỗi lưu (giữ form + thử lại), trùng mã (ORD-14), bấm đôi, đổi shop giữa chừng (ghi theo shop lúc bấm), rời form có dữ liệu (hộp xác nhận), mã không hợp lệ.
- Không làm: ô Ghi chú (đơn không có trường), tên nguồn "Khác", bộ chọn sản phẩm (ORD-11, hoãn), thay đổi schema.
