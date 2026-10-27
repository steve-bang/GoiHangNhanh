# Kế hoạch triển khai tab Cá nhân (PER-01…PER-24)

> Trạng thái: **kế hoạch đã được người dùng duyệt để lập tài liệu; Q-19a đã chốt: giữ 5 tab (D-16); các câu b–h ở mục 9 (Q-19, O-29) vẫn chưa chốt.** Triển khai theo từng PR ở mục 6, chỉ sau khi người dùng cho phép.

## 1. Bối cảnh

BA giao đặc tả tab Cá nhân gồm 24 màn/chức năng (PER-01…PER-24). Mã `PER-xx` **chưa tồn tại trong repo**: repo dùng mã `UI-xx` (docs/09). Tab Cá nhân hiện là khung: `ProfileScreen` (UI-I01) hiển thị tên shop minh họa và 6 mục menu, các màn UI-I02…I06 và UI-H01…H04 là màn khung. Chưa có đăng xuất, hồ sơ, đổi mật khẩu, xóa tài khoản, Firebase thật, route guard.

Ràng buộc: giữ **5 tab** theo D-16 (đặc tả BA ghi "4 tab"; không đổi navigation, Q-19a đã chốt: giữ 5 tab); tuân theo các bất biến trong `CLAUDE.md` (không chức năng giả, ngôn ngữ trung thực, không xóa dữ liệu cục bộ chưa đồng bộ).

## 2. Hiện trạng đã xác minh trong mã (2026-10-27)

| Hạng mục | Hiện trạng |
|---|---|
| Thanh tab | `src/bootstrap/navigation/tab-config.ts`: 5 mục, `account` → `ROUTES.profile` (`UI-I01`). |
| Route | `src/app/(tabs)/account/{index,shop-settings,members,notifications,security,plan,plans,checkout,limit,help}.tsx` đều là tệp mỏng re-export từ `@/features/shop`. `ROUTES` ở `src/core/navigation/routes.ts` (profile, shopSettings, members, notifications, security, help, plan, plans, checkout, planLimit; `notificationList` = `/notifications`, UI-I07). Nhãn ở `src/core/i18n/locales/vi/nav.json`. |
| Cổng (port) | `src/features/shop/domain/types.ts`: `AuthGateway` (signUp, signInWithProvider, signInWithPassword, requestPasswordRecovery, verifyRecoveryCode, resetPassword), `ShopGateway` (createShop, updateShop), `SessionGateway` (`restore`), `Gateways`. Bản giả `data/fake-gateways.ts`, bản `unavailable-gateways.ts`. **Thiếu**: `signOut`, `changePassword`, `deleteAccount`, `getProfile/updateProfile`, kiểu `UserProfile`. |
| Phiên | Chỉ đọc một lần ở Splash (`SessionGateway.restore`); chưa có session context toàn app; chưa có route guard. |
| Kho đơn | `src/features/orders/domain/order-store.ts` (`OrderStore`): không có API xóa hay đếm "chưa đồng bộ"; `current-shop.ts` luôn trả `LOCAL_SHOP_ID` (Q-17). |
| Mạng | `src/platform/connectivity.ts`: `useIsOffline()` là stub luôn `false`. |
| Component dùng chung | Đã có: `Card`, `ConfirmDialog`, `BottomSheet`, `Skeleton`, `EmptyState`, `OfflineBanner`, `TextField`, `ScreenHeader`, `Button` (có `loading`), `Screen`, `Text`, `Icon`. **Chưa có**: `ListItem/Row`, `Switch`, `Toast`, `FormField/PasswordField` (nhãn + lỗi), `Avatar`, `StatusBadge` chung (chỉ có `EvidenceStatusBadge`), `ErrorState`. |
| Cấu hình | `src/core/config/legal-links.ts` đã có (dùng ở màn Chào mừng); `feature-flags.ts`. |
| Test mẫu | `src/features/shop/ui/account-switch.test.tsx` (mẫu test đổi tài khoản), `tab-config.test.ts`, `app-navigation.test.tsx`, `screens-render.test.tsx`, `routes.test.ts`. |
| Đăng nhập | **D-13 đã chốt**: bản đầu chỉ email + mật khẩu (cộng Apple/Google qua cờ), mật khẩu từ 8 ký tự. Vì vậy PER-04 (đổi mật khẩu) có ý nghĩa với tài khoản email; với tài khoản Apple/Google phải ẩn (Q-19c). |

### Sai khác so với bản kế hoạch ban đầu
- Q-19c (phương thức đăng nhập) **đã được D-13 trả lời một phần**: chỉ cần hỏi BA hành vi PER-04 với tài khoản Apple/Google. O-15 vẫn mở cho phần Firebase thật.
- `ProfileScreen` hiện nằm ở `src/features/shop/ui/ProfileScreen.tsx` và dùng `ILLUSTRATIVE_SHOP_NAME` (cờ `illustrative`); việc chuyển sang feature `personal` ở PR1/PR2 phải bỏ dữ liệu minh họa khỏi màn này.
- Không có sai khác khác: các phát hiện còn lại của kế hoạch khớp mã.

## 3. Ánh xạ PER → UI (đề xuất, chờ BA chốt ở Q-19b)

| PER | Nội dung | Mã UI đề xuất |
|---|---|---|
| PER-01 | Màn Cá nhân | UI-I01 |
| PER-02, PER-03 | Xem/sửa hồ sơ (họ tên) | Mã UI mới (BA gán), hoặc gộp vào UI-I01 |
| PER-04 | Đổi mật khẩu | UI-I05 (Bảo mật và dữ liệu) |
| PER-05, 06, 07 | Cửa hàng: xem, sửa, chuyển shop | UI-I02 |
| (thành viên) | Thành viên và quyền | UI-I03 (hoãn, O-03/O-07) |
| PER-08, 09, 10 | Gói, so sánh gói, thanh toán | UI-H01, H02, H03 |
| PER-11, 12 | Dung lượng/dữ liệu bằng chứng; giới hạn | Mã UI mới (BA gán); liên quan UI-H04 |
| PER-13 | Cài đặt thông báo | UI-I04 |
| PER-14, 15, 22 | Quyền riêng tư; phiên/thiết bị; xóa tài khoản | UI-I05 |
| PER-16, 17, 18 | Trợ giúp, điều khoản, gửi hỗ trợ | UI-I06 |
| PER-19, 20 | Liên hệ; thông tin ứng dụng | UI mới hoặc gộp UI-I01/I05/I06 |
| PER-21 | Đăng xuất (dialog xác nhận) | Dialog; UI-J15 khi còn tệp cục bộ chưa đồng bộ |
| PER-23 | Thành phần dùng chung (trạng thái tải/lỗi/offline) | Không phải màn |
| PER-24 | Chưa phân loại rõ trong kế hoạch: "Sắp có" | BA xác nhận ở Q-19b |

Mọi mã UI mới phải được thêm đồng thời vào `ROUTES`/`UI_CODES`, `nav.json` và docs/09 (layout.md mục 5).

## 4. Phân loại theo khả năng thật (không chức năng giả)

- **Làm thật với cổng giả**: PER-01, 02, 03 (họ tên), 04, 05, 06, 21, 13 (lưu tùy chọn cục bộ/giả), 16/17 (nội dung tĩnh trong app), 19 (liên kết trong `legal-links.ts`), 20.
- **Chỉ hiện trạng thái trung thực "Chưa khả dụng / Sắp có"**: PER-08/09/10 (giá, thanh toán, dung lượng, ngày hết hạn chưa có nguồn: O-06, O-16), PER-12, PER-15 (cần auth theo dõi phiên), thành viên (O-03, O-07), PER-24.
- **Hoãn tới khi chốt**: PER-22 xóa tài khoản (chưa có chính sách), PER-18 gửi hỗ trợ thật (chưa có kênh; tạm mở email/liên kết), PER-07 khi chỉ có một shop (ẩn mục).
- **PER-11**: khi chưa có dữ liệu hiện nhãn "Không xác định được trạng thái"; liên kết sang Trung tâm đồng bộ (UI-F01). Không hiện số giả.
- Không hứa "đã sao lưu", không hứa tải nền khi app bị dừng (bất biến 3, 11).

## 5. Kiến trúc đề xuất

- **Feature mới** `src/features/personal/{domain,data,ui}` theo conventions mục 3: `domain` TypeScript thuần; `ui` không import SDK; feature khác chỉ import qua `@/features/personal`. Route mỏng ở `src/app/(tabs)/account/` đổi sang re-export từ `@/features/personal`; `features/shop` giữ phần thiết lập tài khoản/shop (onboarding).
- **Cổng mới**: `AccountGateway` (`getProfile`, `updateProfile`, `changePassword`, `signOut`, `deleteAccount`) và `SettingsGateway` (tùy chọn thông báo/quyền riêng tư). Bản giả có `latencyMs`/`failNext` như `fake-gateways.ts`; bản `unavailable` ném lỗi dịch vụ. Lỗi ném dạng `AppError`; không tự đặt mã mới (xem 5.1).
- **`SessionProvider` toàn app** (user, shop, `signOut`): khi đăng xuất hoặc đổi shop phải xóa toàn bộ state/cache trong bộ nhớ; mọi query/state key chứa `uid + shopId` để không rò dữ liệu tài khoản cũ.
- **`OrderStore`** (cả `memory-order-store.ts` và `sqlite-order-store.ts`, kèm `order-store.contract.ts`): thêm `countUnsynced(shopId)` và hàm kiểm tra "đang quay" (từ `packing_sessions`). **Không** xóa dữ liệu cục bộ khi đăng xuất (Q-19h). Hôm nay chưa có tệp bằng chứng thật (`loadEvidenceStates` trả rỗng, Q-18): nếu nguồn chưa thật thì UI/PR phải ghi rõ, **không trả số giả**.
- **Component dùng chung mới** trong `src/shared/ui`: `ListItem`, `Switch`, `Toast`, `FormField/PasswordField`, `StatusBadge`, `Avatar`, `ErrorState` (thử lại theo từng khu vực). Chỉ dùng token (`useTheme().tokens`), không hex/số thiết kế; cập nhật `src/shared/ui/README.md` và `index.ts`.
- **i18n**: chuỗi trong `src/core/i18n/locales/vi/personal.json` (đăng ký namespace), cấm văn bản cứng trong JSX.
- **Trạng thái từng khu vực** (hồ sơ/cửa hàng/gói) độc lập; kéo để làm mới; giữ vị trí cuộn; offline hiển thị dữ liệu đã lưu kèm nhãn.
- **Platform**: khác biệt iOS/Android (xin quyền thông báo, mở cài đặt hệ thống, mở email) đặt sau `src/platform/`, không rải `Platform.OS`.

### 5.1 Mã lỗi
Chỉ dùng mã có sẵn trong `src/core/errors/codes.ts`. Mã mới (ví dụ đổi mật khẩu sai mật khẩu hiện tại, phiên hết hạn, đăng xuất lỗi) được đề xuất ở decisions.md để BA đặt tên chính thức trước khi thêm vào `codes.ts`/`errors.json`.

## 6. Chia PR, tệp chính và tiêu chí xong

Mỗi PR nhỏ, độc lập, `npm run check` xanh, ghi rõ "chưa kiểm chứng trên thiết bị iOS/Android".

### PR1 — Nền tảng
- **Trạng thái: đã làm trên nhánh `claude/personal-tab-pr1-foundation` (chưa mở PR).** Lệch so với kế hoạch: chưa có `deleteAccount` trong `AccountGateway` (Q-19e chưa chốt); `SettingsGateway` chỉ có tùy chọn thông báo; `SessionProvider` ở `features/personal/ui` chưa nối vào Splash/đăng nhập (làm ở PR sau); không thêm mã UI/route/`nav.json` (Q-19b chưa chốt); mã lỗi mới chỉ đề xuất ở Q-19i; `getInitials` đặt ở `shared/ui`; `ErrorState` nhận chuỗi đã dịch (helper tra mã lỗi `errors:<mã>` dùng chung chưa tách khỏi `features/shop`).
- Tệp: `src/shared/ui/{ListItem,Switch,Toast,FormField,StatusBadge,Avatar,ErrorState}.tsx` (+ test, `index.ts`, README); `src/features/personal/domain/{types,validation}.ts`; `src/features/personal/data/{account-gateway,fake-account-gateway,unavailable-account-gateway}.ts`; `SessionProvider`; `locales/vi/personal.json`; mã UI/`ROUTES` mới (nếu BA gán); cập nhật `routes.test.ts`.
- Xong khi: component có test render/a11y (vai trò, nhãn, vùng chạm tối thiểu, cỡ chữ lớn); cổng giả có test `failNext`/độ trễ; không đổi hành vi màn hiện có.

### PR2 — PER-01, 02, 03, 04
- **Trạng thái: đã làm PHẦN PER-01 và xem hồ sơ trên nhánh `claude/personal-tab-pr2-profile` (chưa mở PR); PER-02 sửa họ tên, PER-03, PER-04 đổi mật khẩu CHƯA làm vì chưa có mã UI (Q-19k).** Đã thêm `getShopSummary()` vào `AccountGateway` (thẻ shop), `Screen.refreshControl`, helper lỗi dùng chung ở `core/i18n/error-message`; `SignInScreen` ghi phiên (`beginSession`, `shopId` chưa biết); Splash chưa nối vì `SessionGateway.restore` không trả danh tính. Q-19i đã chốt (5 mã lỗi), họ tên tối đa 50 ký tự (tạm, Q-19j). Ánh xạ UI cho PER-02/03/04 chưa dùng được: `routes.test.ts` chỉ cho phép UI-A03 có hai route, nên màn Sửa hồ sơ/Đổi mật khẩu chờ Q-19b (xem decisions.md Q-19k).
- Tệp: `src/features/personal/ui/{ProfileScreen,EditProfileScreen,ChangePasswordScreen}.tsx` (chuyển `ProfileScreen` từ `features/shop`); cập nhật `src/app/(tabs)/account/*.tsx`; xóa dùng `ILLUSTRATIVE_SHOP_NAME`; test `screens-render`, `app-navigation`.
- Xong khi: skeleton, lỗi cục bộ có thử lại, dữ liệu đã lưu khi offline; kiểm tra họ tên và mật khẩu (từ 8 ký tự, D-13) bằng hàm thuần có test; PER-04 ẩn với tài khoản Apple/Google (theo Q-19c).

### PR3 — PER-21 đăng xuất an toàn
- Tệp: `order-store.ts` + hai bản cài đặt + `order-store.contract.ts` (`countUnsynced`, kiểm tra đang quay); dialog `ConfirmDialog` + UI-J15; xả state trong `SessionProvider`; test mẫu theo `account-switch.test.tsx`.
- Xong khi: còn tệp chưa đồng bộ/đang quay thì cảnh báo rõ (UI-J15), không chặn mù; không xóa dữ liệu cục bộ; sau đăng xuất không còn state tài khoản cũ (test không rò dữ liệu); lỗi đăng xuất không báo thành công giả.

### PR4 — PER-05, 06, 07 cửa hàng
- Tệp: `ShopSettingsScreen` (UI-I02) dùng `ShopGateway.updateShop`; chọn shop chỉ hiện khi có hơn một shop; dialog xác nhận và xóa cache khi đổi shop.
- Xong khi: đổi tên shop không đổi lịch sử bằng chứng (docs/09 UI-I02); test cô lập theo `shopId`; không biến thành trang quản lý danh mục sản phẩm.

### PR5 — PER-08, 11, 12 gói và dữ liệu bằng chứng
- Tệp: `PlanScreen` (UI-H01), mục dung lượng/dữ liệu; `StatusBadge`.
- Xong khi: hiện "Chưa khả dụng/Sắp có" đúng nơi chưa có nguồn; không số liệu, giá hay hạn giả; liên kết tới UI-F01.

### PR6 — PER-16, 17, 18, 19, 20 trợ giúp và thông tin
- Tệp: `HelpScreen` (UI-I06), nội dung tĩnh trong `locales/vi`; `legal-links.ts`; màn thông tin ứng dụng (phiên bản từ cấu hình Expo).
- Xong khi: không câu quảng cáo "bằng chứng pháp lý tuyệt đối" hay hứa thắng khiếu nại (test i18n cụm cấm); PER-18 chỉ mở email/liên kết tạm, ghi rõ chưa có kênh gửi thật.

### PR7 — PER-13, 14 thông báo và quyền riêng tư
- Tệp: `NotificationSettingsScreen` (UI-I04), `SettingsGateway`; adapter xin quyền thông báo trong `src/platform/`.
- Xong khi: xin quyền hệ điều hành có giải thích trước; từ chối quyền hiển thị đúng; không báo từng video tải thành công (docs/09 UI-I04); tùy chọn lưu cục bộ/giả và ghi rõ.

### PR8 — Sau khi chốt
PER-09/10 (thanh toán), PER-15 (phiên/thiết bị), PER-22 (xóa tài khoản), PER-24, thành viên (UI-I03). Mỗi mục cần quyết định ở mục 9 và có thể cần Cloud Functions + Security Rules (kèm test emulator, gồm truy cập chéo shop).

## 7. Kiểm thử

- Unit: hook/domain, kiểm tra biểu mẫu, đăng xuất/đổi shop (mẫu `account-switch.test.tsx`), hợp đồng `OrderStore`, cập nhật `tab-config.test.ts`, `app-navigation.test.tsx`, `screens-render.test.tsx`, `routes.test.ts`, test i18n cụm cấm.
- `npm run check` xanh trước khi báo xong; kiểm tra cỡ chữ lớn và a11y.
- QA nghiệm thu: ánh xạ 25 mục của BA vào `docs/engineering/testing.md` khi PR1 hợp nhất.
- Chưa tự động hóa được: xin quyền thông báo, mở cài đặt hệ thống, hành vi trên iOS/Android thật (theo `platform-support.md`).

## 8. Rủi ro

- `OrderStore` chưa có nguồn thật cho "đang quay/chưa đồng bộ" (chưa có tệp bằng chứng): cảnh báo đăng xuất chỉ chính xác sau khi có ghi hình/tải lên thật.
- `shopId` đang là `LOCAL_SHOP_ID`: đổi shop chỉ có nghĩa sau khi có Firebase và `current-shop.ts` đọc từ phiên.
- Xóa tài khoản dính chính sách lưu trữ (docs/06) và bất biến 9 (không xóa bằng chứng đang giữ do tranh chấp).

## 9. Câu hỏi mở

Ghi ở [decisions.md Q-19](decisions.md) và [README O-29](../README.md): (a) ~~5 tab hay 4 tab~~ **đã chốt: giữ 5 tab**; (b) bảng ánh xạ PER ↔ UI và mã UI mới; (c) PER-04 với tài khoản Apple/Google; (d) gói và thanh toán (O-06, O-16); (e) xóa tài khoản; (f) nhiều shop/thành viên/phân quyền (O-03, O-07); (g) nội dung trợ giúp, kênh hỗ trợ, URL pháp lý; (h) chính sách dữ liệu cục bộ sau đăng xuất. Không câu nào được tự chốt trong mã.
