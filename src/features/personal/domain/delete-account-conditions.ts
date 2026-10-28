/**
 * Điều kiện hiển thị ở màn Xóa tài khoản (PER-22, board 07 khung 20). TypeScript thuần.
 *
 * Màn này CHỈ cho người dùng biết tình trạng thật; không có luồng xóa (Q-20e, Q-21h, bất biến 9).
 * Mỗi điều kiện có ba trạng thái trung thực:
 * - `met`: đã kiểm tra và đạt;
 * - `attention`: đã kiểm tra, có việc cần xử lý trước;
 * - `unknown`: CHƯA kiểm tra được (không có nguồn dữ liệu, hoặc đọc lỗi). Không bao giờ coi là đạt.
 */
export type DeleteConditionId = 'recording' | 'unsynced' | 'disputes' | 'ownership';

export type DeleteConditionStatus = 'met' | 'attention' | 'unknown';

export interface DeleteConditionFacts {
  /** Có phiên đang ghi video trên máy; `null` = không đọc được. */
  readonly recording: boolean | null;
  /** Số tệp bằng chứng trên máy chưa được máy chủ xác nhận (cả máy); `null` = không đọc được. */
  readonly unsynced: number | null;
  /** Số cửa hàng mà tài khoản là chủ; `null` = không đọc được. */
  readonly ownedShops: number | null;
}

export interface DeleteCondition {
  readonly id: DeleteConditionId;
  readonly status: DeleteConditionStatus;
  /** Số tệp chưa đồng bộ hoặc số cửa hàng là chủ, khi `status` là `attention` và có số. */
  readonly count?: number;
}

/** Thứ tự hiển thị cố định. */
export const DELETE_CONDITION_IDS: readonly DeleteConditionId[] = [
  'recording',
  'unsynced',
  'disputes',
  'ownership',
];

export function evaluateDeleteConditions(facts: DeleteConditionFacts): readonly DeleteCondition[] {
  const { recording, unsynced, ownedShops } = facts;
  return [
    {
      id: 'recording',
      status: recording === null ? 'unknown' : recording ? 'attention' : 'met',
    },
    unsynced === null
      ? { id: 'unsynced', status: 'unknown' }
      : unsynced > 0
        ? { id: 'unsynced', status: 'attention', count: unsynced }
        : { id: 'unsynced', status: 'met' },
    // Chưa có nguồn dữ liệu về tranh chấp/nghĩa vụ lưu giữ (chưa có tranh chấp, chưa có máy chủ): luôn "chưa kiểm tra được".
    { id: 'disputes', status: 'unknown' },
    ownedShops === null
      ? { id: 'ownership', status: 'unknown' }
      : ownedShops > 0
        ? { id: 'ownership', status: 'attention', count: ownedShops }
        : { id: 'ownership', status: 'met' },
  ];
}
