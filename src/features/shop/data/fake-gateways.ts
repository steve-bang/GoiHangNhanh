import type { SocialProvider } from '@/core/config/feature-flags';
import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

import { normalizeSources } from '../domain/selling-sources';
import type {
  AuthAccount,
  AuthGateway,
  CreatedShop,
  CreateShopInput,
  Gateways,
  ShopGateway,
  SignUpWithEmailInput,
} from '../domain/types';

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
}

/** Email mẫu để thử tay trong bản dev: đã có tài khoản. */
export const FAKE_TAKEN_EMAIL = 'da.dung@example.com';
/** Email mẫu để thử tay: mô phỏng mất mạng ở lần gọi. */
export const FAKE_OFFLINE_EMAIL = 'mat.mang@example.com';
/** Mật khẩu coi là quá yếu (chỉ để thử tay và test); độ dài tối thiểu do màn hình kiểm tra riêng. */
export const FAKE_WEAK_PASSWORDS: readonly string[] = ['12345678', '11111111', 'password'];

function delay(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

export class FakeAuthGateway implements AuthGateway {
  readonly signUpCalls: SignUpWithEmailInput[] = [];
  readonly providerCalls: SocialProvider[] = [];
  private readonly latencyMs: number;
  private readonly taken: Set<string>;
  private nextFailure: ErrorCode | null = null;
  private counter = 0;

  constructor(options: FakeBackendOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
    this.taken = new Set((options.takenEmails ?? []).map((e) => e.toLowerCase()));
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

  async signUpWithEmail(input: SignUpWithEmailInput): Promise<AuthAccount> {
    this.signUpCalls.push(input);
    await delay(this.latencyMs);
    this.consumeFailure();
    const email = input.email.trim();
    const key = email.toLowerCase();
    if (key === FAKE_OFFLINE_EMAIL) throw new AppError('AUTH_NETWORK_ERROR');
    if (FAKE_WEAK_PASSWORDS.includes(input.password)) throw new AppError('AUTH_WEAK_PASSWORD');
    if (this.taken.has(key)) throw new AppError('AUTH_EMAIL_IN_USE');
    this.taken.add(key);
    this.counter += 1;
    // Email chưa xác thực: không chặn người dùng (quyết định đã duyệt, decisions.md Q-13).
    return { uid: `fake-user-${this.counter}`, email, emailVerified: false };
  }

  async signInWithProvider(provider: SocialProvider): Promise<void> {
    this.providerCalls.push(provider);
    await delay(this.latencyMs);
    this.consumeFailure();
    // Cố ý không làm gì: chưa có luồng đăng nhập thật (O-15); không báo thành công.
  }
}

export class FakeShopGateway implements ShopGateway {
  readonly createCalls: CreateShopInput[] = [];
  private readonly latencyMs: number;
  private nextFailure: ErrorCode | null = null;
  private counter = 0;

  constructor(options: FakeBackendOptions = {}) {
    this.latencyMs = options.latencyMs ?? 0;
  }

  failNext(code: ErrorCode): void {
    this.nextFailure = code;
  }

  async createShop(input: CreateShopInput): Promise<CreatedShop> {
    this.createCalls.push(input);
    await delay(this.latencyMs);
    if (this.nextFailure) {
      const code = this.nextFailure;
      this.nextFailure = null;
      throw new AppError(code);
    }
    this.counter += 1;
    return {
      id: `fake-shop-${this.counter}`,
      name: input.name,
      sellingSources: normalizeSources(input.sellingSources),
    };
  }
}

export function createFakeGateways(options: FakeBackendOptions = {}): {
  auth: FakeAuthGateway;
  shop: FakeShopGateway;
} & Gateways {
  return { auth: new FakeAuthGateway(options), shop: new FakeShopGateway(options) };
}
