# V1-05 personal-firebase — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 2.2, 3.0, 3.3 V1-05, 7.5. Quyết định tự chốt: [decisions.md](../decisions.md) `#### Q-29 / V1-05 — personal-firebase`.

## Mục tiêu

Ở bản Firebase thật, tab Cá nhân không còn hàng nào người dùng chạm tới được mà báo "chưa kết nối" (`AUTH_SERVICE_UNAVAILABLE`), trừ khi thật sự mất dịch vụ:

1. Đổi mật khẩu: xác thực lại bằng mật khẩu hiện tại rồi `updatePassword`.
2. Đổi họ tên: Auth `updateProfile({ displayName })`.
3. Danh sách cửa hàng: `userShops/{uid}` + `shops/{id}` + `members/{uid}` (server chỉ cho một shop/tài khoản, nên trả 0 hoặc 1 phần tử).
4. Đổi tên cửa hàng: Function `updateShop` có sẵn (giữ nguyên nguồn bán đang lưu).
5. Chuyển cửa hàng: trả lời thật (không còn "chưa kết nối"): chỉ shop đang dùng hợp lệ; shop khác `SHOP_SWITCH_FAILED`. Các chặn hiện có ở `use-switch-shop.ts` (đang quay, tệp chưa đồng bộ) giữ nguyên, không đụng.
6. Ẩn Cài đặt thông báo (UI-I04) ở menu Cá nhân cho v1 (`account-menu.ts`, `availability: 'hidden'`).

Không có quản lý thành viên. Không đổi Rules/Functions (Rules đọc `userShops`, `shops/{id}`, `members/{uid}` đã có và đã có test emulator gồm truy cập chéo shop: `firestore.rules.test.ts` mục "đọc thông tin shop và vai trò", "userShops").

## Thiết kế

**Hợp đồng API** (`src/api/contract`):
- `AuthApi.changePassword({ currentPassword, newPassword }): Promise<void>`: chỉ resolve khi máy chủ xác nhận. Lỗi: `AUTH_WRONG_CURRENT_PASSWORD`, `AUTH_WEAK_PASSWORD`, `AUTH_REQUIRES_RECENT_LOGIN`, `AUTH_SESSION_EXPIRED`, `AUTH_TOO_MANY_REQUESTS`, `AUTH_NETWORK_ERROR`.
- `AuthApi.updateDisplayName(displayName): Promise<{ displayName }>`.
- `ShopApi.listMyShops(): Promise<readonly ShopDetails[]>`.
- `ShopApi.renameShop(shopId, name): Promise<ShopDetails>`: đổi tên, giữ nguyên nguồn bán; `SHOP_PERMISSION_DENIED` khi không được sửa, `SHOP_SAVE_FAILED` khi shop không đọc được/dữ liệu bị từ chối.

Lý do `renameShop` thay vì gọi thẳng `updateShop` ở cổng cá nhân: Function `updateShop` đòi cả `sellingSources` (ghi đè), nên cần đọc nguồn bán đang lưu trước; và ánh xạ `functions/permission-denied` -> `SHOP_PERMISSION_DENIED` phải nằm trong `api/firebase` (chỗ duy nhất biết mã SDK). Luồng thiết lập shop vẫn dùng `updateShop` như cũ (không đổi ánh xạ lỗi của luồng đó).

**Firebase** (`src/api/firebase`):
- `ops.ts`: `changePassword(current, next)` (`auth.currentUser`; thiếu người dùng/email -> lỗi `auth/no-current-user`; `reauthenticateWithCredential(user, EmailAuthProvider.credential(email, current))` rồi `updatePassword`), `updateDisplayName(name)` (`updateProfile`), `readShopSellingSources(shopId)` (mảng chuỗi; không phải mảng -> `null`).
- `error-map.ts`: `guard(call, overrides?)` cho ánh xạ theo ngữ cảnh; thêm vào bảng chung `auth/requires-recent-login` -> `AUTH_REQUIRES_RECENT_LOGIN`, `auth/user-token-expired` và `auth/no-current-user` -> `AUTH_SESSION_EXPIRED` (chỉ xảy ra ở thao tác trên người dùng hiện tại).
- `firebase-api.ts`: `changePassword` ánh xạ riêng `auth/wrong-password`, `auth/invalid-credential` -> `AUTH_WRONG_CURRENT_PASSWORD` (ở đăng nhập vẫn là `AUTH_INVALID_CREDENTIALS`), `auth/user-mismatch`, `auth/user-not-found` -> `AUTH_SESSION_EXPIRED`, `auth/password-does-not-meet-requirements` -> `AUTH_WEAK_PASSWORD`. `renameShop`: đọc chi tiết + quyền (`readShopDetails`), không `canEdit` -> `SHOP_PERMISSION_DENIED` không gọi Function; đọc nguồn bán; gọi `updateShop`; `functions/permission-denied` -> `SHOP_PERMISSION_DENIED`, `functions/invalid-argument`/`not-found` -> `SHOP_SAVE_FAILED`. `listMyShops`: `readShopId` (SDK tự dùng đệm khi offline) -> `readShopDetails`; chưa đăng nhập -> `AUTH_SESSION_EXPIRED`.
- **Fake** (`api/fake`) và **unavailable** (`api/unavailable`) hiện thực đủ bốn hàm (bản giả nhớ tài khoản đang đăng nhập sau `signUp`/`signIn`).

**Cổng cá nhân Firebase** (`features/personal/data/firebase-personal-gateways.ts`): `listShops`, `updateShopName`, `updateProfile` (chuẩn hóa tên như bản giả; trả hồ sơ với tên mới máy chủ đã nhận), `changePassword`, `switchShop` (đọc `listShops` + `identity`; chỉ shop đang dùng -> trả về; khác -> `SHOP_SWITCH_FAILED`). `settings` giữ "chưa kết nối" (mục menu đã ẩn).

**Menu** (`account-menu.ts`): `notifications` -> `hidden` ở mọi chế độ (một chỗ). Màn UI-I04 và route giữ nguyên (deep link vẫn mở được; chặn route là V1-06).

## Tệp

`src/api/contract/{auth,shop}.ts`, `src/api/{fake/fake-api,unavailable/unavailable-api}.ts`, `src/api/contract-tests/api.contract.ts`, `src/api/firebase/{ops,error-map,firebase-api}.ts` (+test), `src/features/personal/data/firebase-personal-gateways.ts` (+test), `src/features/personal/ui/account-menu.ts`, `ProfileScreen.test.tsx`, `decisions.md`, `personal-tab-plan.md` (ghi chú hiện trạng), `firebase-setup.md` (kiểm chứng trên thiết bị), `CHANGELOG.md`.

**Migration/Rules/Functions/thư viện:** không.

## Test

- Hợp đồng (bản giả + Firebase với `FirebaseOps` giả): đổi mật khẩu sai mật khẩu hiện tại -> `AUTH_WRONG_CURRENT_PASSWORD`, đúng -> đăng nhập được bằng mật khẩu mới, mật khẩu cũ không; đổi họ tên trả tên mới; `listMyShops` có shop vừa tạo; `renameShop` đổi tên, giữ nguồn bán.
- `firebase-api.test.ts`: ánh xạ `auth/wrong-password`, `auth/invalid-credential`, `auth/requires-recent-login`, `auth/weak-password`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/no-current-user`; `renameShop` không gọi Function khi không có quyền, `functions/permission-denied` -> `SHOP_PERMISSION_DENIED`, giữ nguồn bán; `listMyShops` rỗng khi chưa có shop.
- `ops.test.ts`: `changePassword` xác thực lại TRƯỚC `updatePassword`, xác thực lại lỗi thì không đổi; không có người dùng -> `auth/no-current-user`; `readShopSellingSources`.
- `firebase-personal-gateways.test.tsx`: bốn hàm mới; `switchShop` shop khác -> `SHOP_SWITCH_FAILED`; `settings` vẫn chưa kết nối.
- `ProfileScreen.test.tsx`: menu không còn Cài đặt thông báo.

## Ảnh (bản web, cổng giả)

Cá nhân (menu sau khi ẩn), Cài đặt cửa hàng, Sửa tên cửa hàng, Đổi mật khẩu (lỗi mật khẩu hiện tại sai), Sửa họ tên. Hiển thị các màn con không đổi; chỉ menu Cá nhân đổi.

## Rủi ro

- Chưa chạy trên thiết bị/Auth emulator: `reauthenticateWithCredential`/`updatePassword`/`updateProfile` chỉ qua test `FirebaseOps` giả và typecheck.
- `renameShop` đọc rồi ghi nguồn bán (Function ghi đè cả hai trường): sửa nguồn bán ở máy khác giữa hai bước có thể bị ghi đè. v1 chỉ sửa nguồn bán trong luồng thiết lập, một máy: chấp nhận, ghi ở decisions. Hướng sửa sau: Function nhận cập nhật từng phần.
- Đổi mật khẩu: Firebase thu hồi refresh token ở máy khác; máy này vẫn đăng nhập (SDK làm mới token).
- `displayName` hiển thị ở máy khác chỉ cập nhật sau khi SDK làm mới người dùng.

Tự review: đã chấp nhận. Điểm đã sửa khi review: (1) bỏ ý định gọi `updateShop` từ cổng cá nhân (sẽ phải biết mã SDK và có nguy cơ ghi đè nguồn bán bằng mảng rỗng) -> `renameShop` trong `api/firebase`, nguồn bán không đọc được thì `SHOP_SAVE_FAILED`, không gửi `[]`; (2) `switchShop` không đổi phiên sang shop mà `userShops` không trỏ tới (lần mở sau sẽ lệch shop) -> chỉ chấp nhận shop đang dùng; (3) không đổi ánh xạ lỗi của luồng thiết lập shop; (4) không đụng `session.identity`/SessionProvider (V1-06 song song). Bất biến: không báo thành công trước khi máy chủ xác nhận (#3, #11); cô lập shop do Rules + Function kiểm `members` (#8); đổi tên shop có kiểm toán phía máy chủ sẵn trong `updateShop` (#7); không đụng bằng chứng.
