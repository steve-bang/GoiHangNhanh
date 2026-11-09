# UI polish: Tìm đơn gốc ưu tiên quét, Đồng bộ/danh sách rỗng, thống nhất nền và tiêu đề — kế hoạch chi tiết

Nguồn: bản review giao diện 2026-11-09 (ảnh chụp bản web cổng giả 390x844, mục 2, 5, 6). **Chỉ là kế hoạch, chưa sửa mã.** Mọi thay đổi chữ hiển thị chờ BA (C-1). Không đổi nghiệp vụ, mã lỗi, Rules, Functions, migration.

## 0. Nhánh làm việc

Repo đang ở `feat/returns-scan-battery` (HEAD `e455711`). **PR #99 đã hợp nhất vào `main`** (`3d93aa4`, `git merge-base HEAD origin/main` = `e455711`, `git log origin/main..HEAD` rỗng; `ReturnScanPanel.tsx` đã có ở `origin/main`). Nên:

- **Không thêm commit vào `feat/returns-scan-battery`** (nhánh cũ đã nằm trọn trong `main`, đẩy thêm sẽ mở lại một PR đã đóng).
- Mỗi PR dưới đây tạo nhánh mới từ `origin/main` (`git fetch origin && git switch -c <tên> origin/main`), không chồng nhánh lên nhau, để diff nhỏ và hợp nhất độc lập.
- Việc 2 phụ thuộc mã quét của #99 (đã có trên `main`), nên không cần chờ gì.

Nếu khi bắt tay làm mà `origin/main` đã có thêm PR chạm cùng tệp (ví dụ `ReturnFindOrderScreen.tsx`), rebase trước khi mở PR.

## 1. Hiện trạng đã đối chiếu mã

### 1.1 Tìm đơn gốc (UI-D02) — `src/features/returns/ui/ReturnFindOrderScreen.tsx`

- Thứ tự trong thân màn (`:260-300`): câu giới thiệu -> `TextField` mã (`:265-279`) -> nút `return-scan` (`:283-290`) -> nút `return-search` (`:292-300`). Cả hai nút đều `variant="secondary" size="compact"`, nên giống hệt nhau (ảnh `04-find-order`). Ô nhập nằm trên cùng, trái nguyên tắc "ưu tiên camera, hạn chế gõ".
- Nút "Tìm đơn gốc" luôn bật; bấm khi ô rỗng thì `search('')` -> `lookupOrders` trả `invalid` -> `returns:find.invalidCode` (`:102-107`). Test `returns-flow.test.tsx:277-281` khóa hành vi này ("mã không hợp lệ (rỗng) khi bấm Tìm").
- Footer (`:217-258`): phase `result` -> `return-use-order` + `return-unlinked` (mode new) hoặc `return-link-order` (mode link); chưa có kết quả và mode new -> chỉ `return-unlinked` (secondary). Mode link chưa có kết quả: không có footer. Lối "Không xác định được đơn gốc" do đó **luôn có ở mode new**; ở mode link không có lối này (đúng: hồ sơ đã tồn tại, chỉ liên kết sau).
- `Screen form` (`:213`): nền trắng, tiêu đề 17sp (xem 1.4).
- Quét: `ReturnScanPanel` (`ReturnScanPanel.tsx`) thay nút `return-scan` khi `scanning` (`:280-291`). Mã quét điền vào ô nhập rồi `search(scanned)` (`:116-120`); không tự chọn/tạo (bất biến 5). Không quyền camera / camera lỗi: panel báo và có `return-scan-manual` ("Nhập mã bằng tay", đóng panel) (`ReturnScanPanel.tsx:66-101`).
- Chuỗi: `src/core/i18n/locales/vi/returns.json` `find.*` (`intro`, `codeLabel`, `codePlaceholder`, `search`, `scan`, `scanHint`, `scanManual`, `unlinkedAction`).
- Test liên quan: `ReturnFindOrderScreen.scan.test.tsx` (17 chỗ dùng testID `return-scan`, `return-scan-manual`, `return-code`, `return-unlinked`), `returns-flow.test.tsx` mục "UI-D02 Tìm đơn gốc" (dùng `return-code`, `return-search`, `return-unlinked`; helper `search()` ở `:229-234`).

### 1.2 Danh sách rỗng (UI-D01, UI-G01) — ảnh `03-returns`, `07-disputes`

- `ReturnsListScreen.tsx:126-139`: danh sách rỗng hiện `EmptyState` có `actionLabel={returns:list.receive}` (`actionVariant="primary"`); đồng thời `footer` (`:189-196`) luôn có nút `returns-receive` cùng nhãn. Hai nút giống nhau trên một màn.
- `DisputesListScreen.tsx:78-91` và `:129-136`: y hệt (`disputes-create`).
- Bảy chip lọc (`ReturnsListScreen.tsx:35-43`, `:204`) và ô tìm (`:198-203`) vẫn hiện khi chưa có hồ sơ nào (`state.items.length === 0`); chiếm ~3 hàng trước khi tới nội dung. Tranh chấp có 3 chip (`DisputesListScreen.tsx:26`).
- Test: `returns-flow.test.tsx:96-101` bấm nút TRONG `returns-empty` bằng `getByRole('button', { name: 'Tiếp nhận hàng hoàn' })`; `:103-108` bấm `returns-receive` ở chân màn; `disputes-flow.test.tsx:97-103` tương tự cho `disputes-empty`.

### 1.3 Đồng bộ (UI-F01) — `src/features/upload/ui/SyncCenterScreen.tsx`, ảnh `05-sync`

- Bộ lọc mặc định (`:77-81`, `:101`): `filter = chosen ?? auto ?? 'uploading'`; `auto` chỉ là `'error'` khi có tệp lỗi, ngược lại luôn `'uploading'`, **kể cả khi "Đang tải" trống mà "Chờ tải" có tệp** hoặc không có gì. Đó là nguyên nhân tab mở sẵn rỗng.
- Rỗng kép: `SyncSummaryCard` (`:149-158`, biến thể `none` = "Không có tệp nào đang chờ hoặc lỗi", `SyncSummaryCard.tsx:38-42`) và `EmptyState` "Không có tệp ở mục này" (`:221-228`, hành động "Mở danh sách đơn") cùng hiện khi không có tệp nào. Thêm hàng "Cài đặt tải lên" (`:177-179`) và 4 chip (`:180-184`) giữa hai khối.
- "Đã tải lên" chỉ nạp khi chọn tab đó (`useSyncJobs(filter === 'uploaded')`, `:85`), nên không biết nó có tệp hay không cho tới khi nạp.
- Chuỗi: `screens.json` `sync.emptyTitle/emptyMessage/emptyAction` (`:360-362`), `sync.summary.none`, `sync.chip.*` (`:287`).
- Test hiện có chịu ảnh hưởng (`SyncCenterScreen.test.tsx`): `:199-217` (route `filter`, "không có tệp lỗi: bộ lọc mặc định vẫn là Đang tải lên" với `uploading` + `queued` còn đúng), `:280-295` (thứ tự chip), `:162-190` (chuyển tab). Không test nào khẳng định văn bản `emptyTitle`/`emptyAction` (cần grep lại khi làm).

### 1.4 Nền và tiêu đề — `src/shared/ui/Screen.tsx`, `ScreenHeader.tsx`, `src/core/theme`

- **Một cờ `form` điều khiển hai thứ**: nền (`Screen.tsx:66`: `form ? surface.raised (trắng) : surface.screen (kem, stone[25])`; footer cũng theo `background` `:106`) và cỡ tiêu đề (`:78` `compact={form}` -> `ScreenHeader.tsx:66` `formTitle` 17sp thay `screenTitle` 24sp; padding/gap/icon Back cũng đổi `:45-48`, `:61`).
- 14 tệp dùng `form` trong số 55 tệp dùng `Screen`: `EvidenceDetailShell`, `DisputeExport/Detail/New/SelectEvidence`, `QuickOrderScreen` (2 chỗ), `ReturnFindOrder/Review/Items/Exterior/Done`, `SearchScreen`, `OrdersListScreen`.
- Có chủ đích? Có, nhưng **chỉ một phần**: `Screen.tsx:29-32` ghi "nhóm màn form/quy trình (mockup 03): nền trắng sạch và tiêu đề nhỏ"; `layout.md:176` (Q-17l) áp cho Tạo đơn nhanh/Xác nhận; `layout.md:188` và `decisions.md` Q-18m mở rộng cả tab Đơn hàng sang `form` theo yêu cầu **giảm cỡ chữ/padding**. Nền trắng của danh sách Đơn hàng là hệ quả đi kèm của cờ chung, không phải yêu cầu riêng. Trong luồng hàng hoàn/tranh chấp, danh sách (D01, G01) kem còn các bước sau (D02…D07, G02…G05) trắng, nên đổi nền giữa các bước.
- Hệ quả tiêu đề (ảnh): gốc tab Đơn hàng 17sp (do `form`) nhưng Cá nhân, Thông báo 24sp; màn có Back: Hàng hoàn/Đồng bộ/Tranh chấp 24sp, Tìm đơn gốc/Tạo đơn nhanh 17sp. Vị trí ngang khác nhau còn do có/không nút Back (`paddingLeft` `:45`).
- Token: `surface.screen`/`surface.raised` ở `core/theme/semantic.ts:30-33`; `typography.screenTitle/formTitle` ở `typography.ts:9,29`. `theme.test.ts:231-232` khóa `screenTitle` trong 24–28sp (không bị ảnh hưởng nếu chỉ đổi nơi dùng). Lưu ý phụ: `ScreenHeader.tsx:61` còn số thô `24 : 26` cho icon Back (nên đổi sang token `tokens.icon.*` khi chạm tệp; kiểm `check:tokens`).
- Test chịu ảnh hưởng: `OrdersListScreen.test.tsx:107-114` (tiêu đề `formTitle`), `OrderDetailScreen.test.tsx:78-86`, `redesign-components.test.tsx` (ScreenHeader), snapshot/kiểm màu nền nếu có (grep `surface.raised`/`formBackground` khi làm); `QuickOrder*` tests nếu đo nền.

## 2. Thiết kế và thay đổi từng tệp

### PR-A (việc 6): danh sách rỗng và Đồng bộ

**A1. Bỏ nút lặp ở D01/G01.** Chọn **chân màn là chỗ duy nhất**: cùng vị trí khi có/không có dữ liệu, vùng ngón cái, test `returns-receive`/`disputes-create` đã tồn tại. `EmptyState` bỏ `actionLabel/onAction/actionVariant` (kiểu đã cho phép không có hành động).
- `ReturnsListScreen.tsx`: xóa 3 prop hành động ở nhánh `:129-136`; `emptyMessage` đủ dẫn hướng (có thể BA sửa thành "Bấm Tiếp nhận hàng hoàn bên dưới để ghi lại tình trạng kiện trước khi mở.").
- `DisputesListScreen.tsx`: tương tự `:81-89`.
- Phương án khác: giữ nút ở EmptyState, ẩn footer khi rỗng. Không khuyến nghị: footer nhảy xuất hiện/biến mất, đổi vị trí nút chính.

**A2. Gọn bộ lọc khi chưa có hồ sơ.** Khi `state.kind === 'ready' && state.items.length === 0` ẩn ô tìm và chip (cả D01 và G01); giữ khi đang lọc ra 0 kết quả (`visible.length === 0 && filtered`, người dùng cần "Xóa bộ lọc") và khi lỗi/đang tải (hiện như cũ để bố cục không nhảy: chip vẫn hiện lúc loading; nếu thấy nhấp nháy thì ẩn chip cả lúc loading, đánh giá khi chụp ảnh). Tính `const hasItems = state.kind === 'ready' && state.items.length > 0` rồi bọc `SearchField` + `FilterChips` bằng `hasItems || state.kind !== 'ready'`.

**A3. Đồng bộ: tab mặc định có nội dung, bỏ rỗng kép.**
- Hàm thuần mới trong domain: `pickDefaultSyncFilter(counts)` trong `src/features/upload/domain/` (cạnh `SYNC_FILTERS`; export qua `domain/index.ts`): ưu tiên `error` > `uploading` > `waiting_upload`; nếu cả ba trống trả `'uploaded'`. `SyncCenterScreen.tsx:101` thay `count('error') > 0 ? 'error' : 'uploading'` bằng hàm này. Vẫn chỉ đặt MỘT lần khi danh sách tải xong; tham số route `filter` hợp lệ và lựa chọn của người dùng vẫn thắng (`:77-81`, không đổi). Mặc định `filter` trước khi nạp xong vẫn `'uploading'` (đang hiện skeleton, không thấy rỗng).
- Khi không có tệp chờ/lỗi nào mà mặc định là `'uploaded'`, `useSyncJobs(true)` nạp danh sách đã tải (một lần đọc thêm, chấp nhận; chỉ khi không có việc chờ).
- Rỗng đơn: xóa `EmptyState` `:221-228`. Hai trường hợp:
  1. **Cả màn rỗng** (`rows.pending.length === 0` và `rows.done?.length === 0` sau khi nạp): ẩn dải chip; `SyncSummaryCard` biến thể `none` là thông điệp duy nhất; thêm prop tùy chọn `action` (nút `secondary slim` "Mở danh sách đơn" -> `ROUTES.orders`) hiển thị trong thẻ ở biến thể `none` (dùng lại `screens:sync.emptyAction`).
  2. **Chỉ tab đang chọn rỗng** (tab khác có tệp, thường do người dùng bấm): một dòng chữ phụ `formBody textMuted` (không icon, không nút), dùng lại `screens:sync.emptyTitle` ("Không có tệp ở mục này"); bỏ `emptyMessage`.
- Chip đếm: tab rỗng vẫn hiện chip (đã có số đếm `(n)` khi > 0), không đổi thứ tự `CHIP_ORDER`.
- Tệp: `SyncCenterScreen.tsx`, `SyncSummaryCard.tsx` (prop `action?`), `domain/sync-filters.ts` hoặc tệp tương đương + `domain/index.ts`.
- Không đổi hợp đồng `ApiClient`, không thêm đọc Firestore (chỉ SQLite cục bộ).

**Chuỗi i18n (chờ BA, C-1), PR-A:** `returns:list.emptyMessage` (đề xuất sửa, tùy chọn), `disputes:list.emptyMessage` (tùy chọn), `screens:sync.emptyMessage` bị bỏ khỏi UI (khóa để lại hoặc xóa; xem quy ước dọn khóa), không có khóa mới bắt buộc nếu dùng lại các khóa trên.

### PR-B (việc 2): Tìm đơn gốc ưu tiên quét

Bố cục mới (chỉ `FindOrderBody`, cả mode `new` và `link`):
1. Câu giới thiệu (chữ đổi: nói quét trước).
2. **Nút Quét** `return-scan`: `variant="primary"`, icon `scan`, đầu màn. Khi `scanning` thì panel thay nút (như `:280-291`).
3. Dòng phân cách chữ nhỏ (caption) "hoặc nhập mã".
4. `TextField` mã (`return-code`) + nút `return-search` "Tìm đơn gốc" **`disabled` khi `typedCode === ''`** (và khi đang tìm). Bấm Enter trên bàn phím chỉ tìm khi có mã.
5. Chỉ MỘT nút chính một lúc: `return-scan` là `primary` khi ô mã trống và chưa có kết quả; khi đã gõ mã (`typedCode !== ''`) và chưa có kết quả thì `return-search` là `primary`, `return-scan` thành `secondary`; khi đã có kết quả (`phase.kind === 'result'`) cả hai là `secondary` (nút chính chuyển xuống footer: `return-use-order`/`return-link-order`).
6. Footer giữ nguyên: `return-unlinked` luôn có ở mode `new` (cả lúc chưa có kết quả), mode `link` không đổi.

Giữ nguyên hành vi an toàn: mã quét vẫn điền ô nhập rồi tra cứu, người dùng tự xác nhận đơn (không tự chọn/tạo/ghép, bất biến 5); không có quyền camera/camera lỗi: `ReturnScanPanel` vẫn báo và có `return-scan-manual`, ô nhập luôn hiển thị bên dưới nên **nhập tay vẫn dùng được kể cả khi panel đang mở**; `invalidCode` còn dùng cho mã chỉ có ký tự không hợp lệ (nhánh `lookupOrders` -> `invalid`), không còn kích hoạt bằng ô rỗng.

Tệp: `ReturnFindOrderScreen.tsx` (đổi thứ tự/variant/disabled `:260-300`), `ReturnScanPanel.tsx` (không đổi logic; có thể đổi nhãn `scanManual` thành "Đóng camera, nhập mã bằng tay" nếu BA muốn rõ hơn), i18n `returns.json`.

**Chuỗi i18n (chờ BA), PR-B:** `returns:find.intro` (đề xuất: "Quét mã trên kiện hoàn để tìm đơn gốc. Không có mã vẫn tiếp nhận được."), `returns:find.orEnter` mới ("Hoặc nhập mã"), tùy chọn `returns:find.scanManual`. Nhãn `scan`/`search`/`unlinkedAction` giữ.

Quyết định mở nhỏ: tự mở camera khi vào màn? Khuyến nghị **không** trong PR này (hộp thoại xin quyền ngay khi vào màn, tốn pin, người dùng chưa chắc có mã; thêm sau khi đo trên thiết bị).

### PR-C (việc 5): một quy tắc nền + tiêu đề, ở một nơi

Nguyên nhân gốc: cờ `form` (1.4) gộp hai quyết định không liên quan. Quy tắc đề xuất (mỗi quy tắc đặt ở đúng một nơi):

- **Cỡ tiêu đề = theo vai trò, suy ra từ `onBack`** (không phải từ màn): màn gốc của tab (không có Back) dùng `screenTitle` 24sp; màn đẩy vào có Back dùng `formTitle` 17sp. Đặt trong `ScreenHeader` (`compact = compact ?? Boolean(onBack)`), bỏ `compact={form}` ở `Screen.tsx:78`. Hệ quả: Đơn hàng (gốc tab) lên 24sp giống Cá nhân/Thông báo; Hàng hoàn, Đồng bộ, Tranh chấp (có Back) xuống 17sp giống Tìm đơn gốc/Tạo đơn nhanh. Vị trí tiêu đề còn lệch do nút Back (bản chất), padding đã dùng chung.
- **Nền = một giá trị** `tokens.color.surface.screen` (kem) cho mọi màn; ô nhập đã trắng + viền `border.field` nên đủ tương phản (ảnh `03-returns` ô tìm trắng trên kem). Bỏ nhánh `surface.raised` ở `Screen.tsx:66`; footer theo nền chung. Khuyến nghị này làm bỏ khái niệm "nền form", chỉ còn nhóm chữ `form*` (đã là token riêng).
- Dọn: xóa prop `form` khỏi `Screen` và 14 nơi gọi; cập nhật comment `Screen.tsx:29-33`, `layout.md:176,188`, `shared/ui/README.md`; không thêm token mới (dùng `surface.screen`, `typography.screenTitle/formTitle`). Đổi icon Back 24/26 sang token (nếu `tokens.icon` có cỡ phù hợp; nếu không có, hỏi trước khi thêm token).

Phương án nền khác (đưa người dùng chọn):
- **A. Giữ trắng cho màn nhập liệu thuần** (`QuickOrder`, `ReturnFindOrder`, `DisputeNew`, `ReturnItems`, `DisputeSelectEvidence`), kem cho danh sách/tổng quan/chi tiết. Cần prop ngữ nghĩa mới (ví dụ `surface="plain"`) và bảng phân loại 14 màn; vẫn còn đổi nền khi đi D01 -> D02 -> D03. Chỉ chọn nếu thiết kế (mockup 03) bắt buộc trắng cho form.
- **C. Trắng mọi nơi.** Không khuyến nghị: đảo ngược Bright Orange kem (D-20), Trang chủ/Cá nhân dùng thẻ trắng trên kem.

Khuyến nghị: **B (kem mọi nơi) + tiêu đề theo Back**, vì một quy tắc, ít ngoại lệ nhất, đúng token đã có. Thay đổi nhìn thấy trên nhiều màn (gồm toàn tab Đơn hàng và chi tiết đơn) nên cần người dùng xem ảnh trước/sau và duyệt trước khi hợp nhất. Mockup 03 và ghi chú Q-17l/Q-18m phải được cập nhật trong `decisions.md` (ghi "thay thế một phần Q-17l/Q-18m về nền/tiêu đề; cỡ chữ `form*` giữ").

## 3. Thứ tự và cách tách PR

1. **PR-A** `feat/ui-polish-empty-sync` (nhỏ, độc lập, ít rủi ro): A1 + A2 + A3.
2. **PR-B** `feat/ui-polish-find-order-scan` (nhỏ, độc lập): việc 2.
3. **PR-C** `feat/ui-polish-surface-header` (rộng, chờ người dùng chọn phương án nền/tiêu đề): làm **sau cùng** để A/B không xung đột (PR-C xóa `form` ở `ReturnFindOrderScreen.tsx:213` và các màn khác) và vì nó cần duyệt thiết kế.

A và B có thể song song (không chung tệp); C rebase lên cả hai. Mỗi PR theo `.github/pull_request_template.md`, Conventional Commits tiếng Anh (`feat(returns): ...`, `fix(upload): ...`, `refactor(ui): ...`), CI xanh mới hợp nhất.

## 4. Test cần thêm/sửa

**PR-A**
- Sửa `returns-flow.test.tsx:96-101` (rỗng: không còn nút "Tiếp nhận hàng hoàn" trong `returns-empty`; khẳng định `within(empty).queryByRole('button')` là null, rồi bấm `returns-receive` ở chân màn mở `ROUTES.returnFindOrder`). Giữ `:103-108`. Thêm: khi rỗng không có `returns-search` và chip; có hồ sơ thì có đủ; lọc ra 0 kết quả thì chip vẫn còn.
- Sửa `disputes-flow.test.tsx:97-103` tương tự (`disputes-create`), thêm kiểm chip ẩn khi rỗng.
- Thêm `pickDefaultSyncFilter.test.ts` (bảng: lỗi thắng; chỉ uploading; chỉ waiting; chỉ done/không có -> uploaded; lỗi + uploading -> error).
- `SyncCenterScreen.test.tsx`: thêm (a) chỉ có tệp `queued` -> mở thẳng "Chờ tải", thấy `sync-job-pack:q`; (b) không có tệp nào -> chỉ MỘT thông điệp rỗng (`sync-summary` "none"), không có dòng "Không có tệp ở mục này", không có chip, có nút "Mở danh sách đơn"; (c) tab khác có tệp, tab đang chọn rỗng -> một dòng chữ, không nút; (d) tệp chỉ ở "Đã tải lên" -> mặc định mở "Đã tải lên". Giữ `:199-217` (route/giá trị lạ/mặc định Đang tải), kiểm vẫn xanh.
- `SyncSummaryCard`: test biến thể `none` có `action` (nếu có test riêng; không thì đưa vào test màn).

**PR-B**
- Sửa `returns-flow.test.tsx` mục UI-D02: helper `search()` (`:229-234`) vẫn đúng (gõ rồi bấm); test `:277-281` "ô rỗng khi bấm Tìm" đổi thành "nút Tìm tắt khi ô rỗng" (`accessibilityState.disabled`) và không tra; thêm: ô gõ khoảng trắng chỉ -> vẫn tắt (dùng `typedCode`).
- `ReturnFindOrderScreen.scan.test.tsx`: giữ (testID không đổi); thêm: `return-scan` có `variant` primary khi ô trống và thứ tự trên màn là scan -> code -> search (so `toJSON` hoặc thứ tự `getAllByRole`); gõ mã thì Tìm thành nút chính; panel mở thì ô nhập vẫn có mặt; không quyền camera/camera lỗi vẫn nhập tay và tìm được; chế độ `link` (`returnId` trong params) có cùng bố cục và `return-link-order` ở footer; `return-unlinked` luôn có ở mode new.
- Không test nào được làm mất khẳng định "không tự tạo/tự chọn" (`scan.test.tsx:34-50`).

**PR-C**
- Sửa `OrdersListScreen.test.tsx:107-114` (tiêu đề gốc tab lên `screenTitle` 24sp; test kiểm theo vai trò) và `OrderDetailScreen.test.tsx:78-86` (chi tiết có Back vẫn `formTitle`).
- Thêm test `ScreenHeader`/`Screen` (trong `redesign-components.test.tsx` hoặc tệp mới): có `onBack` -> `formTitle`; không -> `screenTitle`; `Screen` luôn nền `surface.screen`, không còn prop `form`; footer cùng nền.
- Grep và sửa mọi test đo màu nền/`surface.raised` của màn đã đổi; tương phản `theme.test.ts` không đổi (không đổi token).
- Typecheck bắt hết chỗ còn `form` (prop bị xóa).

Lệnh trước khi báo xong: `npm run check` (lint, typecheck, format, check:tokens, jest); không đổi Rules/Functions nên không cần `test:rules`.

## 5. Ảnh trước/sau (`scripts/screens`)

Chụp bằng `scripts/screens/capture.cjs` (bản web, cổng giả, 390x844 và 360x800; xem `scripts/screens/README.md`), thư mục ảnh `docs/assets/screens/<pr>/` kèm README ghi rõ "ảnh web, không phải thiết bị". "Trước" chụp trên `origin/main` (không dùng lại ảnh ở scratchpad vì ngoài repo), "sau" trên nhánh PR. Tệp route mới `scripts/screens/routes/ui-polish.json`:
- PR-A: `/returns`, `/disputes` (rỗng); `/sync` (rỗng); trạng thái có tệp cần dữ liệu cổng giả/thay đổi tạm trong bản sao để chụp Chờ tải, Lỗi, Đã tải lên; `/returns` có hồ sơ (kiểm chip còn).
- PR-B: `/returns/find-order` (rỗng, đã gõ mã, có kết quả; panel quét web hiện "cần camera"/không quyền), và chế độ link (`/returns/find-order?returnId=...` với hồ sơ chưa liên kết, cần dữ liệu tạm).
- PR-C: `/`, `/orders`, `/account`, `/notifications`, `/returns`, `/sync`, `/disputes`, `/returns/find-order`, `/quick-order`, chi tiết đơn; hai cỡ; đặt cạnh nhau trước/sau và kèm ảnh với chữ lớn nếu công cụ hỗ trợ.

## 6. Rủi ro

- **Không có thiết bị thật:** mọi kết quả chỉ qua Jest và ảnh web. Chưa kiểm chứng trên iOS/Android: panel quét camera thật trong bố cục mới (chiều cao `scanPanel.height` + ô nhập bên dưới khi bàn phím mở: `KeyboardAvoidingView`, cuộn tới ô), chữ lớn hệ thống (nút chính + phân cách + ô nhập có thể đẩy "Tìm" xuống dưới màn nhỏ 360x640; cần chụp), tiêu đề 17sp/24sp ở font scale lớn (đã cho xuống dòng).
- PR-A: mặc định `'uploaded'` kích hoạt một lần nạp danh sách đã tải; nếu nạp chậm sẽ thấy skeleton ở lần mở đầu khi không có tệp chờ. Ẩn chip khi cả màn rỗng làm mất lối vào tab "Đã tải lên" nếu danh sách đã tải thực ra có tệp: tránh bằng cách chỉ coi "cả màn rỗng" sau khi `done` đã nạp xong và rỗng.
- PR-A: bỏ nút ở EmptyState làm test hiện có đổi (liệt kê ở mục 4); thông điệp rỗng phải vẫn nói "bấm nút bên dưới" nên chữ cần BA duyệt.
- PR-B: nút Tìm tắt khi ô rỗng nên người dùng không còn thấy thông báo "Mã chưa hợp lệ" khi bấm trống; thay bằng nút tắt (đảm bảo `accessibilityState.disabled` và nhãn; tắt dạng xám có thể bị bỏ qua, nên giữ dòng giới thiệu nói rõ "Quét hoặc nhập mã").
- PR-B: ô nhập vẫn dùng `onSubmitEditing={() => void search()}`: phải bọc điều kiện `typedCode !== ''` để Enter không gọi tra rỗng.
- PR-C: thay đổi nhìn thấy trên gần như mọi màn; có thể làm lệch ảnh trong `docs/assets/screens` cũ và mockup; tương phản chữ `text.strong/subtle` (nhóm form) trên kem `stone[25]` phải đạt 4.5:1 (test `theme.test.ts` cần chạy; nếu rớt thì dùng `text.primary/secondary` cho nhóm form mà không đổi token). Đổi cỡ tiêu đề gốc tab Đơn hàng từ 17 lên 24sp giảm chỗ cho nút "Tạo đơn" ở `headerRight` (`OrdersListScreen.tsx:197-210`); cần chụp ở 360x800 và chữ lớn. Giữ Q-18m là cỡ chữ nội dung `form*`, không đảo.
- Không vi phạm bất biến nghiệp vụ: không đổi dữ liệu, không tự liên kết, không đổi thứ tự lưu/quay; "Không xác định được đơn gốc" luôn còn ở mode new.

## 7. Tiêu chí nghiệm thu

- UI-D02: quét là nút chính đầu màn khi ô trống; nhập tay bên dưới; "Tìm đơn gốc" tắt cho tới khi có mã; một nút chính tại một thời điểm; không quyền camera/camera lỗi vẫn nhập tay và tìm; "Không xác định được đơn gốc" luôn có ở chế độ tạo mới; chế độ liên kết sau cùng bố cục; không tự chọn/tạo/ghép đơn (test cũ vẫn xanh).
- UI-D01/G01: chỉ MỘT nút "Tiếp nhận hàng hoàn"/"Tạo hồ sơ tranh chấp" (chân màn) trên màn rỗng; ô tìm và chip ẩn khi chưa có hồ sơ, hiện khi có hồ sơ hoặc đang lọc ra 0 kết quả.
- UI-F01: tab mặc định theo Lỗi > Đang tải > Chờ tải > Đã tải lên (tab đầu tiên có tệp; không có gì thì "Đã tải lên"), tham số route và lựa chọn tay vẫn thắng; không bao giờ hiện hai thông điệp rỗng cùng lúc; vẫn không có "Xóa tất cả"; nhãn trạng thái không đổi (không hiện "đã sao lưu" sớm).
- UI chung (PR-C, nếu duyệt): một nền cho mọi màn, tiêu đề 24sp ở gốc tab và 17sp ở màn có Back, quy tắc nằm ở `Screen`/`ScreenHeader`, không còn prop `form`; không hex/số thiết kế thô mới (`npm run check:tokens` xanh); docs `layout.md` và `decisions.md` cập nhật.
- `npm run check` xanh; ảnh trước/sau đính vào PR, ghi rõ "bản web, không phải thiết bị".

## 8. Chưa kiểm chứng trên thiết bị

Toàn bộ ba việc (bố cục, chữ lớn, bàn phím, camera quét thật trong bố cục mới, font iOS/Android, tiêu đề ở font scale lớn). Không thay đổi QA-01…14; nên thêm vào lượt thử thiết bị G: quét mã hàng hoàn ở bố cục mới, Android 360x640 chữ lớn.

## 9. Câu hỏi cần người dùng/BA quyết

1. **(PR-C, cần quyết trước khi làm)** Nền: B kem mọi nơi (khuyến nghị) / A trắng cho màn nhập liệu / C trắng mọi nơi. Nếu `form` trắng là chủ ý của mockup 03 cho Tạo đơn nhanh, nói rõ để chọn A cho riêng nhóm đó.
2. **(PR-C)** Cỡ tiêu đề theo vai trò (gốc tab 24sp, có Back 17sp, khuyến nghị) / tất cả 24sp / tất cả 17sp.
3. **(PR-B)** Có tự mở camera khi vào D02 không (khuyến nghị: không, xét lại sau khi đo thiết bị).
4. **(PR-A)** Nút duy nhất ở chân màn (khuyến nghị) hay trong EmptyState.
5. **(C-1, BA)** Duyệt chữ: `returns:find.intro`, `returns:find.orEnter` (mới), `returns:list.emptyMessage`, `disputes:list.emptyMessage`, nhãn nút tắt/`scanManual`, và việc thôi dùng `screens:sync.emptyMessage`.
6. Ghi nhận trong `decisions.md` (Q-xx, "thay thế một phần Q-17l/Q-18m") khi PR-C được duyệt; điều phối/người dùng chốt, không tự chốt.
