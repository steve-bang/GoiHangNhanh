# Hướng dẫn dùng Design Token (cho developer)

> Quy tắc: **nếu token phù hợp đã có, phải dùng token đó.** Chỉ tạo token mới khi giá trị là một quyết định thiết kế tái sử dụng được hoặc có tên nghiệp vụ rõ ràng. Giá trị, lý do và quan hệ tham chiếu: [design-token-spec.md](design-token-spec.md). Số liệu chuyển đổi: [design-token-migration-report.md](design-token-migration-report.md).

## 1. Phạm vi — đọc trước

Token **bắt buộc** cho mọi màn của app, kể cả Splash, Chào mừng, Đăng nhập, Đăng ký, Quên mật khẩu, OTP, Mật khẩu mới, Tạo shop, Hoàn tất thiết lập (D-20, thay D-17: các màn này đã chuyển sang `tokens` và Bright Orange). Ngoài phạm vi chỉ còn chỗ chứa giá trị gốc của hệ thống token (`src/core/theme/`, `src/shared/ui/theme.ts`) và `src/test-utils/`; danh sách ở một nơi: `scripts/design-token-scope.cjs` (ESLint và `check:tokens` cùng đọc). Màn không nằm trong `Screen` (Splash, khung `OnboardingScaffold`, Chào mừng) phải bọc `AppThemeScope` để `Button`/`Text`/`Icon` nhận bảng Bright Orange.

`Button`, `Text`, `Icon`, `SourceIcon` vẫn đọc được bảng phẳng `colors` (trong `AppThemeScope` là bảng Bright Orange suy từ token); test `frozen-style-equivalence.test.tsx` giữ style của chúng. Bảng cũ jade (`colors.ts` khối `@frozen`) không còn màn nào dùng; gỡ hẳn là việc dọn dẹp riêng.

## 2. Ba tầng

```
primitives.ts   giá trị gốc (palette.jade[700] = #157852, space[8] = 8…)   — nơi DUY NHẤT viết hex
   ↓ tham chiếu
semantic.ts     vai trò (color.action.primary, status.verified.fg…)       — component dùng tầng này
   ↓ tham chiếu
components.ts   quy tắc riêng thành phần (button.minHeight.primary…)       — chỉ khi thật sự cần
```

Tất cả ở `src/core/theme/`, import qua `@/core/theme` hoặc (trong component) `useTheme()` từ `@/shared/ui`.

## 3. Dùng trong component

```tsx
import { Text, useTheme } from '@/shared/ui';

function Example() {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        backgroundColor: tokens.color.surface.raised,
        borderColor: tokens.color.border.default,
        borderWidth: tokens.borderWidth.thin,
        borderRadius: tokens.radius.md,
        padding: tokens.space.lg,
        gap: tokens.space.sm,
      }}
    >
      <Text variant="sectionTitle">{t('...')}</Text>
      <Text color="textMuted">{t('...')}</Text>
    </View>
  );
}
```

**Màu luôn qua `useTheme().tokens.color`.** Với token không đổi theo sáng/tối, dùng được trong `StyleSheet.create` ở mức module:

```tsx
import { layout } from '@/core/theme';

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: layout.space.sm, borderWidth: layout.borderWidth.thin },
});
```

### Chọn token nào

| Cần | Dùng |
|---|---|
| Chữ chính / phụ / trên nút | `color.text.primary` / `.secondary` / `.onAction` (nhóm màn form: `.strong`, `.subtle`) |
| Nền màn / thẻ / khối xám | `color.surface.screen` / `.raised` / `.muted` |
| Viền thẻ / viền ô nhập | `color.border.default` / `.field` |
| Nền nút chính (chữ trắng) · chữ liên kết · biểu tượng/tab đang chọn/nút Quét | `color.action.primary` · `color.action.link` · `color.brand.primary` (đồ họa, không làm nền chữ trắng cỡ thường: 3.66:1); hành động phá hủy `color.action.destructive` (đỏ chỉ cho lỗi/phá hủy/nguy cơ mất dữ liệu) |
| Thông báo thành công / cảnh báo / lỗi | `color.feedback.{success,warning,danger}.{fg,bg}` |
| Trạng thái bằng chứng | `status.<savedOnDevice\|waitingUpload\|uploading\|uploaded\|verified\|error>.{fg,bg,border}` — qua `EvidenceStatusBadge` / `EVIDENCE_STATUS_PRESENTATION`, **không tự dựng**; không gộp các trạng thái |
| Màu trên khung camera | `color.camera.*` (cố định, không đổi theo sáng/tối) |
| Khoảng cách | `space.xxs 2 · xs 4 · tight 6 · sm 8 · md 12 · lg 16 · xl 24` |
| Bo góc / hình tròn | `radius.sm/md/lg` / `radius.full` |
| Độ dày viền | `borderWidth.thin 1 · strong 1.5 · emphasis 2 (chọn/focus/lỗi) · ring 4` |
| Nhấn / vô hiệu / đang xử lý | `opacity.pressed 0.85 · disabled 0.45 · busy 0.8` |
| Cỡ chữ | `<Text variant="...">` (không dùng `fontSize`); trọng số `fontWeight.bold`. Tiêu đề thẻ/dòng danh sách: `cardTitle`; số liệu: `numeric` (chữ số cùng bề rộng) |
| Chữ gợi ý/ghi chú cấp ba · chữ vô hiệu hóa | `color.text.tertiary` · `color.text.disabled` |
| Ranh giới điều khiển (hộp kiểm, nút chọn) · đường kẻ phân nhóm | `color.border.strong` (≥ 3:1) · `color.border.subtle` |
| Nút đang nhấn · nền vô hiệu hóa (component mới) | `color.action.primaryPressed` · `color.action.disabled` |
| Lớp nổi (sheet, hộp thoại) | `color.surface.elevated` |
| Hộp carton trong hình minh họa | `color.illustration.carton` / `.cartonShade` (chỉ đồ họa trang trí) |
| Trạng thái quay/đồng bộ: đang ghi, gián đoạn, đang thử lại, mất mạng, chờ/xong đồng bộ | `status.recording / interrupted / retrying / offline / syncPending / synced` (luôn kèm chữ + biểu tượng riêng) |
| Cỡ biểu tượng | `tokens.icon.sm/md/lg/xl` (16/20/24/32) |
| Vùng chạm tối thiểu | `getMinTouchTarget()` từ `@/platform` (44 iOS / 48 Android) — không nhân bản |
| Kích thước thành phần | `tokens.component.*` / `layout.component.*` (nút, ô nhập, tile, nút dừng quay, khung ngắm…) |

Màu trên `Text` qua prop `color` vẫn dùng tên vai trò cũ (`'textMuted'`, `'danger'`…) — giữ vì `Text` dùng chung với màn đã verify; giá trị giống `text.secondary`, `feedback.danger.fg`.

## 4. Thêm token mới

1. **Có token gần đúng không?** Tìm trong `semantic.ts`/`components.ts` trước. Chênh ≤2dp hoặc cùng ý nghĩa thì dùng token có sẵn.
2. **Đáng thành token không?** Cần một trong: dùng ≥2 chỗ, hoặc là quyết định thiết kế có tên (ví dụ màu riêng một trạng thái nghiệp vụ). Giá trị dùng một lần, mang tính layout (độ rộng tối đa của đoạn chữ…) → `// token-exception: <lý do>`.
3. **Tầng nào?** Giá trị thô mới (màu, bậc thang) → `primitives.ts` (tên theo họ + độ đậm, không theo màn hình). Vai trò mới → `semantic.ts`, trỏ về primitive. Chỉ thêm `components.ts` khi quy tắc không suy ra được từ semantic (kích thước nút dừng quay); **không** sao chép 1–1 một semantic token sang component token.
4. **Cập nhật cùng lúc:** spec ([design-token-spec.md](design-token-spec.md)), test tương phản trong `src/core/theme/theme.test.ts` cho cặp chữ/nền mới, và `npm run check`.
5. Màu mới phải đạt tương phản ≥4.5:1 (chữ) hoặc ≥3:1 (viền/biểu tượng) trên nền sẽ đặt lên.

## 5. Ngoại lệ — khi nào được dùng giá trị riêng

Được, nhưng phải ghi lý do ngay tại chỗ:

```tsx
// token-exception: màu thương hiệu Lazada (danh tính bên thứ ba, không thuộc palette app)
lazada: { icon: 'heart', tint: '#4B3FD8' },
```

Hợp lệ: màu thương hiệu bên thứ ba, màu hình minh họa, giới hạn độ rộng đọc được, khung giữ chỗ chưa có nội dung thật. Không cần ngoại lệ: số `0`, `opacity: 1`, phép tính theo biến (`insets.bottom + tokens.space.lg`, `size * 0.55`), kích thước tính theo màn hình/font scale, `StyleSheet.hairlineWidth`, `size` của `Icon`. Thêm ngoại lệ mới phải cập nhật `scripts/design-token-exceptions.json` trong cùng PR để reviewer thấy.

## 6. Chế độ tối và khác biệt nền tảng

- **Chế độ tối chưa bật** (O-17). Khi chốt: thêm một đối tượng semantic cùng kiểu cho bảng tối và để `useTheme()` chọn theo `useColorScheme()`; component không phải sửa vì chỉ đọc `tokens`. Đó là lý do màu không được đọc tĩnh. Cần bỏ `userInterfaceStyle: light` ở `app.json`.
- **iOS/Android:** không gọi `Platform.OS` trong UI. Khác biệt đã có nằm ở `@/platform` (`getMinTouchTarget`). Đổ bóng: `layout.elevation.floating` chứa cả khóa iOS lẫn Android.

## 7. Không được làm

- Viết mã màu (`#...`, `rgb(...)`) hoặc số cho `fontSize`, `padding`, `margin`, `gap`, `borderRadius`, `borderWidth`, `shadow*`, `elevation`, `opacity`, `width/height` cố định trong giao diện → ESLint báo lỗi.
- Đọc `colors`, `spacing`, `radius` từ `useTheme()` hoặc import `colors`/`palette` trực tiếp trong màn thuộc phạm vi.
- Dùng màu `@frozen` (`splash*`, `welcome*`, `onboarding*`, `borderSubtle`) cho màn mới.
- Dùng màu thành công/tick cho *Đã lưu trên máy*; dùng đỏ cho thứ không phải lỗi/phá hủy/nguy cơ mất dữ liệu; để màu là tín hiệu duy nhất (luôn kèm chữ + biểu tượng).
- Khóa font scale (`allowFontScaling={false}`), đặt chiều cao cố định thay cho `minHeight`, làm vùng chạm nhỏ hơn mức tối thiểu.
- Tắt rule (`eslint-disable`) hoặc dùng `any` để lách lỗi token.

## 8. Lệnh

| Lệnh | Việc |
|---|---|
| `npm run lint` | Gồm rule `design-tokens/no-raw-design-values` |
| `npm run check:tokens` | Cấu trúc token, nguồn hex duy nhất, kiến trúc tầng, baseline ngoại lệ, lỗi khi sửa tệp ngoài phạm vi (trừ allowlist `scripts/design-token-frozen-allow.json`) |
| `npm run check` | Toàn bộ (lint, typecheck, format, check:tokens, test) |


## 6. Quyết định thiết kế v2 (đợt nâng cấp)

- **Một hành động chính mỗi màn.** Trang chủ: *Đóng gói đơn* là thẻ xanh đặc duy nhất; *Nhận hàng hoàn* là thẻ trắng viền mảnh. Bỏ banner và thẻ hướng dẫn nền gradient (trang trí, trùng hành động); lối tắt *Quét mã đơn* bỏ vì trùng nút Quét giữa thanh tab và thẻ *Đóng gói đơn*.
- **Không gradient, glow, bóng nặng.** Phân cấp bằng cỡ chữ, độ đậm, khoảng cách và một màu thương hiệu.
- **Danh sách:** tiêu đề dòng dùng `cardTitle`; dòng phụ `formBody` màu phụ; dòng ngày/giai đoạn là chú thích. Chip lọc dùng `size="compact"` ở danh sách có nhiều chip để không chiếm 3 hàng (vẫn xuống dòng khi chữ lớn, không cuộn ngang).
- **Số liệu** dùng `numeric` (không phải `screenTitle`), để không bị đọc thành tiêu đề.
- **Chưa làm:** chế độ tối (token đã tách `surface.elevated`, `text.*`, `status.*` để làm sau, câu hỏi mở O-17); `Button` chưa dùng `primaryPressed` vì dùng chung với màn đã khách xác nhận.

## 7. Bright Orange (v3)

Chi tiết giá trị, tương phản và cơ chế phạm vi: [design-token-spec.md mục 4.8](design-token-spec.md#48-bright-orange-v3). Tóm tắt cho developer:

- Nền nút chính = `action.primary` (#D93B20), **không** phải `brand.primary` (#EE4D2D): chữ trắng trên #EE4D2D chỉ 3.66:1. Muốn dùng #EE4D2D làm nền nút phải tăng cỡ chữ lên "chữ lớn" (≥ 24px hoặc ≥ 18.66px đậm) và được duyệt lại.
- Chữ cam trên nền màn/trắng/cam nhạt: `action.link`. Biểu tượng, viền chọn, tiến độ, nút Quét: `brand.primary`.
- Trạng thái nghiệp vụ lấy từ `status.*` / `feedback.*`, không bao giờ dùng cam.
- Màn mới phải nằm trong `Screen` (hoặc bọc `AppThemeScope`) để `Button`/`Text`/`Icon` nhận bảng màu mới.
- Splash, đăng nhập và luồng thiết lập đã dùng Bright Orange (D-20). Ảnh minh họa Splash đã đổi sang cam bằng `scripts/assets/recolor-splash-hero.py`. Icon ứng dụng và ảnh splash native của hệ điều hành (`assets/images/icon.png`, `splash/splash-icon*.png`) vẫn màu cũ (jade): cần thiết kế lại riêng.
