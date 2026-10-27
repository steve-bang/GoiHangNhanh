import { resources } from '@/core/i18n/resources';
import { DISPLAY_NAME_MAX_LENGTH, MIN_PASSWORD_LENGTH } from './validation';
import type {
  ConfirmPasswordIssue,
  CurrentPasswordIssue,
  DisplayNameIssue,
  NewPasswordIssue,
} from './validation';

const validation = resources.vi.personal.validation as Record<string, Record<string, string>>;

/** Mọi mã vấn đề của hàm kiểm tra đều phải có câu chữ (compile-time + runtime). */
const EXPECTED: Record<string, readonly string[]> = {
  displayName: ['required', 'too_long'] satisfies DisplayNameIssue[],
  currentPassword: ['required'] satisfies CurrentPasswordIssue[],
  newPassword: ['required', 'too_short', 'same_as_current'] satisfies NewPasswordIssue[],
  confirmNewPassword: ['required', 'mismatch'] satisfies ConfirmPasswordIssue[],
};

describe('personal.json', () => {
  it.each(Object.entries(EXPECTED))('có câu chữ cho mọi mã kiểm tra của %s', (field, issues) => {
    expect(Object.keys(validation[field] ?? {}).sort()).toEqual([...issues].sort());
  });

  it('thông báo kiểm tra ngắn: tối đa 2 câu, dưới 20 từ', () => {
    for (const group of Object.values(validation)) {
      for (const text of Object.values(group)) {
        expect(text.split(/(?<=[.!?])\s+/).length).toBeLessThanOrEqual(2);
        expect(text.split(/\s+/).length).toBeLessThan(20);
      }
    }
  });

  it('con số trong câu chữ khớp hằng số kiểm tra', () => {
    expect(validation['newPassword']?.['too_short']).toContain(String(MIN_PASSWORD_LENGTH));
    expect(validation['displayName']?.['too_long']).toContain(String(DISPLAY_NAME_MAX_LENGTH));
  });
});
