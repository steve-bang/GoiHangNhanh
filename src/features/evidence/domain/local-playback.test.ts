import { FILE_STATES, type FileState } from './file-state';
import {
  formatDuration,
  formatFileSize,
  isServerConfirmed,
  localPlaybackOf,
  shortHash,
  shortId,
} from './local-playback';

describe('localPlaybackOf (chọn nguồn xem lại)', () => {
  const exists = (p: string) => p === 'evidence/ok.mp4';

  it.each<FileState>([FILE_STATES.RECORDING, FILE_STATES.SAVING_LOCAL])(
    '%s: tệp chưa đóng, báo đang lưu dù đã có đường dẫn hay máy chủ có bản',
    (state) => {
      expect(localPlaybackOf({ state, localPath: 'evidence/ok.mp4' }, exists)).toBe('capturing');
    },
  );

  it('tệp còn trên máy: local ở mọi trạng thái, kể cả khi máy chủ đã xác nhận', () => {
    for (const state of [
      FILE_STATES.QUEUED,
      FILE_STATES.UPLOADING,
      FILE_STATES.UPLOADED,
      FILE_STATES.VERIFIED,
      FILE_STATES.UPLOAD_FAILED,
      FILE_STATES.HASH_MISMATCH,
      FILE_STATES.NEEDS_ATTENTION,
    ]) {
      expect(localPlaybackOf({ state, localPath: 'evidence/ok.mp4' }, exists)).toBe('local');
    }
  });

  it.each<FileState>([FILE_STATES.UPLOADED, FILE_STATES.VERIFIED])(
    'mất tệp (không đường dẫn hoặc tệp đã dọn) và máy chủ đã xác nhận %s: cloud',
    (state) => {
      expect(localPlaybackOf({ state, localPath: null }, exists)).toBe('cloud');
      expect(localPlaybackOf({ state, localPath: 'evidence/gone.mp4' }, exists)).toBe('cloud');
    },
  );

  it('mất tệp và máy chủ chưa xác nhận: missing (không đoán nơi khác)', () => {
    for (const state of [
      FILE_STATES.QUEUED,
      FILE_STATES.UPLOADING,
      FILE_STATES.UPLOAD_FAILED,
      FILE_STATES.HASH_MISMATCH,
      FILE_STATES.NEEDS_ATTENTION,
      FILE_STATES.UNRECOVERABLE,
    ]) {
      expect(localPlaybackOf({ state, localPath: null }, exists)).toBe('missing');
      expect(localPlaybackOf({ state, localPath: 'evidence/gone.mp4' }, exists)).toBe('missing');
    }
  });

  it('không hỏi hệ tệp khi tệp còn đang ghi hoặc không có đường dẫn', () => {
    const probe = jest.fn(() => true);
    localPlaybackOf({ state: FILE_STATES.RECORDING, localPath: 'x' }, probe);
    localPlaybackOf({ state: FILE_STATES.VERIFIED, localPath: null }, probe);
    expect(probe).not.toHaveBeenCalled();
  });
});

describe('định dạng thông tin tệp', () => {
  it('kích thước theo dấu phẩy thập phân', () => {
    expect(formatFileSize(500)).toBe('1 KB');
    expect(formatFileSize(870_400)).toBe('850 KB');
    expect(formatFileSize(191_250_000)).toBe('182,4 MB');
    expect(formatFileSize(1_342_177_280)).toBe('1,25 GB');
  });

  it('thời lượng m:ss và h:mm:ss, làm tròn xuống', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_999)).toBe('0:09');
    expect(formatDuration(154_000)).toBe('2:34');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('mã băm và ID rút gọn', () => {
    expect(shortHash('0123456789abcdef'.repeat(4))).toBe('01234567…89abcdef');
    expect(shortHash('abc')).toBe('abc');
    expect(shortId('sess-play-123456')).toBe('123456');
    expect(shortId('abc')).toBe('abc');
  });
});

describe('isServerConfirmed', () => {
  it('chỉ uploaded/verified (do máy chủ xác nhận); hash_mismatch và trạng thái máy khác thì không', () => {
    expect(isServerConfirmed(FILE_STATES.UPLOADED)).toBe(true);
    expect(isServerConfirmed(FILE_STATES.VERIFIED)).toBe(true);
    for (const s of [
      FILE_STATES.QUEUED,
      FILE_STATES.UPLOADING,
      FILE_STATES.UPLOAD_FAILED,
      FILE_STATES.HASH_MISMATCH,
      FILE_STATES.NEEDS_ATTENTION,
      FILE_STATES.UNRECOVERABLE,
    ]) {
      expect(isServerConfirmed(s)).toBe(false);
    }
  });
});
