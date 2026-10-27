/**
 * Điều kiện bảo vệ dữ liệu trước khi đăng xuất (PER-21, UI-J15). TypeScript thuần.
 *
 * Thứ tự ưu tiên (bảo thủ): đang quay > còn bằng chứng chưa đồng bộ > không xác định được > cho phép.
 * "Không xác định được" (đọc kho cục bộ lỗi) KHÔNG được coi là an toàn: chặn như một lỗi đăng xuất,
 * không im lặng cho đi tiếp. Đăng xuất không xóa dữ liệu cục bộ (decisions.md Q-19h).
 */
export interface SignOutFacts {
  /** Có phiên đang ghi video; `null` = không đọc được. */
  readonly recording: boolean | null;
  /** Số tệp bằng chứng cục bộ chưa được máy chủ xác nhận; `null` = không đọc được. */
  readonly unsynced: number | null;
}

export type SignOutGuard =
  | { readonly kind: 'blocked_recording' }
  | { readonly kind: 'unsynced'; readonly count: number }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'clear' };

export function evaluateSignOutGuard(facts: SignOutFacts): SignOutGuard {
  if (facts.recording === true) return { kind: 'blocked_recording' };
  if (facts.unsynced !== null && facts.unsynced > 0) {
    return { kind: 'unsynced', count: facts.unsynced };
  }
  if (facts.recording === null || facts.unsynced === null) return { kind: 'unknown' };
  return { kind: 'clear' };
}
