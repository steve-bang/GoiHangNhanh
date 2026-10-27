import {
  createFakeGateways,
  FAKE_BUSY_EMAIL,
  FAKE_DEMO_EMAIL,
  FAKE_DEMO_PASSWORD,
  FAKE_EXPIRED_CODE_EMAIL,
  FAKE_LOCKED_EMAIL,
  FAKE_MAX_ATTEMPTS,
  FAKE_NO_SHOP_EMAIL,
  FAKE_OFFLINE_EMAIL,
  FAKE_RESET_EXPIRED_EMAIL,
  FAKE_VALID_CODE,
} from './fake-gateways';
import { createUnavailableGateways } from './unavailable-gateways';

const make = (options: Parameters<typeof createFakeGateways>[0] = {}) =>
  createFakeGateways(options).auth;

describe('cổng giả: đăng nhập bằng email + mật khẩu', () => {
  it('tài khoản dev có shop vào được; tài khoản dev chưa có shop báo hasShop=false', async () => {
    const auth = make();
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).resolves.toMatchObject({ email: FAKE_DEMO_EMAIL, hasShop: true });
    await expect(
      auth.signInWithPassword({ email: FAKE_NO_SHOP_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).resolves.toMatchObject({ hasShop: false });
  });

  it('email không phân biệt hoa thường và bỏ khoảng trắng đầu/cuối', async () => {
    const auth = make();
    await expect(
      auth.signInWithPassword({ email: ' DEMO@Example.com ', password: FAKE_DEMO_PASSWORD }),
    ).resolves.toMatchObject({ hasShop: true });
  });

  it('sai mật khẩu và email không tồn tại cho CÙNG một lỗi (không lộ email nào có tài khoản)', async () => {
    const auth = make();
    const wrong = await auth
      .signInWithPassword({ email: FAKE_DEMO_EMAIL, password: 'sai-mat-khau' })
      .catch((e: unknown) => e);
    const unknown = await auth
      .signInWithPassword({ email: 'khong.co@example.com', password: 'sai-mat-khau' })
      .catch((e: unknown) => e);
    expect(wrong).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(unknown).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
  });

  it('sai quá số lần cho phép: AUTH_TOO_MANY_REQUESTS, kể cả khi sau đó nhập đúng', async () => {
    const auth = make();
    for (let i = 0; i < FAKE_MAX_ATTEMPTS; i++) {
      await expect(
        auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: 'sai' }),
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    }
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).rejects.toMatchObject({ code: 'AUTH_TOO_MANY_REQUESTS' });
  });

  it('tài khoản vừa tạo ở màn đăng ký đăng nhập được trong cùng bộ nhớ (chưa có shop)', async () => {
    const auth = make();
    await auth.signUpWithEmail({ email: 'moi@example.com', password: 'matkhau-moi-1' });
    await expect(
      auth.signInWithPassword({ email: 'moi@example.com', password: 'matkhau-moi-1' }),
    ).resolves.toMatchObject({ hasShop: false });
  });

  it('kịch bản thử tay theo email: mạng lỗi, hệ thống bận, quá nhiều lần', async () => {
    const auth = make();
    const login = (email: string) => auth.signInWithPassword({ email, password: 'x'.repeat(8) });
    await expect(login(FAKE_OFFLINE_EMAIL)).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
    await expect(login(FAKE_BUSY_EMAIL)).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
    await expect(login(FAKE_LOCKED_EMAIL)).rejects.toMatchObject({
      code: 'AUTH_TOO_MANY_REQUESTS',
    });
  });

  it('failNext áp dụng cho lần gọi kế tiếp rồi trở lại bình thường', async () => {
    const auth = make();
    auth.failNext('AUTH_NETWORK_ERROR');
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).rejects.toMatchObject({ code: 'AUTH_NETWORK_ERROR' });
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).resolves.toBeDefined();
  });
});

describe('cổng giả: quên mật khẩu, nhập mã, đặt lại', () => {
  it('đi hết luồng với mã cố định 123456; mật khẩu mới dùng được, mật khẩu cũ không', async () => {
    const auth = make();
    await expect(auth.requestPasswordRecovery(FAKE_DEMO_EMAIL)).resolves.toEqual({
      retryAfterSeconds: 30,
    });
    const { ticket } = await auth.verifyRecoveryCode({
      email: FAKE_DEMO_EMAIL,
      code: FAKE_VALID_CODE,
    });
    expect(ticket).toBeTruthy();
    await auth.resetPassword({ ticket, newPassword: 'mat-khau-moi-9' });
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: 'mat-khau-moi-9' }),
    ).resolves.toBeDefined();
    await expect(
      auth.signInWithPassword({ email: FAKE_DEMO_EMAIL, password: FAKE_DEMO_PASSWORD }),
    ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    // vé chỉ dùng một lần
    await expect(
      auth.resetPassword({ ticket, newPassword: 'mat-khau-khac-9' }),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_SESSION_EXPIRED' });
  });

  it('TRUNG TÍNH: email không có tài khoản vẫn "gửi thành công" nhưng mã không bao giờ đúng', async () => {
    const auth = make();
    await expect(auth.requestPasswordRecovery('khong.co@example.com')).resolves.toEqual({
      retryAfterSeconds: 30,
    });
    await expect(
      auth.verifyRecoveryCode({ email: 'khong.co@example.com', code: FAKE_VALID_CODE }),
    ).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
  });

  it('chưa xin mã mà nhập mã: AUTH_OTP_INVALID (cùng lỗi với mã sai)', async () => {
    await expect(
      make().verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: FAKE_VALID_CODE }),
    ).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
  });

  it('mã sai: AUTH_OTP_INVALID; quá số lần nhập: AUTH_TOO_MANY_REQUESTS kể cả khi nhập đúng', async () => {
    const auth = make();
    await auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    for (let i = 0; i < FAKE_MAX_ATTEMPTS; i++) {
      await expect(
        auth.verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: '000000' }),
      ).rejects.toMatchObject({ code: 'AUTH_OTP_INVALID' });
    }
    await expect(
      auth.verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: FAKE_VALID_CODE }),
    ).rejects.toMatchObject({ code: 'AUTH_TOO_MANY_REQUESTS' });
  });

  it('mã hết hạn theo đồng hồ giả; xin mã lại thì dùng được', async () => {
    let now = 1_000;
    const auth = make({ now: () => now, codeTtlMs: 60_000 });
    await auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    now += 60_000;
    await expect(
      auth.verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: FAKE_VALID_CODE }),
    ).rejects.toMatchObject({ code: 'AUTH_OTP_EXPIRED' });
    await auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    await expect(
      auth.verifyRecoveryCode({ email: FAKE_DEMO_EMAIL, code: FAKE_VALID_CODE }),
    ).resolves.toBeDefined();
  });

  it('email thử tay "mã hết hạn ngay" và "phiên đặt lại hết hạn ngay"', async () => {
    const auth = make();
    await auth.requestPasswordRecovery(FAKE_EXPIRED_CODE_EMAIL);
    await expect(
      auth.verifyRecoveryCode({ email: FAKE_EXPIRED_CODE_EMAIL, code: FAKE_VALID_CODE }),
    ).rejects.toMatchObject({ code: 'AUTH_OTP_EXPIRED' });

    const gw = createFakeGateways();
    await gw.auth.requestPasswordRecovery(FAKE_RESET_EXPIRED_EMAIL);
    const { ticket } = await gw.auth.verifyRecoveryCode({
      email: FAKE_RESET_EXPIRED_EMAIL,
      code: FAKE_VALID_CODE,
    });
    await expect(
      gw.auth.resetPassword({ ticket, newPassword: 'mat-khau-moi-9' }),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_SESSION_EXPIRED' });
  });

  it('vé không biết hoặc đã hết hạn: AUTH_RESET_SESSION_EXPIRED', async () => {
    let now = 0;
    const auth = make({ now: () => now, ticketTtlMs: 1000 });
    await expect(
      auth.resetPassword({ ticket: 'khong-co', newPassword: 'mat-khau-moi-9' }),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_SESSION_EXPIRED' });
    await auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    const { ticket } = await auth.verifyRecoveryCode({
      email: FAKE_DEMO_EMAIL,
      code: FAKE_VALID_CODE,
    });
    now = 1000;
    await expect(
      auth.resetPassword({ ticket, newPassword: 'mat-khau-moi-9' }),
    ).rejects.toMatchObject({ code: 'AUTH_RESET_SESSION_EXPIRED' });
  });

  it('xin mã quá nhiều lần: AUTH_TOO_MANY_REQUESTS; kịch bản mạng/bận/quá nhiều theo email', async () => {
    const auth = make();
    for (let i = 0; i < FAKE_MAX_ATTEMPTS; i++) await auth.requestPasswordRecovery('a@b.co');
    await expect(auth.requestPasswordRecovery('a@b.co')).rejects.toMatchObject({
      code: 'AUTH_TOO_MANY_REQUESTS',
    });
    await expect(auth.requestPasswordRecovery(FAKE_OFFLINE_EMAIL)).rejects.toMatchObject({
      code: 'AUTH_NETWORK_ERROR',
    });
    await expect(auth.requestPasswordRecovery(FAKE_BUSY_EMAIL)).rejects.toMatchObject({
      code: 'AUTH_SERVICE_UNAVAILABLE',
    });
    await expect(auth.requestPasswordRecovery(FAKE_LOCKED_EMAIL)).rejects.toMatchObject({
      code: 'AUTH_TOO_MANY_REQUESTS',
    });
  });
});

describe('cổng "chưa kết nối": các lời gọi mới', () => {
  it('đều trả AUTH_SERVICE_UNAVAILABLE, không bao giờ báo thành công', async () => {
    const { auth } = createUnavailableGateways();
    const results = await Promise.allSettled([
      auth.signInWithPassword({ email: 'a@b.co', password: '12345678' }),
      auth.requestPasswordRecovery('a@b.co'),
      auth.verifyRecoveryCode({ email: 'a@b.co', code: '123456' }),
      auth.resetPassword({ ticket: 't', newPassword: '12345678' }),
    ]);
    for (const result of results) {
      expect(result.status).toBe('rejected');
      expect((result as PromiseRejectedResult).reason).toMatchObject({
        code: 'AUTH_SERVICE_UNAVAILABLE',
      });
    }
  });
});
