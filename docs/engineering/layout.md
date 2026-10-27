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
| `/sign-up` | UI-A03 (biến thể đăng ký) | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SignUpScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/create-shop` | UI-A04 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `CreateShopScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/permissions` | UI-A05 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `PermissionsScreen` | Placeholder (route + tiêu đề + lối quay lại) |
| `/setup-done` | UI-A06 | chưa có đặc tả (docs/09 mục 4) | ẩn | `shop`: `SetupDoneScreen` | Placeholder (route + tiêu đề + lối quay lại) |
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
- **Cờ cấu hình** `src/core/config/feature-flags.ts` (`SOCIAL_SIGN_IN_FLAGS`): `apple`, `google`, mặc định `true`, hiện trên cả iOS và Android. Cả hai `false` thì ẩn luôn nhóm social và đường kẻ "Hoặc đăng nhập với".
- **URL pháp lý** `src/core/config/legal-links.ts` (`LEGAL_LINKS`): hiện là **URL giữ chỗ** (`*.invalid`, không mở được). Mở bằng `openExternalLink` (`src/platform/external-link.ts`): bắt lỗi, chỉ ghi log (không kèm URL), không văng exception. Thay bằng URL thật khi có trang.
- **Thay hình/logo bằng tệp thật** chỉ ở `src/features/shop/ui/WelcomeIllustration.tsx` (hình giữa) và `src/features/shop/ui/BrandLogo.tsx` (`BrandMark` + chữ). Hiện dựng bằng biểu tượng Ionicons; biểu tượng Apple/Google cũng là glyph Ionicons (`logo-apple`, `logo-google`) trong `Icon.tsx`.
- **Token mới** (`src/core/theme/colors.ts`): `brandDark`, `welcomeBackground`, `welcomeBlob`, `borderSubtle`; có test tương phản.

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
- Splash (UI-A01) hiện chỉ chuyển hướng; chưa có luồng đăng nhập (O-15) nên chưa chặn truy cập; màn Chào mừng chưa được dùng làm màn khởi đầu.
- Chào mừng: liên kết Điều khoản/Quyền riêng tư là chữ trong câu nên vùng chạm nhỏ hơn 44/48 (Text lồng không có `hitSlop`); cần đánh giá trên thiết bị.
- Font icon tải bất đồng bộ lần đầu: icon có thể hiện trễ một nhịp.

## 8. Kiểm chứng

Đã chạy: `npm run check` (lint, typecheck, format, unit test), `npx expo export --platform ios` và `--platform android` (đóng gói JS thành công). Các test render từng route, kiểm tra thanh tab (bằng router thật trong bộ nhớ), màn quay ẩn tab và chặn rời màn, `ConfirmDialog`, `EvidenceStatusBadge`, vùng chạm theo nền tảng, tương phản màu.

**Chưa kiểm chứng** (chưa có máy ảo/thiết bị/Xcode/Android SDK): bố cục thật trên iOS/Android (tai thỏ, thanh điều hướng Android 3 nút/cử chỉ, edge-to-edge), `KeyboardAvoidingView` trên Android tràn viền, Back phần cứng và cử chỉ vuốt ở màn quay, font scale lớn thật, màn hình nhỏ (iPhone SE), độ mượt, tải font icon. Cần chạy nghiệm thu UI/UX ([docs/09 mục 8](../09-ui-ux-design.md#8-nghiệm-thu-uiux)) trên thiết bị trước khi đánh dấu.
