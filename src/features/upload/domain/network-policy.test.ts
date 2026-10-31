import { UPLOAD_WIFI_ONLY, uploadNetworkGate } from './network-policy';

describe('uploadNetworkGate (V1-09, Q-24c B)', () => {
  const on = (type: 'wifi' | 'cellular' | 'other') => ({ online: true, type });

  it('mặc định công tắc TẮT = luôn tải', () => {
    expect(UPLOAD_WIFI_ONLY).toMatchObject({ key: 'upload.wifi_only', defaultValue: false });
  });

  it.each([
    ['wifi', false, 'allowed'],
    ['cellular', false, 'allowed'],
    ['other', false, 'allowed'],
    ['wifi', true, 'allowed'],
    ['cellular', true, 'waiting_wifi'],
    // Ethernet, VPN, Bluetooth, chưa rõ: không biết có tốn cước di động -> chờ Wi‑Fi khi đã bật.
    ['other', true, 'waiting_wifi'],
    ['wifi', null, 'allowed'],
    // Chưa đọc xong cài đặt: không lỡ dùng 4G/5G của người đã bật.
    ['cellular', null, 'waiting_wifi'],
    ['other', null, 'waiting_wifi'],
  ] as const)('%s, chỉ Wi‑Fi = %s -> %s', (type, wifiOnly, expected) => {
    expect(uploadNetworkGate(on(type), wifiOnly)).toBe(expected);
  });

  it('mất mạng luôn là offline (không phải "chờ Wi‑Fi")', () => {
    for (const wifiOnly of [true, false, null]) {
      expect(uploadNetworkGate({ online: false, type: 'none' }, wifiOnly)).toBe('offline');
    }
  });

  it('giá trị đã lưu sai kiểu không được coi là bật', () => {
    expect(UPLOAD_WIFI_ONLY.decode('true')).toBeUndefined();
    expect(UPLOAD_WIFI_ONLY.decode(1)).toBeUndefined();
    expect(UPLOAD_WIFI_ONLY.decode(true)).toBe(true);
  });
});
