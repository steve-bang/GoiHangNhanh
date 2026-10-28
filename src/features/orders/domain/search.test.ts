import { normalizeSearchInput } from './search';

describe('normalizeSearchInput', () => {
  it('rỗng hoặc dưới 2 ký tự: không truy vấn', () => {
    expect(normalizeSearchInput('')).toBeNull();
    expect(normalizeSearchInput('   ')).toBeNull();
    expect(normalizeSearchInput(' a ')).toBeNull();
  });
  it('trim, gộp khoảng trắng, khóa viết hoa', () => {
    expect(normalizeSearchInput('  dh   10 ')).toEqual({ text: 'dh 10', key: 'DH 10' });
  });
});
