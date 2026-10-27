# Audit hệ thống thiết kế (Design Token) — Đơn Chứng

> Trạng thái: **audit trước triển khai** (số liệu ở đây là hiện trạng `main` khi audit; kết quả sau triển khai: [design-token-migration-report.md](design-token-migration-report.md)). TK-1, TK-2, TK-3 (mã "token" của tài liệu này, không phải Q-xx của `engineering/decisions.md`) đã được xác nhận và ghi ở [D-17, D-18, D-19](README.md#đã-chốt). Đi kèm [design-token-spec.md](design-token-spec.md) (đặc tả token đề xuất). Ngày audit: 2026-10-27, nhánh `design-token`, dựa trên `main`.
> Số liệu lấy bằng quét regex trên mã nguồn (không tính tệp test); sẽ được thay bằng công cụ kiểm tra chính thức (`check:tokens`) khi triển khai. Số là gần đúng theo mẫu quét, đủ để quyết định, không phải con số nghiệm thu.

## 1. Phạm vi

### 1.1. Trong phạm vi (cần đăng nhập, bên trong app)

Tab **Trang chủ, Đơn hàng, Thông báo, Cá nhân** và mọi màn đi ra từ đó: Quét, Tạo đơn nhanh, Xác nhận đơn, Quay đóng gói, Xác nhận/Hoàn tất sau quay, Hàng hoàn, Đồng bộ, Tranh chấp, Chi tiết bằng chứng; thanh tab và nút Quét giữa; các component dùng chung của chúng.

### 1.2. Ngoài phạm vi — **không sửa, không đổi giá trị hiển thị** (đã chạy và được khách hàng xác nhận)

| Nhóm | Tệp |
|---|---|
| Splash | `SplashScreen.tsx`, `splash/**`, `splash-layout.ts` |
| Đăng nhập, Đăng ký | `SignInScreen.tsx`, `SignUpScreen.tsx` |
| Quên mật khẩu, OTP, Mật khẩu mới | `ForgotPasswordScreen.tsx`, `VerifyOtpScreen.tsx`, `NewPasswordScreen.tsx` |
| Hỗ trợ riêng của các màn trên | `auth-layout.ts`, `onboarding/**`, `onboarding-layout.ts`, `onboarding-progress.ts`, `BrandLogo.tsx` |

**Giả định đã được xác nhận (TK-1, [D-17](README.md#đã-chốt)):** `WelcomeScreen`, `WelcomeIllustration`, `CreateShopScreen`, `SetupDoneScreen` cũng thuộc luồng thiết lập trước khi vào app, dùng chung bố cục/bảng màu với nhóm trên và chưa nằm trong danh sách bạn nêu. Mình **xếp vào ngoài phạm vi** theo hướng an toàn (chỉ áp dụng cho những gì "bên trong"). Nếu bạn muốn đưa vào, cần thêm một vòng kiểm tra trực quan.

### 1.3. Vùng chạm nhau: component và token dùng chung với màn ngoài phạm vi

Các màn ngoài phạm vi dùng chung một phần hạ tầng. Phần này **không được đổi giá trị hiển thị** dù tệp nằm ở `shared/ui` hay `core/theme`:

| Thành phần dùng chung | Ngoài phạm vi đang dùng | Quy tắc |
|---|---|---|
| `Button`, `Text`, `Icon`, `SourceIcon` | 6, 12, 7, 1 tệp | Chỉ được thay literal bằng token **cùng giá trị**; có test so sánh style trước/sau |
| `colors` (bảng phẳng ở `core/theme/colors.ts`) | ~25 khóa (xem 3.2) | Giá trị từng khóa **đóng băng** bằng test "golden"; không đổi tên, không xóa |
| `useTheme()` | tất cả | Giữ nguyên các khóa trả về (`colors, spacing, radius, typography`); chỉ **thêm** khóa mới |
| `typography`, `spacing`, `radius`, `MIN_TOUCH_TARGET` | tất cả | Giữ nguyên giá trị hiện có |

Hệ quả: không thể "dọn" `colors.ts` theo cách phá vỡ tương thích. Hệ thống mới phải **thêm vào**, không thay thế tại chỗ (xem spec mục 2).

## 2. Kiến trúc UI hiện tại

| Hạng mục | Hiện trạng |
|---|---|
| Nền tảng | Expo 58 (không React Native CLI), React Native 0.88, React 19, TypeScript strict |
| Điều hướng | Expo Router (`src/app` mỏng, màn thật ở `src/features/*/ui`) |
| Styling | Chỉ `StyleSheet` + style inline; **không** có thư viện styling/UI ngoài (không NativeWind, Paper…) |
| Icon, ảnh vector | `@expo/vector-icons` (qua `shared/ui/Icon`), `react-native-svg` |
| Font | Font hệ thống (không `fontFamily`, không `useFonts`); không `letterSpacing` |
| Animation | Không có trong phạm vi (không `Animated`/`Reanimated`) |
| i18n | i18next, chuỗi UI bị ESLint chặn hard-code |
| Chế độ tối | Không có: `app.json` đặt `userInterfaceStyle: light`; O-17 còn mở |
| Vùng an toàn | `react-native-safe-area-context`, gói trong `shared/ui/Screen` |
| Khác biệt nền tảng | Gom ở `src/platform` (`getMinTouchTarget`: 44 iOS / 48 Android); quy ước (shared/ui README) cấm gọi `Platform.OS` trong UI |
| Accessibility | Có sẵn: `accessibilityRole/Label/State`, `minHeight` thay vì chiều cao cố định, không khóa `allowFontScaling`, test tương phản WCAG ở `core/theme/theme.test.ts` |

**Hệ thống token đã tồn tại** (một phần), gồm: `core/theme/colors.ts` (bảng phẳng ~60 khóa), `typography.ts` (cỡ chữ, `spacing`, `radius`, `MIN_TOUCH_TARGET`), `evidence-status.ts` (ánh xạ 6 nhãn trạng thái → biểu tượng + khóa màu), `shared/ui/theme.ts` (`useTheme()`, hiện trả về bảng sáng cố định). Tức là cần **hợp nhất và hoàn thiện**, không dựng hệ thống thứ hai.

## 3. Kết quả audit

### 3.1. Mức độ hardcode **trong phạm vi**

Toàn app có nhiều hardcode hơn rất nhiều, nhưng phần lớn nằm ở các màn ngoài phạm vi (mục 1.2). Trong phạm vi (192 tệp mã nguồn, không tính test):

| Loại | Số lần | Ghi chú |
|---|---|---|
| Mã màu (`#hex`, `rgba`) ngoài `colors.ts` | 8 | 5 ở `SourceIcon` (màu thương hiệu sàn + viền), 2 ở `HomeBanner` (hộp carton minh họa), 1 ở `ScanTabButton` (`#000` đổ bóng) |
| Spacing (`padding/margin/gap`) bằng số | ~39 | Giá trị: 8×11, 12×8, 4×5, 16×4, 2×3, 6×3, 10×2, 5×1, 14×1, 0×1 |
| Border radius bằng số | 9 | 14 ×4 (góc khung ngắm), và 5, 22, 28, 34, 42 (hình tròn viết tay bằng `kích thước/2`) |
| Border width bằng số | 14 | 1 ×9, 4 ×2, 1.5 ×1, 0 ×2 |
| Kích thước cố định (`width/height/min*`) | ~26 | Nút quay 84/68, nút Quét 62, ô quét nhanh 56, ảnh nhỏ 56/28, avatar 44… |
| Đổ bóng / elevation | 5 | Chỉ ở `ScanTabButton` |
| `fontWeight` bằng chữ | 2 | `Text` (`'700'` cho `bold`), `RecordingFrame` (`'400'`) |
| `fontSize` / `lineHeight` bằng số | **0** | Mọi cỡ chữ đã đi qua `typography` |
| `opacity` bằng số | ~3 | `0.85` (nhấn), `0.45` (vô hiệu), `0.8` (đang xử lý) viết trực tiếp trong `Button`/`Card` |
| Kích thước `Icon` (`size={n}`) | 43 (lúc audit, quét gần đúng; số đếm lại sau gộp `main`: 48 chỗ, 13 cỡ, xem [báo cáo](design-token-migration-report.md) mục 5) | Chưa có thang cỡ biểu tượng |
| Style inline `style={{…}}` | 72 | Phần lớn **đã dùng token** (`color: colors.x`, `gap: spacing.x`) hoặc là giá trị động; không phải vi phạm |

Kết luận: **mã trong phạm vi đã khá kỷ luật** (cỡ chữ 100% qua token; màu gần như 100% qua `useTheme`). Vấn đề chính **không phải rải rác hardcode** mà là: (a) thiếu cấu trúc ngữ nghĩa, (b) thiếu token cho vài nhóm thật sự có dùng, (c) **không có cơ chế ngăn tái phát**.

### 3.2. Vấn đề cấu trúc của `colors.ts`

1. **Một danh sách phẳng trộn ba tầng.** Giá trị gốc (`#157852`), vai trò (`brand`, `danger`) và màu riêng một màn (`splash*` ×13, `welcome*` ×3, `onboarding*`) nằm cạnh nhau. Không có tầng trung gian giữa "màu" và "ý nghĩa".
2. **Hai bộ "chữ chính" song song.** `text #1B1B1B` / `textMuted #5A5F5C` (trung tính ấm) và `ink #0E2B3F` / `inkMuted #566B7C` (xám xanh, từ mockup form). Trong phạm vi hiện dùng cả hai: `text` 13 lần, `ink` 5 lần; màn ngoài phạm vi dùng `ink` 19 lần, `inkMuted` 29 lần. Cùng vai trò "chữ chính/chữ phụ", khác sắc độ.
3. **Hai viền khác tên cùng vai trò:** `border #D9D6CC` (trong phạm vi 15 lần) và `fieldBorder #D3E3DE` (4 lần; ngoài phạm vi 12 lần), thêm `borderSubtle`.
4. **Hai nền "trắng":** `surface #FFFFFF` và `formBackground #FFFFFF` (trùng giá trị, khác tên).
5. **Nhóm khóa chỉ ngoài phạm vi dùng** (~25 khóa: `splash*`, `welcome*`, `onboarding*`, `borderSubtle`) lẫn trong cùng file với màu dùng trong app; developer mới không phân biệt được cái nào tái sử dụng.
6. **Tên gắn màn hình** (`splashWave`, `welcomeBlob`) trái nguyên tắc "token không phụ thuộc màn hình cụ thể".
7. **Thiếu vai trò:** không có `info` (chỉ `infoSoft` dùng 1 lần), không có trạng thái `pressed/disabled/focus/selected` dưới dạng token (viết `opacity` tay), không có `border.strong` cho trạng thái chọn.
8. **Màu trạng thái bằng chứng đi vòng qua `ColorRole` chung.** `EVIDENCE_STATUS_PRESENTATION` trỏ `colorRole: 'success'` cho cả *Đã tải lên* và *Đã xác minh*. Hôm nay hai nhãn khác biểu tượng/chữ nên đúng quy định, nhưng **nếu đổi `success` thì cả hai đổi theo** và không thể tách riêng. Cần khóa màu theo trạng thái nghiệp vụ (xem 3.4).
9. `EvidenceStatusBadge` tự giữ bảng `SOFT_BACKGROUND` (màu nền → màu nền nhạt): logic thiết kế nằm trong component thay vì token.

### 3.3. Giá trị trùng/gần trùng

| Nhóm | Phát hiện | Hướng xử lý |
|---|---|---|
| Spacing | `spacing` chỉ có 4/8/12/16/24, nhưng mã dùng thêm 2, 6, 10, 5, 14 | Thêm `xxs=2` và `tight=6` (có dùng thật ≥3 lần); **gộp** 10→8, 5→4 (chênh ≤2dp, xem spec 4.2); 14 xử lý theo ngữ cảnh |
| Radius | `sm8/md12/lg16`; thêm 14 (khung ngắm, ×4), 5/22/28/34/42 (hình tròn) | Hình tròn → `radius.full`; 14 là token thành phần của khung ngắm |
| Border width | 1, 1.5, 4, 0, `hairlineWidth` | Thang 4 bậc có tên |
| Vùng chạm | `MIN_TOUCH_TARGET` 44/48 + `56` (nút chính) + `50` (nút form) + `88/84/68` (nút dừng quay) | Giữ `platform`; còn lại thành token thành phần |
| Mờ khi nhấn | `0.85` viết ở nhiều nơi | `opacity.pressed` |
| Lớp phủ đen | `scrim 0.5`, `cameraControl 0.55` | Gần trùng; để nguyên cả hai (khác vai trò), ghi TD-3 |
| Nền trắng | `surface` = `formBackground` | Một token ngữ nghĩa, `formBackground` thành alias cũ |

### 3.4. Phân tích UI/UX (đánh giá theo mã, **chưa chạy trên thiết bị**)

| Tiêu chí | Đánh giá | Ghi chú |
|---|---|---|
| Nhất quán thương hiệu | Khá. Xanh `#157852` làm màu chính xuyên suốt | Hai bộ màu chữ (3.2) làm sắc độ tiêu đề lệch nhẹ giữa màn thường và màn form |
| Khả năng đọc tiếng Việt | Tốt. Font hệ thống, `lineHeight` đặt rõ (cỡ 15/22, 24/32…), tôn trọng font scale | Nhóm chữ form 13/14sp thấp hơn khuyến nghị 15–17 (đã ghi ngoại lệ trong docs/09, chờ BA) |
| Vùng chạm | Tốt. `getMinTouchTarget()` dùng ở Button/Card/chip; `minHeight` thay chiều cao cố định | Có test |
| Một tay | Nút chính ghim đáy (`Screen footer`), nút Quét tâm đáy | Chưa kiểm trên máy thật |
| Phân biệt trạng thái | Chữ + biểu tượng + viền, `saved_on_device` cố ý không dùng tick/xanh | Giữ nguyên; **điểm yếu:** `uploaded` và `verified` cùng sắc, chỉ khác biểu tượng/nhãn (đúng quy định docs/09) |
| Ngoại tuyến/cảnh báo | `OfflineBanner` dùng `warning` chữ + biểu tượng | Tốt |
| Ghi hình | `RecordingFrame` dùng lớp phủ tối cố định, chữ trắng `overlay` 12sp | Tương phản chữ trên camera phụ thuộc cảnh quay; cần thử ngoài sáng/tối |
| Tương phản | `theme.test.ts` kiểm nhiều cặp chữ/nền ≥4.5:1 | Cặp mới ở token mới phải vào cùng test |

**Trạng thái nghiệp vụ trong yêu cầu của bạn vs. giao diện hiện có:**

| Trạng thái | Hiện có | Ghi chú |
|---|---|---|
| Đã lưu trên thiết bị / Chờ tải lên / Đang tải lên / Đã tải lên / Đã xác minh / Lỗi | **Có đủ 6 nhãn** riêng (icon + màu) | Giữ nguyên, tách khóa token từng trạng thái |
| Đang ghi hình | Có trong `RecordingFrame` (chấm + đồng hồ) | Hiện chấm màu nào chưa thống nhất với quy tắc "đỏ chỉ cho lỗi" ở docs/09 → câu hỏi TK-2 |
| Đang lưu trên thiết bị (sau khi dừng quay) | Có ở `file-state.ts`, **chưa có nhãn UI riêng** | docs/09: "màn quay hiển thị trạng thái riêng", chưa dựng |
| Bằng chứng chưa đầy đủ / quá trình ghi bị gián đoạn | Có ở miền nghiệp vụ, **chưa có thành phần hiển thị** | Không tạo token cho UI chưa tồn tại (xem spec 3.5) |

### 3.5. Chỗ cần giá trị đặc thù thật sự (giữ lại, có chú thích)

- **Màu thương hiệu bên thứ ba** trong `SourceIcon` (Lazada tím `#4B3FD8`, Shopee/TikTok là ảnh): là danh tính của sàn, không thuộc palette app.
- **Hộp carton minh họa** ở `HomeBanner` (`#E2A95C`/`#C48A3C`): hình minh họa, không phải màu giao diện.
- **Màu trên camera** (`cameraBackground`, `onCamera`, `scanAccent`…): lớp phủ trên nền video, không đổi theo sáng/tối chung.
- **Kích thước tính theo màn hình/font scale**, chiều cao tính toán trong `*-layout.ts`, `Math.round(size * 0.55)` trong `SourceIcon`, `maxWidth` nội dung đọc được.

## 4. Thành phần cần xử lý

| Tệp | Việc | Rủi ro |
|---|---|---|
| `core/theme/colors.ts` | Dựng từ palette gốc, **giữ nguyên mọi khóa và giá trị** (test golden) | Thấp, có test |
| `shared/ui/theme.ts` | Trả thêm `tokens` (ngữ nghĩa); không đổi khóa cũ | Thấp |
| `shared/ui/Card, EvidenceStatusBadge, OrderCard, FilterChips, SearchField, QuickAction, ActionCard, ProductLineList, QuantityStepper, SyncStatusBar, OfflineBanner, Skeleton, TextField, ConfirmDialog, BottomSheet, EmptyState, StatTile, ScreenHeader, Screen, RecordingFrame` | Chuyển literal/khóa cũ sang token; bỏ `SOFT_BACKGROUND` | Thấp–trung bình |
| `shared/ui/Button, Text, Icon, SourceIcon` | **Chỉ thay literal cùng giá trị**; test style tương đương | Trung bình (đang phục vụ màn đã verify) |
| `bootstrap/navigation/ScanTabButton.tsx`, `app/(tabs)/_layout.tsx` | Đổ bóng/nút/thanh tab → token thành phần | Thấp |
| `orders/ui/*` (Home, HomeBanner, Scan, QuickOrder, LineEditor, OrderPreview, OrdersList…) | Spacing/radius/size về token | Trung bình (ScanScreen, QuickOrderScreen có test bố cục) |
| `packing/ui`, `returns/ui`, `evidence/ui`, `disputes/ui`, `upload`, `shop/ui/ProfileScreen`, `screens.tsx` | Rà; phần lớn là placeholder dùng `PlaceholderScreen` | Thấp |
| `core/theme/evidence-status.ts` | Trỏ vào token trạng thái riêng từng nhãn | Thấp, test sẵn có |

## 5. Quy ước nên giữ

- Truy cập qua `useTheme()` (không import `colors` trực tiếp trong component).
- `minHeight` thay vì chiều cao cố định; không khóa `allowFontScaling`.
- Khác biệt nền tảng chỉ ở `src/platform`.
- Nhãn trạng thái bằng chứng chỉ từ `EVIDENCE_STATUS_PRESENTATION`; chữ + biểu tượng + màu, màu không là tín hiệu duy nhất.
- Số cỡ chữ đổi thì đổi cả docs/09 và `theme.test.ts` (đã có quy ước; sẽ mở rộng cho toàn bộ token).
- Màu giữ bằng tên vai trò, đỏ chỉ cho lỗi/phá hủy/nguy cơ mất dữ liệu.

## 6. Quyết định cần chốt

| Mã | Câu hỏi | Đề xuất của mình | Cần bạn? |
|---|---|---|---|
| TK-1 ([D-17](README.md#đã-chốt)) | Welcome / Tạo shop / Setup xong có nằm ngoài phạm vi không? | Ngoài phạm vi (mục 1.2) | **Có** (xác nhận) |
| TK-2 ([D-18](README.md#đã-chốt); **đã chốt: chấp nhận đỏ**, token `camera.recordingIndicator`) | Chấm "đang ghi hình" màu gì? docs/09 giới hạn đỏ cho lỗi/phá hủy | Chấm hiện dùng đỏ; đã chốt chấp nhận. Giữ nguyên; khi dựng token, hỏi BA có ngoại lệ "chấm ghi hình" cho đỏ không | **Có** (BA/sản phẩm) |
| TK-3 ([D-19](README.md#đã-chốt)) | Hợp nhất `text/textMuted` với `ink/inkMuted`? | **Chưa hợp nhất.** Đổi sắc chữ là thay đổi nhìn thấy được trên màn form đã duyệt theo mockup. Giữ cả hai ở tầng gốc, ghi nợ TD-1, hợp nhất khi có duyệt trực quan | Không (hoãn có chủ đích) |
| TK-4 | Chế độ tối | Không bật (O-17 mở). Kiến trúc cho phép thêm ở tầng ngữ nghĩa | Không |
| TK-5 | Token chuyển động (animation) | **Không tạo** vì chưa có animation nào trong phạm vi | Không |

## 7. Rủi ro khi chuyển đổi

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Đổi nhầm giá trị hiển thị của màn đã verify qua `colors`/`Button`/`Text` | **Cao nếu sai** | Test golden cho `colors`, test tương đương style cho `Button`/`Text`, không đổi khóa của `useTheme()` |
| Snap spacing (10→8, 5→4) làm lệch bố cục màn có test layout | Thấp–TB | Chỉ áp dụng ở màn trong phạm vi; chạy test layout; ghi trong báo cáo migration |
| Quy tắc ESLint chặn nhầm tệp ngoài phạm vi | TB | Danh sách ngoại trừ đặt ở **một nguồn** dùng chung cho ESLint và script kiểm tra |
| Quy tắc quá chặt gây "ngoại lệ tràn lan" | TB | Chỉ cấm các thuộc tính thiết kế (màu, spacing, radius, shadow…), cho phép 0/1, giá trị tính toán, và `// token-exception: <lý do>` |
| Không thể xác minh trực quan (chưa build native) | Cao | Nói rõ trong báo cáo; dùng test tương đương style + chụp web nếu chạy được; phần còn lại ghi "chưa xác minh" |

## 8. Việc ngoài phạm vi phát hiện được (chỉ ghi nhận)

- `docs/engineering/layout.md` mô tả bố cục; sẽ cần cập nhật sau triển khai.
- `src/test-utils/render.tsx` có số cố định (dành cho test) — được loại khỏi kiểm tra.
- Không phát hiện vấn đề dữ liệu/bảo mật liên quan giao diện trong lần audit này.
