import { PackRecordScreen } from '@/features/packing';
import { withSessionGate } from '@/features/personal';

// Màn quay: cổng chỉ chặn TRƯỚC khi mở; đã mở thì giữ (bất biến 2, V1-06).

export default withSessionGate(PackRecordScreen, { latch: true });
