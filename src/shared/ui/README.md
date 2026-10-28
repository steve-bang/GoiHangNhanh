# shared/ui/

Component giao diện dùng chung theo design system (`docs/09` mục 3): `Screen`, `Button`, `Card`,
`EvidenceStatusBadge` (6 nhãn trạng thái bằng chứng), `SyncStatusBar`, `OfflineBanner`, `EmptyState`,
`Skeleton`, `BottomSheet`, `ConfirmDialog`, `RecordingFrame`, và bộ cho tab Cá nhân: `ListItem` (hàng menu), `Switch`, `Toast` (`ToastProvider` + `useToast`), `FormField`/`PasswordField`, `StatusBadge` (nhãn chung, KHÔNG dùng cho trạng thái bằng chứng), `Avatar`, `ErrorState` (lỗi cục bộ + thử lại)... Bộ thành phần cho đợt thiết kế lại tab Cá nhân (board 07, `docs/engineering/personal-tab-redesign-plan.md`): `HeroCard` (thẻ nền `brand.deep` phẳng), `IconTile` (ô icon theo tông `brand/blue/warning/success/danger/neutral`, tông trong `tone.ts`), `MetricTile` (ô số liệu có icon; không điền số giả), `StatusCard` (thẻ trạng thái ngang + thanh tiến độ; màu trạng thái bằng chứng chỉ lấy từ `semantic.status`, hôm nay chỉ dựng và test), `Checkbox`. Prop tùy chọn mới (mặc định giữ nguyên): `ConfirmDialog` (`icon`, `iconTone`, `actionsLayout`), `TextField` (`counterMax`, `multiline`), `ErrorState` (`variant="card"`), `EmptyState` (`iconTone`, `actionVariant`, hành động tùy chọn), `ScreenHeader` (`backIcon`). Danh sách, quy tắc bố cục iOS/Android và
cách thêm màn hình: `docs/engineering/layout.md`.

Quy tắc: chỉ dùng token qua `useTheme().tokens` (màu) hoặc `layout` từ `@/core/theme` (spacing/bo góc/viền... trong `StyleSheet.create`); không viết hex/số thiết kế (ESLint chặn, xem `docs/design-system.md`); `Button`, `Text`, `Icon`, `SourceIcon` còn được màn đã verify dùng nên chỉ đổi literal sang token cùng giá trị; chuỗi từ i18n, biểu tượng qua `Icon`;
không gọi `Platform.OS` (dùng `@/platform`); chiều cao chỉ `minHeight` để chữ lớn không vỡ bố cục.
