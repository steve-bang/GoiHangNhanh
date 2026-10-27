import {
  DISPLAY_NAME_MAX_LENGTH,
  validateConfirmNewPassword,
  validateCurrentPassword,
  validateDisplayName,
  validateNewPassword,
} from './validation';

describe('validateDisplayName', () => {
  it('bắt buộc và bỏ khoảng trắng đầu/cuối', () => {
    expect(validateDisplayName('')).toBe('required');
    expect(validateDisplayName('   ')).toBe('required');
    expect(validateDisplayName('  Lan  ')).toBeNull();
  });
  it('giới hạn độ dài theo ký tự hiển thị', () => {
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull();
    expect(validateDisplayName('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe('too_long');
    expect(validateDisplayName('😀'.repeat(DISPLAY_NAME_MAX_LENGTH))).toBeNull();
  });
});

describe('mật khẩu', () => {
  it('mật khẩu hiện tại bắt buộc', () => {
    expect(validateCurrentPassword('')).toBe('required');
    expect(validateCurrentPassword('x')).toBeNull();
  });
  it('mật khẩu mới: từ 8 ký tự (D-13), khác mật khẩu hiện tại, giữ khoảng trắng', () => {
    expect(validateNewPassword('cu', '')).toBe('required');
    expect(validateNewPassword('cu', '1234567')).toBe('too_short');
    expect(validateNewPassword('12345678', '12345678')).toBe('same_as_current');
    expect(validateNewPassword('cu', '1234567 ')).toBeNull();
  });
  it('nhập lại phải khớp nguyên văn', () => {
    expect(validateConfirmNewPassword('abcdefgh', '')).toBe('required');
    expect(validateConfirmNewPassword('abcdefgh', 'abcdefgH')).toBe('mismatch');
    expect(validateConfirmNewPassword('abcdefgh', 'abcdefgh')).toBeNull();
  });
});
