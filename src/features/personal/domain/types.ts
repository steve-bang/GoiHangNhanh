/**
 * Kiểu và cổng (port) của tab Cá nhân (docs/engineering/personal-tab-plan.md). TypeScript thuần:
 * không React/Expo/Firebase. Lỗi nghiệp vụ được ném dưới dạng `AppError`; màn hình không biết SDK nào
 * đứng sau. Bản thật (Firebase Auth/Firestore) chưa có: xem decisions.md Q-13, Q-20.
 */

/** Cách tài khoản đăng nhập. PER-04 (đổi mật khẩu) chỉ có nghĩa với `password` (Q-20c, D-13). */
export type SignInMethod = 'password' | 'apple' | 'google';

export interface UserProfile {
  /** ID tài khoản ổn định (không phải email). */
  readonly uid: string;
  readonly email: string;
  /** Họ tên hiển thị; `null` khi chưa khai báo (không bịa tên từ email). */
  readonly displayName: string | null;
  readonly signInMethod: SignInMethod;
}

/** Danh tính phiên khôi phục từ máy: đủ để `SessionProvider.beginSession`. */
export interface SessionIdentity {
  readonly uid: string;
  readonly email: string;
  readonly displayName: string | null;
  /** Cách đăng nhập theo nhà cung cấp của Auth; `null` = không xác định được (không đoán). */
  readonly signInMethod: SignInMethod | null;
  readonly shopId: string | null;
}

/**
 * Vai trò của người dùng trong shop. Mô hình vai trò/thành viên CHƯA chốt (O-03, O-07, Q-20f): chỉ
 * phân biệt chủ shop và người còn lại để hiện nhãn; quyền sửa do cổng trả ở `canEdit`, không suy ra từ vai trò.
 */
export type ShopRole = 'owner' | 'member';

/** `active`: dùng được; `suspended`: shop tạm khóa, vẫn thấy trong danh sách nhưng không chuyển vào được. */
export type ShopStatus = 'active' | 'suspended';

/** Shop của tài khoản, đủ để hiện thẻ shop và danh sách chuyển shop. Không phải bản ghi shop đầy đủ. */
export interface ShopSummary {
  readonly id: string;
  readonly name: string;
  readonly role: ShopRole;
  readonly status: ShopStatus;
  /**
   * Người dùng có được sửa thông tin shop không, do cổng/máy chủ quyết định (Security Rules là chốt
   * thật; UI chỉ phản ánh để không mời người dùng làm điều sẽ bị từ chối).
   */
  readonly canEdit: boolean;
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
 * `deleteAccount` (V1-15) chỉ resolve khi máy chủ đã ghi nhận yêu cầu xóa; KHÔNG xóa gì trên máy (bên
 * gọi xóa dữ liệu cục bộ sau đó, theo `LocalWipeProvider`).
 */
export interface AccountGateway {
  /**
   * Danh tính của phiên đã lưu trên máy để nạp vào `SessionProvider` khi mở app (SessionHydrator). KHÔNG
   * chờ mạng khi đã biết shop từ bộ nhớ đệm. `null` = chưa đăng nhập; `shopId` null = chưa biết/chưa có
   * shop (không bịa ID). Lỗi thì ném; bên gọi không suy đoán phiên.
   */
  getSessionIdentity(): Promise<SessionIdentity | null>;
  getProfile(): Promise<UserProfile>;
  /** Shop đang dùng của tài khoản; `null` khi chưa có shop (không bịa tên shop). */
  getShopSummary(): Promise<ShopSummary | null>;
  /** Mọi shop người dùng có quyền truy cập (kể cả shop tạm khóa), shop đang dùng nằm trong đó. */
  listShops(): Promise<readonly ShopSummary[]>;
  /**
   * Đổi tên shop (PER-06). Resolve với shop sau khi máy chủ xác nhận. Thiếu quyền thì ném
   * `SHOP_PERMISSION_DENIED`. Không đổi gì ở bằng chứng/lịch sử đã có (docs/09 UI-I02): bằng chứng
   * gắn với ID shop, không gắn với tên.
   */
  updateShopName(shopId: string, name: string): Promise<ShopSummary>;
  /**
   * Chọn shop đang dùng (PER-07). Resolve khi máy chủ xác nhận; bên gọi mới được đổi phiên. Shop không
   * thuộc người dùng hoặc đang tạm khóa thì ném `SHOP_SWITCH_FAILED`. Không xóa dữ liệu cục bộ của shop cũ.
   */
  switchShop(shopId: string): Promise<ShopSummary>;
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>;
  /** Tài khoản không đăng nhập bằng mật khẩu: bản thật phải từ chối; UI vốn đã ẩn mục này. */
  changePassword(input: ChangePasswordInput): Promise<void>;
  /**
   * Xóa tài khoản (PER-22, V1-15): xác thực lại bằng mật khẩu rồi gọi máy chủ. `already_deleted` = tài
   * khoản đã không còn (lần trước máy chủ đã xóa mà app không nhận được xác nhận). Sai mật khẩu:
   * `AUTH_WRONG_CURRENT_PASSWORD`; các lỗi khác xem `AuthApi.deleteAccount`. Không log mật khẩu.
   */
  deleteAccount(password: string): Promise<'deleted' | 'already_deleted'>;
  /**
   * Thu hồi phiên trên máy chủ/SDK. Lỗi thì ném, bên gọi KHÔNG được xả state như đã đăng xuất.
   * Không xóa dữ liệu cục bộ (decisions.md Q-20h).
   */
  signOut(): Promise<void>;
}

/**
 * Tùy chọn loại thông báo muốn nhận (docs/09 UI-I04). Không có mục "mỗi video tải thành công": cố ý
 * không báo từng video. Giá trị mặc định do cổng/BA quyết (Q-20b), không đặt ở đây.
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
