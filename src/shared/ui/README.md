# shared/ui/

Component giao diện dùng chung theo design system (`docs/09` mục 3): `Screen`, `Button`, `Card`,
`EvidenceStatusBadge` (6 nhãn trạng thái bằng chứng), `SyncStatusBar`, `OfflineBanner`, `EmptyState`,
`Skeleton`, `BottomSheet`, `ConfirmDialog`, `RecordingFrame`... Danh sách, quy tắc bố cục iOS/Android và
cách thêm màn hình: `docs/engineering/layout.md`.

Quy tắc: chỉ dùng token qua `useTheme()` (nguồn ở `@/core/theme`), chuỗi từ i18n, biểu tượng qua `Icon`;
không gọi `Platform.OS` (dùng `@/platform`); chiều cao chỉ `minHeight` để chữ lớn không vỡ bố cục.
