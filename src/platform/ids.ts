import { randomUUID } from 'expo-crypto';

import type {
  EvidenceId,
  OrderId,
  OrderLineId,
  PackageId,
  DisputeId,
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
export const newDisputeId = (): DisputeId => randomUUID() as DisputeId;
/** ID cho bản ghi con của hồ sơ tranh chấp (sự kiện lịch sử). */
export const newDisputeRecordId = (): string => randomUUID();
export const newReturnRecordId = (): string => randomUUID();
