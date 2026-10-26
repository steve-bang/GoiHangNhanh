import { resources } from '../i18n/resources';
import { AppError, isAppError } from './app-error';
import { CODES_WITHOUT_DOCUMENTED_MESSAGE, ERROR_CODES } from './codes';

describe('mã lỗi nghiệp vụ', () => {
  it('đều dạng UPPER_SNAKE_CASE và khóa trùng giá trị', () => {
    for (const [key, value] of Object.entries(ERROR_CODES)) {
      expect(value).toMatch(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/);
      expect(value).toBe(key);
    }
  });

  it('mỗi mã có thông báo i18n, trừ mã docs chưa định nghĩa câu thông báo', () => {
    const messages = resources.vi.errors as Record<string, string>;
    for (const code of Object.values(ERROR_CODES)) {
      if (CODES_WITHOUT_DOCUMENTED_MESSAGE.includes(code)) {
        expect(messages[code]).toBeUndefined();
      } else {
        expect(messages[code]).toEqual(expect.any(String));
      }
    }
  });

  it('không có thông báo i18n cho mã không tồn tại', () => {
    const codes = new Set<string>(Object.values(ERROR_CODES));
    for (const key of Object.keys(resources.vi.errors)) expect(codes.has(key)).toBe(true);
  });
});

describe('AppError', () => {
  it('mang mã và ngữ cảnh, nhận diện được bằng isAppError', () => {
    const e = new AppError('INSUFFICIENT_STORAGE', { freeBytes: 10 });
    expect(isAppError(e)).toBe(true);
    expect(e.code).toBe('INSUFFICIENT_STORAGE');
    expect(e.context).toEqual({ freeBytes: 10 });
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
