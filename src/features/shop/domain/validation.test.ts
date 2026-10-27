import {
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  normalizeShopName,
  SHOP_NAME_MAX_LENGTH,
  textLength,
  validateEmail,
  validatePassword,
  validateShopName,
} from './validation';

describe('kiểm tra email', () => {
  it.each(['shop@example.com', 'ten.shop+test@mail.cuahang.vn', '  a@b.co  '])(
    '"%s" hợp lệ',
    (email) => {
      expect(validateEmail(email)).toBeNull();
    },
  );

  it.each(['', '   '])('rỗng "%s" là required', (email) => {
    expect(validateEmail(email)).toBe('required');
  });

  it.each(['abc', 'a@b', 'a@@b.com', 'a b@c.com', '@b.com', 'a@b..com', 'a@.com', 'a@b.'])(
    '"%s" sai định dạng',
    (email) => {
      expect(validateEmail(email)).toBe('invalid');
    },
  );

  it('bỏ khoảng trắng đầu/cuối khi chuẩn hóa', () => {
    expect(normalizeEmail('  shop@example.com ')).toBe('shop@example.com');
  });
});

describe('kiểm tra mật khẩu', () => {
  it('tối thiểu 8 ký tự', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validatePassword('')).toBe('required');
    expect(validatePassword('1234567')).toBe('too_short');
    expect(validatePassword('12345678')).toBeNull();
  });

  it('không cắt khoảng trắng; đếm theo ký tự hiển thị', () => {
    expect(validatePassword('       a')).toBeNull();
    expect(validatePassword('😀😀😀😀😀😀😀')).toBe('too_short');
    expect(validatePassword('😀😀😀😀😀😀😀😀')).toBeNull();
  });
});

describe('kiểm tra tên shop', () => {
  it('bắt buộc: rỗng hoặc chỉ khoảng trắng là required', () => {
    expect(validateShopName('')).toBe('required');
    expect(validateShopName('    ')).toBe('required');
  });

  it('1 đến 50 ký tự sau khi bỏ khoảng trắng đầu/cuối', () => {
    expect(validateShopName('A')).toBeNull();
    expect(validateShopName('  Shop Minh Anh  ')).toBeNull();
    expect(validateShopName('a'.repeat(SHOP_NAME_MAX_LENGTH))).toBeNull();
    expect(validateShopName(`  ${'a'.repeat(SHOP_NAME_MAX_LENGTH)}  `)).toBeNull();
    expect(validateShopName('a'.repeat(SHOP_NAME_MAX_LENGTH + 1))).toBe('too_long');
  });

  it('chuẩn hóa bỏ khoảng trắng đầu/cuối, giữ nguyên chữ có dấu', () => {
    expect(normalizeShopName('  Cửa hàng Ánh  ')).toBe('Cửa hàng Ánh');
    expect(textLength('Đơn Chứng')).toBe(9);
  });
});
