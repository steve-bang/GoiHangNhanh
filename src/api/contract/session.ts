import type { AccountSignInMethod } from './auth';

/**
 * Trạng thái phiên khi mở app (UI-A01): chưa đăng nhập; đã đăng nhập nhưng chưa có shop; đã đăng
 * nhập và có shop. Chỉ phản ánh điều cổng đã xác nhận, không suy đoán.
 */
export type SessionState = 'signed_out' | 'signed_in_no_shop' | 'signed_in';

/**
 * Phiên đăng nhập. `restore` đọc phiên đã lưu trên máy khi mở app, KHÔNG chờ mạng (Q-15). Hiện thực
 * thật = Firebase Auth + tra shop (api/firebase). Lỗi hay quá hạn KHÔNG được coi là đã đăng nhập: bên gọi
 * (màn Splash) xử lý như `signed_out`.
 */
export interface SessionApi {
  restore(): Promise<SessionState>;
  /**
   * Danh tính của phiên đã lưu trên máy (uid, email, shop). KHÔNG chờ mạng khi đã biết shop từ bộ nhớ đệm.
   * `null` = chưa đăng nhập. `shopId` null = đã đăng nhập nhưng chưa biết/chưa có shop (không bịa ID).
   * Lỗi thì ném `AppError`; bên gọi không được suy đoán phiên.
   */
  identity(): Promise<SessionIdentity | null>;
}

export interface SessionIdentity {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  /** Cách đăng nhập theo nhà cung cấp của Auth; `null` = không xác định được (không đoán). */
  readonly signInMethod: AccountSignInMethod | null;
  readonly shopId: string | null;
}
