import type { SocialProvider } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

import { normalizeSources } from '@/core/orders/selling-sources';
import type {
  AuthAccount,
  AuthApi,
  ChangePasswordInput,
  CreatedShop,
  CreateShopInput,
  ApiClient,
  ResetPasswordInput,
  SessionApi,
  SessionIdentity,
  SessionState,
  ShopApi,
  ShopDetails,
  SignedInAccount,
  SignInWithPasswordInput,
  SignUpWithEmailInput,
  UpdateShopInput,
  VerifiedRecovery,
  VerifyRecoveryCodeInput,
} from '../contract';

/**
 * Cổng GIẢ chạy trong bộ nhớ, để dựng giao diện và test khi chưa có máy chủ. Chỉ được dùng khi
 * `__DEV__`, trong test, hoặc khi đặt `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (xem `gateways.ts`). Không
 * lưu gì ra ngoài tiến trình. Bản thật thay ở `gateways.ts` (decisions.md Q-13).
 */
export interface FakeBackendOptions {
  /** Độ trễ mô phỏng của mỗi lời gọi (ms). Test đặt 0. */
  readonly latencyMs?: number;
  /** Email coi như đã có tài khoản (so sánh không phân biệt hoa thường). */
  readonly takenEmails?: readonly string[];
  /** Đồng hồ giả (ms) để test hết hạn mà không chờ thật. Mặc định `Date.now`. */
  readonly now?: () => number;
  /** Mã xác minh còn hiệu lực bao lâu (ms). Mặc định 10 phút. */
  readonly codeTtlMs?: number;
  /** "Vé" đặt lại mật khẩu còn hiệu lực bao lâu (ms). Mặc định 15 phút. */
  readonly ticketTtlMs?: number;
  /** Phiên giả khi mở app (`session.restore`). Mặc định `signed_in` (giữ hành vi mở app của bản dev). */
  readonly sessionState?: SessionState;
  /** Độ trễ riêng của `session.restore` (ms); mặc định = `latencyMs`. Test dùng để mô phỏng cổng chậm. */
  readonly sessionLatencyMs?: number;
  /** true: `session.restore` luôn lỗi (mô phỏng cổng hỏng). */
  readonly sessionFails?: boolean;
}

/** Email mẫu để thử tay trong bản dev: đã có tài khoản. */
export const FAKE_TAKEN_EMAIL = 'da.dung@example.com';
/** Email mẫu để thử tay: mô phỏng mất mạng ở lần gọi. */
export const FAKE_OFFLINE_EMAIL = 'mat.mang@example.com';
/**
 * Tài khoản có sẵn cho dev (CHỈ bản giả; mật khẩu này không phải bí mật và không được dùng ở đâu
 * khác). `demo` đã có shop (đăng nhập vào Tổng quan); `chua.co.shop` chưa có shop (đi tạo shop).
 */
export const FAKE_DEMO_EMAIL = 'demo@example.com';
export const FAKE_NO_SHOP_EMAIL = 'chua.co.shop@example.com';
export const FAKE_DEMO_PASSWORD = 'demo-matkhau-1';
/** Mã xác minh đúng của bản giả (CHỈ bản giả; bản thật do máy chủ sinh và gửi). */
export const FAKE_VALID_CODE = '123456';
/** Email mẫu để thử tay: hệ thống bận / quá nhiều lần / mã hết hạn ngay / phiên đặt lại hết hạn ngay. */
export const FAKE_BUSY_EMAIL = 'he.thong.ban@example.com';
export const FAKE_LOCKED_EMAIL = 'qua.nhieu.lan@example.com';
export const FAKE_EXPIRED_CODE_EMAIL = 'ma.het.han@example.com';
export const FAKE_RESET_EXPIRED_EMAIL = 'phien.het.han@example.com';
/** Số lần sai (đăng nhập, nhập mã) hoặc xin mã tối đa của bản giả trước khi báo quá nhiều lần. */
/** Gợi ý chờ bao lâu mới được xin mã lại (giây) của bản giả. */
export const FAKE_RESEND_SECONDS = 30;
export const FAKE_MAX_ATTEMPTS = 5;
/** Mật khẩu coi là quá yếu (chỉ để thử tay và test); độ dài tối thiểu do màn hình kiểm tra riêng. */
export const FAKE_WEAK_PASSWORDS: readonly string[] = ['12345678', '11111111', 'password'];

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

interface FakeAccount {
  readonly uid: string;
  password: string | null; // null: tài khoản có sẵn mà bản giả không biết mật khẩu
  readonly hasShop: boolean;
  displayName: string | null;
}

interface PendingCode {
  /** Email không có tài khoản vẫn "được gửi mã" nhưng mã không bao giờ hợp lệ (trung tính). */
  readonly valid: boolean;
  readonly expiresAt: number;
  wrongAttempts: number;
}

export class FakeAuthApi implements AuthApi {
  readonly signUpCalls: SignUpWithEmailInput[] = [];
  readonly signInCalls: SignInWithPasswordInput[] = [];
  readonly providerCalls: SocialProvider[] = [];
  readonly recoveryRequests: string[] = [];
  readonly verifyCalls: VerifyRecoveryCodeInput[] = [];
  readonly resetCalls: ResetPasswordInput[] = [];
  signOutCalls = 0;
  /** Số lần đổi mật khẩu (không lưu nội dung mật khẩu). */
  changePasswordCalls = 0;
  readonly displayNameCalls: string[] = [];
  private readonly latencyMs: number;
  private readonly now: () => number;
  /** Tài khoản đang đăng nhập (sau `signUp`/`signIn`, như Firebase Auth); `null` sau `signOut`. */
  private currentKey: string | null = null;
  private readonly codeTtlMs: number;
  private readonly ticketTtlMs: number;
  private readonly accounts = new Map<string, FakeAccount>();
  private readonly failedSignIns = new Map<string, number>();
  private readonly codeRequests = new Map<string, number>();
  private readonly pending = new Map<string, PendingCode>();
  private readonly tickets = new Map<string, { email: string; expiresAt: number }>();
  private nextFailure: ErrorCode | null = null;
  private counter = 0;
  private ticketCounter = 0;

  constructor(options: FakeBackendOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.now = options.now ?? (() => Date.now());
    this.codeTtlMs = options.codeTtlMs ?? 10 * 60_000;
    this.ticketTtlMs = options.ticketTtlMs ?? 15 * 60_000;
    this.seed(FAKE_DEMO_EMAIL, FAKE_DEMO_PASSWORD, true);
    this.seed(FAKE_NO_SHOP_EMAIL, FAKE_DEMO_PASSWORD, false);
    // Hai tài khoản phục vụ kịch bản thử tay của luồng đặt lại mật khẩu (cùng mật khẩu dev).
    this.seed(FAKE_EXPIRED_CODE_EMAIL, FAKE_DEMO_PASSWORD, true);
    this.seed(FAKE_RESET_EXPIRED_EMAIL, FAKE_DEMO_PASSWORD, true);
    for (const email of options.takenEmails ?? []) this.seed(email, null, false);
  }

  private seed(email: string, password: string | null, hasShop: boolean): void {
    this.counter += 1;
    this.accounts.set(email.toLowerCase(), {
      uid: `fake-user-${this.counter}`,
      password,
      hasShop,
      displayName: null,
    });
  }

  /** Lần gọi kế tiếp (bất kể loại) thất bại với mã này, rồi trở lại bình thường. */
  failNext(code: ErrorCode): void {
    this.nextFailure = code;
  }

  private consumeFailure(): void {
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new AppError(code);
    }
  }

  /** Kịch bản thử tay theo email (mạng lỗi, hệ thống bận, quá nhiều lần). */
  private applyEmailScenario(key: string): void {
    if (key === FAKE_OFFLINE_EMAIL) throw new AppError('AUTH_NETWORK_ERROR');
    if (key === FAKE_BUSY_EMAIL) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
    if (key === FAKE_LOCKED_EMAIL) throw new AppError('AUTH_TOO_MANY_REQUESTS');
  }

  async signUpWithEmail(input: SignUpWithEmailInput): Promise<AuthAccount> {
    this.signUpCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const email = input.email.trim();
    const key = email.toLowerCase();
    if (key === FAKE_OFFLINE_EMAIL) throw new AppError('AUTH_NETWORK_ERROR');
    if (FAKE_WEAK_PASSWORDS.includes(input.password)) throw new AppError('AUTH_WEAK_PASSWORD');
    if (this.accounts.has(key)) throw new AppError('AUTH_EMAIL_IN_USE');
    this.counter += 1;
    const uid = `fake-user-${this.counter}`;
    // Tài khoản vừa tạo dùng được để đăng nhập trong cùng phiên chạy (chưa có shop).
    this.accounts.set(key, { uid, password: input.password, hasShop: false, displayName: null });
    this.currentKey = key;
    // Email chưa xác thực: không chặn người dùng (quyết định đã duyệt, decisions.md Q-13).
    return { uid, email, emailVerified: false };
  }

  async signInWithProvider(provider: SocialProvider): Promise<void> {
    this.providerCalls.push(provider);
    await delay(this.latencyMs);
    this.consumeFailure();
    // Cố ý không làm gì: chưa có luồng đăng nhập thật (O-15); không báo thành công.
  }

  async signInWithPassword(input: SignInWithPasswordInput): Promise<SignedInAccount> {
    this.signInCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const email = input.email.trim();
    const key = email.toLowerCase();
    this.applyEmailScenario(key);
    if ((this.failedSignIns.get(key) ?? 0) >= FAKE_MAX_ATTEMPTS) {
      throw new AppError('AUTH_TOO_MANY_REQUESTS');
    }
    const account = this.accounts.get(key);
    // Không phân biệt "không có tài khoản" với "sai mật khẩu".
    if (!account || account.password === null || account.password !== input.password) {
      this.failedSignIns.set(key, (this.failedSignIns.get(key) ?? 0) + 1);
      throw new AppError('AUTH_INVALID_CREDENTIALS');
    }
    this.failedSignIns.delete(key);
    this.currentKey = key;
    return {
      uid: account.uid,
      email,
      emailVerified: false,
      displayName: account.displayName,
      hasShop: account.hasShop,
      shopId: account.hasShop ? `fake-shop-of-${account.uid}` : null,
    };
  }

  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    await delay(this.latencyMs);
    this.consumeFailure();
    this.currentKey = null;
  }

  private currentAccount(): FakeAccount {
    const account = this.currentKey ? this.accounts.get(this.currentKey) : undefined;
    if (!account) throw new AppError('AUTH_SESSION_EXPIRED');
    return account;
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    this.changePasswordCalls += 1;
    await delay(this.latencyMs);
    this.consumeFailure();
    const account = this.currentAccount();
    if (account.password === null || account.password !== input.currentPassword) {
      throw new AppError('AUTH_WRONG_CURRENT_PASSWORD');
    }
    if (FAKE_WEAK_PASSWORDS.includes(input.newPassword)) throw new AppError('AUTH_WEAK_PASSWORD');
    account.password = input.newPassword;
  }

  async updateDisplayName(displayName: string): Promise<{ readonly displayName: string }> {
    this.displayNameCalls.push(displayName);
    await delay(this.latencyMs);
    this.consumeFailure();
    this.currentAccount().displayName = displayName;
    return { displayName };
  }

  /**
   * Dùng chung cho hai chế độ (`PASSWORD_RECOVERY_MODE`): `email_link` (v1) chỉ cần kết quả trung tính
   * và các kịch bản lỗi (bận, quá nhiều lần, mất mạng); mã `123456` chỉ có nghĩa ở chế độ `otp`.
   * Bản giả không gửi thư thật.
   */
  async requestPasswordRecovery(email: string): Promise<{ retryAfterSeconds?: number }> {
    this.recoveryRequests.push(email);
    await delay(this.latencyMs);
    this.consumeFailure();
    const key = email.trim().toLowerCase();
    this.applyEmailScenario(key);
    const requests = (this.codeRequests.get(key) ?? 0) + 1;
    if (requests > FAKE_MAX_ATTEMPTS) throw new AppError('AUTH_TOO_MANY_REQUESTS');
    this.codeRequests.set(key, requests);
    // Luôn "gửi thành công" (trung tính); chỉ email có tài khoản mới có mã dùng được.
    this.pending.set(key, {
      valid: this.accounts.has(key),
      expiresAt: this.now() + (key === FAKE_EXPIRED_CODE_EMAIL ? 0 : this.codeTtlMs),
      wrongAttempts: 0,
    });
    return { retryAfterSeconds: FAKE_RESEND_SECONDS };
  }

  async verifyRecoveryCode(input: VerifyRecoveryCodeInput): Promise<VerifiedRecovery> {
    this.verifyCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const key = input.email.trim().toLowerCase();
    const pending = this.pending.get(key);
    if (!pending) throw new AppError('AUTH_OTP_INVALID');
    if (pending.wrongAttempts >= FAKE_MAX_ATTEMPTS) throw new AppError('AUTH_TOO_MANY_REQUESTS');
    if (this.now() >= pending.expiresAt) throw new AppError('AUTH_OTP_EXPIRED');
    if (!pending.valid || input.code !== FAKE_VALID_CODE) {
      pending.wrongAttempts += 1;
      throw new AppError('AUTH_OTP_INVALID');
    }
    this.pending.delete(key);
    this.ticketCounter += 1;
    const ticket = `fake-ticket-${this.ticketCounter}`;
    const expiresImmediately = key === FAKE_RESET_EXPIRED_EMAIL;
    this.tickets.set(ticket, {
      email: key,
      expiresAt: this.now() + (expiresImmediately ? 0 : this.ticketTtlMs),
    });
    // Kịch bản "phiên hết hạn ngay" cố ý KHÔNG báo hạn cho app, để thử đường lỗi do máy chủ trả về.
    return expiresImmediately
      ? { ticket }
      : { ticket, expiresInSeconds: Math.floor(this.ticketTtlMs / 1000) };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    this.resetCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const record = this.tickets.get(input.ticket);
    if (!record || this.now() >= record.expiresAt) {
      throw new AppError('AUTH_RESET_SESSION_EXPIRED');
    }
    const account = this.accounts.get(record.email);
    if (!account) throw new AppError('AUTH_RESET_SESSION_EXPIRED');
    account.password = input.newPassword;
    this.tickets.delete(input.ticket);
    this.failedSignIns.delete(record.email);
  }
}

export class FakeShopApi implements ShopApi {
  readonly createCalls: CreateShopInput[] = [];
  readonly updateCalls: UpdateShopInput[] = [];
  readonly renameCalls: { shopId: string; name: string }[] = [];
  private readonly latencyMs: number;
  private nextFailure: ErrorCode | null = null;
  private counter = 0;
  private readonly shops = new Map<string, CreatedShop>();

  constructor(options: FakeBackendOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
  }

  failNext(code: ErrorCode): void {
    this.nextFailure = code;
  }

  private consumeFailure(): void {
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new AppError(code);
    }
  }

  async createShop(input: CreateShopInput): Promise<CreatedShop> {
    this.createCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    this.counter += 1;
    const shop: CreatedShop = {
      id: `fake-shop-${this.counter}`,
      name: input.name,
      sellingSources: normalizeSources(input.sellingSources),
    };
    this.shops.set(shop.id, shop);
    return shop;
  }

  async getShop(shopId: string): Promise<ShopDetails | null> {
    await delay(this.latencyMs);
    this.consumeFailure();
    const shop = this.shops.get(shopId);
    return shop ? { id: shop.id, name: shop.name, role: 'owner', canEdit: true } : null;
  }

  /** Bản giả không phân biệt tài khoản: mọi shop đã tạo trong tiến trình (thường là một). */
  async listMyShops(): Promise<readonly ShopDetails[]> {
    await delay(this.latencyMs);
    this.consumeFailure();
    return [...this.shops.values()].map((shop) => ({
      id: shop.id,
      name: shop.name,
      role: 'owner',
      canEdit: true,
    }));
  }

  async renameShop(shopId: string, name: string): Promise<ShopDetails> {
    this.renameCalls.push({ shopId, name });
    await delay(this.latencyMs);
    this.consumeFailure();
    const shop = this.shops.get(shopId);
    if (!shop) throw new AppError('SHOP_SAVE_FAILED');
    this.shops.set(shopId, { ...shop, name });
    return { id: shopId, name, role: 'owner', canEdit: true };
  }

  async updateShop(input: UpdateShopInput): Promise<CreatedShop> {
    this.updateCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const shop: CreatedShop = {
      id: input.shopId,
      name: input.name,
      sellingSources: normalizeSources(input.sellingSources),
    };
    this.shops.set(shop.id, shop);
    return shop;
  }
}

/** Cổng phiên giả: trả trạng thái cấu hình sẵn (xem `EXPO_PUBLIC_FAKE_SESSION` ở `gateways.ts`). */
export class FakeSessionApi implements SessionApi {
  restoreCalls = 0;
  private readonly state: SessionState;
  private readonly latencyMs: number;
  private readonly fails: boolean;

  constructor(options: FakeBackendOptions = {}) {
    this.state = options.sessionState ?? 'signed_in';
    this.latencyMs = options.sessionLatencyMs ?? options.latencyMs ?? 0;
    this.fails = options.sessionFails ?? false;
  }

  async restore(): Promise<SessionState> {
    this.restoreCalls += 1;
    await delay(this.latencyMs);
    if (this.fails) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
    return this.state;
  }

  /** Bản giả: danh tính cố định theo `sessionState` (cổng cá nhân giả là nguồn danh tính ở dev/test). */
  async identity(): Promise<SessionIdentity | null> {
    await delay(this.latencyMs);
    if (this.fails) throw new AppError('AUTH_SERVICE_UNAVAILABLE');
    if (this.state === 'signed_out') return null;
    return {
      uid: 'fake-session-user',
      email: FAKE_DEMO_EMAIL,
      displayName: null,
      signInMethod: 'password',
      shopId: this.state === 'signed_in' ? 'fake-session-shop' : null,
    };
  }
}

export function createFakeApi(options: FakeBackendOptions = {}): {
  auth: FakeAuthApi;
  shop: FakeShopApi;
  session: FakeSessionApi;
} & ApiClient {
  return {
    auth: new FakeAuthApi(options),
    shop: new FakeShopApi(options),
    session: new FakeSessionApi(options),
  };
}
