import type { ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent, FileEventType } from '@/features/evidence';

import {
  applyMediaEvent,
  applyMediaLocation,
  assertMediaDeletable,
  describeLocation,
  type MediaLocation,
  type ReturnMedia,
} from './media';

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
  location: null,
  attemptCount: 0,
  nextAttemptAtDevice: null,
  lastErrorCode: null,
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

describe('applyMediaEvent: trạng thái hàng đợi tải lên (Q-28)', () => {
  const queued = base({
    state: 'queued',
    localPath: 'evidence/m1.jpg',
    sizeBytes: 9,
    sha256Client: SHA,
  });

  it('ghi số lần thử, giờ thử lại và mã lỗi; null xóa giờ thử lại và mã lỗi', () => {
    const started = applyMediaEvent(queued, dev('UPLOAD_STARTED'), 10);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const failed = applyMediaEvent(started.media, dev('UPLOAD_FAILED'), 11, {
      attemptCount: 1,
      lastErrorCode: 'NETWORK',
      nextAttemptAtDevice: 5000,
    });
    expect(failed).toMatchObject({
      ok: true,
      media: {
        state: 'upload_failed',
        attemptCount: 1,
        lastErrorCode: 'NETWORK',
        nextAttemptAtDevice: 5000,
      },
    });
    if (!failed.ok) return;
    const retried = applyMediaEvent(failed.media, dev('RETRY_UPLOAD'), 12, {
      nextAttemptAtDevice: null,
    });
    expect(retried).toMatchObject({
      ok: true,
      media: {
        state: 'queued',
        attemptCount: 1,
        lastErrorCode: 'NETWORK',
        nextAttemptAtDevice: null,
      },
    });
  });

  it('client không tự tới uploaded/verified: sự kiện máy chủ cần origin server', () => {
    const uploading = base({ ...queued, state: 'uploading' });
    expect(applyMediaEvent(uploading, { type: 'SERVER_RECEIVED', origin: 'device' }, 20)).toEqual({
      ok: false,
      error: 'ORIGIN_NOT_ALLOWED',
    });
    expect(
      applyMediaEvent(uploading, { type: 'SERVER_RECEIVED', origin: 'server' }, 20),
    ).toMatchObject({ ok: true, media: { state: 'uploaded' } });
  });
});

describe('assertMediaDeletable (Q-26j + Q-28)', () => {
  const run = (
    media: Partial<ReturnMedia>,
    extra: { confirmed?: boolean; dispute?: boolean } = {},
  ) =>
    assertMediaDeletable({
      returnConfirmed: extra.confirmed ?? false,
      inDispute: extra.dispute ?? false,
      media: base(media),
    });

  it('xóa được ảnh chưa từng đưa cho máy chủ', () => {
    for (const state of [
      'recording',
      'saving_local',
      'local_save_failed',
      'unrecoverable',
    ] as const) {
      expect(() => run({ state })).not.toThrow();
    }
    expect(() => run({ state: 'queued' })).not.toThrow();
    // hỏng ở bước kiểm tra cục bộ trước khi khai báo: máy chủ chưa biết
    expect(() => run({ state: 'needs_attention', lastErrorCode: 'FILE_MISSING' })).not.toThrow();
  });

  it('KHÔNG xóa khi máy chủ có thể đã nhận: đang/đã tải, tải lỗi, đã có lần thử, lỗi do máy chủ', () => {
    for (const state of [
      'uploading',
      'uploaded',
      'verified',
      'hash_mismatch',
      'upload_failed',
    ] as const) {
      expect(() => run({ state })).toThrow(
        expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
      );
    }
    expect(() => run({ state: 'queued', attemptCount: 2 })).toThrow(
      expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
    );
    expect(() => run({ state: 'queued', lastErrorCode: 'NETWORK' })).toThrow(
      expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
    );
    expect(() => run({ state: 'needs_attention', lastErrorCode: 'PERMISSION_DENIED' })).toThrow(
      expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
    );
    expect(() => run({ state: 'needs_attention' })).toThrow(
      expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
    );
  });

  it('video mở kiện KHÔNG BAO GIỜ xóa được (ngoại lệ chỉ cho ảnh chụp nhầm), kể cả chưa tải', () => {
    for (const state of ['recording', 'queued', 'local_save_failed', 'verified'] as const) {
      expect(() => run({ kind: 'video', state })).toThrow(
        expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
      );
    }
  });

  it('hồ sơ đã xác nhận hoặc ảnh trong tranh chấp thì không xóa dù chưa tải', () => {
    expect(() => run({ state: 'queued' }, { confirmed: true })).toThrow(
      expect.objectContaining({ code: 'RETURN_ALREADY_CONFIRMED' }),
    );
    expect(() => run({ state: 'queued' }, { dispute: true })).toThrow(
      expect.objectContaining({ code: 'RETURN_PHOTO_IN_USE' }),
    );
  });
});

describe('applyMediaLocation / describeLocation (Q-26k)', () => {
  const queued = (overrides: Partial<ReturnMedia> = {}) =>
    base({
      state: 'queued',
      localPath: 'evidence/m1.jpg',
      sizeBytes: 9,
      sha256Client: SHA,
      ...overrides,
    });
  const ok: MediaLocation = { status: 'ok', lat: 10.77, lng: 106.7, accuracyM: 12.4, atDevice: 99 };

  it('ghi vị trí một lần sau khi tệp đã đóng; không đổi trạng thái tệp', () => {
    const result = applyMediaLocation(queued(), ok);
    expect(result).toMatchObject({ ok: true, media: { state: 'queued', location: ok } });
  });

  it('chưa đóng tệp (recording/saving_local/lưu lỗi) thì từ chối', () => {
    for (const state of ['recording', 'saving_local', 'local_save_failed'] as const) {
      expect(applyMediaLocation(base({ state }), ok)).toEqual({
        ok: false,
        error: 'ILLEGAL_TRANSITION',
      });
    }
  });

  it('đã có vị trí thì không ghi đè (bất biến như mã băm)', () => {
    const first = applyMediaLocation(queued(), ok);
    expect(first.ok && applyMediaLocation(first.media, { ...ok, lat: 1 })).toEqual({
      ok: false,
      error: 'IMMUTABLE_FIELD',
    });
  });

  it('trạng thái lỗi bỏ tọa độ; ok mà thiếu hoặc sai tọa độ thì từ chối', () => {
    const denied = applyMediaLocation(queued(), { ...ok, status: 'denied' });
    expect(denied).toMatchObject({
      ok: true,
      media: {
        location: { status: 'denied', lat: null, lng: null, accuracyM: null, atDevice: null },
      },
    });
    for (const bad of [
      { ...ok, lat: null },
      { ...ok, lat: 91 },
      { ...ok, lng: -181 },
      { ...ok, lng: Number.NaN },
      { ...ok, accuracyM: -1 },
      { ...ok, atDevice: null },
    ]) {
      expect(applyMediaLocation(queued(), bad)).toEqual({ ok: false, error: 'INVALID_LOCATION' });
    }
  });

  it('describeLocation: có vị trí (làm tròn sai số), không có kèm lý do, chưa ghi = unknown; không lộ tọa độ', () => {
    expect(describeLocation({ location: ok })).toEqual({ kind: 'has', accuracyM: 12 });
    expect(describeLocation({ location: { ...ok, accuracyM: null } })).toEqual({
      kind: 'has',
      accuracyM: null,
    });
    expect(
      describeLocation({
        location: { status: 'timeout', lat: null, lng: null, accuracyM: null, atDevice: null },
      }),
    ).toEqual({ kind: 'none', reason: 'timeout' });
    expect(describeLocation({ location: null })).toEqual({ kind: 'none', reason: 'unknown' });
    expect(JSON.stringify(describeLocation({ location: ok }))).not.toContain('10.77');
  });
});
