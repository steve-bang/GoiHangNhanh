# V1-06 session-guard — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 3.0, 3.3 V1-06, 7.5; `CLAUDE.md` "Cần lưu ý khi làm tiếp" (đơn ở `LOCAL_SHOP_ID` không bao giờ đăng); [decisions.md](../decisions.md) Q-17d, Q-20p, Q-20t.

## Mục tiêu

1. Ở bản Firebase (và "chưa kết nối"), không vào màn nghiệp vụ khi **chưa đăng nhập** (kể cả mở bằng liên kết sâu `doncung://…`) hoặc **chưa có cửa hàng**.
2. Không tạo đơn, phiên quay, hồ sơ hàng hoàn khi phiên **chưa biết `shopId`** (không còn bản ghi mới mang `LOCAL_SHOP_ID` ở bản Firebase), kể cả khi offline lần đầu chưa có bộ nhớ đệm `userShops/{uid}`.
3. Không cắt ngang màn quay (bất biến 2): chặn **trước** khi tạo phiên/bắt đầu quay; khi màn quay đã mở thì giữ nguyên.
4. Cổng giả (dev, test, bản web chụp ảnh) giữ hành vi cũ.

## Hiện trạng (đã đọc mã)

- `SessionProvider` bắt đầu `signed_out` và không phân biệt "chưa nạp" với "đã xác nhận chưa đăng nhập". `SessionHydrator` chỉ gắn trong `src/app/(tabs)/_layout.tsx`, nên mở thẳng `/quick-order` bằng liên kết sâu thì phiên không bao giờ được nạp.
- `useCurrentShopId()` rơi về `LOCAL_SHOP_ID` khi phiên chưa biết shop: mọi màn ghi (Tạo đơn nhanh, bắt đầu quay, tạo hồ sơ hoàn) ghi vào `local-shop`, không bao giờ đăng lên máy chủ.
- `api.session.identity()` ném lỗi khi offline và chưa có đệm `userShops` (không bịa shop): `SessionHydrator` thử lại khi foreground/có mạng.

## Thiết kế

**Chế độ chặt (`strict`).** `requiresKnownShop(env)` ở `features/personal/data/session-mode.ts`: `true` khi `resolveBackendMode(env) !== 'fake'` (Firebase hoặc "chưa kết nối"); cổng giả = `false` (giữ hành vi cũ). `SessionProvider` nhận prop `requireKnownShop` (mặc định theo môi trường, test truyền thẳng).

**Trạng thái nạp phiên.** `SessionProvider` thêm `hydration: 'pending' | 'failed' | 'settled'` và `retryHydration()`. `SessionHydrator` báo kết quả: có câu trả lời dứt khoát (có danh tính hoặc chưa đăng nhập) -> `settled`; lỗi -> `failed` (vẫn tự thử lại như cũ). `beginSession` (đăng nhập/tạo shop) cũng đặt `settled`. `retryHydration` = thử ngay, bỏ qua khoảng tối thiểu 10 giây (người dùng bấm), vẫn không chạy chồng.

**Gắn `SessionHydrator` ở gốc** (`AppProviders`) thay vì trong nhóm `(tabs)`, để liên kết sâu tới màn ngoài tab cũng được nạp phiên. Không đổi Splash (đã khách xác nhận); hydrator không hiển thị gì, không điều hướng.

**Đánh giá cổng (domain thuần, `features/personal/domain/session-gate.ts`).** `evaluateSessionGate({ strict, status, shopId, hydration })`:

| Điều kiện | Kết quả |
|---|---|
| `!strict` | `open` (giữ hành vi cũ) |
| `signed_in` + có `shopId` | `open` |
| `signed_in` + `shopId` null | `no_shop` -> thay bằng Tạo cửa hàng (`ROUTES.createShop`, giống Splash `signed_in_no_shop`) |
| chưa đăng nhập + `hydration = settled` | `signed_out` -> về Chào mừng (`reset`) |
| chưa đăng nhập + `pending` | `loading` (màn chờ ngắn, không hiện dữ liệu `local-shop`) |
| chưa đăng nhập + `failed` | `unreachable` -> "Chưa kết nối được cửa hàng" + Thử lại |

**Component `SessionGate`** (`features/personal/ui/SessionGate.tsx`) + hook `useRequireSession({ latch })` và HOC `withSessionGate(Component, { latch })`. Gắn ở: `src/app/(tabs)/_layout.tsx` (mọi tab), và các route ngoài tab: `scan`, `quick-order`, `order-preview`, `pack-precheck`, `record-pack` (latch), `pack-confirm`, `pack-done`, `pack-saved`, `record-return` (latch), `returns/*`, `disputes/*`, `sync/*`. Không gắn ở Splash, Chào mừng, đăng nhập/đăng ký/khôi phục mật khẩu, Tạo cửa hàng, Hoàn tất thiết lập, Quyền (luồng trước khi vào app).

**Latch cho màn quay.** Màn quay chỉ mở được khi cổng `open` (phiên/kiện đã tạo dưới shop đã biết, bất biến 2). Khi đã mở, `latch` giữ nội dung dù phiên đổi sau đó (đăng xuất/chuyển shop vốn đã bị chặn khi đang quay), để guard không bao giờ gỡ màn quay giữa chừng. Các màn khác không latch: đăng xuất ở tab Cá nhân thì cổng của nhóm tab đưa về Chào mừng (luồng đăng xuất cũng `reset` về Chào mừng: hai lần `reset` về cùng một màn, vô hại).

**Lớp phòng thủ thứ hai ở chỗ ghi.** `CurrentShopProvider` nhận thêm `strict`; hook mới `useWritableShopId(): ShopId | null` (null khi strict và chưa biết shop). Dùng ở: `QuickOrderScreen` (lưu đơn), `useStartPacking` (tạo phiên quay, trước `saveSession`), `useReturnOps.createReturn`. Null -> không ghi, báo lỗi bằng mã **đã có** (`ORDER_SAVE_FAILED`, `RETURN_SAVE_FAILED`: "chưa lưu được", đúng sự thật vì không có gì được ghi). Trên thực tế không tới được vì cổng đã chặn ở route; mã riêng `SHOP_NOT_READY` đề xuất cho BA (Q-29). `useCurrentShopId()` giữ nguyên (đọc) để không đổi các màn chỉ đọc.

**Dữ liệu cũ ở `LOCAL_SHOP_ID`.** Không gán lại, không xóa, không migration (chi tiết và lý do: decisions `Q-29 / V1-06`). Bản Firebase không hiện chúng (truy vấn theo shop thật, bất biến 8).

## Chuỗi mới (i18n, `personal.json`, chờ BA)

- `sessionGate.loadingTitle`: "Đang nạp thông tin cửa hàng…"
- `sessionGate.unreachableTitle`: "Chưa kết nối được cửa hàng."
- `sessionGate.unreachableHint`: "Bạn kiểm tra mạng rồi thử lại nhé. Dữ liệu trên máy vẫn được giữ."

## Migration / Rules / Functions

Không.

## Test

- `session-gate.test.ts`: bảng quyết định đủ mọi tổ hợp.
- `SessionHydrator.test.tsx`: báo `settled`/`failed`; `retryHydration` thử ngay, không chạy chồng.
- `SessionGate.test.tsx` (strict): chưa đăng nhập -> `reset(welcome)`; chưa có shop -> `reset(createShop)`; lỗi nạp -> trạng thái "Chưa kết nối được cửa hàng" + Thử lại gọi lại cổng, có mạng thì mở; đang nạp -> không render con; latch giữ con khi phiên đổi; không strict -> render con ngay.
- `QuickOrderScreen` strict + chưa biết shop -> không gọi `saveNewOrder`; `useStartPacking` -> không gọi `saveSession`; `createReturn` -> không gọi kho.
- Router thật (`expo-router/testing-library`, strict bằng mock `session-mode`): liên kết sâu `/quick-order` khi chưa đăng nhập -> Chào mừng; có phiên + shop -> mở màn.
- Các test hiện có (cổng giả) không đổi.

## Màn cần chụp

Trạng thái "Chưa kết nối được cửa hàng" (UI mới của cổng) ở `/quick-order` và `/home`; màn "Đang nạp". Dựng bằng thay đổi tạm trong nhánh nháp (ép strict + cổng giả ném lỗi khi nạp danh tính), liệt kê trong README ảnh.

## Rủi ro

- Offline lần đầu chưa có đệm `userShops`: không tạo đơn/quay được tới khi có mạng (đánh đổi đúng bất biến 8). Splash khi `restore()` lỗi vẫn về Chào mừng như cũ (không đổi màn đã xác nhận); hydrator ở gốc vẫn thử lại và nạp phiên khi có mạng, nhưng không tự điều hướng khỏi Chào mừng.
- Hydrator chạy ở gốc nên chạy cả khi đang ở Chào mừng: thêm một lần `identity()` (đọc đệm `userShops`, rẻ) mỗi lần mở app.
- `unreachable` không có lối đăng xuất; nếu `identity()` lỗi vĩnh viễn (không phải mạng) người dùng kẹt ở màn này tới khi sửa. Hôm nay chỉ xảy ra khi tài khoản Auth không có email (không có với email/mật khẩu).
- Chưa kiểm chứng trên thiết bị: liên kết sâu thật, nháy màn chờ khi mở app.

## Tự review

Vòng 1 (bất biến 1–11, dữ liệu, kích thước):

- Bất biến 2: ban đầu định chặn cả màn quay theo trạng thái phiên mọi lúc -> có thể gỡ màn đang quay nếu phiên đổi. **Sửa:** thêm `latch` cho `record-pack`/`record-return`; chặn ở chỗ tạo phiên (`useStartPacking`) trước khi điều hướng tới màn quay.
- Bất biến 5/8: phương án gán lại dữ liệu `local-shop` vào shop thật bị loại (không chứng minh được chủ; `created_by` có thể rỗng) -> giữ nguyên.
- Rủi ro "đang nạp" bị hiểu nhầm là "chưa đăng nhập" -> thêm `hydration` thay vì suy từ `status`.
- Liên kết sâu tới màn ngoài tab không có hydrator -> chuyển hydrator lên gốc.
- Mã lỗi mới: không thêm vào `codes.ts`; dùng mã có sẵn, đề xuất `SHOP_NOT_READY`.
- Kích thước: ước ~400 dòng mã (không tính test), dưới ngân sách 1500.

Vòng 2: kiểm tương tác với đăng xuất (hai `reset` về Chào mừng, chấp nhận), với đăng nhập (`beginSession` đặt `settled` để không hiện "đang nạp" sau khi đăng nhập xong), với cổng giả (không đổi). Không còn điểm cần sửa.

**Tự review: đã chấp nhận.** Điểm đã sửa: latch màn quay; hydrator lên gốc; trạng thái `hydration` riêng; không gán lại dữ liệu cũ.
