/**
 * Kiểu và cổng (port) của tab Cá nhân (docs/engineering/personal-tab-plan.md). TypeScript thuần:
 * không React/Expo/Firebase. Lỗi nghiệp vụ được ném dưới dạng `AppError`; màn hình không biết SDK nào
 * đứng sau. Bản thật (Firebase Auth/Firestore) chưa có: xem decisions.md Q-13, Q-19.
 */

/** Cách tài khoản đăng nhập. PER-04 (đổi mật khẩu) chỉ có nghĩa với `password` (Q-19c, D-13). */
export type SignInMethod = 'password' | 'apple' | 'google';

export interface UserProfile {
  /** ID tài khoản ổn định (không phải email). */
  readonly uid: string;
  readonly email: string;
  /** Họ tên hiển thị; `null` khi chưa khai báo (không bịa tên từ email). */
  readonly displayName: string | null;
  readonly signInMethod: SignInMethod;
}

export interface UpdateProfileInput {
  /** Đã bỏ khoảng trắng đầu/cuối, 1-`DISPLAY_NAME_MAX_LENGTH` ký tự. */
  readonly displayName: string;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Cổng tài khoản (port). Mọi hàm chỉ resolve khi máy chủ đã xác nhận: UI không được báo thành công
 * (đã đổi tên, đã đổi mật khẩu, đã đăng xuất) trước khi promise resolve (CLAUDE.md bất biến #3, #11).
 *
 * Cố ý CHƯA có `deleteAccount`: quy trình xóa tài khoản chưa chốt và dính chính sách lưu trữ
 * (decisions.md Q-19e, bất biến #9). Thêm khi đã chốt.
 */
export interface AccountGateway {
  getProfile(): Promise<UserProfile>;
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>;
  /** Tài khoản không đăng nhập bằng mật khẩu: bản thật phải từ chối; UI vốn đã ẩn mục này. */
  changePassword(input: ChangePasswordInput): Promise<void>;
  /**
   * Thu hồi phiên trên máy chủ/SDK. Lỗi thì ném, bên gọi KHÔNG được xả state như đã đăng xuất.
   * Không xóa dữ liệu cục bộ (decisions.md Q-19h).
   */
  signOut(): Promise<void>;
}

/**
 * Tùy chọn loại thông báo muốn nhận (docs/09 UI-I04). Không có mục "mỗi video tải thành công": cố ý
 * không báo từng video. Giá trị mặc định do cổng/BA quyết (Q-19b), không đặt ở đây.
 */
export interface NotificationPreferences {
  /** Tải lên lỗi hoặc cần xử lý. */
  readonly uploadProblems: boolean;
  /** Đồng bộ hoàn tất (tùy chọn). */
  readonly syncCompleted: boolean;
  /** Dung lượng sắp đầy. */
  readonly storageNearlyFull: boolean;
  /** Gói sắp hết hạn. */
  readonly planExpiring: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

/**
 * Cổng cài đặt (port). Bản giả lưu trong bộ nhớ; chỗ lưu thật (Firestore theo người dùng hay cục bộ)
 * chưa chốt. Màn hình phải ghi rõ khi tùy chọn chưa lưu lên máy chủ.
 */
export interface SettingsGateway {
  getNotificationPreferences(): Promise<NotificationPreferences>;
  updateNotificationPreferences(next: NotificationPreferences): Promise<NotificationPreferences>;
}

export interface PersonalGateways {
  readonly account: AccountGateway;
  readonly settings: SettingsGateway;
}
