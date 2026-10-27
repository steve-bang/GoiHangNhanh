# Khung giao diện (app shell) — Đơn Chứng

> Trạng thái: **khung đã dựng, chờ người dùng duyệt** (ADR-013/014/015 trong [decisions.md](decisions.md)). Chỉ có điều hướng, bố cục, component dùng chung và màn hình khung; **chưa có logic nghiệp vụ, camera, tải lên hay Firebase**. Nguồn thiết kế: [docs/09](../09-ui-ux-design.md) (mục 2 kiến trúc thông tin, 3 design system, 4 danh mục màn hình, 5.5 đối chiếu mockup). Chưa chạy trên máy ảo/thiết bị thật (xem mục 8).

## 1. Cấu trúc điều hướng

```
src/app/                     Route Expo Router: MỎNG, chỉ `export { XScreen as default } from '@/features/<f>'`
  _layout.tsx                Stack gốc + AppProviders (i18n); màn quay tắt cử chỉ vuốt quay lại
  index.tsx                  UI-A01: chuyển hướng sang /home
  welcome, sign-in, ...      Thiết lập (UI-A02..A06), không có thanh tab
  (tabs)/                    NHÓM CÓ THANH TAB (tên nhóm không xuất hiện trong URL)
    _layout.tsx              <Tabs> đọc danh sách từ TAB_CONFIG
    home/ orders/ returns/ sync/   mỗi tab một Stack riêng => đi sâu trong tab vẫn thấy thanh tab
  record-pack.tsx            UI-C03 quay đóng gói        (NGOÀI nhóm (tabs)
  record-return.tsx          UI-D04 quay mở kiện hoàn     => thanh tab ẩn)
  pack-confirm / pack-done ...   hậu quay (không tab)
  account/                   Hồ sơ, cài đặt, gói (UI-H*, UI-I*): mở từ menu tài khoản
  disputes/                  Tranh chấp (UI-G*): không phải tab (O-14)
src/bootstrap/navigation/tab-config.ts   CẤU HÌNH TAB (một nơi duy nhất)
src/core/navigation/routes.ts            Bảng route <-> UI-xx (nguồn duy nhất cho đường dẫn)
src/platform/navigation.ts               Adapter duy nhất gọi Expo Router
```

Quy tắc điều hướng (docs/09 mục 2): bắt đầu tác vụ chính trong ≤ 2–3 thao tác (Tổng quan → *Đóng gói đơn* → quét → quay); **màn quay không có thanh tab**, rời màn bằng nút X, nút Back hoặc cử chỉ đều qua hộp thoại *Giữ video và quay lại* / *Kết thúc phiên* (khung chỉ dẫn sang Xác nhận video, không có đường làm mất phần đã ghi); mỗi màn một hành động chính; luôn có đường quay lại (`useAppNavigation().back` về Tổng quan nếu không có lịch sử).

Thanh tab (D-11): **Tổng quan · Đơn hàng · Hàng hoàn · Đồng bộ**. Hồ sơ, cài đặt, thành viên, thông báo, bảo mật, gói dịch vụ, trợ giúp ở **menu tài khoản** (`AccountMenuButton`, góc trên các màn gốc của tab). Tranh chấp không có tab và hiện **chưa có nút dẫn tới** (cần hồ sơ đơn/hàng hoàn thật; O-14).

## 2. Bảng route ↔ mã `UI-xx`

"Đặc tả quy trình" là mã A01–A08/B01–B08 ([docs/09 ánh xạ](../09-ui-ux-design.md#ánh-xạ-với-đặc-tả-quy-trình)); hai bộ mã không trùng nhau. Bảng này được test đối chiếu với các tệp thật trong `src/app` (`src/bootstrap/navigation/routes.test.ts`). UI-F04 (banner ngoại tuyến) và nhóm UI-J (ngoại lệ) không phải route.

| Đường dẫn | Mã `UI-` | Đặc tả quy trình | Thanh tab | Feature / màn hình | Mức |
|---|---|---|---|---|---|
| `/` | UI-A01 | — | — | `src/app/index.tsx` (chuyển hướng sang `/home`) | Chuyển hướng |
| `/welcome` | UI-A02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `WelcomeScreen` | Màn thật theo mockup 5.1 (xem mục 2.1) |
| `/sign-in` | UI-A03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SignInScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/sign-up` | UI-A03 (biến thể đăng ký) | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SignUpScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/create-shop` | UI-A04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `CreateShopScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/permissions` | UI-A05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PermissionsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/setup-done` | UI-A06 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SetupDoneScreen` | Màn thật theo mockup 5.1, cổng giả (xem mục 2.2) |
| `/home` | UI-B01 | A01 | hiện | `orders`: `HomeScreen` | Khung có bố cục + dữ liệu minh họa |
| `/home/scan` | UI-B02 | A02 | hiện | `orders`: `ScanScreen` | Khung có bố cục + dữ liệu minh họa |
| `/home/search` | UI-B03 | A02 | hiện | `orders`: `SearchScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/home/quick-order` | UI-B04 | A02 | hiện | `orders`: `QuickOrderScreen` | Khung có bố cục + dữ liệu minh họa |
| `/home/batch` | UI-B05 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `BatchScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/home/order-preview` | UI-C01 | A03 | hiện | `orders`: `OrderPreviewScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-precheck` | UI-C02 | A04 | ẩn | `packing`: `PackPrecheckScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/record-pack` | UI-C03 | A05 | ẩn | `packing`: `PackRecordScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-confirm` | UI-C04 | A06 | ẩn | `packing`: `PackConfirmScreen` | Khung có bố cục + dữ liệu minh họa |
| `/pack-saved` | UI-C05 | A07 | ẩn | `upload`: `PackSavedScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/pack-done` | UI-C06 | A08 | ẩn | `packing`: `PackDoneScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns` | UI-D01 | B01 | hiện | `returns`: `ReturnsListScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns/find-order` | UI-D02 | B02 | hiện | `returns`: `ReturnFindOrderScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/package-exterior` | UI-D03 | B03 | hiện | `returns`: `ReturnExteriorScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/record-return` | UI-D04 | B04, B05 | ẩn | `returns`: `ReturnRecordScreen` | Khung có bố cục + dữ liệu minh họa |
| `/returns/items-check` | UI-D05 | B06 | hiện | `returns`: `ReturnItemsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/review` | UI-D06 | B07 | hiện | `returns`: `ReturnReviewScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/returns/done` | UI-D07 | B08 | hiện | `returns`: `ReturnDoneScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders` | UI-E01 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrdersListScreen` | Khung có bố cục + dữ liệu minh họa |
| `/orders/[orderId]` | UI-E02 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrderDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/evidence` | UI-E03 | chưa có đặc tả (docs/09 mục 4) | hiện | `evidence`: `OrderEvidenceScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/evidence/[evidenceId]` | UI-E04 | chưa có đặc tả (docs/09 mục 4) | hiện | `evidence`: `EvidenceDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/orders/[orderId]/history` | UI-E05 | chưa có đặc tả (docs/09 mục 4) | hiện | `orders`: `OrderHistoryScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/sync` | UI-F01 | chưa có đặc tả (docs/09 mục 4) | hiện | `upload`: `SyncCenterScreen` | Khung có bố cục + dữ liệu minh họa |
| `/sync/[jobId]` | UI-F02 | chưa có đặc tả (docs/09 mục 4) | hiện | `upload`: `SyncErrorScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/sync/storage` | UI-F03 | chưa có đặc tả (docs/09 mục 4) | hiện | `upload`: `StorageScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes` | UI-G01 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputesScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/new` | UI-G02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeNewScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/select-evidence` | UI-G03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeSelectEvidenceScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/export` | UI-G04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeExportScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/disputes/[disputeId]` | UI-G05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `disputes`: `DisputeDetailScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/plan` | UI-H01 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PlanScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/plans` | UI-H02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PlansScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/checkout` | UI-H03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `CheckoutScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/limit` | UI-H04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PlanLimitScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account` | UI-I01 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `ProfileScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/shop-settings` | UI-I02 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `ShopSettingsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/members` | UI-I03 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `MembersScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/notifications` | UI-I04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `NotificationsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/security` | UI-I05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SecurityScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/account/help` | UI-I06 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `HelpScreen` | Placeholder (route + tiêu đề + lối quay lại) |

Màn có bố cục + dữ liệu minh họa: Tổng quan, Trung tâm quét (khung camera giả), Tạo đơn nhanh, Xem nhanh đơn, Màn quay (khung), Xác nhận video, Hoàn tất đóng gói, Danh sách hàng hoàn, Màn quay mở kiện (khung), Danh sách đơn, Trung tâm đồng bộ.

### 2.1 Màn Chào mừng (UI-A02)

Màn thật đầu tiên (docs/09 mục 5.1, mockup `docs/assets/ui/01-onboarding.png`, màn trái nhất). Không dùng `Screen` vì không có thanh tiêu đề; vẫn dùng vùng an toàn, cuộn được khi chữ lớn, hình minh họa thu nhỏ/ẩn khi màn thấp (iPhone SE).

- **Nút**: *Đăng nhập* → `/sign-in`; *Tạo tài khoản* → `/sign-up` (cả hai là màn khung; đăng nhập thật chưa có, O-15). Nút Apple/Google gọi `signInWithProvider` (`src/features/shop/data/auth-gateway.ts`, hiện **không làm gì**, không báo thành công).
- **Cỡ hình và khoảng cách** (hàm thuần `src/features/shop/ui/welcome-layout.ts`, có test): cả hình minh họa co giãn như một khối từ MỘT tham số (chiều cao, `u = cao / 260`): khung `342u x 260u` chứa vòng tròn nền, khiên, hộp, lá (mọi kích thước và độ lệch đều nhân `u`). Chiều cao hình = min(260, chỗ còn lại sau phần chữ/nút/social/pháp lý ước tính); dưới 110 hoặc chữ hệ thống >= 1,25 thì ẩn hình. Màn thấp hơn 700dp dùng khoảng cách dọc thu gọn (12/16 thay vì 24/24); màn rộng dưới 340dp dùng tiêu đề 24/30 thay vì 30/38. Mục tiêu: 375x667 và 320x568 thấy đủ tiêu đề, hai nút, Apple/Google và dòng pháp lý không cần cuộn (320x568 ẩn hình); chữ hệ thống lớn thì cuộn. Hằng số "phần chiều cao ngoài hình" đo trên bản render web, cần đo lại trên thiết bị thật.
- **Cờ cấu hình** `src/core/config/feature-flags.ts` (`SOCIAL_SIGN_IN_FLAGS`): `apple`, `google`, mặc định `true`, hiện trên cả iOS và Android. Cả hai `false` thì ẩn luôn nhóm social và đường kẻ "Hoặc đăng nhập với".
- **URL pháp lý** `src/core/config/legal-links.ts` (`LEGAL_LINKS`): hiện là **URL giữ chỗ** (`*.invalid`, không mở được). Mở bằng `openExternalLink` (`src/platform/external-link.ts`): bắt lỗi, chỉ ghi log (không kèm URL), không văng exception. Thay bằng URL thật khi có trang.
- **Thay hình/logo bằng tệp thật** chỉ ở `src/features/shop/ui/WelcomeIllustration.tsx` (hình giữa) và `src/features/shop/ui/BrandLogo.tsx` (`BrandMark` + chữ). Hiện dựng bằng biểu tượng Ionicons; biểu tượng Apple/Google cũng là glyph Ionicons (`logo-apple`, `logo-google`) trong `Icon.tsx`.
- **Token mới** (`src/core/theme/colors.ts`): `brandDark`, `welcomeBackground`, `welcomeBlob`, `borderSubtle`; có test tương phản.

### 2.2 Ba màn thiết lập (UI-A03 đăng ký, UI-A04, UI-A06)

Mockup `docs/assets/ui/01-onboarding.png` (màn 2, 3, 4); chi tiết nghiệp vụ đã chốt ở [docs/09 mục 5.1](../09-ui-ux-design.md) và [decisions.md Q-13](decisions.md). Luồng: `/welcome` -> `/sign-up` -> `/create-shop` -> `/setup-done` -> Tổng quan (`navigation.reset`). Giai đoạn này: giao diện + logic + **cổng giả**; chưa có Firebase thật, Function, Splash, route guard, màn Đăng nhập.

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

### 3.1 Icon nguồn bán (`SourceIcon`)

- Thành phần `SourceIcon` (`src/shared/ui/SourceIcon.tsx`, props `{ source: OrderSource; size?: number }`, mặc định 36) là nơi duy nhất quyết định hình của nguồn bán. Dùng ở: thẻ chọn nguồn (Tạo hồ sơ shop), chip nguồn ở Tạo đơn nhanh (qua `ChipOption.leading`), thẻ nguồn ở Xem nhanh đơn, `OrderCard` (Tổng quan, Đơn hàng). Hàng "Nguồn bán" ở màn Hoàn tất (nhiều nguồn) giữ icon chung.
- Shopee và TikTok Shop dùng ảnh thật `assets/images/sources/{shopee,tiktok-shop}.png` (256x256), đặt trong ô vuông bo góc nền trắng, viền mảnh để logo nền trắng và logo nền trong suốt trông đồng bộ. **Thay ảnh:** ghi đè hai tệp này (giữ vuông, <= 512px, < 100 KB; test `source-assets.test.ts` kiểm); bản gốc người dùng cung cấp lưu ở `docs/assets/brand/sources/`. Lazada (chưa có logo) và Khác dùng ô màu + ký hiệu dự phòng trong cùng tệp. Thêm nguồn mới: thêm vào `ORDER_SOURCES`, nhãn i18n, và một mục trong `LOGOS` hoặc `FALLBACK_TILES`.
- Icon là trang trí: ẩn khỏi trình đọc màn hình vì nhãn chữ luôn đi kèm. Không bao giờ dùng icon thay cho chữ.
- **Quy tắc dùng logo bên thứ ba:** không chỉnh sửa logo (không đổi màu, cắt, méo, xóa nền, thêm hiệu ứng); không dùng theo cách gợi ý Đơn Chứng là đối tác, được chứng nhận hay đã tích hợp với sàn (chưa có tích hợp; dữ liệu đơn do người dùng nhập, CLAUDE.md #10). Logo chỉ để người dùng nhận ra kênh bán họ tự chọn.

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

## 6. Đổi thanh tab (O-18)

Danh sách tab chỉ ở `src/bootstrap/navigation/tab-config.ts`; `(tabs)/_layout.tsx` lặp qua nó. Chuyển sang phương án khuyến nghị (*Tổng quan · Đơn hàng · Quét · Hàng hoàn · Đồng bộ*): thêm mục `scan` vào giữa `TAB_CONFIG`, tạo thư mục `(tabs)/scan/` (Stack) và chuyển `home/scan.tsx` sang đó (cập nhật `ROUTES.scan`), thêm nhãn `nav:tabs.scan`, sửa `tab-config.test.ts` và `app-navigation.test.tsx`. Không phải sửa component.

## 7. Giới hạn đã biết của khung

- Dữ liệu là minh họa; tìm/lọc chạy trên dữ liệu giả cục bộ. Không lưu gì; tham số route (mã đơn, sản phẩm nhập) chỉ truyền giữa màn.
- `useIsOffline()` (`src/platform/connectivity.ts`) là **stub luôn trả `false`** (chưa chọn thư viện theo dõi mạng); `OfflineBanner` đã sẵn.
- Camera/quét/đèn pin chưa có: khung camera là placeholder; nút *Đèn pin*, *Xem lại video*, *Ghi thêm đoạn riêng* đang tắt.
- Gợi ý sản phẩm theo lịch sử (UI-B04), chọn nguồn/thời gian ở danh sách đơn (UI-E01), thử lại tệp (UI-F01) chưa làm vì cần dữ liệu/hàng đợi thật.
- Splash (UI-A01) hiện chỉ chuyển hướng; chưa có luồng đăng nhập (O-15) nên chưa chặn truy cập; màn Chào mừng chưa được dùng làm màn khởi đầu. Ba màn thiết lập (mục 2.2) chạy bằng cổng giả: chưa tạo tài khoản/shop thật.
- Chào mừng: liên kết Điều khoản/Quyền riêng tư là chữ trong câu nên vùng chạm nhỏ hơn 44/48 (Text lồng không có `hitSlop`); cần đánh giá trên thiết bị.
- Font icon tải bất đồng bộ lần đầu: icon có thể hiện trễ một nhịp.

## 8. Kiểm chứng

Đã chạy: `npm run check` (lint, typecheck, format, unit test), `npx expo export --platform ios` và `--platform android` (đóng gói JS thành công). Các test render từng route, kiểm tra thanh tab (bằng router thật trong bộ nhớ), màn quay ẩn tab và chặn rời màn, `ConfirmDialog`, `EvidenceStatusBadge`, vùng chạm theo nền tảng, tương phản màu.

**Chưa kiểm chứng** (chưa có máy ảo/thiết bị/Xcode/Android SDK): bố cục thật trên iOS/Android (tai thỏ, thanh điều hướng Android 3 nút/cử chỉ, edge-to-edge), `KeyboardAvoidingView` trên Android tràn viền, Back phần cứng và cử chỉ vuốt ở màn quay, font scale lớn thật, màn hình nhỏ (iPhone SE), độ mượt, tải font icon. Cần chạy nghiệm thu UI/UX ([docs/09 mục 8](../09-ui-ux-design.md#8-nghiệm-thu-uiux)) trên thiết bị trước khi đánh dấu.
