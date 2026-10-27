import { resources } from './resources';

/**
 * Chất lượng câu chữ thông báo lỗi cho người không rành công nghệ (docs/09, quy ước viết thông báo
 * lỗi): tối đa 2 câu, dưới 20 từ, từ thường ngày, không đổ lỗi, không hứa quá mức.
 */

type Message = string | { title: string; hint?: string };
type Json = string | { [key: string]: Json };

function fullText(m: Message): string {
  return typeof m === 'string' ? m : [m.title, m.hint].filter(Boolean).join(' ');
}

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((part) => part.length > 0);
}

function words(text: string): string[] {
  return text.split(/\s+/).filter((word) => word.length > 0);
}

const errors = resources.vi.errors as Record<string, Message>;
const AUTH_MESSAGES: [string, Message][] = Object.entries(errors).filter(([code]) =>
  code.startsWith('AUTH_'),
);

function flatten(tree: Json, prefix: string): [string, string][] {
  if (typeof tree === 'string') return [[prefix, tree]];
  return Object.entries(tree).flatMap(([k, v]) => flatten(v, `${prefix}.${k}`));
}
const SIGN_UP_ERRORS = flatten(resources.vi.screens.signUp.errors as Json, 'signUp.errors');

const SCREEN_ERRORS: [string, string][] = [
  ...flatten(resources.vi.screens.signIn.errors as Json, 'signIn.errors'),
  ...flatten(resources.vi.screens.forgot.errors as Json, 'forgot.errors'),
  ...flatten(resources.vi.screens.otp.errors as Json, 'otp.errors'),
  ...flatten(resources.vi.screens.newPassword.errors as Json, 'newPassword.errors'),
];

const ALL: [string, Message][] = [
  ...AUTH_MESSAGES,
  ...SIGN_UP_ERRORS.map(([key, value]): [string, Message] => [key, value]),
  ...SCREEN_ERRORS.map(([key, value]): [string, Message] => [key, value]),
];

/** Từ khó hiểu hoặc hứa quá mức, bị cấm trong thông báo lỗi. */
const FORBIDDEN = [
  'dịch vụ tài khoản',
  'yêu cầu',
  'xác thực',
  'tuyệt đối',
  'thao tác không hợp lệ',
  'vui lòng',
  'xin lỗi',
  'bạn đã sai',
  'bạn nhập sai',
  'không thể không',
  'tài khoản chưa được tạo',
];

describe('câu chữ thông báo lỗi AUTH_*, signUp.errors và lỗi các màn đăng nhập/khôi phục', () => {
  it('có đủ bốn mã AUTH_* và các lỗi của ô nhập', () => {
    expect(AUTH_MESSAGES.map(([code]) => code).sort()).toEqual([
      'AUTH_EMAIL_IN_USE',
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_NETWORK_ERROR',
      'AUTH_OTP_EXPIRED',
      'AUTH_OTP_INVALID',
      'AUTH_RESET_SESSION_EXPIRED',
      'AUTH_SERVICE_UNAVAILABLE',
      'AUTH_TOO_MANY_REQUESTS',
      'AUTH_WEAK_PASSWORD',
    ]);
    expect(SIGN_UP_ERRORS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(ALL)('%s: tối đa 2 câu và dưới 20 từ', (_key, message) => {
    const text = fullText(message);
    // "Ví dụ: ten@cuahang.com" chứa dấu chấm trong địa chỉ email, không phải hết câu
    expect(sentences(text.replace(/@[\w.]+/g, '@x')).length).toBeLessThanOrEqual(2);
    expect(words(text).length).toBeLessThan(20);
  });

  it.each(ALL)('%s: không chứa từ cấm', (_key, message) => {
    const text = fullText(message).toLowerCase();
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
  });

  it('thông báo hai câu tách title (câu đầu) và hint (câu sau), mỗi phần một câu', () => {
    for (const code of ['AUTH_NETWORK_ERROR', 'AUTH_SERVICE_UNAVAILABLE']) {
      const m = errors[code] as { title: string; hint: string };
      expect(sentences(m.title)).toHaveLength(1);
      expect(sentences(m.hint)).toHaveLength(1);
    }
  });

  it('thông báo một câu chỉ là chuỗi (title)', () => {
    expect(typeof errors.AUTH_EMAIL_IN_USE).toBe('string');
  });

  it('email đã dùng nói rõ và đúng từng chữ; mạng/hệ thống không đổ lỗi cho người dùng', () => {
    expect(errors.AUTH_EMAIL_IN_USE).toBe('Email này đã có tài khoản.');
    expect(fullText(errors.AUTH_NETWORK_ERROR as Message)).toBe(
      'Mất kết nối mạng. Bạn kiểm tra mạng rồi thử lại nhé.',
    );
    expect(fullText(errors.AUTH_SERVICE_UNAVAILABLE as Message)).toBe(
      'Hệ thống đang bận. Bạn thử lại sau ít phút nhé.',
    );
  });

  it('lời đăng nhập sai KHÔNG nói rõ cái nào sai; đúng từng chữ theo thiết kế', () => {
    const text = fullText(errors.AUTH_INVALID_CREDENTIALS as Message);
    expect(text).toBe('Email hoặc mật khẩu chưa chính xác. Bạn kiểm tra lại nhé!');
  });

  it('mã xác minh, quá nhiều lần, phiên hết hạn: đúng từng chữ', () => {
    expect(errors.AUTH_OTP_INVALID).toBe('Mã xác minh chưa chính xác. Bạn kiểm tra lại nhé!');
    expect(fullText(errors.AUTH_OTP_EXPIRED as Message)).toBe(
      'Mã xác minh đã hết hạn. Bạn xin mã mới nhé.',
    );
    expect(fullText(errors.AUTH_TOO_MANY_REQUESTS as Message)).toBe(
      'Bạn đã thử quá nhiều lần. Hãy thử lại sau ít phút.',
    );
    expect(fullText(errors.AUTH_RESET_SESSION_EXPIRED as Message)).toBe(
      'Phiên xác minh đã hết hạn. Bạn cần xác minh lại để đặt mật khẩu mới.',
    );
  });

  it('không có câu trấn an "tài khoản chưa được tạo" ở màn đăng ký', () => {
    for (const [, message] of AUTH_MESSAGES) {
      expect(fullText(message).toLowerCase()).not.toMatch(/chưa được tạo|chưa tạo/);
    }
  });
});

describe('tên thương hiệu không bị tách dòng', () => {
  const NBSP = ' ';
  const all: [string, string][] = Object.entries(resources.vi).flatMap(([ns, tree]) =>
    flatten(tree as Json, ns),
  );

  it('mọi chuỗi có tên "Đơn Chứng" dùng khoảng trắng không ngắt (U+00A0)', () => {
    const hits = all.filter(([, v]) => /Đơn\s+Chứng|Đơn Chứng/.test(v));
    expect(hits.length).toBeGreaterThanOrEqual(4);
    for (const [key, value] of hits) {
      expect({ key, ok: value.includes(`Đơn${NBSP}Chứng`) }).toEqual({ key, ok: true });
    }
  });

  it('tiêu đề đăng ký vẫn xuống dòng có chủ ý giữa "Tạo tài khoản" và tên thương hiệu', () => {
    expect(resources.vi.screens.signUp.title).toBe(`Tạo tài khoản\nĐơn${NBSP}Chứng`);
  });
});
