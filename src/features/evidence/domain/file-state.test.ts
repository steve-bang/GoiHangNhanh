import {
  ALL_FILE_STATES,
  ERROR_STATES,
  FILE_EVENT_TYPES,
  FILE_STATES,
  SERVER_ONLY_STATES,
  allowedEvents,
  isLocalCopyReleasable,
  originOf,
  transition,
  type FileEvent,
  type FileEventType,
  type FileState,
} from './file-state';

const device = (type: FileEventType): FileEvent => ({ type, origin: 'device' });
const server = (type: FileEventType): FileEvent => ({ type, origin: 'server' });
const ev = (type: FileEventType): FileEvent => ({ type, origin: originOf(type) });

function run(start: FileState, types: FileEventType[]): FileState {
  let state = start;
  for (const type of types) {
    const r = transition(state, ev(type));
    if (!r.ok) throw new Error(`${type} bị từ chối từ ${state}: ${r.error}`);
    state = r.state;
  }
  return state;
}

describe('đường thuận: Đang ghi -> Đã xác minh', () => {
  it('đi đủ 6 bước theo docs/02', () => {
    expect(run('recording', ['STOP_RECORDING'])).toBe('saving_local');
    expect(run('recording', ['STOP_RECORDING', 'LOCAL_FILE_READABLE'])).toBe('queued');
    expect(run('recording', ['STOP_RECORDING', 'LOCAL_FILE_READABLE', 'UPLOAD_STARTED'])).toBe(
      'uploading',
    );
    expect(
      run('recording', [
        'STOP_RECORDING',
        'LOCAL_FILE_READABLE',
        'UPLOAD_STARTED',
        'SERVER_RECEIVED',
      ]),
    ).toBe('uploaded');
    expect(
      run('recording', [
        'STOP_RECORDING',
        'LOCAL_FILE_READABLE',
        'UPLOAD_STARTED',
        'SERVER_RECEIVED',
        'SERVER_VERIFIED',
      ]),
    ).toBe('verified');
  });
});

describe('client không bao giờ tự nhảy tới trạng thái do máy chủ xác lập', () => {
  it('mọi sự kiện origin=device từ mọi trạng thái đều không tới uploaded/verified/hash_mismatch', () => {
    const deviceEvents = FILE_EVENT_TYPES.filter((t) => originOf(t) === 'device');

    for (const state of ALL_FILE_STATES) {
      for (const type of deviceEvents) {
        const r = transition(state, device(type));
        if (r.ok) expect(SERVER_ONLY_STATES).not.toContain(r.state);
      }
    }
  });

  it('sự kiện máy chủ giả danh origin=device bị từ chối', () => {
    for (const type of ['SERVER_RECEIVED', 'SERVER_VERIFIED', 'SERVER_HASH_MISMATCH'] as const) {
      for (const state of ALL_FILE_STATES) {
        expect(transition(state, device(type))).toEqual({
          ok: false,
          error: 'ORIGIN_NOT_ALLOWED',
          state,
        });
      }
    }
  });

  it('sự kiện thiết bị giả danh origin=server bị từ chối', () => {
    expect(transition('queued', server('UPLOAD_STARTED'))).toMatchObject({
      ok: false,
      error: 'ORIGIN_NOT_ALLOWED',
    });
  });

  it('không có chuyển nào từ queued/uploading tới verified mà không qua uploaded', () => {
    expect(transition('queued', server('SERVER_VERIFIED'))).toMatchObject({ ok: false });
    expect(transition('uploading', server('SERVER_VERIFIED'))).toMatchObject({ ok: false });
  });
});

describe('chuyển không hợp lệ bị từ chối và giữ nguyên trạng thái', () => {
  it.each<[FileState, FileEventType]>([
    ['recording', 'LOCAL_FILE_READABLE'], // phải qua saving_local
    ['recording', 'UPLOAD_STARTED'],
    ['saving_local', 'UPLOAD_STARTED'], // chưa đọc được -> không được tải
    ['queued', 'STOP_RECORDING'],
    ['verified', 'UPLOAD_STARTED'],
    ['verified', 'RETRY_UPLOAD'],
    ['unrecoverable', 'RETRY_UPLOAD'],
    ['hash_mismatch', 'SERVER_VERIFIED'], // cách ly: không thể "xác minh" lại bằng sự kiện này
    ['hash_mismatch', 'RETRY_UPLOAD'],
  ])('%s + %s', (state, type) => {
    const r = transition(state, ev(type));
    expect(r).toEqual({ ok: false, error: 'ILLEGAL_TRANSITION', state });
  });
});

describe('tình huống gián đoạn và lỗi (docs/04 A05/A07, QA-04/05/09/12)', () => {
  it('QA-04: app bị kill khi đang ghi -> khôi phục phải kiểm tra lại, không thẳng vào hàng đợi', () => {
    const r = transition('recording', device('RECOVERY_FOUND_FILE'));
    expect(r).toEqual({ ok: true, state: 'saving_local' });
    expect(transition('recording', ev('LOCAL_FILE_READABLE'))).toMatchObject({ ok: false });
  });

  it('đã chuyển tệp sang thư mục bền: ghi đường dẫn mới nhưng vẫn ở saving_local, chưa thành hàng đợi', () => {
    expect(transition('saving_local', device('LOCAL_FILE_MOVED'))).toEqual({
      ok: true,
      state: 'saving_local',
    });
    for (const state of ALL_FILE_STATES.filter((s) => s !== 'saving_local')) {
      expect(transition(state, device('LOCAL_FILE_MOVED'))).toMatchObject({ ok: false });
    }
  });

  it('QA-12: hết dung lượng giữa phiên -> lỗi lưu cục bộ, không sang hàng đợi', () => {
    expect(run('recording', ['LOCAL_WRITE_FAILED'])).toBe('local_save_failed');
    expect(run('saving_local', ['LOCAL_WRITE_FAILED'])).toBe('local_save_failed');
    expect(transition('local_save_failed', device('LOCAL_FILE_READABLE'))).toMatchObject({
      ok: false,
    });
  });

  it('tải lên thất bại -> thử lại quay về hàng đợi', () => {
    expect(run('uploading', ['UPLOAD_FAILED', 'RETRY_UPLOAD', 'UPLOAD_STARTED'])).toBe('uploading');
  });

  it('QA-05: máy chủ đã nhận nhưng app mất phản hồi -> đối soát đưa về uploaded, không tải lại', () => {
    expect(run('upload_failed', ['SERVER_RECEIVED'])).toBe('uploaded');
    expect(run('queued', ['SERVER_RECEIVED'])).toBe('uploaded');
    expect(run('needs_attention', ['SERVER_RECEIVED'])).toBe('uploaded');
  });

  it('QA-09: mã băm không khớp -> cách ly, không bao giờ thành verified', () => {
    const state = run('uploaded', ['SERVER_HASH_MISMATCH']);
    expect(state).toBe('hash_mismatch');
    expect(allowedEvents(state)).toEqual([]);
  });

  it('cần xử lý rồi được giải quyết thì quay lại hàng đợi', () => {
    expect(run('uploading', ['NEEDS_ATTENTION', 'ATTENTION_RESOLVED'])).toBe('queued');
  });

  it('tệp mất/hỏng không còn bản nào -> không thể khôi phục (trạng thái cuối)', () => {
    const state = run('needs_attention', ['MARK_UNRECOVERABLE']);
    expect(state).toBe('unrecoverable');
    expect(allowedEvents(state)).toEqual([]);
  });
});

describe('bao phủ và bất biến của bảng chuyển', () => {
  it('mọi trạng thái đều đạt được từ recording', () => {
    const reachable = new Set<FileState>(['recording']);
    const queue: FileState[] = ['recording'];
    while (queue.length > 0) {
      const s = queue.shift() as FileState;
      for (const type of allowedEvents(s)) {
        const r = transition(s, ev(type));
        if (r.ok && !reachable.has(r.state)) {
          reachable.add(r.state);
          queue.push(r.state);
        }
      }
    }
    expect([...reachable].sort()).toEqual([...ALL_FILE_STATES].sort());
  });

  it('verified và các trạng thái cuối không có lối ra', () => {
    expect(allowedEvents('verified')).toEqual([]);
    expect(allowedEvents('hash_mismatch')).toEqual([]);
    expect(allowedEvents('unrecoverable')).toEqual([]);
  });

  it('trạng thái lỗi được khai báo khớp docs/02 (5 trạng thái)', () => {
    expect([...ERROR_STATES].sort()).toEqual(
      [
        FILE_STATES.LOCAL_SAVE_FAILED,
        FILE_STATES.UPLOAD_FAILED,
        FILE_STATES.HASH_MISMATCH,
        FILE_STATES.NEEDS_ATTENTION,
        FILE_STATES.UNRECOVERABLE,
      ].sort(),
    );
  });
});

describe('giải phóng bản cục bộ (bất biến #4)', () => {
  it('chỉ verified mới đủ điều kiện cần; uploaded/hash_mismatch/mọi trạng thái khác thì không', () => {
    for (const state of ALL_FILE_STATES) {
      expect(isLocalCopyReleasable(state)).toBe(state === 'verified');
    }
  });
});
