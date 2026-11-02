# Báo cáo audit UI/UX — Đơn Chứng

> **Phạm vi:** toàn bộ app di động (Expo SDK 58, React Native, Expo Router) ở HEAD `0834935` của `main` (2026-11-02).
> **Phương pháp:** đánh giá **tĩnh từ mã nguồn và tài liệu**; không chạy app, không có thiết bị, không có trình đọc màn hình. Mọi hành vi lúc chạy (bàn phím, `hitSlop`, thứ tự đọc, Dynamic Type) ghi là *chưa kiểm chứng trên thiết bị*, khớp với cổng G-11 trong `release-checklist.md`.
> **Ràng buộc:** báo cáo này **không sửa mã**, không đề xuất bỏ tính năng, không thêm tính năng mới; chỉ đề xuất tinh chỉnh trải nghiệm trên chức năng đã có. Các đề xuất chạm quyết định mở (O-xx, Q-xx) được đánh dấu **[cần duyệt]** vì `CLAUDE.md` cấm tự chốt thay người dùng/BA.
> **Cách đọc số liệu:** số lượng lấy bằng grep trên mã không phải test; tỷ lệ tương phản tính lại bằng công thức WCAG từ giá trị token ở `src/core/theme/primitives.ts` và `semantic.ts`.

---

## 1. Tóm tắt điều hành

### 1.1 Điểm mạnh cần giữ

| # | Điểm mạnh | Bằng chứng |
|---|---|---|
| S1 | Token hóa gần như tuyệt đối: không hex/rgba trong `features/**/ui`, không chuỗi UI cứng, chỉ có 3 hex ở `SourceIcon.tsx` (màu thương hiệu bên thứ ba) | `src/shared/ui/SourceIcon.tsx:24,30,98`; ESLint `design-tokens/no-raw-design-values` |
| S2 | Trạng thái không bao giờ chỉ dựa vào màu: `StatusBadge`/`EvidenceStatusBadge` luôn có icon + nhãn, nhãn đọc to có cả lý do | `EvidenceStatusBadge.tsx:44-50` |
| S3 | Vùng chạm có hàm trung tâm `getMinTouchTarget()` (44 iOS / 48 Android), nút chính ≥ 50–56 | `src/core/theme/typography.ts:41`, `components.ts:11` |
| S4 | Hộp thoại xác nhận tùy biến thống nhất (`ConfirmDialog`), không dùng `Alert.alert` ở đâu; thao tác phá hủy có `destructive`, có chặn khi đang quay/chưa tải | `src/shared/ui/ConfirmDialog.tsx`; 12 màn dùng |
| S5 | Chuỗi lỗi sạch: 52 mã trong `errors.json`, không mã nào ≥ 20 từ hoặc > 2 câu | `src/core/i18n/locales/vi/errors.json` |
| S6 | Bàn phím: `KeyboardAvoidingView` + `keyboardShouldPersistTaps="handled"` + `keyboardDismissMode="on-drag"` trong `Screen`; form auth có `returnKeyType` nối tiếp | `Screen.tsx:84-92`; `SignInScreen.tsx:192-220` |
| S7 | Trạng thái rõ ràng ở nhiều màn: skeleton/empty/error/retry (Đơn hàng, Cá nhân, Đồng bộ), ngôn ngữ trung thực ("Đã lưu trên máy" ≠ "đã lên máy chủ") | `OrdersListScreen.tsx`, `SyncCenterScreen.tsx`, `ProfileScreen.tsx:102-105` |
| S8 | Không dùng emoji làm icon; một bộ icon duy nhất (Ionicons) qua `Icon` ẩn khỏi trình đọc màn hình, nghĩa luôn đi kèm chữ | `Icon.tsx:12-88,112-117` |
| S9 | Gián đoạn khi quay được xử lý có chủ đích (khóa thoát, phục hồi sau kill, toast thông báo) | `PackRecordLive.tsx`, `RecordingFrame.tsx`, `Providers.tsx:45` |

### 1.2 Vấn đề lớn nhất (đã kiểm chứng)

1. **Viền ô nhập và nút phụ không đạt 3:1** (WCAG 1.4.11): `border.field` = 1,58:1 trên trắng, 1,53:1 trên nền màn; `border.default` = 1,20:1. *(High, a11y)*
2. **Đường tới camera dài** cho đơn mới: 6 màn / ≈ 5 chạm + gõ mã + gõ tên sản phẩm. Docs ghi nhận là O-19 chưa giải quyết. *(High, hiệu quả)* **[cần duyệt]**
3. **Nút chết trong màn Xác nhận video**: "Xem lại video" và "Ghi thêm đoạn riêng" luôn `disabled`, `onPress={() => undefined}`, hiển thị cho mọi người dùng mà không giải thích. *(High, nhận thức trạng thái)*
4. **9 route chỉ là `PlaceholderScreen` không có lối vào**, và 2 màn thật khó tìm: Danh sách tranh chấp (G01) không có lối vào, Tìm kiếm (B03) chỉ mở được từ màn Quét. *(High, khả năng khám phá)*
5. **Form dày nhất không chia nhỏ:** D05 Kiểm hàng (tới 7 điều khiển mỗi dòng), Tạo đơn nhanh, Xóa tài khoản. *(High/Medium, tải nhận thức)*
6. **Thiếu hẳn các nền tảng trải nghiệm hệ điều hành:** không dark mode, không xử lý reduce-motion, không haptics, ripple Android (chỉ giảm opacity). *(Medium; phần lớn là O-17 đã biết)*
7. **Lạm dụng thẻ (Card):** 95 chỗ `<Card>` (91 trong `features/`), có màn xếp 4–6 thẻ liền nhau. *(Medium, mật độ thông tin)*

### 1.3 Cải thiện kỳ vọng nếu làm hết P0 + P1
Người dùng nhập liệu nhanh hơn trên màn dày (return-key, nhóm trường), không còn gặp nút "chết", thấy rõ viền ô nhập ngoài nắng, tìm được tranh chấp và tìm kiếm, và người dùng trình đọc màn hình nghe được nhóm thông tin trong Trung tâm đồng bộ.

---

## 2. Phương pháp và thang đánh giá

- **Tiêu chí:** 10 nguyên tắc Nielsen (§4.1), Apple HIG, Material Design 3, WCAG 2.2 AA, nguyên tắc mobile-first (§4.2–4.5).
- **Mức độ:**
  - **Critical** — chặn hoàn thành tác vụ chính, mất dữ liệu, hoặc vi phạm a11y chặn người dùng.
  - **High** — làm sai/chậm tác vụ chính thường xuyên hoặc vi phạm WCAG AA có thể sửa rõ ràng.
  - **Medium** — gây khó chịu hoặc kém nhất quán nhưng có đường vòng.
  - **Low** — bóng bẩy, nhất quán nhỏ.
- **Không tìm thấy vấn đề Critical** ở mức mã nguồn: các bất biến nghiệp vụ (xác nhận trước khi hủy, chặn xóa khi đang quay, không tự liên kết) đều được UI tôn trọng. Mức Critical chỉ có thể xuất hiện sau khi chạy trên thiết bị (ví dụ bàn phím che nút trên Android edge-to-edge, `platform/layout.ts:16-19` đã tự ghi chưa kiểm chứng).
- **Giới hạn đã biết:** xem Phụ lục C.

---

## 3. Hiện trạng

### 3.1 Điều hướng
- **Thanh tab 5 mục:** Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân (`src/bootstrap/navigation/tab-config.ts`). Quét là nút nổi (`action: true`, `ScanTabButton.tsx`), không phải tab thật.
- **Bảng route:** 52 route chia sẻ 51 mã `UI-xx` (`src/core/navigation/routes.ts`); tab bar ẩn ở màn quay, form và luồng sâu.
- **Cổng phiên:** mọi route nghiệp vụ ngoài `(tabs)` bọc `withSessionGate`; Splash chuyển hướng theo phiên.
- **Khung màn hình:** `Screen` cho safe-area trên, header, `OfflineBanner`, `KeyboardAvoidingView`, cuộn, footer ghim. Màn auth/onboarding dùng `OnboardingScaffold` riêng (có KAV riêng, **không có OfflineBanner**); `ScanScreen` và Splash không dùng `Screen`.

### 3.2 Design system
- **Token ba tầng:** `primitives.ts` (nơi duy nhất có hex) → `semantic.ts` (vai trò, qua `useTheme().tokens`) → `components.ts`. Hai bảng màu song song còn tồn tại: bảng phẳng jade cũ cho Splash/đăng nhập/thiết lập (bị golden test khóa) và Bright Orange cho phần còn lại (D-20).
- **Typography:** font hệ thống, 12 biến thể (24/32, 17/24, 16/22, 15/22, 12/16 và nhóm form 13/14), `fontWeight` token chỉ có 400/700 trong khi `typography` dùng thêm 500/600 dạng chuỗi.
- **Spacing/radius:** 2·4·6·8·12·16·24; radius 8·12·16·full.
- **Elevation/motion:** chỉ một mức đổ bóng (`ScanTabButton.tsx:55`); không có token motion; không có hoạt ảnh tự viết (chỉ `Modal animationType` của BottomSheet/ConfirmDialog).
- **Thành phần:** 41 component dùng chung. Ba thành phần có 0 chỗ dùng ngoài test: `ActionCard`, `StatusCard`, `SyncStatusBar`. Hai cặp trùng chức năng: `StatTile`/`MetricTile`, `ActionCard`/`QuickAction`.
- **A11y trong bộ thành phần:** `accessibilityRole` ≈ 200 chỗ, `accessibilityLabel` ≈ 135 chỗ, `accessibilityHint` chỉ ≈ 19 chỗ; `allowFontScaling` không bao giờ tắt (tốt), `maxFontSizeMultiplier` chỉ ở tab label, `QuickAction` (1,3) và Splash.

### 3.3 Ma trận trạng thái theo màn (tóm tắt)

| Nhóm | Loading | Empty | Error+Retry | Offline riêng | Pull-to-refresh |
|---|---|---|---|---|---|
| Trang chủ | không (không skeleton) | có (`home-today-empty`) | có (`home-today-error`) | chỉ banner chung | **không** |
| Đơn hàng (danh sách/chi tiết) | skeleton | có | có | banner chung | danh sách: có |
| Quét / Tạo đơn nhanh | – / có | – | có | banner chung | – |
| Đóng gói (precheck/quay/xác nhận/xong) | có | – | có (thẻ lỗi) | – | – |
| Hàng hoàn D01–D07 | có | có | có | – | **không** |
| Tranh chấp G01–G05 | có | có | có | – | **không** |
| Trung tâm đồng bộ F01/F02 | có | có (theo bộ lọc) | có | **có** (ghi chú offline/chờ Wi‑Fi) | **không** |
| Thông báo (tab) | – | chỉ trạng thái rỗng | – | – | – |
| Cá nhân | skeleton | có | có | **có** (cũ/làm mới lỗi) | có (Hồ sơ, Cài đặt shop) |
| Auth/Onboarding | nút loading | – | banner lỗi + retry | **không có banner** | – |

---

## 4. Đánh giá liên màn hình

### 4.1 Nielsen — 10 nguyên tắc

| Nguyên tắc | Đánh giá | Phát hiện chính (xem mã tham chiếu ở §5) |
|---|---|---|
| 1. Hiển thị trạng thái hệ thống | **Tốt** ở tải lên và quay (nhãn chuẩn docs/09 §3, toast gián đoạn); **Trung bình** ở Trang chủ (không skeleton) và các danh sách không có làm mới | H-1, SY-2 |
| 2. Khớp giữa hệ thống và thế giới thật | **Tốt:** ngôn ngữ đời thường, "Đã lưu trên máy" thay vì thuật ngữ; SHA‑256 có hiện cho người dùng (cần giải thích) | EV-2 |
| 3. Quyền kiểm soát và tự do | **Tốt:** hộp thoại thoát khi form bẩn, chặn thoát khi quay; **Trung bình:** nút Hủy trong Tạo đơn nhanh nằm ở header | QO-3 |
| 4. Nhất quán và chuẩn mực | **Trung bình:** hai bảng màu song song, icon outline/solid lẫn lộn, Card xếp chồng không đều, Search chỉ từ Quét | DS-3, DS-5 |
| 5. Ngăn lỗi | **Tốt:** kiểm trùng đơn, idempotent, chặn đăng xuất khi chưa tải; **Trung bình:** ô số lượng không gắn bàn phím số ở mọi nơi (đã có ở D05) | – |
| 6. Nhận diện hơn ghi nhớ | **Trung bình:** lịch sử tìm kiếm tốt; Tìm kiếm khó khám phá; Tranh chấp không có lối vào | NV-2, NV-3 |
| 7. Linh hoạt và hiệu quả | **Yếu:** 6 màn tới camera; Tạo đơn nhanh không `returnKeyType`; không có phím tắt khi quét liên tục (B05 là placeholder) | QO-1, SC-2 |
| 8. Thẩm mỹ và tối giản | **Trung bình:** Trang chủ 7 khối; 4–6 thẻ liên tiếp ở Chi tiết đơn/tranh chấp | H-2, OD-1 |
| 9. Giúp nhận biết, chẩn đoán, khôi phục lỗi | **Tốt:** `{title,hint}`, nút Thử lại; **Lỗ hổng nhỏ:** 3 mã lỗi chưa có chuỗi | ER-1 |
| 10. Trợ giúp và tài liệu | **Trung bình:** Trung tâm trợ giúp có nội dung; "Điều khoản/Chính sách" trong Trợ giúp bị khóa "sắp có" | PR-5 |

### 4.2 Apple HIG
- **Vùng chạm 44 pt:** đạt qua `getMinTouchTarget()`. Ngoại lệ phải bù bằng `hitSlop` (chip compact 40 pt, nút Bộ lọc nhìn thấy 34 pt `OrdersListScreen.tsx:367`, liên kết pháp lý nội dòng ở Chào mừng `WelcomeScreen.tsx:183-200` — không có vùng chạm bù).
- **Dynamic Type:** không khóa cỡ chữ (tốt) nhưng nhóm form 13/14 sp thấp hơn thân văn bản 15 sp (docs/09 dòng 58 đã ghi là ngoại lệ chờ BA).
- **Dark Mode, Liquid Glass, haptics:** không có (`app.json:7` `userInterfaceStyle: "light"`, `expo-haptics` không có trong `package.json`).
- **Hộp thoại/bottom sheet:** đúng mẫu (`BottomSheet`, `ConfirmDialog` có `accessibilityViewIsModal`); `BottomSheet` không có `KeyboardAvoidingView` (0 kết quả) — rủi ro nếu có ô nhập bên trong (Quét thủ công, chọn nguồn bán).

### 4.3 Material Design 3
- **Phản hồi chạm:** chỉ giảm `opacity` (17 chỗ), 0 `android_ripple`.
- **Cỡ vùng chạm 48 dp:** đạt.
- **Color roles/dynamic color/dark:** không áp dụng (chủ đích, theo token thương hiệu).
- **Thanh điều hướng:** 5 đích (đúng khoảng 3–5), nhưng một đích (Thông báo) gần như rỗng.

### 4.4 WCAG 2.2 AA

| Tiêu chí | Kết quả | Chi tiết |
|---|---|---|
| 1.4.3 Tương phản chữ 4,5:1 | **Đạt** (sát ngưỡng ở một số chỗ) | chữ chính 14,64; chữ phụ 4,91–5,08; trắng trên `action.primary` (cam 700) 4,57; success 4,57; warning 4,58 |
| 1.4.3 chữ trắng trên `brand.primary` (cam 600) | **Không đạt** nếu dùng làm nền chữ thường | 3,66:1 (token chỉ nên dùng cho icon/đồ họa; hiện đúng vai trò) |
| 1.4.11 Tương phản thành phần UI 3:1 | **Không đạt** | `border.field` 1,58 (trắng) / 1,53 (nền màn); `border.default` 1,20. Chỉ `border.strong` 3,03 đạt. Dùng ở `TextField.tsx:101`, `Button.tsx:63`, `SearchField.tsx:58` |
| 1.4.4 Đổi cỡ chữ 200% | **Chưa kiểm chứng**; nút dùng `minHeight` (tốt); tile/badge/chip chưa có giới hạn phóng | `numberOfLines` chỉ 6 lần |
| 1.4.10 Reflow | Chưa kiểm chứng | – |
| 1.4.12 Giãn văn bản | Chưa kiểm chứng | – |
| 2.1.1 / 2.4.3 bàn phím & thứ tự focus | Chưa kiểm chứng | – |
| 2.3.3/reduce motion | Rủi ro thấp (gần như không có hoạt ảnh); chưa có `useReducedMotion` | – |
| 2.5.8 Kích thước mục tiêu (24 px) | **Đạt** (44/48 là ngưỡng nội bộ) | – |
| 3.3.1/3.3.3 Nhận diện & gợi ý sửa lỗi | **Đạt:** lỗi inline + `accessibilityLiveRegion`, `{title,hint}` | `CreateShopScreen.tsx:60-120` |
| 4.1.2 Tên, vai trò, giá trị | **Phần lớn đạt**; thẻ công việc đồng bộ không có nhãn nhóm | `SyncJobCard.tsx` có 0 `accessibilityLabel` |
| 4.1.3 Thông báo trạng thái | **Đạt** (Toast `role=alert`, live region ở lỗi trường) | – |

### 4.5 Mobile-first
Một tay: nút chính ghim chân màn (tốt). Ngoài trời: viền ô nhập mờ (1,58:1) rất khó thấy dưới nắng. Mạng yếu: banner offline toàn cục + trạng thái chờ Wi‑Fi (tốt). Ngón cái: nút Hủy ở header (Tạo đơn nhanh, Quay) nằm vùng khó với tay.

---

## 5. Audit theo từng màn / nhóm màn

Định dạng mỗi mục: **Vấn đề** · **Vì sao là vấn đề UX** · **Mức độ** · **Khuyến nghị** · **Cải thiện kỳ vọng**. Mã tham chiếu `file:line` là bằng chứng.

### 5.1 Splash, Chào mừng, Đăng nhập, Đăng ký, Quên mật khẩu, Tạo shop, Hoàn tất thiết lập (UI-A01…A09)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| A-1 | Liên kết Điều khoản/Chính sách ở Chào mừng là `Text` lồng nhau, không có vùng chạm bù (`WelcomeScreen.tsx:183-200`) | Dưới 44 pt, khó bấm bằng ngón cái; HIG/WCAG 2.5.8 | **Medium** | Bọc mỗi liên kết trong vùng `minHeight: touch` hoặc đưa ra hàng riêng | Bấm đúng liên kết pháp lý lần đầu |
| A-2 | Màn auth/onboarding dùng `OnboardingScaffold`, **không có `OfflineBanner`**; lỗi mạng chỉ hiện sau khi gửi (`AUTH_NETWORK_ERROR`) | Nguyên tắc 1: người dùng không biết mình đang offline trước khi bấm | **Medium** | Hiển thị cùng banner offline đang dùng ở `Screen` | Biết sớm, đỡ gửi thất bại |
| A-3 | Splash có thời gian hiển thị tối thiểu cố định (`SPLASH_MIN_VISIBLE_MS`), không có trạng thái lỗi/offline riêng | Chờ không cần thiết nếu phiên đã sẵn sàng | **Low** | Rà lại giá trị tối thiểu khi đã có phiên; (giữ chỗ cho Q-24e slogan) | Mở app nhanh hơn |
| A-4 | Ô mật khẩu Đăng ký chỉ có quy tắc ≥ 8 ký tự; thẻ yêu cầu hiện sẵn (tốt) nhưng không phản hồi từng quy tắc khi gõ ở Đăng ký (có ở Mật khẩu mới) | Nhất quán giữa hai màn | **Low** | Dùng cùng mẫu tick trực tiếp | Giảm lỗi gửi |
| A-5 | Nút mạng xã hội chỉ là icon, ẩn theo cờ (`SignInScreen.tsx:262`); có `accessibilityLabel` (`AuthParts.tsx:193`) | Đạt; ghi nhận vì các nút này không hoạt động ở v1 (O-15) | **Low** | Giữ ẩn; kiểm tra lại khi bật | – |
| A-6 | `VerifyOtp`/`NewPassword` (A08/A09) không với tới được ở v1 (chế độ `email_link`) | Mã chết, nhưng không ảnh hưởng người dùng | **Low** | Ghi chú trong tài liệu, không cần đổi UI | – |
| A-7 | Từ Đăng ký tới màn Home qua 4 màn (Chào mừng → Đăng ký → Tạo shop → Hoàn tất → Home) | Chấp nhận được cho lần đầu; Tạo shop đã có `StepProgress` và nút Bỏ qua (`CreateShopScreen.tsx:242,309-326`) | **Low** | Giữ; cân nhắc gộp "Hoàn tất" nếu BA đồng ý | Vào việc sớm hơn |

### 5.2 Trang chủ (UI-B01) — `HomeScreen.tsx`

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| H-1 | Không skeleton khi tải số liệu "Hôm nay"; không kéo-để-làm-mới (có `home-today-empty`/`-error` nhưng không có trạng thái loading) | Nguyên tắc 1; khung nhảy khi số liệu về | **Medium** | Skeleton cho `StatTile`; thêm `refreshControl` qua `Screen` (đã hỗ trợ) | Cảm giác chắc chắn, dữ liệu mới theo yêu cầu |
| H-2 | 7 khối: 2 thẻ hành động, liên kết "Danh sách hoàn" chữ phải, 3 quick action, 3 ô số, thẻ thông báo thiết bị, thẻ mẹo | Quá nhiều lựa chọn ngang hàng; người bán chỉ cần "Đóng gói" và "Nhận hoàn" | **Medium** | Giữ 2 hành động chính nổi bật; hạ bậc/gộp quick action và mẹo; không bỏ chức năng nào | Quét một mắt biết làm gì |
| H-3 | Liên kết "Danh sách hoàn" là `Pressable` trơ trọi (`HomeScreen.tsx:122`) và là **lối vào duy nhất** của danh sách hoàn; 3 ô số dẫn tới 3 nơi khác nhau | Khó khám phá, nguyên tắc 6 | **Medium** | Đưa liên kết thành `ListItem` có chevron hoặc thẻ phụ cùng hàng với thẻ Nhận hoàn | Tìm hồ sơ hoàn dễ hơn |
| H-4 | Icon kích thước số cứng (`size={26}` ở đầu trang) | Lệch thang token 16/20/24/32 | **Low** | Dùng `tokens.icon.*` | Nhất quán |

### 5.3 Tìm kiếm và Quét (UI-B02, B03)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| SC-1 | Tìm kiếm (B03) chỉ mở được từ màn Quét (`ScanScreen.tsx:371`), không có lối từ Trang chủ/Đơn hàng; trong khi Đơn hàng đã có ô tìm riêng | Người dùng không biết có tìm kiếm có lịch sử | **Medium** | Cho phép ô tìm ở Trang chủ/Đơn hàng dẫn vào B03 (hành vi giữ nguyên) **[cần duyệt]** | Tìm đơn dễ hơn |
| SC-2 | Quét liên tục (B05) là placeholder; mỗi lần quét xong phải qua nhiều bước | Nguyên tắc 7 | **Medium** | Không đề xuất tính năng mới; ghi nhận cho BA | – |
| SC-3 | Nút Quay lại/Trợ giúp/Đèn dùng icon 26 px số cứng; đèn có nhãn (`ScanScreen.tsx:259`) | Nhất quán token | **Low** | Dùng token icon | – |
| SC-4 | `BottomSheet` Quét thủ công chứa `TextField` nhưng `BottomSheet` không có `KeyboardAvoidingView` | Bàn phím có thể che ô/nút; **chưa kiểm chứng** | **Medium** | Kiểm trên Android/iOS; nếu lỗi, thêm xử lý bàn phím trong `BottomSheet` | Ô nhập luôn thấy |

### 5.4 Tạo đơn nhanh (UI-B04) — `QuickOrderScreen.tsx`

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| QO-1 | **Không có `returnKeyType`/`onSubmitEditing`** ở bất kỳ ô nào (grep 0 kết quả trong `QuickOrder*.tsx`); mã đơn → mã vận đơn → tên sản phẩm → biến thể phải chạm tay | Màn nhập nhiều nhất của app; nguyên tắc 7; HIG form | **High** | Nối `returnKeyType="next"`→`"done"` và focus ô kế tiếp (mẫu đã có ở `SignInScreen.tsx:192-220`) | Nhập bằng bàn phím liền mạch |
| QO-2 | Mỗi dòng sản phẩm gồm tên + biến thể + số lượng (`QuickOrderLineEditor.tsx:81,138,198`) lặp lại cùng gợi ý | Màn dài; nút "Tiếp tục" ghim chân (`:434`, tốt) nên không mất, nhưng trường nhiều | **Medium** | Nhóm có tiêu đề rõ "Đơn", "Sản phẩm"; thu gọn dòng đã nhập | Quét dọc dễ hơn |
| QO-3 | Nút Hủy ở header (`headerRight`) | Vùng khó với một tay; có hộp thoại thoát khi dữ liệu bẩn (tốt, `:296-315`) | **Low** | Giữ; cân nhắc thêm "Quay lại" chân màn | – |
| QO-4 | Luồng: Quét → Tạo đơn nhanh (form) → Xác nhận → Chi tiết đơn → Quay → Preview → Precheck… (docs/09 O-19) | Dài hơn đặc tả "một chạm" | **High** | **[cần duyệt O-19]** — không tự rút gọn vì liên quan bất biến "không tự tạo/gộp"; thử rút số bước giữa "Tạo đơn hàng" và camera | Tới camera nhanh hơn |
| QO-5 | `PreviewScreen:188` đọc `t('errors:<code>')` trực tiếp, bỏ qua `resolveErrorMessage`; nếu mã có dạng `{title,hint}` sẽ hiển thị sai | Rủi ro hiển thị lỗi sai | **Low** | Dùng `resolveErrorMessage` thống nhất | Thông báo lỗi nhất quán |

### 5.5 Xem trước đơn, Kiểm tra trước khi quay, Quay, Xác nhận, Hoàn tất đóng gói (UI-C01…C06)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| PK-1 | **Màn Xác nhận có hai nút luôn tắt** "Xem lại video" và "Ghi thêm đoạn riêng": `disabled` + `onPress={() => undefined}` (`PackConfirmScreen.tsx:84-95`), không có lý do | Nút chết gây hiểu nhầm là lỗi; nguyên tắc 1, 9 | **High** | Giữ chức năng (không bỏ), nhưng ẩn tới khi chạy được hoặc kèm dòng giải thích "Sắp có"; bỏ khỏi đường chính | Không còn băn khoăn "sao bấm không được" |
| PK-2 | Ba nút xếp chồng ở chân màn (Lưu + 2 nút phụ) | Nút chính nằm trên cùng nhưng hai nút phụ đẩy chân màn rất cao | **Medium** | Sau khi xử lý PK-1 chỉ còn một nút chính | Màn gọn |
| PK-3 | Ảnh xem trước thumbnail `minHeight: 180` số cứng; chuỗi `thumbnail` ghi "(minh họa)" | Lệch token; có thể gây hiểu nhầm là ảnh thật | **Low** | Dùng token; làm rõ nhãn | – |
| PK-4 | Nút dừng quay có `accessibilityRole`/`Label` nhưng không có `accessibilityHint` (`RecordingFrame.tsx`) | Người dùng đọc màn hình không biết hệ quả bấm | **Medium** | Thêm hint ngắn | Dùng được với VoiceOver/TalkBack |
| PK-5 | Không có phản hồi xúc giác khi bắt đầu/dừng quay | HIG/M3 khuyến nghị haptics cho hành động chính; người đang đeo găng/tay bận | **Low** | Haptics nhẹ qua adapter nền tảng **[cần duyệt: thêm phụ thuộc]** | Biết đã bắt đầu/dừng |
| PK-6 | Precheck (C02) chỉ hiện khi bị chặn và có tới 4 nút (`PackPrecheckScreen.tsx:135-156`) | Quá nhiều lựa chọn khi đang bị chặn | **Low** | Một nút chính theo nguyên nhân + liên kết phụ | Rõ việc cần làm |
| PK-7 | Ghi video tự bắt đầu khi vào màn (`PackRecordLive.tsx:219`); có khóa thoát | Hợp lý (ít chạm); đảm bảo người dùng thấy đếm ngược/đèn ghi | **Low** | Giữ; xác minh trên thiết bị (G-4) | – |

### 5.6 Danh sách, chi tiết, sửa đơn (UI-E01, E02)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| OD-1 | Chi tiết đơn xếp **6 `Card`** (`OrderDetailScreen.tsx`), thêm danh sách lịch sử nội tuyến trùng nội dung với E05 (placeholder) | Hộp lồng hộp, mật độ cao | **Medium** | Gộp thông tin phụ thành `ListGroup`; chỉ giữ thẻ cho khối cần nhấn mạnh | Dễ quét |
| OD-2 | Hàng đầu danh sách: ô tìm + nút Tạo + chip trạng thái + nút Bộ lọc (34 pt nhìn thấy, `OrdersListScreen.tsx:367`) | Nhiều lớp điều khiển trước nội dung | **Medium** | Giữ chip; đưa Bộ lọc gọn lại; tăng vùng nhìn thấy lên ≥ 40 | Thấy nhiều đơn hơn |
| OD-3 | Màn Sửa đơn dài (mã, nguồn, vận đơn, dòng sản phẩm + gợi ý) 511 dòng | Cùng vấn đề QO-2 | **Medium** | Nhóm trường, thu gọn dòng | – |
| OD-4 | Cổ chai: sửa đơn chỉ khi chưa có phiên (`ORDER_HAS_SESSION`) — thông báo có giải thích? | Người dùng bấm Sửa rồi mới biết bị chặn | **Low** | Kiểm tra: nếu chặn chỉ sau khi bấm, hiển thị lý do ngay ở nút | Giảm bực |
| OD-5 | Tìm kiếm có xác nhận khi xóa lịch sử (tốt, `SearchScreen.tsx:217`) | – | – | Giữ | – |

### 5.7 Bằng chứng và xem lại (UI-E03, E04)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| EV-1 | Mỗi hàng bằng chứng là một `Card` có nút riêng (`OrderEvidenceScreen.tsx:74`) | Hộp lồng hộp lặp lại | **Low** | Dùng `ListItem` trong `ListGroup` | Danh sách gọn |
| EV-2 | SHA‑256 hiển thị cho người dùng | Thuật ngữ kỹ thuật; nhưng chủ đích minh bạch | **Low** | Thêm giải thích một câu (đúng lời "chỉ chứng minh tệp không đổi", bất biến 11) | Hiểu đúng, không hiểu sai là "bằng chứng pháp lý" |
| EV-3 | Khung media cố định 3:4 (`EvidenceDetailView.tsx:343`) | Ảnh ngang nhỏ | **Low** | Theo tỉ lệ thật khi có | Xem ảnh rõ hơn |
| EV-4 | `ReturnMediaDetail`/`DisputeEvidenceDetail` không có prop a11y trong tệp (dựa vào shell) | Cần xác minh bằng VoiceOver | **Low** | Kiểm thử G-11 | – |

### 5.8 Hàng hoàn (UI-D01…D07)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| RT-1 | **D05 Kiểm hàng:** mỗi dòng gồm tên, biến thể, số lượng, huy hiệu so sánh, ghi chú, chip loại chênh lệch, ghi chú chênh lệch, nút xóa (`ReturnItemsScreen.tsx:315-425`) | Tải nhận thức cao nhất app; lặp theo số dòng | **High** | Mặc định thu gọn, chỉ mở phần chênh lệch khi cần; giữ mọi trường | Kiểm hàng nhanh, ít cuộn |
| RT-2 | Luồng danh sách → tìm đơn → ngoại quan → quay → kiểm → xem lại → xong: 6 bước sau danh sách | Dài nhưng mỗi bước đúng đặc tả B01–B08 | **Medium** | Giữ bước; bảo đảm có thanh tiến độ và "Lưu để sau" xuyên suốt | Biết còn bao xa |
| RT-3 | D03 gom checklist + ghi chú + lý do mở trước + ảnh trong một màn | Nhóm nhiều khối | **Medium** | Tiêu đề phần rõ; neo tiến độ | Dễ theo dõi |
| RT-4 | D02 có nhiều bộ nút theo trạng thái (`ReturnFindOrderScreen.tsx:214-244`) | Khó đoán nút chính | **Low** | Một hành động chính cho mỗi trạng thái | – |
| RT-5 | Nút xóa dòng ở D05 chỉ có `hitSlop` xs (`ReturnItemsScreen.tsx:488`) | Có thể < 44 pt | **Medium** | Kiểm kích thước nền; nâng lên `minHeight: touch` | Không bấm nhầm |
| RT-6 | Danh sách hoàn không kéo-để-làm-mới; lối vào duy nhất qua Trang chủ | Xem H-3 | **Low** | Xem H-3 | – |

### 5.9 Tranh chấp (UI-G01…G05)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| DS-1 | **Danh sách tranh chấp (G01) không có lối vào** từ menu/Trang chủ; `ROUTES.disputes` chỉ dùng để reset (`DisputeLoadState.tsx:45`) | Người dùng đã tạo tranh chấp không có cách quay lại ngoài deep link | **High** | Thêm một lối vào tới màn có sẵn (hành vi màn giữ nguyên) **[cần duyệt Q-27]** | Tìm lại hồ sơ đã tạo |
| DS-2 | Chi tiết (G05) xếp 4 thẻ (`DisputeDetailScreen.tsx:110-202`), Xuất (G04) 3 khối | Mật độ thẻ | **Medium** | `ListGroup`, ít viền | Gọn |
| DS-3 | Thẻ tệp ở G03 mang đủ nhãn "giữ/giữ bởi hồ sơ khác/hạn chế" cạnh checkbox | Thông tin dày nhưng đúng yêu cầu bảo toàn bằng chứng | **Low** | Giữ; thống nhất vị trí nhãn | – |
| DS-4 | Dùng `RadioRow` tùy biến thay vì thành phần chung | Nhất quán | **Low** | Kiểm `accessibilityRole="radio"` + state | – |

### 5.10 Trung tâm đồng bộ (UI-F01, F02) — `SyncCenterScreen`, `SyncJobCard`

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| SY-1 | **Thẻ công việc không có nhãn truy cập** (0 `accessibilityLabel` trong `SyncJobCard.tsx` và `SyncCenterScreen.tsx`) | Trình đọc màn hình đọc rời rạc từng thành phần | **High** | Gom thành một phần tử có nhãn tổng hợp (tên đơn + trạng thái + lý do) | Nghe hiểu ngay |
| SY-2 | Không kéo-để-làm-mới | Danh sách trạng thái đổi theo thời gian | **Medium** | Thêm `refreshControl` | Chủ động cập nhật |
| SY-3 | Mỗi thẻ tối đa 2 nút đầy đủ (Thử lại/Kiểm tra lại + Chi tiết/Mở) (`SyncJobCard.tsx:90-120`) | Nút lặp theo số tệp, danh sách dài thì rất nặng | **Medium** | Nút phụ dạng liên kết; giữ "Thử lại" nổi bật | Danh sách thoáng |
| SY-4 | Công tắc "Chỉ tải khi có Wi‑Fi" đặt ở đầu màn | Hợp lý, nhưng chiếm vị trí nổi nhất | **Low** | Giữ; cân nhắc đưa vào Cài đặt khi danh sách dài | – |
| SY-5 | `SyncStatusBar` có sẵn nhưng không dùng; docs/09 UI-B01 yêu cầu khối đồng bộ khi có lỗi | Lệch thiết kế | **Medium** | Dùng cho Trang chủ khi có lỗi (đã có thành phần) | Thấy lỗi từ Trang chủ |

### 5.11 Thông báo (UI-I07) và Cài đặt thông báo (UI-I04)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| NT-1 | Tab Thông báo chỉ có trạng thái rỗng + nút mở Đồng bộ (`NotificationListScreen.tsx`, 26 dòng) nhưng chiếm 1/5 tab | Tab "chết" làm loãng điều hướng; tuy trung thực (D-16, V1-10) | **Medium** | **[cần duyệt]** — không đổi cấu trúc tab; làm rõ nội dung "Việc cần xử lý" từ dữ liệu có thật (lỗi đồng bộ) | Tab có giá trị |
| NT-2 | Cài đặt thông báo bị ẩn khỏi menu (`account-menu.ts`) | Không ảnh hưởng người dùng | **Low** | – | – |

### 5.12 Cá nhân, Cửa hàng, Bảo mật, Xóa tài khoản, Trợ giúp (UI-I01…I06)

| ID | Vấn đề | Vì sao | Mức | Khuyến nghị | Kỳ vọng |
|---|---|---|---|---|---|
| PR-1 | Hồ sơ: nhiều thẻ (hồ sơ, cửa hàng, dữ liệu bằng chứng, menu nhóm) | Có skeleton/offline/cũ (tốt) nhưng nhiều thẻ | **Low** | Giữ | – |
| PR-2 | Bảo mật: 3 hàng khóa "sắp có" nằm trước hàng Xóa tài khoản (`SecurityScreen.tsx:175-188`) | Hàng khóa chiếm chỗ, gây băn khoăn | **Low** | Xếp xuống cuối nhóm | Việc thật lên trước |
| PR-3 | Đổi mật khẩu có 3 ô mật khẩu; kiểm tra `new-password` autocomplete (tốt) | Chấp nhận được | **Low** | – | – |
| PR-4 | **Xóa tài khoản** gồm 5 khối: điều kiện, cảnh báo tệp chưa tải, thẻ dữ liệu, ô tích, nhập mật khẩu (`DeleteAccountParts.tsx:75,173,198,270`) | Là hành động phá hủy nên dài là đúng; nhưng dễ bỏ sót cảnh báo | **Medium** | Chia thành các bước có tiêu đề; nút xóa kiểu `destructive` rõ ràng (kiểm tra) | Hiểu hết hệ quả trước khi xóa |
| PR-5 | Liên hệ hỗ trợ có 4 ô nhập rồi mở `mailto:`; chỉ 3 ô nối `returnKey` (`SupportContactScreen.tsx:147`); Điều khoản/Chính sách bị khóa | Tạo kỳ vọng gửi trong app | **Low** | Ghi rõ "mở ứng dụng thư"; nối đủ `returnKey` | Không bất ngờ |
| PR-6 | Menu Gói/Thành viên/Thanh toán ẩn bằng cờ; màn vẫn tồn tại (H01, I03) | Không ảnh hưởng người dùng | **Low** | – | – |

### 5.13 Màn placeholder và mồ côi

Chín route chỉ vẽ `PlaceholderScreen` (biểu tượng đồng hồ + "sắp có") và không nơi nào điều hướng tới: A05 `/permissions`, B05 `/home/batch`, C05 `/pack-saved`, E05 `/orders/[id]/history`, F03 `/sync/storage`, H02 `/account/plans`, H03 `/account/checkout`, H04 `/account/limit`, I03 `/account/members` (`shop/ui/screens.tsx:17-24`, `orders/ui/placeholders.tsx:4-5`, `upload/ui/placeholders.tsx`).

| ID | Vấn đề | Mức | Khuyến nghị |
|---|---|---|---|
| PH-1 | Người dùng có thể chạm tới nhờ deep link/URL nhưng chỉ thấy "sắp có" | **Low** | Giữ làm khung; bảo đảm cổng phiên vẫn áp dụng |
| PH-2 | Tài liệu `layout.md` còn gọi nhiều màn đã thật là "Placeholder" và mô tả sai A05, Splash, `useIsOffline`, màn quay | **Low** | Cập nhật tài liệu để tránh nhầm khi bàn giao |

---

## 6. Vấn đề của design system (xuyên suốt)

| ID | Vấn đề | Bằng chứng | Mức | Khuyến nghị |
|---|---|---|---|---|
| DS-A | Tương phản viền ô nhập/nút phụ/thẻ < 3:1 | `semantic.ts:39-45`; `TextField.tsx:101`; `Button.tsx:57-63` | **High** | Dùng cấp đậm hơn cho viền *nhận biết điều khiển* (ví dụ `stone[400]` 3,03:1 trên trắng) và giữ `default` cho đường phân nhóm; kiểm lại golden test màu |
| DS-B | Không dark mode | `app.json:7`, `Providers.tsx:73` | **Medium** | Đã có kiến trúc; chờ O-17 **[cần duyệt]** |
| DS-C | Không `useReducedMotion`, không haptics, không ripple Android | grep 0 | **Low–Medium** | Thêm khi bổ sung chuyển động; hiện rủi ro thấp |
| DS-D | Cỡ chữ nhóm form 13/14 sp < thân 15 sp; 3 cặp biến thể chênh ≤ 1 sp | `typography.ts:22-38` | **Medium** | Thu gọn thang; **[cần duyệt BA — ngoại lệ docs/09 dòng 58]** |
| DS-E | `fontWeight` 500/600 ngoài token | `typography.ts` vs `primitives.ts:~80` | **Low** | Thêm vào token |
| DS-F | Icon số cứng 18/20/22/26 ngoài thang (≈ 33 chỗ); mặc định `Icon` 22 | `Icon.tsx`; 44 chỗ `<Icon size=…>`, chỉ 21 dùng token | **Low** | Quy về `tokens.icon.*` |
| DS-G | Icon trộn outline/solid; hai alias cùng glyph (`device-saved`, `phone`) | `Icon.tsx:12-88` | **Low** | Quy ước outline cho điều hướng, solid cho trạng thái |
| DS-H | Thành phần trùng/không dùng: `StatTile`≈`MetricTile`, `ActionCard`≈`QuickAction`, 0 chỗ dùng cho `ActionCard`/`StatusCard`/`SyncStatusBar` | grep | **Low** | Hợp nhất/xóa sau khi BA xác nhận |
| DS-I | Lạm dụng `Card`: 95 chỗ (91 trong features) | grep `<Card` | **Medium** | Quy tắc: thẻ chỉ cho khối cần nhấn; còn lại `ListGroup`/nền phẳng |
| DS-J | Đệm đáy: khi `Screen` không có `footer`, nội dung cuộn chỉ có `padding` thường, **không cộng `insets.bottom`** (`Screen.tsx:~70-103`); cạnh trái/phải (landscape) chưa xử lý | `Screen.tsx` | **Medium** | Cộng `insets.bottom` cho ScrollView khi không footer và không `inTabs` |
| DS-K | `BottomSheet` không có xử lý bàn phím | `BottomSheet.tsx` (0 `KeyboardAvoiding`) | **Medium** | Xem SC-4 |
| DS-L | Chưa giới hạn phóng chữ cho tile/badge/chip/StatTile | grep `maxFontSizeMultiplier` (7 chỗ) | **Medium** | Giới hạn 1,3–1,5 ở thành phần dễ vỡ; kiểm 200% trên thiết bị |
| DS-M | Hai bảng màu (jade cũ / cam) song song | `colors.ts`, `app-colors.ts` | **Low** | Kế hoạch gộp (TD-1) |
| DS-N | Ba mã lỗi chưa có chuỗi (`RETURN_LIST_UNAVAILABLE`, `RETURN_SESSION_INTERRUPTED`, `RETURN_UPLOAD_PENDING`) — chưa thấy nơi nào hiển thị chúng | `codes.ts:24-26,98-100` | **Low** | Bổ sung chuỗi khi BA duyệt (C-1) |

---

## 7. Backlog ưu tiên

Công sức: **S** ≤ 0,5 ngày, **M** 1–2 ngày, **L** > 2 ngày. **[cần duyệt]** = chạm quyết định mở/BA.

### P0 — Vấn đề usability/a11y nghiêm trọng (làm trước)

| ID | Việc | Màn | Mức | Công sức | Ghi chú / rủi ro |
|---|---|---|---|---|---|
| P0-1 | Tăng tương phản viền điều khiển lên ≥ 3:1 (ô nhập, nút phụ, tìm kiếm) | toàn app (`semantic.ts`, `TextField`, `Button`, `SearchField`) | High | S–M | Phải cập nhật golden/test màu; kiểm trực quan hai bảng màu |
| P0-2 | Xử lý hai nút luôn tắt ở màn Xác nhận video (ẩn hoặc giải thích) | `PackConfirmScreen.tsx` | High | S | Không bỏ chức năng, chỉ làm rõ trạng thái |
| P0-3 | Nhãn truy cập tổng hợp cho thẻ công việc đồng bộ | `SyncJobCard.tsx` | High | S | Kiểm thử VoiceOver/TalkBack (G-11) |
| P0-4 | `returnKeyType` + chuyển ô kế tiếp ở Tạo đơn nhanh và Liên hệ hỗ trợ | `QuickOrderScreen`, `QuickOrderLineEditor`, `SupportContactScreen` | High | S | Chưa kiểm chứng bàn phím trên thiết bị |
| P0-5 | Đệm đáy `insets.bottom` khi `Screen` không có footer; xử lý bàn phím trong `BottomSheet` | `Screen.tsx`, `BottomSheet.tsx` | Medium–High | S–M | Cần thiết bị thật (G-13 liên quan) |

### P1 — Cải thiện UX lớn

| ID | Việc | Màn | Mức | Công sức | Ghi chú |
|---|---|---|---|---|---|
| P1-1 | Rút ngắn đường tới camera cho đơn mới | Quét → Tạo đơn → Quay | High | L | **[cần duyệt O-19]**; không được vi phạm "không tự tạo/gộp" |
| P1-2 | Lối vào cho Danh sách tranh chấp; lối vào Tìm kiếm ngoài màn Quét | Cá nhân/Trang chủ/Đơn hàng | High | S–M | **[cần duyệt Q-27]**; chỉ thêm điều hướng tới màn có sẵn |
| P1-3 | Thu gọn dòng ở D05 Kiểm hàng (mở chênh lệch khi cần) | `ReturnItemsScreen.tsx` | High | M | Giữ mọi dữ liệu |
| P1-4 | Skeleton + kéo-để-làm-mới cho Trang chủ, Hàng hoàn, Tranh chấp, Đồng bộ | các màn liệt kê | Medium | M | `Screen` đã nhận `refreshControl` |
| P1-5 | `OfflineBanner` cho màn auth/onboarding | `OnboardingScaffold` | Medium | S | – |
| P1-6 | Dùng `SyncStatusBar` ở Trang chủ khi có lỗi/tệp chờ (docs/09 UI-B01) | `HomeScreen` | Medium | S–M | Thành phần đã có |
| P1-7 | Vùng chạm các liên kết/nút nhỏ (Chào mừng, Bộ lọc 34 pt, xóa dòng D05, chip compact) | nhiều màn | Medium | S | Kiểm kích thước thật |
| P1-8 | Giới hạn phóng chữ ở thành phần dễ vỡ và thử 200% | shared/ui | Medium | M | Cần thiết bị |
| P1-9 | Hint truy cập cho nút dừng/đèn khi quay | `RecordingFrame.tsx` | Medium | S | – |
| P1-10 | Giảm lạm dụng thẻ ở Chi tiết đơn, Chi tiết tranh chấp, Bằng chứng của đơn | `OrderDetailScreen`, `DisputeDetailScreen`, `OrderEvidenceScreen` | Medium | M | Quy tắc dùng thẻ ở §6 DS-I |

### P2 — Nhất quán thị giác

| ID | Việc | Phạm vi | Công sức |
|---|---|---|---|
| P2-1 | Quy mọi `Icon size` về token; thống nhất outline/solid | `features/**`, `Icon.tsx` | M |
| P2-2 | Thêm `fontWeight` 500/600 vào token; rà thang chữ (gộp biến thể chênh ≤ 1 sp) | `typography.ts` | S–M **[cần duyệt BA]** |
| P2-3 | Hợp nhất `StatTile`/`MetricTile`; quyết định số phận `ActionCard`/`StatusCard` | `shared/ui` | M |
| P2-4 | Thay `minHeight: 180` và các số cứng còn lại bằng token | `PackConfirmScreen` và vài màn | S |
| P2-5 | Dùng `resolveErrorMessage` thống nhất; bổ sung chuỗi cho 3 mã lỗi | `OrderPreviewScreen`, `errors.json` | S **[cần duyệt C-1]** |
| P2-6 | Xếp lại hàng "sắp có" xuống cuối nhóm ở Bảo mật; làm rõ Liên hệ hỗ trợ sẽ mở ứng dụng thư | `SecurityScreen`, `SupportContactScreen` | S |
| P2-7 | Cập nhật `layout.md`/`docs/09` cho khớp mã (màn thật vs placeholder, Splash, `useIsOffline`) | docs | S |

### P3 — Vi tương tác và bóng bẩy

| ID | Việc | Ghi chú |
|---|---|---|
| P3-1 | Haptics cho quét thành công, bắt đầu/dừng quay | Thêm phụ thuộc `expo-haptics` **[cần duyệt]** |
| P3-2 | `android_ripple` thay vì chỉ giảm opacity trên Android | Qua `Pressable` chung |
| P3-3 | Skeleton có shimmer + tôn trọng reduce-motion | Hiện skeleton tĩnh |
| P3-4 | Chuyển cảnh/animation tối thiểu cho BottomSheet, toast | Thêm `useReducedMotion` |
| P3-5 | Dark mode | **[cần duyệt O-17]**; kiến trúc token đã sẵn |
| P3-6 | Chuyển phản hồi thành công (đã gửi, đã lưu) bằng toast ngắn thay vì chỉ điều hướng | Chỉ ở luồng đã có |

---

## 8. Ràng buộc nghiệp vụ khi thực hiện backlog

Các đề xuất phải giữ bất biến trong `CLAUDE.md`:

- **Bất biến 5 (không tự liên kết/kết luận):** P1-1 rút ngắn đường tới camera không được tự chọn đơn khi nhiều kết quả hoặc tự tạo đơn.
- **Bất biến 6 (không dữ liệu giả):** không thêm nút "quay bổ sung giả"; hai nút ở màn Xác nhận chỉ được bật khi luồng thật hỗ trợ.
- **Bất biến 11 (ngôn ngữ trung thực):** giải thích SHA‑256 (EV-2) phải nói đúng "không đổi kể từ lúc tính", không hứa giá trị pháp lý. Nhãn "Đã lưu trên máy chủ" chỉ sau khi máy chủ xác nhận.
- **Bất biến 4/9 (bản gốc bất biến, bằng chứng tranh chấp):** việc thu gọn danh sách tệp (DS-2/RT-1) không được che nhãn "giữ" hay "hạn chế".
- **Thiết kế exception-first:** mọi thay đổi bố cục phải giữ nhánh ngoại lệ (mở kiện trước khi quay, hàng hoàn chưa liên kết).
- **Thông báo lỗi:** tối đa 2 câu, dưới 20 từ (docs/09 §5.1) khi bổ sung chuỗi mới.

---

## Phụ lục A — Danh mục màn hình ↔ route ↔ tệp (rút gọn)

| Nhóm | Route | UI | Tệp chính |
|---|---|---|---|
| Auth | `/`, `/welcome`, `/sign-in`, `/sign-up`, `/forgot-password`(+`/sent`), `/create-shop`, `/setup-done` | A01–A09 | `src/features/shop/ui/*` |
| Trang chủ | `/home`, `/home/search` | B01, B03 | `home/ui/HomeScreen.tsx`, `orders/ui/SearchScreen.tsx` |
| Quét/Tạo đơn | `/scan`, `/quick-order` | B02, B04 | `orders/ui/ScanScreen.tsx`, `QuickOrderScreen.tsx` |
| Đóng gói | `/order-preview`, `/pack-precheck`, `/record-pack`, `/pack-confirm`, `/pack-done` | C01–C04, C06 | `packing/ui/*`, `orders/ui/OrderPreviewScreen.tsx` |
| Đơn hàng | `/orders`, `/orders/[id]`(+`/edit`,`/evidence`,`/evidence/[eid]`) | E01–E04 | `orders/ui/*` |
| Hàng hoàn | `/returns`, `/returns/find-order`, `/returns/package-exterior`, `/record-return`, `/returns/items-check`, `/returns/review`, `/returns/done`, `/returns/[rid]/media/[mid]` | D01–D07 | `returns/ui/*` |
| Tranh chấp | `/disputes`, `/disputes/new`, `/disputes/select-evidence`, `/disputes/export`, `/disputes/[id]`, `/disputes/[id]/evidence/[eid]` | G01–G05 | `disputes/ui/*` |
| Đồng bộ | `/sync`, `/sync/[jobId]` | F01, F02 | `upload/ui/*` |
| Thông báo | `/notifications` (tab), `/account/notifications` | I07, I04 | `shop/ui/NotificationListScreen.tsx`, `personal/ui/NotificationsScreen.tsx` |
| Cá nhân | `/account` và con (`edit-profile`, `evidence`, `retention`, `shop-settings`(+`edit`,`switch`), `security`(+`change-password`,`delete-account`), `help`(+…)) | I01, I02, I05, I06 | `personal/ui/*` |
| Placeholder | `/permissions`, `/home/batch`, `/pack-saved`, `/orders/[id]/history`, `/sync/storage`, `/account/plans`, `/account/checkout`, `/account/limit`, `/account/members` | A05, B05, C05, E05, F03, H02–H04, I03 | `shop/ui/screens.tsx`, `orders/ui/placeholders.tsx`, `upload/ui/placeholders.tsx` |

Nguồn chính: `src/core/navigation/routes.ts`, `docs/engineering/layout.md`, `docs/09-ui-ux-design.md`.

## Phụ lục B — Tương phản đã tính (công thức WCAG 2.x)

| Cặp | Tỷ lệ | Ngưỡng | Kết quả |
|---|---|---|---|
| `border.field` (#D8CBC3) / trắng | 1,58 | 3 (UI) | Không đạt |
| `border.field` / nền màn (#FFFAF7) | 1,53 | 3 | Không đạt |
| `border.default` (#F0E4DE) / nền màn | 1,20 | 3 | Không đạt (dùng phân nhóm) |
| `border.strong` (#9A938D) / trắng | 3,03 | 3 | Đạt |
| `text.secondary` (#746D68) / trắng | 5,08 | 4,5 | Đạt |
| Chữ trắng / `action.primary` (cam 700) | 4,57 | 4,5 | Đạt (sát) |
| Chữ trắng / `brand.primary` (cam 600) | 3,66 | 4,5 | Không đạt cho chữ thường; đúng vai trò icon |
| `feedback.success` / `warning` fg trên bg | 4,57 / 4,58 | 4,5 | Đạt (sát) |
| `text.disabled` / trắng | 3,03 | – | Miễn trừ (vô hiệu hóa) |

## Phụ lục C — Chưa xác minh được (cần thiết bị)

- Bàn phím che nút/ô nhập (Android edge-to-edge, `BottomSheet`), `platform/layout.ts:16-19`.
- Kích thước hiệu lực của `hitSlop` ở nút Bộ lọc, chip compact, nút xóa dòng D05.
- Thứ tự đọc VoiceOver/TalkBack; Dynamic Type 200% và Android font scale (G-11).
- Thời gian phản hồi/độ giật của màn danh sách dài; hiệu năng băm khi quay.
- Skeleton có hoạt ảnh hay không (nội dung `Skeleton.tsx` cho thấy tĩnh).
- Nội dung `ReturnLoadState`, `DisputeLoadState`, `OrderSourcePicker` chưa đọc chi tiết.
- Mã lỗi `RETURN_*` chưa có chuỗi có thể tới UI hay không.

## Phụ lục D — Tài liệu và nguồn đối chiếu

`docs/09-ui-ux-design.md` (O-02, O-17, O-19, ngoại lệ cỡ chữ dòng 58, nhãn dòng 259), `docs/design-system.md`, `docs/design-system-audit.md`, `docs/engineering/layout.md`, `docs/engineering/release-checklist.md` (G-11), `docs/engineering/testing.md`, `CLAUDE.md` (bất biến nghiệp vụ).
