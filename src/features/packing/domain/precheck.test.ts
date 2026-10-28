import { runPrecheck } from './precheck';
import {
  ESTIMATED_BYTES_PER_MINUTE,
  MIN_BATTERY_LEVEL,
  MIN_FREE_BYTES_TO_RECORD,
  requiredFreeBytes,
} from './recording-policy';

const ok = {
  camera: 'granted' as const,
  freeBytes: MIN_FREE_BYTES_TO_RECORD + 1,
  canWrite: () => true,
};

describe('runPrecheck (A04)', () => {
  it('đủ điều kiện: ready', () => {
    expect(runPrecheck(ok)).toEqual({ status: 'ready' });
  });

  it('quyền camera đang kiểm: pending, chưa kết luận', () => {
    expect(runPrecheck({ ...ok, camera: 'checking' })).toEqual({ status: 'pending' });
  });

  it('chưa có quyền camera: askable -> xin quyền; blocked -> mở Cài đặt', () => {
    expect(runPrecheck({ ...ok, camera: 'askable' })).toEqual({
      status: 'blocked',
      issues: [{ id: 'camera', code: 'CAMERA_PERMISSION_DENIED', fix: 'request_permission' }],
    });
    expect(runPrecheck({ ...ok, camera: 'blocked' })).toMatchObject({
      issues: [{ id: 'camera', fix: 'open_settings' }],
    });
  });

  it('dung lượng dưới ngưỡng: INSUFFICIENT_STORAGE; đúng bằng ngưỡng thì đạt', () => {
    expect(runPrecheck({ ...ok, freeBytes: MIN_FREE_BYTES_TO_RECORD - 1 })).toEqual({
      status: 'blocked',
      issues: [{ id: 'storage', code: 'INSUFFICIENT_STORAGE', fix: 'free_storage' }],
    });
    expect(runPrecheck({ ...ok, freeBytes: MIN_FREE_BYTES_TO_RECORD })).toEqual({
      status: 'ready',
    });
  });

  it('không đọc được dung lượng: không chặn (không đoán là thiếu)', () => {
    expect(runPrecheck({ ...ok, freeBytes: null })).toEqual({ status: 'ready' });
  });

  it('không ghi được vào nơi lưu: LOCAL_SAVE_UNAVAILABLE, thử lại', () => {
    expect(runPrecheck({ ...ok, canWrite: () => false })).toEqual({
      status: 'blocked',
      issues: [{ id: 'localWrite', code: 'LOCAL_SAVE_UNAVAILABLE', fix: 'retry' }],
    });
  });

  it('liệt kê TẤT CẢ điều kiện không đạt theo thứ tự camera, dung lượng, ghi tệp', () => {
    const result = runPrecheck({ camera: 'blocked', freeBytes: 1, canWrite: () => false });
    expect(result.status === 'blocked' && result.issues.map((i) => i.id)).toEqual([
      'camera',
      'storage',
      'localWrite',
    ]);
  });

  it('chính sách mặc định (O-05): chỗ trống phải đủ quay 10 phút', () => {
    expect(MIN_FREE_BYTES_TO_RECORD).toBe(10 * ESTIMATED_BYTES_PER_MINUTE);
    expect(requiredFreeBytes()).toBe(MIN_FREE_BYTES_TO_RECORD);
  });

  it('thời lượng tối thiểu theo chính sách (về sau theo gói): đổi chính sách thì đổi ngưỡng', () => {
    const free = requiredFreeBytes({ minRecordMinutes: 30 }) - 1;
    expect(runPrecheck({ ...ok, freeBytes: free }).status).toBe('ready');
    expect(runPrecheck({ ...ok, freeBytes: free, policy: { minRecordMinutes: 30 } }).status).toBe(
      'blocked',
    );
    expect(
      runPrecheck({ ...ok, freeBytes: free + 1, policy: { minRecordMinutes: 30 } }).status,
    ).toBe('ready');
  });

  describe('pin và nhiệt độ (A04, người dùng khuyến khích chặn)', () => {
    const low = MIN_BATTERY_LEVEL;
    const blockedIds = (r: ReturnType<typeof runPrecheck>) =>
      r.status === 'blocked' ? r.issues.map((i) => i.id) : [];

    it('pin thấp và KHÔNG cắm sạc: chặn BATTERY_LOW, khuyên cắm sạc', () => {
      expect(
        runPrecheck({ ...ok, device: { batteryLevel: low, charging: false, thermal: null } }),
      ).toEqual({
        status: 'blocked',
        issues: [{ id: 'battery', code: 'BATTERY_LOW', fix: 'charge' }],
      });
    });

    it('pin thấp nhưng đang sạc, hoặc pin trên ngưỡng: không chặn', () => {
      expect(
        runPrecheck({ ...ok, device: { batteryLevel: 0.02, charging: true, thermal: null } }),
      ).toEqual({ status: 'ready' });
      expect(
        runPrecheck({
          ...ok,
          device: { batteryLevel: low + 0.01, charging: false, thermal: null },
        }),
      ).toEqual({ status: 'ready' });
    });

    it('pin thấp mà không rõ có sạc không: vẫn chặn (không đoán là đang sạc)', () => {
      expect(
        blockedIds(
          runPrecheck({ ...ok, device: { batteryLevel: low, charging: null, thermal: null } }),
        ),
      ).toEqual(['battery']);
    });

    it('không biết pin hay nhiệt độ (máy không cung cấp): không chặn', () => {
      expect(
        runPrecheck({ ...ok, device: { batteryLevel: null, charging: null, thermal: null } }),
      ).toEqual({ status: 'ready' });
      expect(runPrecheck(ok)).toEqual({ status: 'ready' });
    });

    it('máy nóng mức serious/critical: chặn DEVICE_OVERHEATED; nominal/fair thì không', () => {
      for (const thermal of ['serious', 'critical'] as const) {
        expect(
          runPrecheck({ ...ok, device: { batteryLevel: 0.9, charging: false, thermal } }),
        ).toEqual({
          status: 'blocked',
          issues: [{ id: 'thermal', code: 'DEVICE_OVERHEATED', fix: 'cool_down' }],
        });
      }
      for (const thermal of ['nominal', 'fair'] as const) {
        expect(
          runPrecheck({ ...ok, device: { batteryLevel: 0.9, charging: false, thermal } }).status,
        ).toBe('ready');
      }
    });

    it('liệt kê đủ cả 5 điều kiện khi tất cả không đạt', () => {
      expect(
        blockedIds(
          runPrecheck({
            camera: 'blocked',
            freeBytes: 1,
            canWrite: () => false,
            device: { batteryLevel: 0.01, charging: false, thermal: 'critical' },
          }),
        ),
      ).toEqual(['camera', 'storage', 'localWrite', 'battery', 'thermal']);
    });
  });
});
