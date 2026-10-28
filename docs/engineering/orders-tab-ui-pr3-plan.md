# Kế hoạch PR3 "Tìm kiếm, quét, xác định đơn" (ORD-02, 03, 04, 14)

> Trạng thái: **người dùng đã duyệt Q-22u (bảng `search_history`) và Q-22x (tra cứu trước khi sang Tạo đơn); v, w, y giữ mặc định, z chờ BA xem câu chữ. PR3 đã làm** (nhánh `claude/orders-tab-ui-pr3`); lệch so với kế hoạch ghi ở `decisions.md` Q-22u, Q-22aa. Thuộc [orders-tab-ui-plan.md](orders-tab-ui-plan.md) mục 5 (PR3 chỉ phụ thuộc PR1 / #22); nhánh `claude/orders-tab-ui-pr3` rẽ từ `claude/orders-tab-ui-pr1`, **không** lấy mã PR2 (#24). Câu chữ/quyết định đã duyệt: `decisions.md` Q-22 (a, b, c, f); các câu mới đề xuất đánh số Q-22u… (mục 3).

## 1. Hiện trạng đã xác minh trong mã

| Chủ đề | Hiện trạng |
|---|---|
| Quét (UI-B02, `ui/ScanScreen.tsx`, route cấp gốc `/scan`, ẩn thanh tab) | Camera qua adapter `platform/barcode-scanner.tsx` (`useScannerPermission`, `BarcodeScannerView`). Chống quét lặp: cùng mã trong 2000 ms bị bỏ qua + cờ `handled` (mở khóa sau 2000 ms). Quyền camera: hộp thoại `CameraPermissionSheet` + khung `ScanUnavailable` (askable/blocked/camera lỗi). Camera chỉ gắn khi `cameraReady && focused` (giải phóng khi mất focus). Nhập tay: `BottomSheet` + `TextField`. Nút "Đơn đã lưu" push `ROUTES.search`. |
| **Tra cứu khi quét** | **KHÔNG có.** `lookup(value)` chỉ `push(ROUTES.quickOrder, { code })`: mọi mã quét/nhập đều sang Tạo đơn nhanh dù đơn đã tồn tại; việc kiểm trùng chỉ xảy ra ở bước *lưu* của `QuickOrderScreen.submit` (`findOrdersByCodes` + `classifyMatches` + sheet `duplicate-sheet`). Tức là A02 ("đúng một kết quả -> tóm tắt; không có -> tạo mới; nhiều -> chọn") **chưa được thực thi ở bước quét**. |
| "Tìm đơn đã lưu" (UI-B03) | `SearchScreen` là `PlaceholderScreen` (`ui/placeholders.tsx`), route `ROUTES.search = /home/search` (trong nhóm tab Trang chủ, có thanh tab). Chỉ nút trong sheet nhập tay của ScanScreen trỏ tới. Tìm thật chỉ có ở ô tìm của danh sách (UI-E01). |
| Trùng mã | `domain/duplicates.ts`: `classifyMatches` phân `sameOrder` (cùng mã + nguồn) / `sameTracking` / `sameCodeOtherSource` (chỉ báo, không coi là trùng); `hasDuplicates`. Sheet trùng nằm riêng trong `QuickOrderScreen` (`duplicate-sheet`, nút *Dùng đơn này* và *Vẫn tạo đơn mới*). `findOrdersByCodes(shopId, {orderCodeKey?, trackingCodeKey?})` khớp **bằng** khóa chuẩn hóa `toCodeKey` (OR hai khóa). |
| Tìm trong danh sách | `listOrders` có `searchKey` (chuỗi con của khóa mã đơn HOẶC mã vận đơn, `instr`, không debounce, bỏ kết quả cũ bằng số thế hệ; Q-18e). |
| Nhận mã điền sẵn | `QuickOrderScreen` đọc `params.code` làm giá trị đầu của ô mã đơn; không có tham số "mã này là mã vận đơn". |
| Lưu cục bộ | `OrderStore` có 2 hiện thực (SQLite `sqlite-order-store.ts` + migration `sqlite-migrations.ts`, bộ nhớ `memory-order-store.ts`) và một bộ test hợp đồng chung `data/order-store.contract.ts`. Chưa có chỗ lưu "lịch sử tìm kiếm". |
| Offline | `useIsOffline()` là stub luôn `false`; dữ liệu đơn hoàn toàn cục bộ nên tìm/quét **không** phụ thuộc mạng ở bản hiện tại. Nhánh "mất mạng" của đặc tả chỉ còn nghĩa là **lỗi đọc kho cục bộ** (`SEARCH_UNAVAILABLE`). |

## 2. Phạm vi từng mục

### 2.1 ORD-02 Tìm kiếm đơn (UI-B03 `SearchScreen`)

- **Màn:** thay placeholder bằng màn thật ở `features/orders/ui/SearchScreen.tsx`, **giữ mã UI-B03 và route `/home/search`** (không mã UI mới, không route con) để không đổi `routes.test`. Mở bằng 3 lối: nút quét ở ô tìm UI-E01 (đã có, đi `/scan`), nút "Đơn đã lưu" trong ScanScreen (đã có), và **ô tìm của UI-E01 giữ nguyên** (đây là lọc danh sách, khác tìm; không đổi ở PR3). Đề xuất UI-E01 *không* chuyển sang UI-B03 để không phá hành vi PR1.
- **Hành vi:** ô tìm tự focus; `trim` + chuẩn hóa `toCodeKey`; **chuỗi rỗng không truy vấn** (hiện khối "Tìm kiếm gần đây"); **debounce 350 ms** (trong khoảng 300–500 ms của đặc tả); mỗi lần truy vấn có số thế hệ, **kết quả cũ không ghi đè mới** (cùng kỹ thuật `use-order-list`); nút xóa ô; giới hạn 20 kết quả đầu (tìm theo chuỗi con; có dòng "Chỉ hiện 20 kết quả đầu, hãy gõ thêm" khi cắt); kết quả dùng `OrderCard`-gọn hoặc hàng mới `OrderResultRow` (logo nguồn + mã đơn + nguồn bán + mã vận đơn + sản phẩm đầu + SL + ngày tạo, **một nhãn bằng chứng mức đơn** qua `OrderEvidenceBadge`, hôm nay *Chưa có video*; mockup vẽ nhãn "Đúng đơn": **không dùng**, vì đó là kết luận hộ người dùng, bất biến 5).
- **Chọn kết quả:** chạm hàng = mở chi tiết (`ROUTES.orderDetail` bằng ID đơn). **Mở thẳng khi đúng một khớp chính xác** (xem Q-22v: đề xuất chỉ khi người dùng *bấm Tìm/Enter* hoặc dán/quét mã đầy đủ, không mở thẳng khi đang gõ debounce, vì gõ dở "DH-10" có thể tình cờ chỉ khớp một đơn và nhảy màn bất ngờ). "Khớp chính xác" = khóa mã đơn hoặc mã vận đơn **bằng** khóa đã nhập; nếu **nhiều** đơn khớp chính xác -> hiện danh sách bắt chọn (ORD-14), không mở đơn đầu.
- **Không tìm thấy:** khung "Không có kết quả" + CTA *Tạo đơn với mã này* (push `quickOrder` với `code`, **không tự tạo**) + *Thử tìm lại* (xóa ô). Câu chữ: "Không tìm thấy đơn này." / "Kiểm tra lại mã hoặc tạo đơn mới với mã đã nhập." (đối chiếu mockup 14 và mã lỗi `ORDER_NOT_FOUND`: "Chưa tìm thấy đơn. Bạn có thể tạo đơn mới hoặc kiểm tra lại mã.", dùng đúng câu của docs/04).
- **Lỗi truy vấn:** giữ nguyên chữ đã gõ, `ErrorState variant="card"` ("Chưa thể tìm kiếm lúc này." theo `SEARCH_UNAVAILABLE`, câu docs/04 nhắc "lưu bản nháp" không hợp: dùng câu riêng "Chưa tìm được lúc này. Bạn thử lại nhé." như Q-18g, ghi BA) + *Thử lại*.
- **Lịch sử tìm gần đây (Q-22f đã duyệt: lưu cục bộ, theo shop, có nút xóa):**
  - **Nơi lưu (đề xuất): bảng SQLite mới `search_history` qua migration v-tiếp-theo** (`CREATE TABLE search_history (shop_id TEXT NOT NULL, query_key TEXT NOT NULL, query_text TEXT NOT NULL, last_used_at_device INTEGER NOT NULL, PRIMARY KEY (shop_id, query_key))`; chỉ mục `(shop_id, last_used_at_device DESC)`). Lý do: cùng cơ sở dữ liệu đã có, cô lập `shop_id` cùng cách mọi bảng khác, **sống sót khi đăng xuất** như dữ liệu đơn và **xóa được theo shop** (đổi shop thấy lịch sử của shop đó), và test hợp đồng cho cả hai kho. Phương án thay thế: `AsyncStorage`/khóa-giá trị (cần thêm phụ thuộc, không có sẵn trong repo, không cô lập theo shop tự nhiên) -> không khuyến nghị.
  - **Hợp đồng `OrderStore` thêm 3 hàm** (đổi hợp đồng kho: đây là thay đổi hợp đồng đầu tiên của dải PR1–PR6; không chạm `listOrders`): `recordSearch(shopId, text, nowDevice)` (upsert theo `query_key = toCodeKey(text)`, giữ tối đa 10 mục gần nhất mỗi shop, xóa mục cũ nhất khi vượt), `listRecentSearches(shopId, limit)` (mới nhất trước), `clearRecentSearches(shopId)`. Kho bộ nhớ cài tương ứng. Các hàm này chỉ lưu **chuỗi người dùng đã tìm**, không tạo/đổi dữ liệu đơn.
  - **Khi nào ghi:** chỉ khi người dùng *chủ động xác nhận* tìm (Enter/nút tìm, hoặc chọn một kết quả), **không** ghi mỗi lần debounce; không ghi chuỗi rỗng hoặc ngắn hơn 2 ký tự.
  - **Quyền riêng tư:** mã đơn/vận đơn là PII nhẹ (Q-22f): lưu cục bộ, không gửi đi, không log (`logger` đã che), có *Xóa tất cả* (xác nhận một lần bằng `ConfirmDialog`) và xóa từng mục (nút x). Không đồng bộ lên máy chủ khi có Firebase (ghi vào Q-22).
  - Chạm mục lịch sử = điền vào ô và tìm ngay.

### 2.2 ORD-03 Quét mã (UI-B02 `ScanScreen`): chỉ đổi giao diện

- Theo mockup 03: header "Quét mã đơn hàng" + nút trợ giúp; khung quét 4 góc; dòng "Đưa mã vào trong khung để quét"; hàng dưới: nút *Nhập mã thủ công* + nút đèn pin tròn (hôm nay đèn pin ở header: đổi vị trí). Bỏ/giữ khối "Mẹo quét" trắng ở đáy: đề xuất **giữ** (đang cho người mới, nội dung không hứa quá), thu gọn nếu mockup không có; chốt khi làm giao diện (nit, không chặn).
- **Giữ nguyên:** chống quét lặp (`REPEAT_SCAN_WINDOW_MS` + `handled`), quyền camera (3 trạng thái + hộp thoại), camera chỉ gắn khi `focused`, `onError` -> khung lỗi + nhập tay, mã vừa quét hiện lên. Không đổi `platform/barcode-scanner.tsx`.
- **Đổi hành vi (thuộc ORD-04, mục 2.3):** `lookup` không đi thẳng quickOrder mà mở `OrderMatchSheet` sau khi tra cứu. Quét lặp một mã vẫn **chỉ một truy vấn** (chặn ở `onScan` như hiện tại). Khi sheet đang mở, camera **tạm dừng nhận mã mới** (`handled` giữ true tới khi sheet đóng) để không chồng sheet.

### 2.3 ORD-04 + ORD-14 gom `OrderMatchSheet`

Một sheet dùng chung cho **quét** (UI-B02), **nhập tay** và **tìm** (UI-B03) khi người dùng *xác nhận một mã cụ thể*. Đầu vào: `code` thô; hook `useOrderLookup(code)` (mới, `ui/use-order-lookup.ts`) gọi `findOrdersByCodes(shopId, { orderCodeKey, trackingCodeKey })` **với cùng khóa cho cả hai** (mã có thể là mã đơn hoặc mã vận đơn: một lần truy vấn OR đã có sẵn), rồi **phân loại thuần** bằng hàm mới trong `domain/` (`classifyLookup(matches, code)` -> `none | one | many`). Không thêm hàm kho cho nhánh này (không đổi hợp đồng).

| Kết quả | Giao diện | Hành động |
|---|---|---|
| Đúng 1 đơn | Dấu tick + "Đã tìm thấy đơn hàng" (mockup 04); tóm tắt: mã đơn, nguồn bán, mã vận đơn, sản phẩm đầu + SL, thời điểm tạo; nhãn bằng chứng mức đơn | *Xem chi tiết đơn* (-> `orderDetail` bằng ID). Không tự bắt đầu quay. |
| 0 đơn | "Không tìm thấy đơn này." + mã đã quét/nhập | *Tạo đơn với mã này* (-> `quickOrder` `{ code }`, **không tạo gì**); *Quét/nhập lại* (đóng sheet) |
| >= 2 đơn (cùng mã đơn khác nguồn, hoặc mã vận đơn trùng đơn khác, hoặc mã đơn của đơn này = mã vận đơn của đơn kia) | Tiêu đề "Có nhiều đơn trùng mã" + "Hãy chọn đúng đơn." ; mỗi đơn là một hàng chọn **kèm nguồn bán (logo + chữ), mã vận đơn, sản phẩm đầu, ngày tạo** và **nhãn lý do khớp** ("Trùng mã đơn" / "Trùng mã vận đơn") để phân biệt; thứ tự mới nhất trước nhưng **không có hàng nào được chọn sẵn, không có nút "Tiếp tục" chung** | Chạm hàng = mở chi tiết đơn đó; cuối danh sách *Không phải đơn nào trong này: tạo đơn mới với mã này* |
| Lỗi đọc kho | `ErrorState` trong sheet ("Chưa tìm được lúc này. Bạn thử lại nhé.") giữ mã | *Thử lại* (cùng mã, một truy vấn), *Nhập mã khác* |
| Đang tra | Skeleton ngắn; nút khóa (chống bấm đúp) | |

- Sheet "Trường hợp khác" của mockup 04 (3 lối: Không thấy / Nhiều đơn trùng / Tạo đơn mới) **không** dựng thành menu cố định: đó là danh sách các nhánh của đặc tả chứ không phải lựa chọn người dùng. Mỗi nhánh hiện đúng khi dữ liệu thật rơi vào nhánh đó (câu hỏi Q-22w để designer xác nhận).
- `QuickOrderScreen` **giữ** kiểm trùng ở bước lưu (dải phòng thủ thứ hai: mã nhập tay thẳng ở quickOrder, hoặc đơn vừa được tạo từ thiết bị khác sau khi tra); dialog trùng hiện có **không** đổi ở PR3 (đổi giao diện dialog là việc của PR4, theo kế hoạch gốc dòng 14). Nên `OrderMatchSheet` chỉ thay đường *quét/tìm*, không thay đường *lưu*.
- Mã không nhận diện/ký tự không hợp lệ (`validateCode` của `domain/codes.ts`): hiện lỗi `INVALID_CODE` ngay trong ô nhập tay/ô tìm, không truy vấn.

## 3. Chỗ mockup/đặc tả lệch quy tắc dự án và câu hỏi cần chốt (Q-22 tiếp theo)

| Mockup/đặc tả | Vấn đề | Đề xuất xử lý |
|---|---|---|
| Nhãn "Dùng đơn" trên mỗi kết quả (mockup 02) | Là lời khuyên/kết luận hộ; hai đơn khác nguồn cùng mã không phải "đúng đơn" (bất biến 5) | Bỏ nhãn; hàng chỉ có *chạm để xem chi tiết*. |
| Ô tìm "mã đơn hoặc mã vận đơn" | Mã vận đơn chỉ là thuộc tính tìm kiếm, không là định danh (bất biến 1); quét mã vận đơn **không** cho biết sản phẩm (bất biến 10) | Tra cả hai khóa nhưng hiển thị rõ "Trùng mã vận đơn" và không suy đơn từ mã vận đơn một mình khi có >1. Khi không thấy, `quickOrder` nhận `code` điền vào ô **mã đơn** (hiện chưa có tham số "đây là mã vận đơn"). |
| Tìm "khi offline trong dữ liệu cục bộ" | Dữ liệu đơn hôm nay *chỉ* cục bộ; chưa có đồng bộ đa thiết bị nên "không thấy" có thể chỉ nghĩa là chưa có trên máy này | Ghi trung thực: "Không tìm thấy đơn này **trên máy này**" (câu chờ BA; khi có Firebase đổi lại). Không hứa "đã kiểm tra toàn bộ shop". |
| Lưu mã nháp ("tạo đơn nháp khi mất mạng") (A02 nghiệm thu) | Cần cơ chế xử lý trùng + đồng bộ; chưa có | Không làm ở PR3; mã không thấy -> chỉ sang `quickOrder` (đơn chỉ tồn tại khi người dùng bấm lưu). |
| "Đã tìm thấy đơn hàng" + dấu tick xanh lớn | Dễ đọc như "đã xác minh bằng chứng" | Dùng `IconTile` tông `brand`, không tông `success`; câu "Đã tìm thấy đơn trong máy." |
| Thanh "Mã đã có phiên đóng gói -> hiển thị lịch sử, hỏi xem phiên cũ hay tạo phiên mới" (A02) | Phụ thuộc quay/phiên thật; tìm thấy đơn đã có phiên thì chi tiết (UI-E02) đã cho thấy kiện/phiên và nút *Quay* mở lại đúng phiên | Không thêm hộp hỏi ở PR3; chuyển thẳng chi tiết. |
| Mockup 02 hiện ảnh sản phẩm, "Shop ABC" | Không có ảnh/tên shop (Q-22p) | Logo nguồn bán thay ảnh; bỏ tên shop. |

**Câu hỏi cần chốt (đề xuất Q-22u..z):**

| # | Câu hỏi | Phương án | Đề xuất | Chặn PR3? |
|---|---|---|---|---|
| u | Lịch sử tìm: nơi lưu | 1) Bảng SQLite `search_history` (migration mới, +3 hàm `OrderStore`); 2) khóa-giá trị `AsyncStorage` (thêm phụ thuộc) | **1** | **Chặn** phần lịch sử (đổi hợp đồng kho + migration); các phần khác không chờ |
| v | Mở thẳng chi tiết khi đúng một khớp chính xác | 1) Chỉ khi xác nhận (Enter/Tìm/quét/chọn từ lịch sử); 2) cả khi đang gõ | **1** | Không (mặc định 1) |
| w | Sheet quét/tìm "Trường hợp khác" (mockup 04) | 1) Chỉ hiện nhánh đúng với dữ liệu; 2) dựng menu 3 lối cố định | **1** (designer xác nhận) | Không |
| x | Quét/nhập mã: mọi lần xác nhận đều tra cứu rồi mới sang tạo đơn (đổi luồng hiện tại là đi thẳng quickOrder) | 1) Tra cứu trước (theo A02, tránh tạo trùng); 2) giữ đi thẳng quickOrder (chỉ kiểm lúc lưu) | **1** (đây là đổi hành vi nhìn thấy ở tab Quét: cần người dùng đồng ý) | **Chặn** (đổi luồng) |
| y | Nút/đường vào UI-B03 từ UI-E01 | 1) Giữ ô tìm UI-E01 là lọc, UI-B03 chỉ mở từ ScanScreen; 2) nút kính lúp ở UI-E01 mở UI-B03 | **1** (không phá PR1); BA/designer xác nhận có cần thêm lối 2 | Không |
| z | Câu chữ "trên máy này", `SEARCH_UNAVAILABLE`, "Không tìm thấy đơn này" | BA xem; giữ câu trung thực (mục 3 bảng trên) | giữ | Không |

## 4. Tệp sẽ thêm/sửa

**Domain/data (có test hợp đồng cho SQLite + bộ nhớ, `data/order-store.contract.ts`):**
- `domain/order-store.ts`: thêm `recordSearch`, `listRecentSearches`, `clearRecentSearches` (+ kiểu `RecentSearch { text; lastUsedAtDevice }`).
- `data/sqlite-migrations.ts`: thêm migration cuối (bảng `search_history` + chỉ mục); `data/sqlite-order-store.ts`, `data/memory-order-store.ts`: cài 3 hàm (SQL tham số hóa, mọi truy vấn có `shop_id`; upsert + cắt còn 10 mục).
- `domain/lookup.ts` (mới, thuần): `classifyLookup(matches, code)` -> `{kind:'none'} | {kind:'one', order} | {kind:'many', orders[], reason theo từng đơn}`; `matchReason(order, key)` ('orderCode' | 'trackingCode'); `isExactKey`. Export qua `domain/index.ts`. Test thuần.
- `domain/search.ts` (mới, thuần): `normalizeSearchInput(raw)` (trim, `toCodeKey`, rỗng/dưới 2 ký tự -> null) dùng chung debounce/ghi lịch sử.

**UI:**
- `ui/SearchScreen.tsx` (thay placeholder trong `ui/placeholders.tsx`; xóa export cũ; `ui/index.ts` xuất mới), `ui/use-order-search.ts` (debounce 350 ms, số thế hệ, trạng thái idle/loading/results/empty/error), `ui/use-recent-searches.ts`.
- `ui/OrderMatchSheet.tsx` + `ui/use-order-lookup.ts` (mới); `ui/OrderResultRow.tsx` (hàng kết quả dùng chung sheet + tìm; có thể tái dùng `OrderCard` bản gọn nếu đủ, quyết khi làm).
- `ui/ScanScreen.tsx`: đổi giao diện theo mockup 03; `lookup` -> mở `OrderMatchSheet`; giữ chống lặp/quyền.
- `shared/ui`: không thêm component mới nếu tái dùng `BottomSheet`, `EmptyState`, `ErrorState`, `IconTile`, `SourceIcon`, `Skeleton` (đã có). `SearchField` đã có `onScan`.
- i18n `screens.json`: nhóm `orderSearch.*` (tiêu đề, placeholder, gần đây, xóa tất cả, không kết quả, lỗi, cắt 20), `orderMatch.*` (một đơn, không thấy, nhiều đơn, lý do khớp, lỗi, tạo đơn mới với mã này), chỉnh `scan.*` (giữ khóa còn dùng, xóa khóa chết). Mã lỗi chỉ từ `core/errors/codes.ts` (`ORDER_NOT_FOUND`, `ORDER_DUPLICATE`, `INVALID_CODE`, `SEARCH_UNAVAILABLE`: **đã có**; không thêm mã mới).
- Route/UI code: **không đổi `ROUTES`**, `routes.test.ts` không phải sửa; chỉ cập nhật `nav.titles.UI-B03` nếu mockup đặt "Tìm đơn hàng" (hôm nay "Tìm đơn thủ công"?): kiểm khi làm; `screens-render.test.tsx` đã bao UI-B03 qua tiêu đề.
- Tài liệu: `layout.md` (UI-B02, UI-B03), `decisions.md` Q-22 u..z, `CLAUDE.md` Trạng thái, `orders-tab-ui-plan.md` (đánh dấu PR3), docs/09 UI-B03 (BA chỉnh: bỏ nhãn "Dùng đơn" nếu có).

## 5. Kế hoạch test

- **Domain thuần:** `classifyLookup` (0/1/nhiều; mã đơn trùng khác nguồn; mã đơn A = mã vận đơn B; không chọn hộ), `normalizeSearchInput`.
- **Hợp đồng kho (chạy cho SQLite `node:sqlite` và bộ nhớ):** `recordSearch` upsert không trùng theo khóa chuẩn hóa, giữ tối đa 10, thứ tự mới nhất trước; **cô lập shop** (shop A không thấy lịch sử shop B; xóa shop A không đụng B); `clearRecentSearches`; migration lên phiên bản mới giữ nguyên dữ liệu đơn cũ.
- **UI-B03:**
  - truy vấn nhanh nhiều mã liên tiếp (gõ "A", "AB", "ABC" nhanh, kho trả chậm/đảo thứ tự) -> **chỉ hiện kết quả của chuỗi mới nhất**;
  - chuỗi rỗng/dưới 2 ký tự **không gọi kho**; debounce gộp các lần gõ (đếm số lần gọi kho);
  - đổi shop khi đang tìm -> kết quả/lịch sử shop cũ không còn (cùng mẫu Harness `CurrentShopProvider` ở test PR2);
  - lịch sử: chỉ ghi khi xác nhận; chạm mục điền ô + tìm; xóa từng mục/tất cả (có xác nhận);
  - không kết quả -> CTA *Tạo đơn với mã này* push `quickOrder` `{code}` và **không** có đơn nào được tạo (đếm `countOrders`); lỗi kho giữ chữ + Thử lại;
  - nhiều khớp chính xác bắt chọn, không mở đơn đầu; hàng không có nhãn "Đúng đơn"/"Đã đồng bộ".
- **UI-B02 + sheet:** quét lặp **một mã chỉ một truy vấn** (phát `onScan` liên tục trong 2 s -> 1 lần `findOrdersByCodes`); sheet đang mở thì mã mới bị bỏ qua; quét mã không thấy -> sheet *Tạo đơn* -> `quickOrder` với mã điền sẵn; trùng mã (2 đơn) bắt chọn kèm nguồn bán/mã vận đơn, không có hàng chọn sẵn; một đơn -> *Xem chi tiết* bằng ID; lỗi kho -> giữ mã + Thử lại (một truy vấn); quyền camera (askable/blocked/lỗi) vẫn nhập tay được; mất focus gỡ camera (test hiện có giữ xanh).
- **Điều hướng (router thật, `app-navigation.test.tsx`):** Quét -> tìm thấy -> chi tiết -> Back về màn quét còn nguyên; Quét -> không thấy -> quickOrder điền mã -> lưu -> đơn mới tìm lại được.
- **Giữ xanh:** test ScanScreen cũ cập nhật (hành vi `lookup` đổi: đây là thay đổi test có chủ đích, ghi trong PR), `OrdersListScreen`, `QuickOrderScreen` (kiểm trùng lúc lưu) không đổi.
- `npm run check` (lint, typecheck, format, check:tokens, unit) trước khi báo xong.

## 6. Chia bước/commit, rủi ro, tiêu chí xong

**Commit (mỗi bước `npm run check` xanh):**
1. Domain thuần: `lookup.ts`, `search.ts` + test.
2. Kho: migration + 3 hàm `OrderStore` (SQLite + bộ nhớ) + test hợp đồng (chỉ sau khi chốt Q-22u).
3. `OrderMatchSheet` + `use-order-lookup` + test.
4. `ScanScreen`: giao diện ORD-03 + nối sheet (chỉ sau khi chốt Q-22x) + test.
5. `SearchScreen` + hooks + lịch sử + test.
6. i18n dọn khóa chết, test điều hướng router thật.
7. Tài liệu (layout, decisions, CLAUDE.md, kế hoạch, ghi chú docs/09).

**Rủi ro:** (a) đổi luồng quét (Q-22x) làm người dùng cũ bớt một bước nhưng thêm một sheet: cần đồng ý; (b) migration SQLite lần đầu sau khi có dữ liệu người dùng: chỉ thêm bảng, không sửa v1, có test nâng cấp; (c) tìm theo chuỗi con trên danh sách lớn (đã chấp nhận ở Q-18d/e, giới hạn 20 kết quả); (d) debounce/số thế hệ dễ sai: có test thứ tự đảo; (e) camera: sheet mở chồng khi quét liên tục: khóa `handled` tới khi sheet đóng; (f) `SearchScreen` nằm trong tab Trang chủ có thanh tab trong khi ScanScreen ẩn thanh tab: Back từ tìm về Quét/Trang chủ cần kiểm bằng router thật; (g) PR3 chỉ rẽ từ PR1: khi PR2 merge, `OrderDetailScreen` đổi nhưng route/ID giữ nguyên nên không xung đột (ghi nếu `orders/ui/index.ts` xung đột nhỏ).

**Tiêu chí xong:** quét/tìm không bao giờ tự tạo đơn hay tự chọn kết quả đầu; mã không thấy -> tạo đơn điền sẵn mã; nhiều đơn/trùng mã bắt chọn kèm nguồn bán + thông tin phân biệt; kết quả cũ không ghi đè mới; chuỗi rỗng không truy vấn; quét lặp một mã chỉ một truy vấn; lịch sử tìm theo shop, có xóa, không log; không hex/số thiết kế/chuỗi UI trong màn; test hợp đồng cho cả hai kho; `npm run check` xanh.

**Chưa kiểm chứng được (phải ghi vào PR):** camera quét thật trên iOS/Android (độ nhạy, đèn pin, mã vạch dòng thật), quyền camera sau khi bật trong Cài đặt, hiệu năng tìm với danh sách lớn, bàn phím che CTA ở sheet, chữ lớn hệ thống ở sheet nhiều đơn, ảnh render web (vẫn chưa chụp được trong môi trường này).
