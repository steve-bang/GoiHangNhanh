import { runPrecheck } from './precheck';
import { MIN_FREE_BYTES_TO_RECORD } from './recording-controller';

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

  it('ngưỡng cấu hình được (chờ O-05)', () => {
    expect(runPrecheck({ ...ok, freeBytes: 10, minFreeBytes: 10 })).toEqual({ status: 'ready' });
    expect(runPrecheck({ ...ok, freeBytes: 9, minFreeBytes: 10 }).status).toBe('blocked');
  });
});
