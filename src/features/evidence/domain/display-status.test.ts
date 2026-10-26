import { EVIDENCE_STATUS_PRESENTATION } from '@/core/theme';

import { toDisplayStatus } from './display-status';
import { ALL_FILE_STATES } from './file-state';

describe('toDisplayStatus (docs/09 mục 3)', () => {
  it('hai pha ghi hình dùng trạng thái riêng của màn quay', () => {
    expect(toDisplayStatus('recording')).toEqual({ kind: 'capture', phase: 'recording' });
    expect(toDisplayStatus('saving_local')).toEqual({ kind: 'capture', phase: 'saving_local' });
  });

  it('queued: không có lý do chờ -> Đã lưu trên máy; có lý do -> Chờ tải lên', () => {
    expect(toDisplayStatus('queued')).toEqual({ kind: 'label', label: 'saved_on_device' });
    expect(toDisplayStatus('queued', { waitingReason: 'offline' })).toEqual({
      kind: 'label',
      label: 'waiting_upload',
    });
  });

  it('uploaded và verified là hai nhãn khác nhau', () => {
    expect(toDisplayStatus('uploaded')).toEqual({ kind: 'label', label: 'uploaded' });
    expect(toDisplayStatus('verified')).toEqual({ kind: 'label', label: 'verified' });
  });

  it('mọi trạng thái lỗi hiện nhãn Lỗi – cần xử lý, kể cả cách ly mã băm', () => {
    for (const s of [
      'local_save_failed',
      'upload_failed',
      'hash_mismatch',
      'needs_attention',
      'unrecoverable',
    ] as const) {
      expect(toDisplayStatus(s)).toEqual({ kind: 'label', label: 'error' });
    }
  });

  it('nhãn "verified" chỉ xuất hiện cho trạng thái verified', () => {
    for (const s of ALL_FILE_STATES) {
      const d = toDisplayStatus(s, { waitingReason: 'offline' });
      const isVerifiedLabel = d.kind === 'label' && d.label === 'verified';
      expect(isVerifiedLabel).toBe(s === 'verified');
    }
  });

  it('mọi nhãn trả về đều có presentation', () => {
    for (const s of ALL_FILE_STATES) {
      const d = toDisplayStatus(s);
      if (d.kind === 'label') expect(EVIDENCE_STATUS_PRESENTATION[d.label]).toBeDefined();
    }
  });
});
