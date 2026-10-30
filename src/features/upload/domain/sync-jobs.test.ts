import type { ShopId } from '@/core/ids';
import {
  ALL_FILE_STATES,
  NON_RETRYABLE_ATTENTION_CODES,
  type FileState,
} from '@/features/evidence';

import {
  describeSyncJob,
  parseSyncJobKey,
  RECHECK_AFTER_MS,
  syncJobKey,
  userRetryEvent,
  type SyncJob,
} from './sync-jobs';

const NOW = 10_000_000;

function job(state: FileState, extra: Partial<SyncJob> = {}): SyncJob {
  return {
    key: syncJobKey('pack', 'e1'),
    id: 'e1',
    shopId: 'shop-1' as ShopId,
    kind: 'video',
    state,
    sizeBytes: 1000,
    attemptCount: 0,
    lastErrorCode: null,
    updatedAtDevice: NOW,
    createdAtDevice: NOW - 1000,
    record: { kind: 'pack', orderId: 'o1', orderCode: 'DH-1', packageIndex: 1 },
    uploader: 'current',
    ...extra,
  };
}

const online = { online: true, now: NOW };

describe('describeSyncJob: bộ lọc và nhãn theo trạng thái tệp thật', () => {
  it.each<[FileState, string, string]>([
    ['queued', 'waiting_upload', 'waiting_upload'],
    ['uploading', 'uploading', 'uploading'],
    ['upload_failed', 'error', 'error'],
    ['needs_attention', 'error', 'error'],
    ['hash_mismatch', 'error', 'error'],
    ['local_save_failed', 'error', 'error'],
    ['unrecoverable', 'error', 'error'],
    ['uploaded', 'uploaded', 'uploaded'],
    ['verified', 'uploaded', 'verified'],
  ])('%s -> bộ lọc %s, nhãn %s', (state, filter, label) => {
    expect(describeSyncJob(job(state), online)).toMatchObject({ filter, label });
  });

  it('đang ghi/đang lưu không phải việc đồng bộ', () => {
    expect(describeSyncJob(job('recording'), online)).toBeNull();
    expect(describeSyncJob(job('saving_local'), online)).toBeNull();
  });

  it('không bao giờ "Đã tải lên"/"Đã xác minh" khi máy chủ chưa xác lập', () => {
    for (const state of ALL_FILE_STATES) {
      const view = describeSyncJob(job(state), online);
      if (view && (view.label === 'uploaded' || view.label === 'verified')) {
        expect(['uploaded', 'verified']).toContain(state);
      }
      if (view?.filter === 'uploaded') expect(['uploaded', 'verified']).toContain(state);
    }
  });
});

describe('describeSyncJob: lý do và hành động', () => {
  it('chờ tải: lý do theo mạng', () => {
    expect(describeSyncJob(job('queued'), online)?.reason).toBe('queued');
    expect(describeSyncJob(job('queued'), { online: false, now: NOW })?.reason).toBe('offline');
  });

  it('tải lỗi: Thử lại; lý do phân biệt lỗi mạng và máy chủ', () => {
    expect(
      describeSyncJob(job('upload_failed', { lastErrorCode: 'TIMEOUT' }), online),
    ).toMatchObject({ reason: 'waitingNetwork', action: 'retry' });
    expect(
      describeSyncJob(job('upload_failed', { lastErrorCode: 'INTERNAL@3' }), online)?.reason,
    ).toBe('waitingNetwork');
    expect(
      describeSyncJob(job('upload_failed', { lastErrorCode: 'HTTP_403' }), online),
    ).toMatchObject({ reason: 'willRetry', action: 'retry' });
    expect(
      describeSyncJob(job('upload_failed', { lastErrorCode: 'HTTP_403' }), {
        online: false,
        now: NOW,
      })?.reason,
    ).toBe('offline');
  });

  it('cần xử lý do máy chủ từ chối: có Thử lại; đăng nhập hết hạn: Thử lại + lý do đăng nhập', () => {
    expect(
      describeSyncJob(job('needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }), online),
    ).toMatchObject({ reason: 'serverRejected', action: 'retry' });
    expect(
      describeSyncJob(job('needs_attention', { lastErrorCode: 'AUTH_REQUIRED' }), online),
    ).toMatchObject({ reason: 'signInAgain', action: 'retry' });
  });

  it.each([...NON_RETRYABLE_ATTENTION_CODES])('lỗi tệp cục bộ %s: không có nút Thử lại', (code) => {
    const view = describeSyncJob(job('needs_attention', { lastErrorCode: code }), online);
    expect(view?.action).toBeNull();
    expect(view?.reason).not.toBe('serverRejected');
  });

  it('UPLOAD_FILE_TOO_LARGE dùng câu của docs/04 A07', () => {
    expect(
      describeSyncJob(job('needs_attention', { lastErrorCode: 'UPLOAD_FILE_TOO_LARGE' }), online)
        ?.reason,
    ).toBe('tooLarge');
  });

  it('cần xử lý không rõ mã, lệch mã băm, không khôi phục được: không có nút', () => {
    expect(describeSyncJob(job('needs_attention'), online)).toMatchObject({
      reason: 'unknownAttention',
      action: null,
    });
    expect(describeSyncJob(job('hash_mismatch'), online)).toMatchObject({
      reason: 'hashMismatch',
      action: null,
    });
    expect(describeSyncJob(job('unrecoverable'), online)?.action).toBeNull();
  });

  it('đã tải lên: Kiểm tra lại chỉ sau 15 phút chưa xác minh', () => {
    const fresh = job('uploaded', { updatedAtDevice: NOW - RECHECK_AFTER_MS + 1 });
    expect(describeSyncJob(fresh, online)).toMatchObject({ reason: 'verifying', action: null });
    const stuck = job('uploaded', { updatedAtDevice: NOW - RECHECK_AFTER_MS });
    expect(describeSyncJob(stuck, online)).toMatchObject({
      reason: 'verifyStuck',
      action: 'recheck',
    });
    expect(describeSyncJob(job('verified', { updatedAtDevice: 0 }), online)?.action).toBeNull();
  });
});

describe('tệp do tài khoản khác tạo (V1-07)', () => {
  it.each(['other', 'unknown', 'case_owner'] as const)(
    '%s: nhóm riêng, không nút, không "Đang tải lên"',
    (uploader) => {
      for (const state of ['queued', 'uploading', 'upload_failed', 'needs_attention'] as const) {
        const view = describeSyncJob(job(state, { uploader, lastErrorCode: 'HTTP_403' }), online);
        expect(view?.foreign).toBe(uploader);
        expect(view?.action).toBeNull();
        expect(view?.label).not.toBe('uploading');
      }
    },
  );

  it('tệp tài khoản khác kẹt uploaded: không có Kiểm tra lại (máy chủ chỉ nhận từ người khai báo)', () => {
    const view = describeSyncJob(
      job('uploaded', { uploader: 'other', updatedAtDevice: 0 }),
      online,
    );
    expect(view).toMatchObject({ foreign: null, action: null, reason: 'verifying' });
  });
});

describe('userRetryEvent', () => {
  it('upload_failed: RETRY_UPLOAD, chỉ xóa giờ chờ', () => {
    expect(userRetryEvent('upload_failed')).toEqual({
      event: { type: 'RETRY_UPLOAD', origin: 'device' },
      patch: { nextAttemptAtDevice: null },
    });
  });

  it('needs_attention: USER_RETRY_ATTENTION, đặt lại lượt, GIỮ mã lỗi', () => {
    const step = userRetryEvent('needs_attention');
    expect(step?.event).toEqual({ type: 'USER_RETRY_ATTENTION', origin: 'device' });
    expect(step?.patch).toEqual({ attemptCount: 0, nextAttemptAtDevice: null });
    expect(step?.patch).not.toHaveProperty('lastErrorCode');
  });

  it('trạng thái khác: không có', () => {
    for (const state of ALL_FILE_STATES.filter(
      (s) => s !== 'upload_failed' && s !== 'needs_attention',
    )) {
      expect(userRetryEvent(state)).toBeNull();
    }
  });
});

describe('khóa route', () => {
  it('tách đúng nguồn và id; khóa lạ trả null', () => {
    expect(parseSyncJobKey('pack:e-1')).toEqual({ source: 'pack', id: 'e-1' });
    expect(parseSyncJobKey('return:m:2')).toEqual({ source: 'return', id: 'm:2' });
    expect(parseSyncJobKey('x:1')).toBeNull();
    expect(parseSyncJobKey(undefined)).toBeNull();
  });
});
