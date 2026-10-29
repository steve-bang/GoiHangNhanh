import type { DisputeId, EvidenceId, ShopId } from '@/core/ids';

import type {
  DisputeDetails,
  DisputeStatus,
  DisputeSubject,
  DisputeSummary,
  IssueType,
} from './types';

export interface NewDisputeInput {
  readonly id: DisputeId;
  readonly shopId: ShopId;
  readonly subject: DisputeSubject;
  readonly issueType: IssueType;
  readonly note: string;
  readonly createdAtDevice: number;
}

/**
 * Kho hồ sơ tranh chấp cục bộ. Lỗi lưu ném `AppError('DISPUTE_SAVE_FAILED')`; sửa hồ sơ đã đóng ném
 * `DISPUTE_CLOSED`. Không có thao tác xóa: đóng hồ sơ KHÔNG xóa bằng chứng hay lịch sử (bất biến 7, 9).
 */
export interface DisputeStore {
  createDispute(input: NewDisputeInput): Promise<DisputeDetails>;
  getDispute(shopId: ShopId, id: DisputeId): Promise<DisputeDetails | null>;
  /** Mới cập nhật trước. */
  listDisputes(
    shopId: ShopId,
    options?: { status?: DisputeStatus; limit?: number },
  ): Promise<readonly DisputeSummary[]>;
  /** Thêm bằng chứng (idempotent: id đã có thì bỏ qua). */
  addEvidence(
    shopId: ShopId,
    id: DisputeId,
    evidenceIds: readonly EvidenceId[],
    nowDevice: number,
  ): Promise<DisputeDetails>;
  addNote(shopId: ShopId, id: DisputeId, note: string, nowDevice: number): Promise<DisputeDetails>;
  closeDispute(
    shopId: ShopId,
    id: DisputeId,
    note: string,
    nowDevice: number,
  ): Promise<DisputeDetails>;
  /** Mọi bằng chứng đang bị giữ bởi hồ sơ tranh chấp ĐANG MỞ của shop (bất biến 9). */
  listHeldEvidenceIds(shopId: ShopId): Promise<readonly EvidenceId[]>;
}
