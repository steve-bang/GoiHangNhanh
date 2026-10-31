import { toDisplayStatus } from './display-status';
import { ALL_FILE_STATES, type FileState } from './file-state';
import { foreignUploadNote, uploaderRelation } from './uploader';

describe('uploaderRelation (V1-07, Q-24g)', () => {
  it.each([
    ['u-1', 'u-1', 'current'],
    ['u-2', 'u-1', 'other'],
    [undefined, 'u-1', 'unknown'],
    [null, 'u-1', 'unknown'],
    ['', 'u-1', 'unknown'],
    // Chưa biết ai đăng nhập: không kết luận.
    ['u-2', null, 'current'],
    [undefined, null, 'current'],
  ] as const)('người tạo %s, đang đăng nhập %s -> %s', (createdBy, uid, expected) => {
    expect(uploaderRelation(createdBy, uid)).toBe(expected);
  });
});

describe('foreignUploadNote', () => {
  const waiting: FileState[] = ['queued', 'uploading', 'upload_failed', 'needs_attention'];

  it('chỉ nói khi tệp còn chờ máy chủ VÀ do tài khoản khác/không rõ tạo', () => {
    for (const state of ALL_FILE_STATES) {
      const expectNote = waiting.includes(state);
      expect(foreignUploadNote(state, 'other')).toBe(expectNote ? 'other' : null);
      expect(foreignUploadNote(state, 'unknown')).toBe(expectNote ? 'unknown' : null);
      expect(foreignUploadNote(state, 'current')).toBeNull();
    }
  });
});

describe('toDisplayStatus với người tạo', () => {
  it('tệp của tài khoản khác: queued/uploading là "Chờ tải lên" (máy này không gửi gì)', () => {
    for (const uploader of ['other', 'unknown'] as const) {
      expect(toDisplayStatus('queued', { uploader })).toEqual({
        kind: 'label',
        label: 'waiting_upload',
      });
      expect(toDisplayStatus('uploading', { uploader })).toEqual({
        kind: 'label',
        label: 'waiting_upload',
      });
      // Không bao giờ nói đã lên máy chủ hộ, và lỗi vẫn là lỗi.
      expect(toDisplayStatus('upload_failed', { uploader })).toEqual({
        kind: 'label',
        label: 'error',
      });
      expect(toDisplayStatus('verified', { uploader })).toEqual({
        kind: 'label',
        label: 'verified',
      });
    }
  });

  it('tài khoản hiện tại hoặc không truyền: như cũ', () => {
    expect(toDisplayStatus('queued', { uploader: 'current' })).toEqual({
      kind: 'label',
      label: 'saved_on_device',
    });
    expect(toDisplayStatus('uploading', { uploader: 'current' })).toEqual({
      kind: 'label',
      label: 'uploading',
    });
    expect(toDisplayStatus('queued')).toEqual({ kind: 'label', label: 'saved_on_device' });
  });
});
