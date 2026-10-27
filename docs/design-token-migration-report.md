# Báo cáo chuyển đổi Design Token

> Nhánh `design-token`, so với `main`. Phạm vi: màn bên trong app sau đăng nhập (xem [audit](design-system-audit.md) mục 1). Splash, Đăng nhập, Đăng ký, Quên mật khẩu, OTP, Mật khẩu mới và luồng thiết lập (Welcome, Tạo shop, Thiết lập xong) **không bị sửa**.
> Mọi kết quả dưới đây là kết quả đã chạy thật trong môi trường này. Chưa build native, chưa chạy trên thiết bị hay máy ảo; có ảnh chụp bản web trước/sau (mục 5.1).
> Cập nhật sau khi gộp `main` (màn Danh sách/Chi tiết đơn, PR #9): code mới của `main` đã được chuyển sang token; số liệu bên dưới là sau gộp.

## 1. Tóm tắt trạng thái

| Hạng mục | Trạng thái |
|---|---|
| Hệ thống token ba tầng, tài liệu, hướng dẫn | **Hoàn thành** |
| Refactor `shared/ui` và các màn trong phạm vi | **Hoàn thành** (rule ESLint báo 0 vi phạm) |
| Cơ chế bắt buộc (rule ESLint, `check:tokens`, CI, test) | **Hoàn thành** |
| Màn ngoài phạm vi không đổi hiển thị | **Hoàn thành, xác minh bằng so sánh cây style** (mục 5); chưa xác minh trên thiết bị |
| Kiểm tra trực quan iOS/Android, ảnh trước/sau | **Chưa thể xác minh** |
| Chế độ tối, token chuyển động, thang cỡ biểu tượng | **Chưa làm có chủ đích** (mục 7) |

## 2. Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| `npm run lint` (có rule token) | Sạch |
| `npm run typecheck` | Sạch |
| `npm run format:check` | Sạch |
| `npm run check:tokens` | OK: 196 tệp trong phạm vi, 10 ngoại lệ có chú thích |
| `npm test` (project `unit` + `tooling`) | 78 suite, **1616 test pass** (gồm test mới của `main`; trước thay đổi trên `main` cũ: 69 suite, 1350 test) |
| `npm run test:rules` (Firebase Emulator) | **Không chạy**: không liên quan UI, cần Java 21 + emulator |
| Build native / EAS | **Không chạy được** (chưa dựng được, như `CLAUDE.md` ghi) |

Test mới: `colors.test.ts` (golden của bảng màu cũ), phần tương phản semantic/trạng thái trong `theme.test.ts`, `frozen-style-equivalence.test.tsx` (Button/Text), `eslint-rules/design-tokens.test.js` (27 ca cho rule). Bài `frozen-style-equivalence` đã được chạy cả trên mã `main` cũ và pass (nên nó thực sự giữ hợp đồng cũ).

## 3. Token đã tạo và cách tổ chức

`src/core/theme/` (TypeScript thuần):

| Tệp | Nội dung |
|---|---|
| `primitives.ts` | Palette (jade, green, amber, red, teal, neutral, slate, mint, camera, scan, alpha), thang `space`, `radiusScale`, `borderWidthScale`, `opacityScale`, `fontWeight`, `elevationScale`. **Nơi duy nhất viết hex** |
| `semantic.ts` | `color.{text,surface,border,action,brand,feedback,overlay,camera}`, `status.*` (6 trạng thái bằng chứng, mỗi trạng thái bộ `fg/bg/border` riêng), `space`, `radius`, `borderWidth`, `opacity`, `elevation`, `type` |
| `components.ts` | `button`, `field`, `tile`, `actionCard`, `stepper`, `scanFrame`, `record`, `tabBar.scanButton` |
| `colors.ts` | Bảng phẳng cũ cho màn ngoài phạm vi: dựng từ primitives, 47 khóa, **khóa bằng golden**; khối `@frozen` giữ hex cũ của Splash/Welcome/onboarding |
| `typography.ts` | Giữ nguyên giá trị; `spacing` thêm `xxs`, `tight`; `radius` thêm `full` (khóa cũ không đổi) |
| `evidence-status.ts` | `colorRole` → `statusToken` (khóa màu riêng từng nhãn) |
| `index.ts` | Điểm vào duy nhất; thêm `layout` (token không đổi theo sáng/tối, dùng được trong `StyleSheet.create`) |

Truy cập: `useTheme().tokens` (`shared/ui/theme.ts`); các khóa cũ của `useTheme()` giữ nguyên.
Không thêm dependency nào, không có dependency vòng (kiểm bằng `check:tokens`).

## 4. Tệp đã thay đổi (so với `main`)

- **Hệ thống token và công cụ (mới/sửa):** 10 tệp ở `src/core/theme/`, `eslint-rules/design-tokens.cjs` + test, `scripts/check-design-tokens.cjs`, `scripts/design-token-scope.cjs`, `scripts/design-token-exceptions.json`, `eslint.config.js`, `jest.config.js`, `package.json`, `.github/workflows/ci.yml`.
- **Component dùng chung (`src/shared/ui/`):** ActionCard, BottomSheet, Button, CameraPermissionSheet, Card, ConfirmDialog, EmptyState, EvidenceStatusBadge, FilterChips, OfflineBanner, OrderCard, ProductLineList, QuantityStepper, QuickAction, RecordingFrame, Screen, ScreenHeader, SearchField, Skeleton, SourceIcon, StatTile, SyncStatusBar, Text, TextField, theme.ts.
- **Màn và thành phần trong app:** thanh tab (`app/(tabs)/_layout.tsx`, `ScanTabButton`), orders (HeaderHelpButton, HomeBanner, HomeScreen, OrderPreviewScreen, OrdersListScreen, QuickOrderLineEditor, QuickOrderScreen, ScanScreen), packing (PackConfirmScreen, PackDoneScreen), returns (ReturnsListScreen), upload (SyncCenterScreen), shop (ProfileScreen).
- **Không tác động:** các màn placeholder (`screens.tsx`, `placeholders.tsx`) đã dùng `PlaceholderScreen`, không cần đổi; toàn bộ tệp ngoài phạm vi (kiểm bằng `git diff`: không tệp nào trong danh sách ngoại trừ bị sửa).
- **Tài liệu:** 4 tài liệu Design Token (audit, spec, hướng dẫn, báo cáo này), `docs/README.md`, `docs/engineering/conventions.md`, `CLAUDE.md`, `src/shared/ui/README.md`.

## 5. Hardcode trước và sau (trong phạm vi)

Đo bằng chính rule ESLint chạy trên `main` (trước) và trên nhánh này (sau):

| Loại | Trước (`main`) | Sau |
|---|---|---|
| Số thiết kế cố định (spacing, bo góc, viền, độ mờ, bóng, kích thước…) | 103 | **0** (+5 ngoại lệ có lý do) |
| Mã màu viết thẳng | 8 | **0** (+5 ngoại lệ có lý do) |
| `fontWeight` bằng chữ | 2 | **0** |
| Đọc bảng cũ `colors`/`spacing`/`radius` | 83 (33 + 30 + 20) | **0** (trừ Button/Text/Icon/SourceIcon, dùng chung với màn đã verify) |

Ghi chú dòng "Đọc bảng cũ": số 0 chỉ tính các **bảng** `colors`/`spacing`/`radius`. Prop `color` của `Text` (`color="ink"`, `"textMuted"`, `"danger"`…) **vẫn nhận tên vai trò cũ** (nợ TD-6) vì `Text` dùng chung với màn đã verify; rule ESLint không kiểm chỗ này nên các chỗ gọi như vậy trong phạm vi chưa được chuyển sang `tokens`. Tổng ngoại lệ: 5 số + 5 màu = 10, khớp `scripts/design-token-exceptions.json` và `check:tokens`.
| Tổng vi phạm rule | **196 / 39 tệp** | **0** |

`fontSize`/`lineHeight` bằng số: 0 trước và sau (vốn đã qua `Text variant`).

### Hardcode còn lại (10 ngoại lệ có chú thích)

| Chỗ | Giá trị | Lý do |
|---|---|---|
| `SourceIcon` | `#4B3FD8`, `#8FA3B8`, `#D5DDD9` | Màu thương hiệu Lazada, ô "nguồn khác", viền logo sàn: không thuộc palette app |
| `HomeBanner` | `#E2A95C`, `#C48A3C` | Màu hình minh họa hộp carton |
| `ScanScreen` | `maxWidth 320` | Giới hạn độ rộng dòng chữ thông báo |
| `RecordingFrame` | `maxWidth 160` | Giới hạn nhãn mã đơn trên khung quay |
| `PackConfirmScreen` | `minHeight 180` | Khung giữ chỗ xem trước video (chưa có video thật) |
| `OrderDetailScreen` | chấm trạng thái 8dp | Kích thước riêng của hàng chi tiết |
| `OrderCard` | `opacity 0.7` khi nhấn | Độ mờ nhấn đậm hơn cho nút chữ nhỏ, không dùng ở chỗ khác |

Không bị rule kiểm có chủ đích: số `0`, `opacity` bằng `1`, phép tính theo biến, `StyleSheet.hairlineWidth`, `size` của `Icon` (44 chỗ `<Icon size={số}>`, 13 cỡ khác nhau từ 14 đến 56; chưa tính các chỗ cỡ tính từ biến; nợ TD-5. Đếm 2026-10-27 trong phạm vi theo `scripts/design-token-scope.cjs`, không tính tệp test).

### Thay đổi nhìn thấy được so với `main` (toàn bộ, đã đo)

Bằng cách render 19 màn/nhóm component trong phạm vi cùng 9 màn ngoài phạm vi trên cả hai mã nguồn rồi so cây style: chỉ có các khác biệt sau, đều chủ đích:

| Thay đổi | Chỗ | Mức |
|---|---|---|
| `opacity` 0.4 → 0.45 | `QuantityStepper` khi vô hiệu (Quick order, Order preview) | 0.05 |
| `paddingHorizontal` 14 → 12 | Nút sao chép mã ở `OrderPreviewScreen` | 2dp |
| `paddingVertical` 5 → 4 | Pill nguồn bán ở `QuickOrderScreen` | 1dp mỗi phía |
| `gap` 10 → 8 | Hàng gợi ý ở `ScanScreen` | 2dp |
| `borderRadius` 22/28 → 9999 | Avatar, lối tắt tròn | Không đổi hình (hình tròn) |

`gap` 10 → 8 ở hàng gợi ý của `QuickOrderLineEditor` và ở hàng "Nguồn bán" của `OrderDetailScreen` không hiện trong các trạng thái đã render nên chỉ xác nhận qua mã, không qua so sánh.

**Màn ngoài phạm vi:** Welcome, Đăng nhập, Đăng ký, Quên mật khẩu, Tạo shop, Thiết lập xong, Splash: cây style **giống hệt** `main` (khác duy nhất là đường dẫn tệp ảnh trong môi trường thử). Mật khẩu mới và OTP chỉ render màn chuyển hướng khi mở không có vé nên **chưa được so sánh nội dung**; chúng không bị sửa và dùng `Button`/`Text` đã có test tương đương. Phương pháp so sánh là script dùng một lần, không lưu vào repo.

### 5.1. Ảnh chụp trước/sau (bản web, 390×844 @2x)

Build web riêng cho `main` và nhánh này (`expo export -p web`; `react-native-web` chỉ cài trong bản sao tạm, không vào repo), chụp bằng Chromium, so từng điểm ảnh. Kho đơn trên web là bộ nhớ nên 3 đơn mẫu được tạo qua Tạo đơn nhanh trong cùng phiên.

| Màn | Kết quả so với `main` |
|---|---|
| Trang chủ | Giống hệt từng byte |
| Đơn hàng (rỗng) | Giống hệt |
| Đơn hàng (3 đơn, danh sách mới của `main`) | Giống hệt |
| Tạo đơn nhanh | Khác ở pill "Thay đổi" (padding dọc 5 → 4) và nút "−" của bộ đếm khi vô hiệu (0.4 → 0.45) |
| Xác nhận đơn | Chỉ khác ở nút "Sao chép" (hẹp hơn 2dp mỗi phía, 14 → 12) |
| Chi tiết đơn | Khác ở nút "Sao chép" (14 → 12) và khoảng cách hàng "Nguồn bán" (10 → 8) |

Đây đúng là các thay đổi đã liệt kê ở bảng trên, không có thay đổi ngoài dự kiến. Ảnh nằm ngoài repo (không commit). Chưa chụp: Quét mã, Quay, Hàng hoàn, Hồ sơ, và trạng thái lỗi/đang tải.

## 6. Vấn đề trực quan/tương thích còn tồn tại, chưa xác minh được

- **Ảnh chụp chỉ là bản web** (mục 5.1): không thay được kiểm tra trên iOS/Android thật (font, vùng an toàn, camera). Một số màn và trạng thái chưa chụp (mục 5.1).
- Cần xem trên máy ảo/thiết bị iOS và Android (chưa có ở dự án): đặc biệt các thay đổi 1–2dp ở mục 5, tương phản chữ trên camera ngoài sáng, vùng chạm một tay.
- `HomeScreen` có `GradientPanel` (gradient xanh) — trái định hướng "tránh gradient", nhưng đã có từ trước và theo mockup đã duyệt; chỉ đổi màu sang token, không đổi thiết kế.
- Chấm "đang ghi hình" (`#B3261E`) trên nền camera `#16201A` chỉ đạt tương phản khoảng 2.56:1, thấp hơn mức 3:1 cho thành phần giao diện; nền thật là khung hình camera nên còn thay đổi theo cảnh quay. Chấm luôn đi kèm chữ và đồng hồ nên không phải tín hiệu duy nhất. Mình giữ nguyên màu đang chạy; nếu muốn đạt 3:1 cần đổi sang đỏ sáng hơn (cần duyệt trực quan).
- Hai bộ chữ chính song song (`text`/`ink`) còn tồn tại (TD-1; hoãn có chủ đích theo TK-3, [D-19](README.md#đã-chốt)).

## 7. Chưa hoàn thành / hoãn có chủ đích

| Việc | Lý do |
|---|---|
| Chế độ tối | O-17 chưa chốt. Kiến trúc đã chừa chỗ ([design-system.md](design-system.md) mục 6) |
| Token chuyển động | Chưa có animation trong phạm vi |
| Thang cỡ biểu tượng (TD-5) | 13 cỡ (14…56) theo mockup; `Icon` mặc định 22 được màn đã verify dùng |
| Hợp nhất `text`/`ink` (TD-1), `info.fg` (TD-2), `scrim`/`cameraControl` (TD-3), chữ số tabular (TD-4), `Text.color` tên cũ (TD-6) | Cần duyệt trực quan hoặc đụng màn đã verify |
| UI cho *Đang ghi hình / Đang lưu trên thiết bị / Bằng chứng chưa đầy đủ hoặc bị gián đoạn* | Chưa có giao diện; sẽ thêm `status.*` cùng lúc dựng UI, không gộp vào nhãn nào. Chấm "đang ghi" đã có token riêng `camera.recordingIndicator` (đỏ), ngoại lệ được chủ sản phẩm chấp nhận (TK-2, [D-18](README.md#đã-chốt)) |
| Đưa luồng thiết lập (Welcome…) hoặc màn đã verify vào token | Ngoài yêu cầu (TK-1, [D-17](README.md#đã-chốt)); làm khi khách hàng đồng ý |

## 8. Phát hiện ngoài phạm vi (chỉ ghi nhận, không sửa)

- `docs/engineering/layout.md` mô tả bố cục cũ, chưa nhắc token; có thể bổ sung sau.
- Không phát hiện vấn đề mất dữ liệu, nghiệp vụ hay bảo mật liên quan giao diện trong lần này.
