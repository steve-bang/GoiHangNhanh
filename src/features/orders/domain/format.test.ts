import { formatDeviceDateTime } from './format';

describe('formatDeviceDateTime', () => {
  it('định dạng dd/MM/yyyy HH:mm theo giờ máy', () => {
    expect(formatDeviceDateTime(new Date(2026, 9, 27, 9, 5).getTime())).toBe('27/10/2026 09:05');
    expect(formatDeviceDateTime(new Date(2026, 0, 2, 23, 59).getTime())).toBe('02/01/2026 23:59');
  });
});
