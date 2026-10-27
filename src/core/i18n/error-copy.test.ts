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

/** Thông báo theo mã; thiếu thì chuỗi rỗng để test tự đỏ ở các so sánh chữ. */
function msg(code: string): Message {
  return errors[code] ?? '';
}

const PROFILE_MESSAGES: [string, Message][] = [
  ['PROFILE_SAVE_FAILED', msg('PROFILE_SAVE_FAILED')],
  ['SHOP_SAVE_FAILED', msg('SHOP_SAVE_FAILED')],
  ['SHOP_SWITCH_FAILED', msg('SHOP_SWITCH_FAILED')],
  ['SHOP_PERMISSION_DENIED', msg('SHOP_PERMISSION_DENIED')],
];

const ALL: [string, Message][] = [
  ...AUTH_MESSAGES,
  ...PROFILE_MESSAGES,
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
      'AUTH_REQUIRES_RECENT_LOGIN',
      'AUTH_RESET_SESSION_EXPIRED',
      'AUTH_SERVICE_UNAVAILABLE',
      'AUTH_SESSION_EXPIRED',
      'AUTH_SIGN_OUT_FAILED',
      'AUTH_TOO_MANY_REQUESTS',
      'AUTH_WEAK_PASSWORD',
      'AUTH_WRONG_CURRENT_PASSWORD',
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

  it('mã tab Cá nhân (Q-19i): đúng từng chữ với câu người dùng chốt', () => {
    expect(errors.AUTH_WRONG_CURRENT_PASSWORD).toBe('Mật khẩu hiện tại chưa đúng.');
    expect(fullText(msg('AUTH_SIGN_OUT_FAILED'))).toBe('Chưa đăng xuất được. Bạn thử lại nhé.');
    expect(fullText(msg('PROFILE_SAVE_FAILED'))).toBe(
      'Chưa cập nhật được thông tin. Bạn thử lại nhé.',
    );
    expect(fullText(msg('AUTH_REQUIRES_RECENT_LOGIN'))).toContain('đăng nhập lại');
    expect(fullText(msg('AUTH_SESSION_EXPIRED'))).toContain('đăng nhập lại');
  });

  it('mã cửa hàng (Q-19n): đúng từng chữ với kế hoạch đã duyệt', () => {
    expect(fullText(msg('SHOP_SAVE_FAILED'))).toBe(
      'Không thể cập nhật cửa hàng lúc này. Bạn thử lại nhé.',
    );
    expect(fullText(msg('SHOP_SWITCH_FAILED'))).toBe('Chưa chuyển được cửa hàng. Bạn thử lại nhé.');
    expect(fullText(msg('SHOP_PERMISSION_DENIED'))).toBe(
      'Bạn chưa có quyền thực hiện thao tác này. Hãy liên hệ chủ cửa hàng.',
    );
  });

  it('không có câu trấn an "tài khoản chưa được tạo" ở màn đăng ký', () => {
    for (const [, message] of AUTH_MESSAGES) {
      expect(fullText(message).toLowerCase()).not.toMatch(/chưa được tạo|chưa tạo/);
    }
  });
});

/**
 * Quét TOÀN BỘ chuỗi giao diện (mọi locale, mọi namespace), không chỉ lỗi AUTH/signUp: không từ khó
 * hiểu, không lời hứa quá mức (CLAUDE.md #11: không hứa thắng khiếu nại, không "tuyệt đối").
 */
const EVERY_UI_STRING: [string, string][] = Object.entries(resources).flatMap(
  ([locale, namespaces]) =>
    Object.entries(namespaces as Record<string, Json>).flatMap(([ns, tree]) =>
      flatten(tree, `${locale}.${ns}`),
    ),
);

/** Cụm hứa quá mức hoặc nói như đảm bảo pháp lý: cấm ở mọi chuỗi giao diện. */
const FORBIDDEN_PROMISES = [
  'tuyệt đối',
  'pháp lý',
  'chắc chắn thắng',
  'đảm bảo thắng',
  'thắng khiếu nại',
  'không thể bị',
  'vĩnh viễn',
  'mãi mãi',
  'không bao giờ mất',
  'bảo đảm',
  'đảm bảo',
];

/**
 * "bảo vệ" chỉ được dùng ở các câu thương hiệu đã được người dùng duyệt (tiêu đề và tagline màn Chào
 * mừng). Chỗ khác dùng "lưu bằng chứng" thay vì hứa "bảo vệ".
 */
const APPROVED_PROTECT_KEYS = [
  'vi.screens.welcome.title',
  'vi.screens.signIn.brandTagline',
  // Splash (UI-A01): nhãn "Bảo vệ quyền lợi" và câu viết tay "...đều xứng đáng được bảo vệ!" giữ
  // nguyên theo ảnh thiết kế, NGOẠI LỆ CÓ CHỦ ĐÍCH do người dùng duyệt (decisions.md Q-15, D-15).
  'vi.screens.splash.features.protect',
  'vi.screens.splash.slogan',
];

describe('quét toàn bộ chuỗi giao diện', () => {
  it('có chuỗi để quét (đủ nhiều namespace)', () => {
    expect(EVERY_UI_STRING.length).toBeGreaterThan(300);
  });

  it.each(EVERY_UI_STRING)('%s: không có từ cấm', (_key, value) => {
    const text = value.toLowerCase();
    for (const word of FORBIDDEN) expect(text).not.toContain(word);
    for (const word of FORBIDDEN_PROMISES) expect(text).not.toContain(word);
  });

  it('"bảo vệ" chỉ xuất hiện ở các câu thương hiệu đã duyệt', () => {
    const hits = EVERY_UI_STRING.filter(([, value]) => /bảo vệ/i.test(value)).map(([key]) => key);
    expect(hits.sort()).toEqual([...APPROVED_PROTECT_KEYS].sort());
  });

  it('các câu thương hiệu đã duyệt giữ nguyên đúng từng chữ', () => {
    expect(resources.vi.screens.welcome.title).toBe('Bảo vệ bằng chứng\ncho từng đơn hàng');
    expect(resources.vi.screens.welcome.subtitle).toBe(
      'Ghi hình đầy đủ – Lưu trữ an toàn – An tâm kinh doanh',
    );
    expect(resources.vi.screens.signIn.brandTagline).toBe('Bảo vệ đơn hàng – Vững bước kinh doanh');
  });

  it('câu chữ Splash giữ nguyên theo thiết kế đã duyệt (Q-15): đúng từng chữ', () => {
    const splash = resources.vi.screens.splash;
    expect(splash.tagline).toBe('Ghi hình đầy đủ\nLưu bằng chứng an tâm');
    expect(splash.features).toEqual({
      record: 'Quay video\nđóng gói',
      cloud: 'Lưu trữ\nđám mây',
      orders: 'Quản lý\nđơn hàng',
      protect: 'Bảo vệ\nquyền lợi',
    });
    expect(splash.slogan).toBe('Mỗi đơn hàng\nđều xứng đáng được bảo vệ!');
  });

  it('bốn câu phụ đã chỉnh để không hứa quá: đúng từng chữ', () => {
    const NBSP = '\u00a0';
    expect(resources.vi.screens.signUp.subtitle).toBe(
      'Bắt đầu lưu bằng chứng cho đơn hàng của bạn chỉ trong vài phút!',
    );
    expect(resources.vi.screens.setupDone.subtitle).toBe(
      'Cảm ơn bạn đã hoàn tất thiết lập. Giờ đây bạn có thể bắt đầu ghi hình và lưu bằng chứng cho đơn hàng.',
    );
    expect(resources.vi.screens.signIn.subtitle).toBe(
      `Cùng Đơn${NBSP}Chứng lưu bằng chứng cho từng đơn hàng nhé!`,
    );
    expect(resources.vi.screens.newPassword.description).toBe(
      'Chọn mật khẩu mạnh để giữ tài khoản của bạn an toàn hơn.',
    );
  });

  it('mật khẩu yếu theo D-13: đúng từng chữ, không đòi chữ và số', () => {
    expect(errors.AUTH_WEAK_PASSWORD).toBe('Mật khẩu này dễ đoán. Hãy dùng ít nhất 8 ký tự.');
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

/** Câu chữ thông báo của tab Đơn hàng (UI-E01, UI-E02): cùng quy ước docs/09 mục 5.1. */
const ORDER_TAB_MESSAGES: [string, string][] = [
  ...flatten(resources.vi.screens.orders as Json, 'orders'),
  ...flatten(resources.vi.screens.orderDetail as Json, 'orderDetail'),
].filter(([key]) =>
  [
    'loadError',
    'loadMoreError',
    'emptyMessage',
    'noResultsMessage',
    'notFound',
    'noTracking',
    'undeclaredHint',
    'noEvidence',
  ].some((name) => key.endsWith(`.${name}`) || key === name),
);

describe('câu chữ thông báo của tab Đơn hàng', () => {
  it('có đủ các thông báo cần kiểm tra', () => {
    expect(ORDER_TAB_MESSAGES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(ORDER_TAB_MESSAGES)('%s: tối đa 2 câu và dưới 20 từ', (_key, message) => {
    expect(sentences(message).length).toBeLessThanOrEqual(2);
    expect(words(message).length).toBeLessThan(20);
  });

  it.each(ORDER_TAB_MESSAGES)('%s: không chứa từ cấm', (_key, message) => {
    for (const word of FORBIDDEN) expect(message.toLowerCase()).not.toContain(word);
  });

  it('không có nhãn "Đã đồng bộ" hay "Hoàn tất" ở tab Đơn hàng', () => {
    const all = [
      ...flatten(resources.vi.screens.orders as Json, 'orders'),
      ...flatten(resources.vi.screens.orderDetail as Json, 'orderDetail'),
    ];
    for (const [, value] of all) {
      expect(value).not.toMatch(/đã đồng bộ|hoàn tất/i);
    }
  });
});
