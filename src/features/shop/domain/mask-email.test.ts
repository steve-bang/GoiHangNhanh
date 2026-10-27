import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('giữ 2 ký tự đầu của phần trước @ và toàn bộ tên miền', () => {
    expect(maskEmail('dasomething@example.com')).toBe('da•••@example.com');
    expect(maskEmail('shop.minh.anh@cuahang.vn')).toBe('sh•••@cuahang.vn');
  });

  it('phần trước @ ngắn: chỉ giữ 1 ký tự để vẫn che được', () => {
    expect(maskEmail('ab@example.com')).toBe('a•••@example.com');
    expect(maskEmail('a@example.com')).toBe('a•••@example.com');
  });

  it('bỏ khoảng trắng đầu/cuối; không làm lộ phần che', () => {
    const masked = maskEmail('  da.dung@example.com ');
    expect(masked).toBe('da•••@example.com');
    expect(masked).not.toContain('dung');
  });

  it('đếm theo ký tự hiển thị (không cắt đôi ký tự có dấu/emoji)', () => {
    expect(maskEmail('đạtshop@example.com')).toBe('đạ•••@example.com');
    expect(maskEmail('😀😀x@example.com')).toBe('😀😀•••@example.com');
  });

  it('chuỗi không phải email: che gần hết, không ném lỗi', () => {
    expect(maskEmail('abcdef')).toBe('a•••');
    expect(maskEmail('')).toBe('•••');
    expect(maskEmail('@example.com')).toBe('@•••');
  });
});
