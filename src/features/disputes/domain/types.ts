import type { DisputeId, EvidenceId, OrderId, ReturnCaseId, ShopId } from '@/core/ids';

/** Loại vấn đề người dùng chọn (UI-G02). Chỉ là điều người dùng nêu, không phải kết luận nguyên nhân. */
export type IssueType =
  'missing_item' | 'wrong_variant' | 'damaged' | 'package_condition' | 'other';

export const ISSUE_TYPES: readonly IssueType[] = [
  'missing_item',
  'wrong_variant',
  'damaged',
  'package_condition',
  'other',
];

/** Hồ sơ tranh chấp tham chiếu đơn hoặc hồ sơ hàng hoàn BẰNG ID; mã chỉ là nhãn chụp lại để hiển thị. */
export type DisputeSubject =
  | { readonly kind: 'order'; readonly orderId: OrderId; readonly label: string }
  | {
      readonly kind: 'return';
      readonly returnId: ReturnCaseId;
      readonly label: string;
      /** Đơn gốc của hồ sơ hoàn tại lúc tạo (nếu có) để lấy bằng chứng đóng gói. */
      readonly orderId: OrderId | null;
      /**
       * Hồ sơ hoàn có hạn chế bằng chứng mở kiện tại lúc tạo (docs/05 B07, Q-26h). Nhãn này đi theo
       * hồ sơ tranh chấp, không được ẩn khi xuất.
       */
      readonly openingEvidenceLimit: boolean;
    };

export type DisputeStatus = 'open' | 'closed';

export type DisputeEventKind = 'created' | 'evidence_added' | 'note_added' | 'closed';

export interface Dispute {
  readonly id: DisputeId;
  readonly shopId: ShopId;
  readonly seq: number;
  /** Mã gọi tên (TC-00001), theo số thứ tự trên máy này. Không phải định danh. */
  readonly code: string;
  readonly status: DisputeStatus;
  readonly subject: DisputeSubject;
  readonly issueType: IssueType;
  readonly note: string;
  readonly closeNote: string;
  readonly createdAtDevice: number;
  readonly updatedAtDevice: number;
  readonly closedAtDevice: number | null;
  readonly createdBy?: string;
}

export interface DisputeEvidenceRef {
  readonly evidenceId: EvidenceId;
  readonly addedAtDevice: number;
  readonly by?: string;
}

export interface DisputeEvent {
  readonly id: string;
  readonly disputeId: DisputeId;
  readonly kind: DisputeEventKind;
  readonly note: string;
  readonly atDevice: number;
  readonly by?: string;
}

export interface DisputeDetails {
  readonly dispute: Dispute;
  readonly evidence: readonly DisputeEvidenceRef[];
  readonly events: readonly DisputeEvent[];
}

export interface DisputeSummary {
  readonly dispute: Dispute;
  readonly evidenceCount: number;
}
