/**
 * Giao diện dùng chung của feature evidence. Màn UI-E04 (Chi tiết bằng chứng) nằm ở `features/orders`
 * (cần dữ liệu đơn/kiện/phiên; đặt ở đây sẽ tạo phụ thuộc vòng); bản hàng hoàn ở `features/returns`, bản
 * mở từ tranh chấp ở `features/disputes` (V1-17b). Tất cả dùng `EvidenceDetailShell` + `EvidenceDetailView`.
 */
export { EvidenceDetailShell } from './EvidenceDetailShell';
export type { EvidenceDetailPending, EvidenceDetailShellProps } from './EvidenceDetailShell';
export { EvidenceDetailView } from './EvidenceDetailView';
export type { EvidenceDetailRow, EvidenceDetailViewProps } from './EvidenceDetailView';
