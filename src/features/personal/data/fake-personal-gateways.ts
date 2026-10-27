import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

import { MIN_PASSWORD_LENGTH, normalizeDisplayName } from '../domain/validation';
import type {
  AccountGateway,
  ChangePasswordInput,
  NotificationPreferences,
  PersonalGateways,
  ShopSummary,
  SettingsGateway,
  SignInMethod,
  UpdateProfileInput,
  UserProfile,
} from '../domain/types';

/**
 * Cổng GIẢ chạy trong bộ nhớ, để dựng giao diện và test khi chưa có máy chủ. Chỉ dùng khi
 * `__DEV__`, trong test, hoặc `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (xem `personal-gateways.ts`). Không
 * lưu gì ra ngoài tiến trình, không ghi mật khẩu vào bản ghi cuộc gọi.
 */
export interface FakePersonalOptions {
  /** Độ trễ mô phỏng của mỗi lời gọi (ms). Test đặt 0. */
  readonly latencyMs?: number;
  readonly profile?: Partial<UserProfile>;
  /** `null` = chưa có shop. Mặc định: một shop minh họa (chỉ bản giả). */
  readonly shop?: ShopSummary | null;
  readonly notificationPreferences?: NotificationPreferences;
}

/** Mật khẩu hiện tại của tài khoản giả (CHỈ bản giả; không phải bí mật). Trùng mật khẩu dev của cổng đăng nhập giả. */
export const FAKE_ACCOUNT_PASSWORD = 'demo-matkhau-1';
/** Mật khẩu coi là quá yếu (chỉ bản giả): độ dài tối thiểu do màn hình kiểm tra riêng. */
export const FAKE_ACCOUNT_WEAK_PASSWORDS: readonly string[] = ['12345678', '11111111', 'password'];

/** Mặc định của bản giả (chỉ để dựng giao diện; mặc định thật do BA chốt). */
export const FAKE_NOTIFICATION_DEFAULTS: NotificationPreferences = {
  uploadProblems: true,
  syncCompleted: false,
  storageNearlyFull: true,
  planExpiring: true,
};

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

class FailureQueue {
  private next: ErrorCode | null = null;
  set(code: ErrorCode): void {
    this.next = code;
  }
  consume(): void {
    if (this.next) {
      const code = this.next;
      this.next = null;
      throw new AppError(code);
    }
  }
}

export class FakeAccountGateway implements AccountGateway {
  getProfileCalls = 0;
  getShopSummaryCalls = 0;
  readonly updateCalls: UpdateProfileInput[] = [];
  /** Số lần đổi mật khẩu được gọi (không lưu nội dung mật khẩu). */
  changePasswordCalls = 0;
  signOutCalls = 0;
  private readonly latencyMs: number;
  private profile: UserProfile;
  private readonly shop: ShopSummary | null;
  private password: string = FAKE_ACCOUNT_PASSWORD;
  private readonly failure = new FailureQueue();

  constructor(options: FakePersonalOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.shop =
      options.shop === undefined ? { id: 'fake-shop-1', name: 'Shop minh họa' } : options.shop;
    this.profile = {
      uid: 'fake-user-1',
      email: 'demo@example.com',
      displayName: null,
      signInMethod: 'password' satisfies SignInMethod,
      ...options.profile,
    };
  }

  /** Lần gọi kế tiếp (bất kể loại) thất bại với mã này, rồi trở lại bình thường. */
  failNext(code: ErrorCode): void {
    this.failure.set(code);
  }

  async getProfile(): Promise<UserProfile> {
    this.getProfileCalls += 1;
    await delay(this.latencyMs);
    this.failure.consume();
    return this.profile;
  }

  async getShopSummary(): Promise<ShopSummary | null> {
    this.getShopSummaryCalls += 1;
    await delay(this.latencyMs);
    this.failure.consume();
    return this.shop;
  }

  async updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    this.updateCalls.push(input);
    await delay(this.latencyMs);
    this.failure.consume();
    this.profile = { ...this.profile, displayName: normalizeDisplayName(input.displayName) };
    return this.profile;
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    this.changePasswordCalls += 1;
    await delay(this.latencyMs);
    this.failure.consume();
    // Tài khoản Apple/Google không có mật khẩu hiện tại để đối chiếu (UI vốn ẩn mục này, Q-19c).
    if (this.profile.signInMethod !== 'password') throw new AppError('AUTH_WRONG_CURRENT_PASSWORD');
    if (input.currentPassword !== this.password) throw new AppError('AUTH_WRONG_CURRENT_PASSWORD');
    if (
      Array.from(input.newPassword).length < MIN_PASSWORD_LENGTH ||
      FAKE_ACCOUNT_WEAK_PASSWORDS.includes(input.newPassword)
    ) {
      throw new AppError('AUTH_WEAK_PASSWORD');
    }
    this.password = input.newPassword;
  }

  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    await delay(this.latencyMs);
    this.failure.consume();
  }
}

export class FakeSettingsGateway implements SettingsGateway {
  readonly updateCalls: NotificationPreferences[] = [];
  private readonly latencyMs: number;
  private preferences: NotificationPreferences;
  private readonly failure = new FailureQueue();

  constructor(options: FakePersonalOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.preferences = options.notificationPreferences ?? FAKE_NOTIFICATION_DEFAULTS;
  }

  failNext(code: ErrorCode): void {
    this.failure.set(code);
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    await delay(this.latencyMs);
    this.failure.consume();
    return this.preferences;
  }

  async updateNotificationPreferences(
    next: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    this.updateCalls.push(next);
    await delay(this.latencyMs);
    this.failure.consume();
    this.preferences = { ...next };
    return this.preferences;
  }
}

export function createFakePersonalGateways(options: FakePersonalOptions = {}): {
  account: FakeAccountGateway;
  settings: FakeSettingsGateway;
} & PersonalGateways {
  return { account: new FakeAccountGateway(options), settings: new FakeSettingsGateway(options) };
}
