import { VIDEO_MAX_BYTES } from '@/features/upload';

import {
  BITRATE_HEADROOM,
  ESTIMATED_BYTES_PER_MINUTE,
  MIN_FREE_BYTES_TO_RECORD,
  VIDEO_PROFILE,
  DEFAULT_RECORDING_POLICY,
  requiredFreeBytes,
} from './recording-policy';

describe('VIDEO_PROFILE và ước lượng dung lượng (V1-22)', () => {
  it('Q-30a/b: 1080p, H.264, 6 Mbps', () => {
    expect(VIDEO_PROFILE).toMatchObject({ quality: '1080p', codec: 'avc1', bitrateBps: 6_000_000 });
  });

  it('ESTIMATED_BYTES_PER_MINUTE suy từ bitrate + headroom, không phải số ước tự do', () => {
    expect(ESTIMATED_BYTES_PER_MINUTE).toBe(
      Math.ceil((VIDEO_PROFILE.bitrateBps / 8) * 60 * BITRATE_HEADROOM),
    );
    // 6 Mbps danh nghĩa = 45 MB/phút; ước lượng có headroom khoảng 58,5 MB/phút (gần 60 MB/phút trước đây).
    expect(ESTIMATED_BYTES_PER_MINUTE).toBeGreaterThan(45_000_000);
    expect(ESTIMATED_BYTES_PER_MINUTE).toBeLessThan(62_000_000);
  });

  it('chỗ trống yêu cầu cho 10 phút >= dung lượng danh nghĩa của bitrate (không bao giờ thấp hơn thực tế)', () => {
    const nominal = (VIDEO_PROFILE.bitrateBps * 600) / 8;
    expect(requiredFreeBytes(DEFAULT_RECORDING_POLICY)).toBeGreaterThanOrEqual(nominal);
    expect(MIN_FREE_BYTES_TO_RECORD).toBe(10 * ESTIMATED_BYTES_PER_MINUTE);
  });

  it('một lần quay đủ giới hạn 10 phút ở bitrate mục tiêu nhỏ hơn trần tải lên rất nhiều', () => {
    expect((VIDEO_PROFILE.bitrateBps * 600) / 8).toBeLessThan(VIDEO_PROFILE.maxFileBytes / 2);
  });

  it('maxFileBytes nhỏ hơn VIDEO_MAX_BYTES của hàng đợi tải lên (tệp tự dừng không bao giờ bị từ chối vì quá lớn) và vừa Int32 của Android', () => {
    expect(VIDEO_PROFILE.maxFileBytes).toBeLessThan(VIDEO_MAX_BYTES);
    expect(VIDEO_PROFILE.maxFileBytes).toBeLessThanOrEqual(2_147_483_647);
    expect(VIDEO_PROFILE.maxFileBytes).toBeGreaterThanOrEqual(VIDEO_MAX_BYTES * 0.9);
  });
});
