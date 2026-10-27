# Khung giao diện (app shell) — Đơn Chứng

> Trạng thái: **khung đã dựng, chờ người dùng duyệt** (ADR-013/014/015 trong [decisions.md](decisions.md)). Điều hướng, bố cục, component dùng chung, màn hình khung và hai màn dựng theo mockup 02 (Trang chủ, Quét mã đơn hàng với camera quét thật, Q-16); **chưa có logic nghiệp vụ, quay video, tải lên hay Firebase**. Nguồn thiết kế: [docs/09](../09-ui-ux-design.md) (mục 2 kiến trúc thông tin, 3 design system, 4 danh mục màn hình, 5.5 đối chiếu mockup). Chưa chạy trên máy ảo/thiết bị thật (xem mục 8).

## 1. Cấu trúc điều hướng

```
src/app/                     Route Expo Router: MỎNG, chỉ `export { XScreen as default } from '@/features/<f>'`
  _layout.tsx                Stack gốc + AppProviders (i18n); màn quay tắt cử chỉ vuốt quay lại
  index.tsx                  UI-A01: chuyển hướng sang /home
  welcome, sign-in, ...      Thiết lập và khôi phục (UI-A02..A09), không có thanh tab
  (tabs)/                    NHÓM CÓ THANH TAB (tên nhóm không xuất hiện trong URL)
    _layout.tsx              <Tabs> đọc danh sách từ TAB_CONFIG
    home/ orders/ account/   mỗi tab một Stack riêng => đi sâu trong tab vẫn thấy thanh tab
    notifications.tsx        tab Thông báo (UI-I07)
    scan-tab.tsx             chỗ giữ của nút Quét giữa thanh tab (chỉ chuyển hướng; mục 6)
  record-pack.tsx            UI-C03 quay đóng gói        (NGOÀI nhóm (tabs)
  record-return.tsx          UI-D04 quay mở kiện hoàn     => thanh tab ẩn)
  pack-confirm / pack-done ...   hậu quay (không tab)
  returns/ sync/             Hàng hoàn (UI-D*), Đồng bộ (UI-F*): ngoài nhóm tab từ D-16, vào từ Trang chủ
  disputes/                  Tranh chấp (UI-G*): không phải tab (O-14)
src/bootstrap/navigation/tab-config.ts   CẤU HÌNH TAB (một nơi duy nhất)
src/core/navigation/routes.ts            Bảng route <-> UI-xx (nguồn duy nhất cho đường dẫn)
src/platform/navigation.ts               Adapter duy nhất gọi Expo Router
```

Quy tắc điều hướng (docs/09 mục 2): bắt đầu tác vụ chính trong ≤ 2–3 thao tác (Trang chủ → *Đóng gói đơn* → quét → quay); **màn quay không có thanh tab**, rời màn bằng nút X, nút Back hoặc cử chỉ đều qua hộp thoại *Giữ video và quay lại* / *Kết thúc phiên* (khung chỉ dẫn sang Xác nhận video, không có đường làm mất phần đã ghi); mỗi màn một hành động chính; luôn có đường quay lại (`useAppNavigation().back` về Tổng quan nếu không có lịch sử).

Thanh tab (D-16, theo mockup 02): **Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân**. **Quét** là nút tròn nổi giữa thanh: không chuyển tab, mở màn quét (UI-B02) toàn màn hình, ẩn thanh tab. **Hàng hoàn và Đồng bộ không còn là tab**: nằm ngoài nhóm `(tabs)`, vào từ Trang chủ. Hồ sơ, cài đặt shop, thành viên, cài đặt thông báo, bảo mật, gói dịch vụ, trợ giúp là các mục của tab **Cá nhân** (UI-I01; thư mục `(tabs)/account/`). Tranh chấp không có tab và hiện **chưa có nút dẫn tới** (cần hồ sơ đơn/hàng hoàn thật; O-14).

## 2. Bảng route ↔ mã `UI-xx`

"Đặc tả quy trình" là mã A01–A08/B01–B08 ([docs/09 ánh xạ](../09-ui-ux-design.md#ánh-xạ-với-đặc-tả-quy-trình)); hai bộ mã không trùng nhau. Bảng này được test đối chiếu với các tệp thật trong `src/app` (`src/bootstrap/navigation/routes.test.ts`). UI-F04 (banner ngoại tuyến) và nhóm UI-J (ngoại lệ) không phải route.

| Đường dẫn | Mã `UI-` | Đặc tả quy trình | Thanh tab | Feature / màn hình | Mức |
|---|---|---|---|---|---|
| `/` | UI-A01 | — | — | `shop`: `SplashScreen` | Màn thật theo thiết kế `docs/assets/ui/06-splash-design.png`, cổng phiên giả, tự chuyển (xem mục 2.4) |
| `/welcome` | UI-A02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `WelcomeScreen` | Màn thật theo mockup 5.1 (xem mục 2.1) |
| `/sign-in` | UI-A03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SignInScreen` | Màn thật theo mockup 05, cổng giả (xem mục 2.3) |
| `/sign-up` | UI-A03 (biến thể đăng ký) | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SignUpScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/forgot-password` | UI-A07 | chưa có đặc tả | ẩn | `shop`: `ForgotPasswordScreen` | Màn thật theo mockup 05, cổng giả (mục 2.3) |
| `/verify-otp` | UI-A08 | chưa có đặc tả | ẩn | `shop`: `VerifyOtpScreen` | Màn thật, cổng giả; chặn vào khi chưa xin mã (mục 2.3) |
| `/new-password` | UI-A09 | chưa có đặc tả | ẩn | `shop`: `NewPasswordScreen` | Màn thật, cổng giả; chặn vào khi chưa có vé (mục 2.3) |
| `/create-shop` | UI-A04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `CreateShopScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/permissions` | UI-A05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PermissionsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/setup-done` | UI-A06 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SetupDoneScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/home` | UI-B01 | A01 | hiện | `orders`: `HomeScreen` | Màn dựng theo mockup 02 (D-16, Q-16) + dữ liệu minh họa |
| `/scan` | UI-B02 | A02 | ẩn (route cấp gốc ngoài nhóm tab) | `orders`: `ScanScreen` | Màn thật theo mockup 02: camera thật (`expo-camera`, ADR-016), nhập tay, đèn pin, xử lý quyền (Q-16) |
| `/home/search` | UI-B03 | A02 | hiện | `orders`: `SearchScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/home/quick-order` | UI-B04 | A02 | hiện | `orders`: `QuickOrderScreen` | Khung có bố cục + dữ liệu minh họa |
| `/home/batch` | UI-B05 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `BatchScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/home/order-preview` | UI-C01 | A03 | hiện | `orders`: `OrderPreviewScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-precheck` | UI-C02 | A04 | ẩn | `packing`: `PackPrecheckScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/record-pack` | UI-C03 | A05 | ẩn | `packing`: `PackRecordScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-confirm` | UI-C04 | A06 | ẩn | `packing`: `PackConfirmScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-saved` | UI-C05 | A07 | ẩn | `upload`: `PackSavedScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/pack-done` | UI-C06 | A08 | ẩn | `packing`: `PackDoneScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns` | UI-D01 | B01 | ẩn | `returns`: `ReturnsListScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns/find-order` | UI-D02 | B02 | ẩn | `returns`: `ReturnFindOrderScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/package-exterior` | UI-D03 | B03 | ẩn | `returns`: `ReturnExteriorScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/record-return` | UI-D04 | B04, B05 | ẩn | `returns`: `ReturnRecordScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns/items-check` | UI-D05 | B06 | ẩn | `returns`: `ReturnItemsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/review` | UI-D06 | B07 | ẩn | `returns`: `ReturnReviewScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/done` | UI-D07 | B08 | ẩn | `returns`: `ReturnDoneScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders` | UI-E01 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrdersListScreen` | Khung có bố cục + dữ liệu minh họa |
| `/orders/[orderId]` | UI-E02 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrderDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/evidence` | UI-E03 | chưa có đặc tả (docs/09 mục 4) | hiện | `evidence`: `OrderEvidenceScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/evidence/[evidenceId]` | UI-E04 | chưa có đặc tả (docs/09 mục 4) | hiện | `evidence`: `EvidenceDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/history` | UI-E05 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrderHistoryScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/sync` | UI-F01 | chưa có đặc tả (docs/09 mục 4) | ẩn | `upload`: `SyncCenterScreen` | Khung có bố cục + dữ liệu minh họa |
| `/sync/[jobId]` | UI-F02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `upload`: `SyncErrorScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/sync/storage` | UI-F03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `upload`: `StorageScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes` | UI-G01 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputesScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/new` | UI-G02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeNewScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/select-evidence` | UI-G03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeSelectEvidenceScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/export` | UI-G04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeExportScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/[disputeId]` | UI-G05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/plan` | UI-H01 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `PlanScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/plans` | UI-H02 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `PlansScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/checkout` | UI-H03 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `CheckoutScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/limit` | UI-H04 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `PlanLimitScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account` | UI-I01 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `ProfileScreen` | Tab Cá nhân: tên shop + danh sách mục (minh họa) |
| `/account/shop-settings` | UI-I02 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `ShopSettingsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/members` | UI-I03 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `MembersScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/notifications` | UI-I04 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `NotificationsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/security` | UI-I05 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `SecurityScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/help` | UI-I06 | chưa có đặc tả (docs/09 mục 4) | hiện | `shop`: `HelpScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/notifications` | UI-I07 | chưa có đặc tả (thêm theo O-26) | hiện | `shop`: `NotificationListScreen` | Placeholder, tab Thông báo |

Màn có bố cục + dữ liệu minh họa: Tổng quan, Trung tâm quét (khung camera giả), Tạo đơn nhanh, Xem nhanh đơn, Màn quay (khung), Xác nhận video, Hoàn tất đóng gói, Danh sách hàng hoàn, Màn quay mở kiện (khung), Danh sách đơn, Trung tâm đồng bộ.

### 2.1 Màn Chào mừng (UI-A02)

Màn thật đầu tiên (docs/09 mục 5.1, mockup `docs/assets/ui/01-onboarding.png`, màn trái nhất). Không dùng `Screen` vì không có thanh tiêu đề; vẫn dùng vùng an toàn, cuộn được khi chữ lớn, hình minh họa thu nhỏ/ẩn khi màn thấp (iPhone SE).

- **Nút**: *Đăng nhập* → `/sign-in`; *Tạo tài khoản* → `/sign-up` (cả hai là màn khung; đăng nhập thật chưa có, O-15). Nút Apple/Google gọi `signInWithProvider` (`src/features/shop/data/auth-gateway.ts`, hiện **không làm gì**, không báo thành công).
- **Cỡ hình và khoảng cách** (hàm thuần `src/features/shop/ui/welcome-layout.ts`, có test): cả hình minh họa co giãn như một khối từ MỘT tham số (chiều cao, `u = cao / 260`): khung `342u x 260u` chứa vòng tròn nền, khiên, hộp, lá (mọi kích thước và độ lệch đều nhân `u`). Chiều cao hình = min(260, chỗ còn lại sau phần chữ/nút/social/pháp lý ước tính); dưới 110 hoặc chữ hệ thống >= 1,25 thì ẩn hình. Màn thấp hơn 700dp dùng khoảng cách dọc thu gọn (12/16 thay vì 24/24); màn rộng dưới 340dp dùng tiêu đề 24/30 thay vì 30/38. Mục tiêu: 375x667 và 320x568 thấy đủ tiêu đề, hai nút, Apple/Google và dòng pháp lý không cần cuộn (320x568 ẩn hình); chữ hệ thống lớn thì cuộn. Hằng số "phần chiều cao ngoài hình" đo trên bản render web, cần đo lại trên thiết bị thật.
- **Cờ cấu hình** `src/core/config/feature-flags.ts` (`SOCIAL_SIGN_IN_FLAGS`): `apple`, `google`, mặc định `true`, hiện trên cả iOS và Android. Cả hai `false` thì ẩn luôn nhóm social và đường kẻ "Hoặc đăng nhập với".
- **URL pháp lý** `src/core/config/legal-links.ts` (`LEGAL_LINKS`): hiện là **URL giữ chỗ** (`*.invalid`, không mở được). Mở bằng `openExternalLink` (`src/platform/external-link.ts`): bắt lỗi, chỉ ghi log (không kèm URL), không văng exception. Thay bằng URL thật khi có trang.
- **Thay hình/logo bằng tệp thật** chỉ ở `src/features/shop/ui/WelcomeIllustration.tsx` (hình giữa) và `src/features/shop/ui/BrandLogo.tsx` (`BrandMark` + chữ). Hiện dựng bằng biểu tượng Ionicons; biểu tượng Apple/Google cũng là glyph Ionicons (`logo-apple`, `logo-google`) trong `Icon.tsx`.
- **Token mới** (`src/core/theme/colors.ts`): `brandDark`, `welcomeBackground`, `welcomeBlob`, `borderSubtle`; có test tương phản.

### 2.4 Splash (UI-A01)

Thiết kế `docs/assets/ui/06-splash-design.png` (docs/09 mục 5.7; quyết định đã duyệt: [decisions.md Q-15](decisions.md), D-15). Màn tĩnh, không nút, không chấm phân trang; route `/` (`src/app/index.tsx` chỉ re-export `SplashScreen`).

- **Luồng khởi động:** `useSplashLaunch` (`src/features/shop/ui/splash/use-splash-launch.ts`) gọi `gateways.session.restore()` **ngay khi mở app** (song song với việc tải ảnh) và đếm hai mốc: `SPLASH_MIN_VISIBLE_MS = 2000` (hiển thị tối thiểu, **tính từ lúc Splash của app thật sự hiện**, tức ảnh minh họa `onLoad`/`onError`, hoặc bố cục không cần ảnh, hoặc quá `SPLASH_HERO_MAX_WAIT_MS = 4000`) và `SPLASH_MAX_WAIT_MS = 3000` (hạn chờ phiên **kể từ lúc mở app**). Hằng số ở **một nơi**: `src/features/shop/domain/launch.ts`. Thời điểm chuyển `T = max(visibleStart + 2000, min(restoreDoneAt, launchAt + 3000))`: không bao giờ chuyển trước khi Splash hiện đủ 2 giây; quá 3 giây mà phiên chưa xong thì dùng `signed_out` và bỏ kết quả đến muộn; cổng lỗi, ném lỗi đồng bộ hoặc trả giá trị lạ cũng là `signed_out`. Lý do: splash hệ điều hành che cho tới khi ảnh xong, nếu tính 2 giây từ lúc hook chạy thì ảnh chậm làm người dùng thấy Splash ngắn hơn 2 giây. Ẩn splash hệ điều hành: khi ảnh xong/lỗi, hoặc không cần ảnh, hoặc gỡ màn (đổi bố cục khi đang chạy không ẩn sớm); `_layout.tsx` giữ đường bảo hiểm 4 giây riêng cho liên kết sâu. Màn đích do hàm thuần `resolveLaunchRoute` (`domain/launch.ts`): `signed_out` -> `/welcome`, `signed_in_no_shop` -> `/create-shop`, `signed_in` -> `/home`; điều hướng bằng `useAppNavigation().reset` (Back không quay lại Splash). Chịu được `StrictMode` (effect chạy hai lần, `restore()` có thể gọi hai lần, vẫn chỉ chuyển một lần). **Chưa chặn truy cập** (route guard là việc sau).
- **Cờ phiên giả `EXPO_PUBLIC_FAKE_SESSION`** = `signed_out` | `no_shop` | `signed_in` (chỉ cổng giả đọc; `data/gateways.ts` `resolveFakeSession`). Không đặt: `__DEV__`/test = `signed_in` (giữ hành vi mở app trước đây); bản dùng cổng giả mà không phải dev (xem trước, `EXPO_PUBLIC_USE_FAKE_BACKEND=1`) = `signed_out`; **bản build thường (không cổng giả) luôn lỗi => `signed_out`**, tức chỉ vào được Chào mừng/đăng nhập (trước đây mọi bản mở thẳng Tổng quan). Muốn vào khung trong bản xem trước: đặt `EXPO_PUBLIC_FAKE_SESSION=signed_in`.
- **Bố cục** (hàm thuần `splash/splash-layout.ts` `computeSplashLayout`, có test ở 390x844, 412x915, 375x667, 320x568, 360x640 và fontScale 1/1,3/2): khối đầu (khiên, tên, khẩu hiệu, hàng 4 tính năng) neo trên + `insets.top`; sóng + câu viết tay neo dưới + `insets.bottom`; ảnh rộng bằng màn (tới 1,02 lần khi còn dư chỗ) đè lên mép trên sóng (sóng phủ mép dưới ảnh, che viền). Màn cao hơn 2:3: phần dư chia vào khoảng cách (giới hạn trên) rồi cho ảnh lớn thêm. Màn thấp: ẩn dần câu viết tay -> hàng tính năng -> khẩu hiệu -> thu nhỏ ảnh (hai mép ảnh làm mờ vào nền khi hẹp hơn màn; dưới 60% thì ẩn ảnh); **khiên + tên luôn hiện**. Chữ hệ thống >= 125%: ẩn hàng tính năng và khẩu hiệu. Chữ thật dùng `maxFontSizeMultiplier` (`FONT_CAPS`), không khóa `allowFontScaling`; nhãn tính năng 12dp, không co theo ảnh.
- **Thành phần** (`src/features/shop/ui/splash/`): `BrandMarkPlay` (logo khiên-play SVG, **bản tạm**), `SplashBackdrop` (nền + hình loang), `SplashHero` (ảnh 3D), `SplashWave` (sóng + gradient), `SplashFeatures` (hàng 4 tính năng, biểu tượng SVG). Câu viết tay và tên/khẩu hiệu ở `SplashScreen.tsx`.
- **Thay logo / ảnh / phông / sóng:** logo ở `BrandMarkPlay.tsx` (nguồn SVG `docs/assets/brand/splash/brand-mark-play.svg`; không đổi `BrandMark`/`StackedBrandLogo` của màn khác, đồng bộ toàn app là việc sau, O-23); ảnh: ghi đè `assets/images/splash/splash-hero.webp` (cùng tỉ lệ 1024x1050; test `splash-assets.test.ts`: WebP có alpha, < 400 KB), bản gốc PNG ở `docs/assets/brand/splash/`, **ảnh giữ nguyên logo sàn trong ảnh (mục 3.1 không cho sửa)**; phông: chỉ `SplashScreen.tsx` (hiện phông hệ thống; O-25); sóng: hai đường dẫn trong `SplashWave.tsx` + `WAVE_VIEWBOX` ở `splash-layout.ts`.
- **Màu** (token trong `src/core/theme/colors.ts`, có test tương phản): `splashBackground` `#F7FAF8` (cũng là nền splash hệ điều hành trong `app.json`; đổi thì đổi cả hai, test đối chiếu), `splashWave` `#14705B` -> `splashWaveDeep` `#0C6753`, `splashTagline` `#0A6550`, `splashLogo` `#026D50`, cùng `splashWordmark`, `splashFeature*`, `splashWaveLight`, `splashBlob`, `splashDivider`, `onSplashWave`. Chữ trắng trên sóng >= 4,5:1.
- **Splash hệ điều hành:** plugin `expo-splash-screen` trong `app.json` (nền + khiên-play giữa màn); adapter `src/platform/native-splash.ts` (`holdNativeSplash` ở `src/app/_layout.tsx`, `hideNativeSplash` khi ảnh 3D xong/lỗi/gỡ màn, bảo hiểm 4 giây ở layout gốc cho trường hợp mở thẳng route khác). Ảnh tạo từ SVG bằng Chromium; icon ứng dụng và adaptive icon **tạm** (O-23). iOS có `fade`, Android 12+ không (platform-support.md mục 4).
- **Trợ năng:** gốc màn `accessible` với nhãn "Đơn Chứng"; mọi thứ khác ẩn khỏi trình đọc màn hình. Không có chuyển động.
- **Không làm:** nút, chấm phân trang, route guard, Firebase thật, đổi logo ở màn khác.

### 2.2 Ba màn thiết lập (UI-A03 đăng ký, UI-A04, UI-A06)

Mockup `docs/assets/ui/01-onboarding.png` (màn 2, 3, 4); chi tiết nghiệp vụ đã chốt ở [docs/09 mục 5.1](../09-ui-ux-design.md) và [decisions.md Q-13](decisions.md). Luồng: `/welcome` -> `/sign-up` -> `/create-shop` -> `/setup-done` -> Tổng quan (`navigation.reset`). Giai đoạn này: giao diện + logic + **cổng giả**; chưa có Firebase thật, Function, Splash, route guard (màn Đăng nhập: mục 2.3).

- **Cấu trúc** (`src/features/shop`): `domain/` (kiểm tra dữ liệu `validation.ts`, nguồn bán `selling-sources.ts`, reducer luồng `onboarding-flow.ts`, kiểu + cổng `types.ts`), `data/` (`fake-gateways.ts`, `unavailable-gateways.ts`, chọn cổng `gateways.ts`), `ui/` (ba màn, `onboarding/` gồm khung cuộn, ô nhập, thanh tiến trình, thẻ nguồn bán, hình minh họa, `OnboardingFlow.tsx`). Route ở `src/app/{sign-up,create-shop,setup-done}.tsx` chỉ re-export.
- **Trạng thái luồng** (`OnboardingFlowProvider`, đặt trong `bootstrap/Providers.tsx`; test dùng `renderWithProviders`): giữ email, tên shop, nguồn bán, tài khoản/shop đã được cổng xác nhận khi quay lại/tiến tới. Không giữ mật khẩu. Mất khi app đóng.
- **Cổng giả và cách bật.** Bản giả (trong bộ nhớ, trễ ~450 ms) dùng khi `__DEV__`, trong test, hoặc `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (ví dụ `EXPO_PUBLIC_USE_FAKE_BACKEND=1 npx expo export --platform web` để chụp ảnh giao diện). Bản build thường (không bật) dùng cổng "chưa kết nối": mọi lời gọi trả `AUTH_SERVICE_UNAVAILABLE`, màn hiện khung lỗi "Hệ thống đang bận" kèm Thử lại và **không điều hướng**. Thử tay trên bản giả: `da.dung@example.com` -> email đã dùng; `mat.mang@example.com` -> mất mạng; mật khẩu `12345678`/`11111111`/`password` -> mật khẩu yếu. Thay bằng Firebase thật: sửa `createGateways()` ở `data/gateways.ts` (Firebase Auth + Function callable `createShop`, điều kiện ở decisions.md Q-13).
- **Hiển thị lỗi (UI-A03 đăng ký):** lỗi theo ô (`IconField` nhận `error` + `errorAction`) nằm ngay dưới ô, chữ cỡ 14 màu `ink`, biểu tượng cảnh báo và viền ô đỏ, `accessibilityRole=alert`; lỗi chung dùng `FormErrorBanner` (nền `dangerSoft`, chữ `ink`, viền `danger`, câu đầu đậm, nút Thử lại) và tự cuộn vào vùng nhìn. Hai thông báo hai câu lấy `title`/`hint` từ `errors.json` (`resolveErrorMessage`). `computeSignUpLayout` nhận `errors` (ước tính chiều cao dòng lỗi/khung) để hình minh họa nhường chỗ trước, rồi cuộn; test ở 375x667 và 320x568. Thử tay trên bản giả: thêm `he.thong.ban@example.com` chỉ có trong bản sao chụp ảnh, không có trong repo (chưa có kịch bản "hệ thống bận" trong cổng giả; test dùng `failNext`).
- **Cờ cấu hình:** nhóm "Hoặc đăng ký với" dùng lại `SOCIAL_SIGN_IN_FLAGS` (mục 2.1): cờ tắt thì ẩn nút; cả hai tắt thì ẩn luôn đường kẻ.
- **Bố cục** (`ui/onboarding-layout.ts`, hàm thuần có test ở 390x844, 375x667, 320x568, 412x915): mỗi màn tính cỡ chữ, khoảng cách (thu gọn dưới 700dp, lề 20 và tiêu đề nhỏ dưới 340dp) và chiều cao hình; quy tắc chung: hình co rồi **ẩn trước khi** nội dung thiết yếu bị cắt; không vừa thì cuộn (`ScrollView` + `flexGrow`). Hiện tại: 390x844 và 412x915 cả ba màn vừa không cuộn; 375x667 và 320x568 màn đăng ký vừa (ẩn hình), màn tạo shop cuộn (4 thẻ nguồn bán + trường + nút không vừa 568/667dp), màn hoàn tất vừa (320x568 ẩn hình). Hằng số "chiều cao ngoài chữ" và hệ số độ rộng chữ đã đối chiếu với bản render web, **cần đo lại trên thiết bị thật** (SF/Roboto khác font web).
- **Bàn phím:** `KeyboardAvoidingView` (qua `@/platform`) + cuộn tới ô đang nhập khi nhận focus (`useScrollIntoView`); `keyboardShouldPersistTaps="handled"`. Email: `keyboardType=email-address`, `autoComplete=email`, `textContentType=emailAddress`, không tự viết hoa; mật khẩu: `autoComplete=new-password`, `textContentType=newPassword`, `passwordRules`; Return: email -> mật khẩu -> gửi. Viền focus mặc định của trình duyệt được bỏ qua `getInputResetStyle()` (chỉ bản web).
- **Điều hướng:** `AppNavigation.reset(route)` (`@/platform/navigation`) xóa lịch sử rồi hiển thị route; dùng ở "Bắt đầu sử dụng". Màn Hoàn tất bật `useConfirmBeforeLeave(true, ...)` để chặn Back hệ thống/cử chỉ.
- **Thay hình/icon bằng tệp thật:** hình khiên/hộp/bảng ghi/pháo giấy ở `ui/onboarding/OnboardingIllustrations.tsx` (hình học theo một tham số chiều cao ở `onboarding-layout.ts`); icon nguồn bán ở `SourceIcon` (xem 3.1); biểu tượng thêm vào bảng `ICON_GLYPHS` (`shared/ui/Icon.tsx`). Phông chữ vẫn là phông hệ thống (mockup dùng phông hình học khác).
- **Token:** đổi `brand` thành `#157852` (khớp nút chính trong mockup; ảnh hưởng mọi màn); thêm `ink`, `inkMuted`, `onboardingBackground`, `fieldBorder` (có test tương phản). `Button` có thêm `loading`.
- **Chưa kiểm chứng:** máy thật iOS/Android (bàn phím thật, Back phần cứng, autofill/gợi ý mật khẩu, bố cục với tai thỏ/thanh điều hướng, font scale), nút hiện/ẩn mật khẩu trên iOS (đổi `secureTextEntry` có thể xóa nội dung khi gõ tiếp), độ giống mockup mới kiểm bằng bản render web (không phải native).

## 3. Design system (`src/shared/ui`)

Token ở `src/core/theme` (màu, chữ, khoảng cách, bo góc, vùng chạm); component lấy qua `useTheme()` (sẵn chỗ cho chế độ tối khi O-17 chốt). Chuỗi UI ở `src/core/i18n/locales/vi/{common,nav,screens,evidence}.json`.

| Component | Việc | Ghi chú đáng nhớ |
|---|---|---|
| `Screen` (+`ScreenHeader`) | Khung màn: vùng an toàn, tiêu đề, banner ngoại tuyến, nội dung cuộn, `footer` ghim đáy, tránh bàn phím | `inTabs` khi nằm trong thanh tab (không cộng vùng an toàn đáy lần nữa); `illustrative` hiện ghi chú dữ liệu minh họa |
| `Text` | Chữ theo `typography`, tôn trọng font scale | Không khóa `allowFontScaling` |
| `Button` | Chính / phụ / phá hủy | `minHeight` (44 iOS / 48 Android qua `@/platform`; chính ≥ 56) chứ không cố định chiều cao; đỏ chỉ cho phá hủy; nhãn cụ thể |
| `ActionCard` | Hai nút lớn của Tổng quan | Một `primary`, một `secondary` |
| `Card`, `OrderCard` | Thẻ; thẻ đơn (mã, nguồn, ngày, số video, một trạng thái) | Mã đơn chỉ là chuỗi hiển thị, không phải ID |
| `ProductLineList` | Dòng sản phẩm (tên, variant, số lượng, nguồn "Do bạn nhập") | Nhãn *Chưa khai báo sản phẩm* chỉ khi chưa có dòng nào |
| `TextField`, `SearchField`, `QuantityStepper`, `FilterChips` | Nhập, tìm, số lượng (mặc định 1), lọc | Chip xuống dòng thay vì cuộn ngang |
| `EvidenceStatusBadge` | 6 nhãn trạng thái bằng chứng (docs/09 mục 3) | Chữ + biểu tượng riêng + viền; *Đã lưu trên máy* không tick/màu thành công; tiến độ % chỉ khi `uploading` và có số đo |
| `SyncStatusBar` | Khối đồng bộ (lỗi/chờ/đang tải) | Dùng nhãn chuẩn; ghi chú tải nền có thể tạm dừng |
| `OfflineBanner` | Banner ngoại tuyến (UI-F04) | Hiện qua `Screen` khi `useIsOffline()` (hiện luôn `false`, xem mục 7) |
| `EmptyState`, `Skeleton`/`SkeletonCard` | Trống có hành động cụ thể; giữ chỗ khi tải | Skeleton tĩnh, không hiệu ứng |
| `BottomSheet`, `ConfirmDialog` | Lựa chọn ngắn; xác nhận | `ConfirmDialog` có `destructive` và `primary` để lối an toàn là nút chính |
| `RecordingFrame` | Khung màn quay dùng chung C03/D04 | Không tab, chặn rời màn, không nút thư viện (O-02), vùng xem trước là placeholder |
| `PlaceholderScreen` | Màn khung (route + tiêu đề + lối quay lại) | Mã `UI-xx` chỉ hiện ở bản dev |
| `Icon` | Tên biểu tượng trừu tượng → glyph Ionicons | Đổi bộ icon chỉ sửa `Icon.tsx` |

Dữ liệu minh họa nằm ở **một tệp** `src/shared/fixtures/illustrative-data.ts` (tiền tố `ILLUSTRATIVE_*`, mã đơn `DEMO-xxxx`); khi nối dữ liệu thật thay từng chỗ import bằng hook ở `data/` của feature rồi xóa tệp này.

### 2.3 Đăng nhập và khôi phục mật khẩu (UI-A03 đăng nhập, UI-A07, UI-A08, UI-A09)

Mockup `docs/assets/ui/05-sign-in-and-recovery.png`; nghiệp vụ và điểm lệch: [docs/09 mục 5.6](../09-ui-ux-design.md), [decisions.md Q-14](decisions.md). Giai đoạn này: giao diện + logic + **cổng giả**; chưa Firebase thật, chưa Splash/route guard toàn app.

- **Mã** (`src/features/shop`): `domain/` (`mask-email.ts`, `otp.ts` gồm lọc chữ số + đếm ngược theo mốc, `recovery-flow.ts` reducer, `validation.ts` thêm `validateConfirmPassword`), `data/` (cổng mở rộng, bản giả, bản "chưa kết nối"), `ui/` (`SignInScreen`, `ForgotPasswordScreen`, `VerifyOtpScreen`, `NewPasswordScreen`, `auth-layout.ts`, `onboarding/AuthParts.tsx` gồm `OtpBoxes`/`TipCard`/`RequirementCard`/`SocialIconRow`/`useCountdown`, `AuthIllustrations.tsx`, `useGatewayTask.ts`). Route chỉ re-export ở `src/app/{sign-in,forgot-password,verify-otp,new-password}.tsx`.
- **Cổng `AuthGateway`:** `signInWithPassword` -> `SignedInAccount` (có `hasShop`), `requestPasswordRecovery` -> `{retryAfterSeconds?}` (trung tính), `verifyRecoveryCode` -> `{ticket}`, `resetPassword({ticket,newPassword})`. Bản "chưa kết nối" luôn `AUTH_SERVICE_UNAVAILABLE`.
- **Trạng thái luồng** (`OnboardingFlowProvider`, thêm `recovery`): email đang gõ, email đã xin mã, mốc cho phép gửi lại, "vé" (+ hạn nếu cổng báo), cờ banner, **email điền sẵn cho Đăng nhập (dùng một lần)**. Chỉ trong bộ nhớ, không lưu đĩa, không log; **không** chứa mật khẩu hay mã OTP đang gõ. Chặn vào màn: `/verify-otp` cần đã xin mã (không thì về `/forgot-password`), `/new-password` cần vé (không thì về `/verify-otp` hoặc `/forgot-password`); kiểm tra một lần lúc mở màn. Rời luồng (màn Quên mật khẩu bị gỡ, "Quay lại đăng nhập"), đổi email hoặc đặt lại xong thì xóa email đã xin mã/vé (`left_flow`, `reset_completed`, `email_changed`). Nhập mã xong dùng `replace` sang Mật khẩu mới nên Back về Quên mật khẩu. Đặt lại xong dùng `reset(signIn)`; email đi qua `signInEmail` của trạng thái luồng, không qua tham số (adapter `reset` vẫn nhận `params?` cho nơi khác). `useGatewayTask` truyền `isActive()` (adapter `useIsScreenActive`, dựa `useFocusEffect`) để kết quả cổng đến muộn không điều hướng. Ô OTP không có `maxLength`.
- **Chạy bản giả:** mặc định ở `__DEV__`/test, hoặc `EXPO_PUBLIC_USE_FAKE_BACKEND=1`. Tài khoản dev (CHỈ bản giả): `demo@example.com` / `demo-matkhau-1` (có shop), `chua.co.shop@example.com` (cùng mật khẩu, chưa có shop). Mã xác minh đúng **`123456`** (chỉ bản giả). Kịch bản theo email: `mat.mang@example.com` (mạng lỗi), `he.thong.ban@example.com` (hệ thống bận), `qua.nhieu.lan@example.com` (quá nhiều lần), `ma.het.han@example.com` (mã hết hạn ngay), `phien.het.han@example.com` (phiên đặt lại hết hạn ngay). Sai 5 lần (đăng nhập hoặc nhập mã) hoặc xin mã quá 5 lần: `AUTH_TOO_MANY_REQUESTS`. Email không tồn tại vẫn "gửi mã" nhưng mã không bao giờ đúng. Tài khoản vừa tạo ở màn đăng ký đăng nhập được trong cùng phiên chạy (coi như chưa có shop). Test dùng `failNext(code)` và đồng hồ giả (`now`).
- **Bố cục** (`ui/auth-layout.ts`, hàm thuần có test 390x844, 412x915, 375x667, 320x568 và quét kích thước): hình co rồi ẩn trước khi nội dung bị cắt. Ước tính tại 375x667: đăng nhập ẩn hình (vừa, không cuộn), quên mật khẩu hình 150, nhập mã hình 119, mật khẩu mới hình 130; tại 320x568 cả bốn ẩn hình, riêng đăng nhập cần cuộn. Hằng số đã đối chiếu với bản render web; **cần đo lại trên thiết bị thật**.
- **Chưa kiểm chứng:** máy thật iOS/Android; bàn phím số và gợi ý/tự điền mã (`textContentType=oneTimeCode`, `autoComplete=one-time-code`; mã gửi qua email nên iOS/Android có thể không tự điền); trình quản lý mật khẩu; VoiceOver/TalkBack (ô nhập mã trong suốt + 6 ô vẽ ẩn khỏi trình đọc).

### 3.1 Icon nguồn bán (`SourceIcon`)

- Thành phần `SourceIcon` (`src/shared/ui/SourceIcon.tsx`, props `{ source: OrderSource; size?: number }`, mặc định 36) là nơi duy nhất quyết định hình của nguồn bán. Dùng ở: thẻ chọn nguồn (Tạo hồ sơ shop), chip nguồn ở Tạo đơn nhanh (qua `ChipOption.leading`), thẻ nguồn ở Xem nhanh đơn, `OrderCard` (Tổng quan, Đơn hàng). Hàng "Nguồn bán" ở màn Hoàn tất (nhiều nguồn) giữ icon chung.
- Shopee và TikTok Shop dùng ảnh thật `assets/images/sources/{shopee,tiktok-shop}.png` (256x256), đặt trong ô vuông bo góc nền trắng, viền mảnh để logo nền trắng và logo nền trong suốt trông đồng bộ. **Thay ảnh:** ghi đè hai tệp này (giữ vuông, <= 512px, < 100 KB; test `source-assets.test.ts` kiểm); bản gốc người dùng cung cấp lưu ở `docs/assets/brand/sources/`. Lazada (chưa có logo) và Khác dùng ô màu + ký hiệu dự phòng trong cùng tệp. Thêm nguồn mới: thêm vào `ORDER_SOURCES`, nhãn i18n, và một mục trong `LOGOS` hoặc `FALLBACK_TILES`.
- Icon là trang trí: ẩn khỏi trình đọc màn hình vì nhãn chữ luôn đi kèm. Không bao giờ dùng icon thay cho chữ.
- **Quy tắc dùng logo bên thứ ba:** không chỉnh sửa logo (không đổi màu, cắt, méo, xóa nền, thêm hiệu ứng); không dùng theo cách gợi ý Đơn Chứng là đối tác, được chứng nhận hay đã tích hợp với sàn (chưa có tích hợp; dữ liệu đơn do người dùng nhập, CLAUDE.md #10). Logo chỉ để người dùng nhận ra kênh bán họ tự chọn.
- **Ngoại lệ Splash (D-15, decisions.md Q-15):** ảnh minh họa 3D của Splash (`assets/images/splash/splash-hero.webp`) có sẵn logo Shopee/TikTok/Lazada và được giữ nguyên theo thiết kế do chủ sản phẩm duyệt; không cắt/xóa/vẽ đè lên logo trong ảnh. Rủi ro (gợi ý đã tích hợp/đối tác, nhãn hiệu) cần kiểm tra trước phát hành; ảnh là bản tạm, sẽ thay (O-24).

## 4. Quy tắc bố cục iOS và Android (D-12)

- Mọi màn dùng `Screen`: header tự vẽ (`headerShown: false`) để hai nền tảng giống nhau và **tràn viền Android** (edge-to-edge) đúng; inset trên/dưới lấy từ `react-native-safe-area-context`.
- Khác biệt nền tảng chỉ ở `src/platform/layout.ts` (`getMinTouchTarget`, `getKeyboardAvoidingBehavior`); **không** gọi `Platform.OS` trong màn hình/component.
- Vùng chạm ≥ 44pt iOS / 48dp Android; kích thước chỉ đặt `minHeight`/`minWidth`; nhãn nút tự xuống dòng. Chữ lớn: nội dung co giãn hết cỡ; riêng nhãn thanh tab giới hạn 1,3× để thanh không vỡ.
- Nút chính ghim đáy qua `footer` của `Screen`, được `KeyboardAvoidingView` đẩy lên khỏi bàn phím; nội dung cuộn có `keyboardShouldPersistTaps="handled"`.
- Không dựa vào màu: mọi trạng thái có chữ + biểu tượng; đỏ chỉ cho lỗi/phá hủy; cần chú ý dùng cam.
- Không hiệu ứng trang trí, không đổ bóng; mỗi màn một hành động chính nổi bật.
- Câu chữ trung thực (CLAUDE.md #11): không "an toàn/đã sao lưu" trước khi *Đã xác minh*; không hứa tải nền tự hoàn tất.

## 5. Cách thêm một màn hình

1. Chọn mã `UI-xx` trong docs/09 mục 4 (không thêm màn ngoài danh mục). Mã mới phải có trong `UI_CODES` và `nav.json` (`titles.UI-xx`).
2. Thêm một dòng vào `ROUTES` (`src/core/navigation/routes.ts`): đường dẫn, mã `UI-xx`, `tabBar` (true nếu nằm trong tab).
3. Viết màn hình ở `src/features/<feature>/ui/` dùng `Screen` + component dùng chung; chuỗi qua `t('...')` (ESLint cấm văn bản cứng trong JSX); điều hướng qua `useAppNavigation()` và `ROUTES.*`; đặt `testID="screen-UI-xx"`. Xuất qua `index.ts` của feature.
4. Tạo tệp route mỏng ở `src/app/...` (nằm trong `(tabs)/<tab>/` nếu cần thanh tab): `export { XScreen as default } from '@/features/<feature>';`.
5. Chạy `npm run check`: `routes.test.ts` bắt route lệch bảng, `screens-render.test.tsx` render mọi route.
6. Cần màn quay mới: đặt **ngoài** `(tabs)`, dùng `RecordingFrame`, thêm `gestureEnabled: false` ở `_layout.tsx` gốc.

## 6. Thanh tab và nút Quét giữa (D-16)

Danh sách tab chỉ ở `src/bootstrap/navigation/tab-config.ts` (`TAB_CONFIG`); `(tabs)/_layout.tsx` lặp qua nó. Mục có `action: true` (Quét) là **nút nổi giữa**, không phải tab thật: `_layout.tsx` chặn `tabPress` và `router.push(ROUTES.scan.path)`, vẽ bằng `ScanTabButton` (`src/bootstrap/navigation/ScanTabButton.tsx`). Tệp `(tabs)/scan-tab.tsx` chỉ là chỗ giữ cho navigator (chuyển hướng tới màn quét khi mở bằng liên kết sâu); `routes.test.ts` loại nó khỏi phép đối chiếu với `ROUTES`.

Màn quét `/scan` là **route cấp gốc ngoài nhóm tab** (`src/app/scan.tsx`) để Back về đúng màn đứng trước khi bấm Quét, từ tab nào cũng vậy (nếu để trong stack của một tab thì Back luôn về tab đó). Tạo đơn nhanh và Tìm đơn đã lưu vẫn ở `(tabs)/home` và mở từ `/scan`; Back từ Tạo đơn nhanh quay về màn quét (có test điều hướng thật). `routes.ts` đặt `tabBar: false` cho route ngoài nhóm tab; `isTabBarHiddenAt(pathname)` vẫn là cơ chế chung để ẩn thanh tab theo đường dẫn.

Thêm/bớt tab: sửa `TAB_CONFIG`, tạo/xóa tệp hoặc thư mục tương ứng trong `(tabs)/`, thêm nhãn `nav:tabs.*`, sửa `tab-config.test.ts` và `app-navigation.test.tsx`. Hàng hoàn và Đồng bộ ngoài nhóm tab: `src/app/returns/*`, `src/app/sync/*`.

## 7. Giới hạn đã biết của khung

- Dữ liệu là minh họa; tìm/lọc chạy trên dữ liệu giả cục bộ. Không lưu gì; tham số route (mã đơn, sản phẩm nhập) chỉ truyền giữa màn.
- `useIsOffline()` (`src/platform/connectivity.ts`) là **stub luôn trả `false`** (chưa chọn thư viện theo dõi mạng); `OfflineBanner` đã sẵn.
- Camera **quét mã** (UI-B02) đã có thật (`expo-camera`, ADR-016) nhưng chưa kiểm chứng trên thiết bị; camera **quay video** chưa có (nút *Xem lại video*, *Ghi thêm đoạn riêng* đang tắt).
- Gợi ý sản phẩm theo lịch sử (UI-B04), chọn nguồn/thời gian ở danh sách đơn (UI-E01), thử lại tệp (UI-F01) chưa làm vì cần dữ liệu/hàng đợi thật.
- Splash (UI-A01, mục 2.4) chạy bằng cổng phiên giả; chưa có luồng đăng nhập thật (O-15) nên **chưa chặn truy cập** (route guard là việc sau). Bản build thường luôn vào Chào mừng (cổng "chưa kết nối"). Ba màn thiết lập (mục 2.2) chạy bằng cổng giả: chưa tạo tài khoản/shop thật. Splash hệ điều hành, icon (tạm), tải ảnh 3D, WebP alpha, tràn viền Android và vùng an toàn thật **chưa kiểm chứng trên thiết bị**; ảnh chụp đối chiếu thiết kế là render web.
- Chào mừng: liên kết Điều khoản/Quyền riêng tư là chữ trong câu nên vùng chạm nhỏ hơn 44/48 (Text lồng không có `hitSlop`); cần đánh giá trên thiết bị.
- Font icon tải bất đồng bộ lần đầu: icon có thể hiện trễ một nhịp.

## 8. Kiểm chứng

Đã chạy: `npm run check` (lint, typecheck, format, unit test), `npx expo export --platform ios` và `--platform android` (đóng gói JS thành công). Các test render từng route, kiểm tra thanh tab (bằng router thật trong bộ nhớ), màn quay ẩn tab và chặn rời màn, `ConfirmDialog`, `EvidenceStatusBadge`, vùng chạm theo nền tảng, tương phản màu.

**Chưa kiểm chứng** (chưa có máy ảo/thiết bị/Xcode/Android SDK): bố cục thật trên iOS/Android (tai thỏ, thanh điều hướng Android 3 nút/cử chỉ, edge-to-edge), `KeyboardAvoidingView` trên Android tràn viền, Back phần cứng và cử chỉ vuốt ở màn quay, font scale lớn thật, màn hình nhỏ (iPhone SE), độ mượt, tải font icon. Cần chạy nghiệm thu UI/UX ([docs/09 mục 8](../09-ui-ux-design.md#8-nghiệm-thu-uiux)) trên thiết bị trước khi đánh dấu.
