/**
 * Trạng thái phiên toàn app (người dùng + shop đang dùng). TypeScript thuần. Chỉ phản ánh điều cổng đã
 * xác nhận; đăng xuất chỉ xả state SAU KHI cổng xác nhận (không báo đăng xuất giả).
 *
 * `epoch` tăng mỗi lần phiên đổi danh tính (đăng nhập, đổi shop, đăng xuất): mọi cache/state trong bộ
 * nhớ phải gắn với `sessionKey` để không rò dữ liệu của tài khoản/shop cũ sang tài khoản/shop mới.
 */
export interface SessionUser {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
}

export interface SessionState {
  readonly status: 'signed_out' | 'signed_in';
  readonly user: SessionUser | null;
  /** Shop đang dùng; `null` khi chưa có shop. */
  readonly shopId: string | null;
  readonly epoch: number;
  /**
   * Tăng mỗi lần hồ sơ được cập nhật thành công (đổi họ tên). KHÔNG đổi `epoch`/`sessionKey`: dữ liệu
   * theo phiên vẫn giữ, nhưng màn đang hiện hồ sơ cũ (ví dụ UI-I01 bên dưới màn Sửa) tải lại khi số này đổi.
   */
  readonly profileRevision: number;
}

export type SessionAction =
  | { type: 'signed_in'; user: SessionUser; shopId: string | null }
  | { type: 'shop_changed'; shopId: string | null }
  | { type: 'profile_updated'; displayName: string | null }
  | { type: 'signed_out' };

export const INITIAL_SESSION: SessionState = {
  status: 'signed_out',
  user: null,
  shopId: null,
  epoch: 0,
  profileRevision: 0,
};

/** Khóa cho mọi state/cache theo phiên: đổi tài khoản hoặc shop thì khóa đổi. */
export function sessionKey(state: SessionState): string {
  return state.user ? `${state.user.uid}:${state.shopId ?? 'none'}` : 'anonymous';
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'signed_in':
      return {
        status: 'signed_in',
        user: action.user,
        shopId: action.shopId,
        epoch: state.epoch + 1,
        profileRevision: 0,
      };
    case 'shop_changed':
      if (state.status !== 'signed_in' || state.shopId === action.shopId) return state;
      return { ...state, shopId: action.shopId, epoch: state.epoch + 1 };
    case 'profile_updated':
      // Luôn tăng `profileRevision` kể cả khi phiên chưa biết người dùng (phiên khôi phục chưa mang danh tính).
      return {
        ...state,
        user: state.user ? { ...state.user, displayName: action.displayName } : null,
        profileRevision: state.profileRevision + 1,
      };
    case 'signed_out':
      if (state.status === 'signed_out') return state;
      return { ...INITIAL_SESSION, epoch: state.epoch + 1 };
  }
}
