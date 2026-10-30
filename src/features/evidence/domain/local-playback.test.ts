import { FILE_STATES, type FileState } from './file-state';
import {
  formatDuration,
  formatFileSize,
  isServerConfirmed,
  localPlaybackOf,
  shortHash,
  shortId,
} from './local-playback';

describe('localPlaybackOf (xem lại trên máy, chỉ đọc)', () => {
  const exists = (p: string) => p === 'evidence/ok.mp4';

  it.each<FileState>([FILE_STATES.RECORDING, FILE_STATES.SAVING_LOCAL])(
    '%s: tệp chưa đóng, không mở dù đã có đường dẫn',
    (state) => {
      expect(localPlaybackOf({ state, localPath: 'evidence/ok.mp4' }, exists)).toBe('capturing');
    },
  );

  it('tệp đã đóng và còn trên máy: mở được ở mọi trạng thái sau khi lưu', () => {
    for (const state of [
      FILE_STATES.QUEUED,
      FILE_STATES.UPLOADING,
      FILE_STATES.UPLOADED,
      FILE_STATES.VERIFIED,
      FILE_STATES.UPLOAD_FAILED,
      FILE_STATES.HASH_MISMATCH,
      FILE_STATES.NEEDS_ATTENTION,
    ]) {
      expect(localPlaybackOf({ state, localPath: 'evidence/ok.mp4' }, exists)).toBe('available');
    }
  });

  it('không có đường dẫn hoặc tệp đã mất: missing (không đoán nơi khác)', () => {
    expect(localPlaybackOf({ state: FILE_STATES.VERIFIED, localPath: null }, exists)).toBe(
      'missing',
    );
    expect(
      localPlaybackOf({ state: FILE_STATES.QUEUED, localPath: 'evidence/gone.mp4' }, exists),
    ).toBe('missing');
    expect(
      localPlaybackOf({ state: FILE_STATES.UNRECOVERABLE, localPath: 'evidence/gone.mp4' }, exists),
    ).toBe('missing');
  });

  it('không hỏi hệ tệp khi tệp còn đang ghi', () => {
    const probe = jest.fn(() => true);
    localPlaybackOf({ state: FILE_STATES.RECORDING, localPath: 'x' }, probe);
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
