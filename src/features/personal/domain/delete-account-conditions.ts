/**
 * Điều kiện ở màn Xóa tài khoản (PER-22, board 07 khung 20; luồng thật V1-15). TypeScript thuần.
 *
 * Mỗi điều kiện có ba trạng thái trung thực:
 * - `met`: đã kiểm tra và đạt;
 * - `attention`: đã kiểm tra, có điều cần biết/xử lý;
 * - `unknown`: CHƯA kiểm tra được (đọc lỗi). Không bao giờ coi là đạt.
 *
 * và một loại (`kind`) cố định quyết định ảnh hưởng tới nút Xóa:
 * - `blocker` (đang quay; còn tranh chấp mở, bất biến 9; dữ liệu của tài khoản khác trên máy): chỉ cho
 *   xóa khi `met`;
 * - `warning` (tệp chưa tải lên, R-2 A): `attention` thì phải tích xác nhận riêng; `unknown` thì chặn
 *   (không biết sẽ mất bao nhiêu tệp);
 * - `info` (là chủ cửa hàng): không chặn, chỉ báo cửa hàng sẽ bị xóa theo câu chung 30 ngày.
 */
export type DeleteConditionId = 'recording' | 'disputes' | 'foreign' | 'unsynced' | 'ownership';

export type DeleteConditionStatus = 'met' | 'attention' | 'unknown';

export type DeleteConditionKind = 'blocker' | 'warning' | 'info';

export interface DeleteConditionFacts {
  /** Có phiên đang ghi video trên máy; `null` = không đọc được. */
  readonly recording: boolean | null;
  /** Số tệp bằng chứng trên máy chưa được máy chủ nhận (cả máy); `null` = không đọc được. */
  readonly unsynced: number | null;
  /** Số hồ sơ tranh chấp đang mở trên máy (mọi shop); `null` = không đọc được. */
  readonly openDisputes: number | null;
  /** Số bản ghi trên máy không chắc của tài khoản này; `null` = không đọc được hoặc chưa biết tài khoản. */
  readonly foreignRecords: number | null;
  /** Số cửa hàng mà tài khoản là chủ; `null` = không đọc được. */
  readonly ownedShops: number | null;
}

export interface DeleteCondition {
  readonly id: DeleteConditionId;
  readonly kind: DeleteConditionKind;
  readonly status: DeleteConditionStatus;
  /** Số tệp/hồ sơ/bản ghi/cửa hàng, khi `status` là `attention`. */
  readonly count?: number;
}

/** Thứ tự hiển thị cố định: điều kiện chặn trước, rồi cảnh báo, rồi thông tin. */
export const DELETE_CONDITION_IDS: readonly DeleteConditionId[] = [
  'recording',
  'disputes',
  'foreign',
  'unsynced',
  'ownership',
];

const KIND: Record<DeleteConditionId, DeleteConditionKind> = {
  recording: 'blocker',
  disputes: 'blocker',
  foreign: 'blocker',
  unsynced: 'warning',
  ownership: 'info',
};

function countCondition(id: DeleteConditionId, value: number | null): DeleteCondition {
  const kind = KIND[id];
  if (value === null) return { id, kind, status: 'unknown' };
  return value > 0 ? { id, kind, status: 'attention', count: value } : { id, kind, status: 'met' };
}

export function evaluateDeleteConditions(facts: DeleteConditionFacts): readonly DeleteCondition[] {
  return [
    {
      id: 'recording',
      kind: KIND.recording,
      status: facts.recording === null ? 'unknown' : facts.recording ? 'attention' : 'met',
    },
    countCondition('disputes', facts.openDisputes),
    countCondition('foreign', facts.foreignRecords),
    countCondition('unsynced', facts.unsynced),
    countCondition('ownership', facts.ownedShops),
  ];
}

export interface DeleteGate {
  /** Mọi điều kiện chặn đã đạt và biết chắc số tệp sẽ mất. */
  readonly allowed: boolean;
  /** Số tệp chưa tải sẽ bị xóa; > 0 thì phải tích xác nhận riêng. */
  readonly unsyncedToLose: number;
}

export function evaluateDeleteGate(conditions: readonly DeleteCondition[]): DeleteGate {
  const unsynced = conditions.find((c) => c.id === 'unsynced');
  const blockersMet = conditions
    .filter((c) => c.kind === 'blocker')
    .every((c) => c.status === 'met');
  const unsyncedKnown = unsynced !== undefined && unsynced.status !== 'unknown';
  return {
    allowed: blockersMet && unsyncedKnown,
    unsyncedToLose: unsynced?.status === 'attention' ? (unsynced.count ?? 0) : 0,
  };
}

/** Nút Xóa bật khi điều kiện cho phép, đã "Tôi hiểu và đồng ý", và đã tích riêng nếu còn tệp chưa tải. */
export function canSubmitDelete(
  gate: DeleteGate,
  consent: { readonly agreed: boolean; readonly unsyncedAcknowledged: boolean },
): boolean {
  return (
    gate.allowed && consent.agreed && (gate.unsyncedToLose === 0 || consent.unsyncedAcknowledged)
  );
}
