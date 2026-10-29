import type { ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent, FileEventType } from '@/features/evidence';

import { applyMediaEvent, type ReturnMedia } from './media';

const dev = (type: FileEventType): FileEvent => ({ type, origin: 'device' });
const SHA = 'c'.repeat(64);

const base = (overrides: Partial<ReturnMedia> = {}): ReturnMedia => ({
  id: 'm1',
  shopId: 's' as ShopId,
  returnId: 'r' as ReturnCaseId,
  kind: 'photo',
  state: 'recording',
  localPath: null,
  sizeBytes: null,
  sha256Client: null,
  createdAtDevice: 1,
  updatedAtDevice: 1,
  ...overrides,
});

describe('applyMediaEvent', () => {
  it('STOP_RECORDING ghi đường dẫn tạm và cập nhật giờ thiết bị', () => {
    const result = applyMediaEvent(base(), dev('STOP_RECORDING'), 50, { localPath: 'tmp/a.jpg' });
    expect(result).toMatchObject({
      ok: true,
      media: { state: 'saving_local', localPath: 'tmp/a.jpg', updatedAtDevice: 50 },
    });
  });

  it('không đổi bản ghi gốc (thuần)', () => {
    const before = base();
    applyMediaEvent(before, dev('STOP_RECORDING'), 50, { localPath: 'tmp/a.jpg' });
    expect(before.state).toBe('recording');
    expect(before.localPath).toBeNull();
  });

  it('vào queued cần đủ đường dẫn, kích thước > 0 và mã băm', () => {
    const saving = base({ state: 'saving_local', localPath: 'evidence/m1.jpg' });
    expect(applyMediaEvent(saving, dev('LOCAL_FILE_READABLE'), 2)).toEqual({
      ok: false,
      error: 'MISSING_FILE_DETAILS',
    });
    expect(
      applyMediaEvent(saving, dev('LOCAL_FILE_READABLE'), 2, { sizeBytes: 0, sha256Client: SHA }),
    ).toEqual({ ok: false, error: 'MISSING_FILE_DETAILS' });
    const ok = applyMediaEvent(saving, dev('LOCAL_FILE_READABLE'), 2, {
      sizeBytes: 9,
      sha256Client: SHA,
    });
    expect(ok).toMatchObject({ ok: true, media: { state: 'queued', sha256Client: SHA } });
  });

  it('mã băm, kích thước đã đặt không đổi được; đường dẫn không đổi sau khi có mã băm', () => {
    const queued = base({
      state: 'queued',
      localPath: 'evidence/m1.jpg',
      sizeBytes: 9,
      sha256Client: SHA,
    });
    expect(applyMediaEvent(queued, dev('UPLOAD_STARTED'), 3, { sha256Client: 'd' })).toEqual({
      ok: false,
      error: 'IMMUTABLE_FIELD',
    });
    expect(applyMediaEvent(queued, dev('UPLOAD_STARTED'), 3, { sizeBytes: 10 })).toEqual({
      ok: false,
      error: 'IMMUTABLE_FIELD',
    });
    expect(applyMediaEvent(queued, dev('UPLOAD_STARTED'), 3, { localPath: 'x' })).toEqual({
      ok: false,
      error: 'IMMUTABLE_FIELD',
    });
    // Ghi lại đúng giá trị cũ thì không phải thay đổi.
    expect(applyMediaEvent(queued, dev('UPLOAD_STARTED'), 3, { sha256Client: SHA }).ok).toBe(true);
  });

  it('đường dẫn đổi được khi tệp chưa đóng (tạm -> bền)', () => {
    const saving = base({ state: 'saving_local', localPath: 'tmp/a.jpg' });
    const moved = applyMediaEvent(saving, dev('LOCAL_FILE_MOVED'), 4, {
      localPath: 'evidence/m1.jpg',
    });
    expect(moved).toMatchObject({ ok: true, media: { localPath: 'evidence/m1.jpg' } });
  });

  it('sự kiện máy chủ giả bằng origin device bị từ chối; chuyển sai trạng thái bị từ chối', () => {
    const queued = base({ state: 'queued' });
    expect(applyMediaEvent(queued, dev('SERVER_VERIFIED'), 5)).toEqual({
      ok: false,
      error: 'ORIGIN_NOT_ALLOWED',
    });
    expect(applyMediaEvent(base(), dev('LOCAL_FILE_READABLE'), 5)).toEqual({
      ok: false,
      error: 'ILLEGAL_TRANSITION',
    });
  });

  it('LOCAL_WRITE_FAILED giữ đường dẫn đã có', () => {
    const saving = base({ state: 'saving_local', localPath: 'tmp/a.jpg' });
    expect(applyMediaEvent(saving, dev('LOCAL_WRITE_FAILED'), 6)).toMatchObject({
      ok: true,
      media: { state: 'local_save_failed', localPath: 'tmp/a.jpg' },
    });
  });
});
