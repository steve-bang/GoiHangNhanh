import { randomUUID } from 'expo-crypto';

import type {
  EvidenceId,
  OrderId,
  OrderLineId,
  PackageId,
  ReturnCaseId,
  SessionId,
} from '@/core/ids';

/**
 * Sinh ID nội bộ (UUID v4 qua expo-crypto, ngẫu nhiên an toàn của hệ điều hành). ID sinh ở máy
 * khách và dùng làm khóa ổn định; mã đơn/mã vận đơn không bao giờ thay ID (bất biến 1).
 */
export const newOrderId = (): OrderId => randomUUID() as OrderId;
export const newOrderLineId = (): OrderLineId => randomUUID() as OrderLineId;
export const newPackageId = (): PackageId => randomUUID() as PackageId;
export const newSessionId = (): SessionId => randomUUID() as SessionId;
export const newEvidenceId = (): EvidenceId => randomUUID() as EvidenceId;
export const newReturnCaseId = (): ReturnCaseId => randomUUID() as ReturnCaseId;
/** ID cho bản ghi con của hồ sơ hàng hoàn (dòng nhận về, sai lệch, sự kiện liên kết, lịch sử). */
export const newReturnRecordId = (): string => randomUUID();
