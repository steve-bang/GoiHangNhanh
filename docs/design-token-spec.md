# Đặc tả Design Token — Đơn Chứng

> Trạng thái: **đã triển khai** trong `src/core/theme/` (kết quả: [design-token-migration-report.md](design-token-migration-report.md); cách dùng: [design-system.md](design-system.md)). TK-1, TK-2, TK-3 ở audit mục 6 đã được xác nhận ([D-17, D-18, D-19](README.md#đã-chốt)). Phạm vi: các màn **bên trong app sau đăng nhập**. Splash, Đăng nhập, Đăng ký, Quên mật khẩu, OTP, Mật khẩu mới (và các tệp hỗ trợ) **không đổi** — xem audit mục 1.
> Giá trị hex bên dưới **lấy nguyên từ `core/theme/colors.ts` hiện tại**, không có màu mới. Mục tiêu của token là cấu trúc và ngăn lệch, không phải đổi giao diện.

## 1. Nguyên tắc thiết kế

1. **Không đổi giao diện đã duyệt.** Mọi token trong phạm vi bằng giá trị đang chạy, trừ các điểm gộp spacing nêu ở 4.2 (chênh ≤2dp, có ghi).
2. **Thêm, không thay.** Màn ngoài phạm vi đọc `colors`/`typography`/`spacing`/`radius` hiện có; các bảng đó giữ nguyên khóa và giá trị (khóa bằng test golden).
3. **Ba tầng, nối bằng tham chiếu thật trong code** (không sao chép hex): `primitives → semantic → component`.
4. **Chỉ tạo token khi đã có ≥2 chỗ dùng, hoặc là một quyết định thiết kế có tên** (ví dụ: màu từng trạng thái bằng chứng). Không tạo token cho thứ chưa tồn tại (chuyển động, chế độ tối, UI "bị gián đoạn").
5. **Component token chỉ khi** có quy tắc riêng không suy ra được từ semantic (kích thước nút dừng quay, độ nhô nút Quét). Không tạo bản sao 1–1 của một semantic token.
6. **Đặt tên theo vai trò, không theo màn hình** (không `splash*`, `home*`).

## 2. Kiến trúc và vị trí tệp

Hợp nhất vào `src/core/theme/` (đã là nơi chứa theme, TypeScript thuần, không import React Native):

```
src/core/theme/
  primitives.ts    NGUỒN DUY NHẤT của giá trị gốc: palette, thang spacing/radius/border/opacity, elevation
  semantic.ts      vai trò (color.text.primary, status.verified…) = tham chiếu tới primitives
  components.ts    quy tắc riêng của thành phần = tham chiếu tới primitives/semantic
  colors.ts        (cũ) bảng phẳng cho màn ngoài phạm vi: DỰNG TỪ primitives, giá trị y hệt
  typography.ts    (cũ) typography/spacing/radius/MIN_TOUCH_TARGET: giữ nguyên giá trị
  evidence-status.ts  (cũ) trỏ sang token trạng thái riêng từng nhãn
  index.ts         điểm vào công khai duy nhất
```

- `colors.ts` hiện viết hex tay. Sau đổi, mỗi khóa là `primitives.palette.x` → **một nguồn hex**, không hai nơi. Test golden so từng khóa với giá trị hiện tại (snapshot ghi vào test từ mã hôm nay) nên bất kỳ lệch nào đều làm test đỏ.
- `useTheme()` (`shared/ui/theme.ts`) trả **thêm** khóa `tokens` (semantic + `component`). Các khóa cũ `colors, spacing, radius, typography` giữ nguyên. Component trong phạm vi dùng `tokens`; màn ngoài phạm vi vẫn dùng khóa cũ.
- **Hai đường truy cập, chọn theo việc:** (1) `useTheme().tokens` cho mọi thứ trong render, **bắt buộc cho màu**; (2) `layout` (export từ `@/core/theme`) cho token không đổi theo sáng/tối (space, radius, borderWidth, opacity, elevation, `component`) khi cần trong `StyleSheet.create` ở mức module. ESLint chặn đọc `semantic.color`/`semantic.status` tĩnh để chế độ tối sau này không phải sửa từng component.
- Giá trị do hệ điều hành cấp (`StyleSheet.hairlineWidth`, vùng chạm tối thiểu qua `getMinTouchTarget`) giữ nguyên ở lớp UI/`@/platform`, không sao chép vào `core/theme`.
- Không thêm thư viện. Không dependency vòng: `primitives ← semantic ← components`, `colors/typography ← primitives`, `shared/ui ← core/theme`.

## 3. Nhóm token được chọn

| Nhóm | Quyết định | Lý do |
|---|---|---|
| Color | **Có** — primitives + semantic + trạng thái bằng chứng | Có cấu trúc yếu nhất (audit 3.2) |
| Typography | **Giữ** 9 variant hiện có, thêm tên cho `weight` | 0 literal cỡ chữ trong phạm vi |
| Spacing | **Có**, mở rộng từ 5 lên 7 bậc | Mã dùng 2 và 6 nhiều lần |
| Sizing | **Có**, chỉ giá trị lặp/có nghĩa (cỡ nút, nút dừng quay, ô ảnh nhỏ) | Audit 3.3 |
| Radius | **Có** + `full` | 5 hình tròn viết tay |
| Border width | **Có** (4 bậc) | 14 chỗ |
| Opacity | **Có** (pressed/disabled/busy) | Viết tay lặp |
| Elevation | **Có**, 1 bậc `floating` | Chỉ nút Quét; docs/09: thẻ không đổ bóng |
| Motion | **Không tạo** | Không có animation trong phạm vi |
| Font family / letter spacing | **Không tạo** | Dùng font hệ thống, không có `letterSpacing` |
| Dark mode | **Không bật** (O-17), chừa chỗ ở 8 | Chưa là yêu cầu sản phẩm |
| Icon size | **Không tạo** | Có 13 cỡ (14…56) theo từng mockup (44 chỗ `<Icon size={số}>` trong phạm vi, đếm 2026-10-27), `Icon` mặc định 22 và được màn ngoài phạm vi dùng; gom lại đổi hiển thị. Ghi nợ TD-5 |
| Z-index/breakpoint | **Không** | Không cần; `useWindowDimensions` giữ logic cũ |

## 4. Giá trị cuối cùng

### 4.1. Primitives — màu (từ `colors.ts` hiện tại)

Đặt tên theo họ màu + độ đậm, không theo vai trò.

| Primitive | Hex | Nguồn khóa cũ |
|---|---|---|
| `jade.950` | `#14382A` | `brandDark` |
| `jade.700` | `#157852` | `brand` |
| `jade.100` | `#E6F0E9` | `brandSoft` |
| `green.700` | `#1E7A3C` | `success` |
| `green.100` | `#E3F1E7` | `successSoft` |
| `amber.700` | `#B45309` | `warning` |
| `amber.50` | `#FDF3E7` | `warningSoft` |
| `red.700` | `#B3261E` | `danger` |
| `red.50` | `#FCEBEA` | `dangerSoft` |
| `teal.50` | `#EAF5F4` | `infoSoft` |
| `neutral.0` | `#FFFFFF` | `surface`, `formBackground`, `onBrand`… |
| `neutral.50` | `#FAF8F2` | `background` |
| `neutral.100` | `#F3F6F5` | `surfaceMuted` |
| `neutral.300` | `#D9D6CC` | `border` |
| `neutral.600` | `#5A5F5C` | `textMuted` |
| `neutral.900` | `#1B1B1B` | `text` |
| `slate.900` | `#0E2B3F` | `ink` |
| `slate.500` | `#566B7C` | `inkMuted` |
| `mint.200` | `#D3E3DE` | `fieldBorder` |
| `camera.900` | `#16201A` | `cameraBackground` |
| `scan.400` | `#35E0A1` | `scanAccent` |
| `black.50a` / `black.55a` | `rgba(0,0,0,0.5)` / `rgba(0,0,0,0.55)` | `scrim` / `cameraControl` |
| `white.75a` | `rgba(255,255,255,0.75)` | `onCameraMuted` |

Các khóa chỉ màn ngoài phạm vi dùng (`splash*`, `welcome*`, `onboarding*`, `borderSubtle`) **không** vào primitives: chúng ở lại trong `colors.ts` như màu "cũ đóng băng", có chú thích `@frozen: màn đã verify`. Không ai trong phạm vi được dùng chúng (lint chặn, mục 7).

### 4.2. Primitives — thang số

| Thang | Giá trị | Ghi chú |
|---|---|---|
| `space` | `0 · 2 · 4 · 6 · 8 · 12 · 16 · 24` | Thêm 2, 6 (đang dùng ×3, ×3). **Gộp:** `10→8` (2 chỗ, khoảng cách icon–chữ), `5→4` (padding pill), `14` xử lý riêng theo ngữ cảnh khi triển khai (1 chỗ). Chênh ≤2dp, ghi trong báo cáo migration |
| `radius` | `8 · 12 · 16 · full` | `full = 9999` thay các hình tròn viết `kích thước/2` (5, 22, 28, 34, 42) — kết quả hiển thị giống hệt |
| `borderWidth` | `none 0 · thin 1 · strong 1.5 · emphasis 2 · ring 4` | `emphasis` = viền chọn/focus/lỗi (trước đây viết `2`). Cạnh mảnh nhất vẫn là `StyleSheet.hairlineWidth` của hệ điều hành |
| `opacity` | `pressed 0.85 · busy 0.8 · disabled 0.45` | Đúng giá trị `Button`/`Card`. `QuantityStepper` trước đây dùng `0.4` cho trạng thái vô hiệu: hợp nhất về `0.45` (chênh 0.05) |
| `elevation.floating` | `{ elevation 6, color neutral đen, opacity 0.18, radius 8, offset (0, 3) }` | Chuyển nguyên từ `ScanTabButton` |

`spacing` t-shirt cũ (`xs 4, sm 8, md 12, lg 16, xl 24`) được giữ. Thêm `xxs = 2` và `tight = 6`.

### 4.3. Semantic — màu

| Token | → Primitive | Mục đích |
|---|---|---|
| `text.primary` | `neutral.900` | Chữ chính màn thường |
| `text.secondary` | `neutral.600` | Chữ phụ, chú thích |
| `text.onAction` | `neutral.0` | Chữ trên nút/nền thương hiệu, nền lỗi |
| `text.strong` / `text.subtle` | `slate.900` / `slate.500` | Chữ chính/phụ **nhóm màn form** (nợ TD-1, xem 6) |
| `surface.screen` | `neutral.50` | Nền màn hình |
| `surface.raised` | `neutral.0` | Thẻ, ô nhập, nền màn form |
| `surface.muted` | `neutral.100` | Khối gợi ý, ô chưa chọn |
| `border.default` | `neutral.300` | Viền thẻ, đường chia |
| `border.field` | `mint.200` | Viền ô nhập nhóm form |
| `action.primary` | `jade.700` | Nút chính, liên kết, tab đang chọn |
| `action.destructive` | `red.700` | Hành động phá hủy (đỏ chỉ cho lỗi/phá hủy/nguy cơ mất dữ liệu) |
| `feedback.{success,warning,danger}.{fg,bg}` | `green.700/100`, `amber.700/50`, `red.700/50` | Thông báo, ô nhắc |
| `feedback.info.bg` | `teal.50` | Ô nhắc thông tin (chưa có `info.fg` — TD-2) |
| `brand.soft` | `jade.100` | Nền nhấn nhẹ, trạng thái chọn |
| `overlay.scrim` | `black.50a` | Lớp phủ hộp thoại/bottom sheet |
| `camera.{background,onCamera,onCameraMuted,control,scanAccent}` | các primitive camera | **Cố định, không đổi theo sáng/tối** |

### 4.4. Semantic — trạng thái bằng chứng (token riêng từng trạng thái nghiệp vụ)

Mỗi nhãn có bộ `fg / bg / border` **riêng**, dù một số hôm nay trùng giá trị. Không dùng chung khóa `success`, để đổi một trạng thái không kéo theo trạng thái khác.

| Token | fg | bg | Biểu tượng (giữ trong `evidence-status.ts`) |
|---|---|---|---|
| `status.savedOnDevice` | `neutral.600` | `neutral.0` | `device-saved` — **không** tick, không xanh |
| `status.waitingUpload` | `amber.700` | `amber.50` | `clock` |
| `status.uploading` | `jade.700` | `jade.100` | `cloud-upload` |
| `status.uploaded` | `green.700` | `green.100` | `cloud-done` |
| `status.verified` | `green.700` | `green.100` | `shield-check` |
| `status.error` | `red.700` | `red.50` | `alert-triangle` |

`border` mỗi trạng thái = `fg` (đúng hành vi hiện tại). Bảng `SOFT_BACKGROUND` trong `EvidenceStatusBadge` bị xóa. Test hiện có (mỗi nhãn biểu tượng riêng; `saved_on_device` không tick/xanh; chỉ `verified` được nói "Đã lưu an toàn trên máy chủ") giữ nguyên.

`camera.recordingIndicator` (đỏ `red.700`) là màu chấm *Đang ghi hình* — **ngoại lệ đã được chủ sản phẩm chấp nhận (TK-2, [D-18](README.md#đã-chốt))** của quy tắc "đỏ chỉ cho lỗi/phá hủy"; chỉ dùng cho chấm này, luôn kèm chữ và đồng hồ. **Chưa tạo token trạng thái** cho: *Đang lưu trên thiết bị*, *Bằng chứng chưa đầy đủ / ghi bị gián đoạn*. UI của ba trạng thái này chưa tồn tại hoặc chưa chốt màu (audit 3.4, TK-2). Khi dựng UI sẽ thêm khóa `status.recording`, `status.savingOnDevice`, `status.incomplete` cùng lúc, **không** gộp vào nhãn nào ở trên.

### 4.5. Typography

Giữ nguyên 9 variant (`screenTitle, sectionTitle, body, caption, formTitle, formLabel, formBody, formButton, formButtonSmall, overlay`) với đúng giá trị hiện tại. Thêm tên cho trọng số dùng bằng chữ: `weight.regular '400'`, `weight.bold '700'` (thay `fontWeight: '700'` ở `Text`, `'400'` ở `RecordingFrame`). Không thêm font family/letter spacing.

Quy tắc: không dùng `fontSize` số trong UI; số liệu (số lượng, đồng hồ) dùng variant sẵn có; nếu cần số cùng độ rộng, thêm `fontVariant: ['tabular-nums']` vào **variant**, không lẻ tẻ từng màn (chưa cần, ghi TD-4).

### 4.6. Sizing và component

Chỉ ghi giá trị **đã có và dùng ≥2 lần hoặc có tên nghiệp vụ**:

| Token | Giá trị | Dùng ở | Lý do tách |
|---|---|---|---|
| `size.touch` | từ `platform` (44 iOS / 48 Android) | mọi vùng chạm | **Không sao chép**, đọc từ `platform` |
| `button.minHeight.primary` | 56 | `Button` regular | Lớn hơn vùng chạm để bấm một tay (đã có chú thích) |
| `button.minHeight.compact` | 50 | `Button` compact | |
| `button.borderWidth` | `strong` (1.5) / `thin` (1 cho slim) | `Button` | |
| `component.field.minHeight` | 52 | `TextField`, `SearchField`, hàng ở `ProfileScreen`, `ScanScreen` | Ô nhập/hàng thao tác, lớn hơn vùng chạm để gõ một tay |
| `component.tile.{sm,md,lg,xl}` | 28 / 44 / 52 / 56 | thumbnail dòng sản phẩm; avatar; ô biểu tượng thẻ; lối tắt tròn, ảnh đơn | Ô vuông chứa biểu tượng/ảnh nhỏ |
| `component.actionCard.minHeight` | 88 | `ActionCard` | |
| `component.stepper.valueMinWidth` | 48 | `QuantityStepper` | |
| `component.scanFrame.cornerRadius` | 14 | `ScanScreen` | Khung ngắm (4 góc) |
| `component.record.{stopOuter,stopInner,stopRing,stopAreaMinHeight,dot,controlMin}` | 84 / 68 / ring / 88 / 10 / 48 | `RecordingFrame` | Nút dừng quay: thao tác quan trọng nhất, tách khỏi thang chung |
| `component.tabBar.scanButton` | size 62, lift 18, ring `ring`, elevation `floating` | `ScanTabButton` | |

Hình tròn dùng `radius.full` (9999) thay cho `kích thước/2`; kết quả hiển thị giống hệt.

Không tạo: `card.*`, `textField.*`, `orderCard.*`, `badge.*`. Chúng hôm nay chỉ là `radius.md`, `border.default`, `spacing.lg` ghép lại; sao chép sang component token chỉ thêm một tầng tham chiếu không có quyết định mới.

## 5. Quy tắc theo nền tảng

- Vùng chạm tối thiểu: lấy **duy nhất** từ `platform` (`getMinTouchTarget`). Không nhân bản vào token.
- Đổ bóng: một token `elevation.floating` chứa cả khóa iOS (`shadow*`) và Android (`elevation`); React Native bỏ khóa không thuộc nền tảng. Không `Platform.OS` trong UI.
- Cạnh mảnh: `hairline` do `platform` cấp (`StyleSheet.hairlineWidth` phụ thuộc mật độ điểm ảnh).
- Chưa kiểm chứng trên thiết bị thật (chưa build native); mọi khác biệt iOS/Android ghi nhận khi spike.

## 6. Quy tắc accessibility

- Tương phản: mọi cặp `fg/bg` trong semantic phải ≥ **4.5:1** (chữ thường) hoặc ≥ **3:1** (viền/biểu tượng lớn). Test mới kiểm **toàn bộ** cặp semantic và trạng thái, mở rộng `theme.test.ts`.
- Màu không là tín hiệu duy nhất: token trạng thái luôn đi cùng biểu tượng + nhãn (đã có test).
- Chữ: không khóa `allowFontScaling`; `lineHeight` đi cùng `fontSize` trong variant; chiều cao chỉ `minHeight`.
- Vùng chạm ≥ 44 iOS / 48 Android; kích thước component token không được nhỏ hơn.
- **Nợ thiết kế đã ghi:** TD-1 hai bộ chữ (`text/ink`); TD-2 thiếu `info.fg`; TD-3 `scrim 0.5` vs `cameraControl 0.55` gần trùng; TD-4 chữ số tabular; TD-5 cỡ biểu tượng (13 cỡ, chưa có thang); TD-6 `Text.color` còn nhận tên vai trò cũ (`'textMuted'`, `'ink'`…) vì `Text` dùng chung với màn đã verify.

## 7. Cơ chế bắt buộc tuân thủ

Danh sách tệp ngoài phạm vi nằm ở **một nguồn** (`scripts/design-token-scope.cjs`), dùng cho cả ESLint và script kiểm tra, để đổi phạm vi không phải sửa hai nơi.

| Cơ chế | Chặn |
|---|---|
| Rule ESLint nội bộ `design-tokens/no-raw-design-values` (`eslint-rules/`, không thêm dependency), áp cho tệp trong phạm vi | Chuỗi màu `#…`/`rgb(a)`/`hsl(a)` ở bất cứ đâu trong giao diện; số cố định ở thuộc tính thiết kế: `fontSize, lineHeight, letterSpacing, padding*, margin*, gap, borderRadius*, border*Width, shadow*, elevation, opacity, width/height/min*/max*`; `fontWeight` bằng chữ; đọc bảng cũ `colors/spacing/radius` từ `useTheme()`; import `colors`/`palette` trực tiếp; đọc `semantic.color/status` tĩnh |
| Cho phép | `0`; `opacity` bằng `1`; biểu thức tính (`insets.bottom + token`, `size * 2`); giá trị động; `Math.max/min` chỉ khi mọi số trong đó là token; `// token-exception: <lý do>` cùng dòng hoặc dòng ngay trên (≥10 ký tự). `Button`/`Text`/`Icon`/`SourceIcon` (dùng chung với màn đã verify) vẫn bị chặn literal nhưng được đọc bảng cũ |
| `npm run check:tokens` (`scripts/check-design-tokens.cjs`) | Mẫu ngoài-phạm vi không bị mục; hex chỉ ở `primitives.ts` và khối `@frozen` của `colors.ts`; kiến trúc tầng (`primitives` không import ai, `semantic`/`components` chỉ import tầng dưới); số `token-exception` không vượt baseline `scripts/design-token-exceptions.json` (thêm ngoại lệ = sửa baseline trong PR để reviewer thấy); cảnh báo (không fail) khi nhánh sửa tệp ngoài phạm vi. Tham chiếu token sai (đường dẫn không tồn tại) do `tsc` bắt vì `tokens` có kiểu |
| Test | Golden `colors` (`colors.test.ts`); tương phản các cặp semantic/trạng thái (`theme.test.ts`); 6 nhãn ↔ 6 khóa `status.*` riêng; style `Button`/`Text` bằng giá trị trước khi có token (`frozen-style-equivalence.test.tsx`); chính rule ESLint (`eslint-rules/design-tokens.test.js`, 27 ca) |
| CI | `npm run check:tokens` thêm vào `npm run check` và job `quality` (thêm 1 bước; checkout `fetch-depth: 0` để so với `origin/main`; `npm test` chạy thêm project `tooling` cho test rule) |

## 8. Hướng mở rộng

- **Chế độ tối:** khai báo một đối tượng semantic thứ hai cùng kiểu (`satisfies` kiểu của bảng sáng) và để `useTheme()` chọn theo `useColorScheme`; component không phải sửa vì chỉ đọc `tokens`. Token `camera.*` không đổi theo sáng/tối. Chỉ làm khi O-17 được chốt; cần bỏ `userInterfaceStyle: light`.
- **Chuyển động:** thêm `motion.duration/easing` khi xuất hiện animation đầu tiên trong phạm vi.
- **Hợp nhất `text`/`ink` (TD-1):** sau duyệt trực quan, đổi `text.strong/subtle` thành alias của `text.primary/secondary` (một dòng đổi, không sửa component).
- **Đưa màn ngoài phạm vi vào:** khi khách hàng đồng ý, đổi `scripts/design-token-scope.cjs`, chuyển từng màn, gỡ khóa `@frozen`.

## 9. Giá trị bị thay thế hoặc loại bỏ trong phạm vi

| Cũ | Mới | Ghi chú |
|---|---|---|
| `SOFT_BACKGROUND` trong `EvidenceStatusBadge` | `status.*.bg` | Logic thiết kế chuyển vào token |
| `colorRole` trong `EVIDENCE_STATUS_PRESENTATION` | khóa `status.*` riêng | Màu không còn dùng chung `success` |
| Literal `0.85/0.8/0.45`, `1.5`, `4`, `56`, `50`, `84/68/88`, `62/18` | token mục 4.2, 4.6 | Cùng giá trị |
| Spacing `10`, `5` | `8`, `4` | Chênh ≤2dp |
| `'#000'` (đổ bóng) | `elevation.floating` | Cùng giá trị |
| Hình tròn `borderRadius: n/2` | `radius.full` | Hiển thị giống hệt |
| Opacity `0.4` (Stepper vô hiệu) | `opacity.disabled` 0.45 | Chênh 0.05 |
| Spacing `14` (nút sao chép) | `space.md` 12 | Chênh 2dp |
| `Math.max(touch, 52)` | `component.field.minHeight` | Cùng giá trị |
| Import `colors` trực tiếp, nếu có, ở UI | `useTheme().tokens` | |

## 10. Ngoại lệ được chấp thuận

| Chỗ | Giá trị | Lý do |
|---|---|---|
| `SourceIcon` | `#4B3FD8` (Lazada), `#8FA3B8` (nguồn khác), `#D5DDD9` viền | Danh tính màu của sàn, không thuộc palette app; ghi chú ngay tại chỗ |
| `HomeBanner` | `#E2A95C`, `#C48A3C` | Màu hình minh họa; chuyển vào `primitives.illustration.*` nếu minh họa mới cần dùng lại |
| `ScanScreen` `maxWidth 320`, `RecordingFrame` `maxWidth 160`, `PackConfirmScreen` `minHeight 180` | | Giới hạn độ rộng đọc được / chiều cao khung giữ chỗ; không phải quyết định tái sử dụng |
| `StyleSheet.hairlineWidth`, `Icon size={n}` | | Giá trị do hệ điều hành cấp / cỡ glyph theo mockup (TD-5); rule không kiểm |
| Kích thước tính theo màn/font scale | `Math.round(size * 0.55)`, `*-layout.ts` | Phép tính bố cục, không phải giá trị thiết kế cố định |
| Tệp test, `test-utils`, tệp ngoài phạm vi | tuỳ ý | Không bị kiểm tra |
