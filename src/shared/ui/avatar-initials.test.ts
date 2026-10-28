import { getInitials } from './avatar-initials';

describe('getInitials', () => {
  it('lấy chữ cái đầu của từ đầu và từ cuối, viết hoa', () => {
    expect(getInitials('nguyễn văn an')).toBe('NA');
    expect(getInitials('  Lan ')).toBe('L');
    expect(getInitials('Đặng Thu')).toBe('ĐT');
  });
  it('rỗng khi không có tên', () => {
    expect(getInitials(null)).toBe('');
    expect(getInitials(undefined)).toBe('');
    expect(getInitials('   ')).toBe('');
  });
});
