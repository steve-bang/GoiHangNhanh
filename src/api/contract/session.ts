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
}
