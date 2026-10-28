import type { FileState } from '@/features/evidence';

import { hasPendingEvidence, summarizeSessionEvidence } from './session-evidence';

const of = (...states: FileState[]) => states.map((state) => ({ state }));

describe('summarizeSessionEvidence', () => {
  it('không có tệp: total 0, không nhãn', () => {
    expect(summarizeSessionEvidence([])).toEqual({
      total: 0,
      saved: 0,
      notSaved: 0,
      inProgress: 0,
      problem: null,
      label: null,
    });
  });

  it('lỗi LƯU cục bộ (local_save_failed, unrecoverable) không được tính là đã lưu', () => {
    const summary = summarizeSessionEvidence(of('local_save_failed', 'unrecoverable'));
    expect(summary).toMatchObject({ saved: 0, notSaved: 2, label: null });
  });

  it('lỗi TẢI LÊN: video vẫn tính là đã lưu trên máy, kèm vấn đề, nhãn lỗi', () => {
    expect(summarizeSessionEvidence(of('upload_failed'))).toMatchObject({
      saved: 1,
      notSaved: 0,
      problem: 'upload_failed',
      label: 'error',
    });
    expect(summarizeSessionEvidence(of('needs_attention')).problem).toBe('attention');
    expect(summarizeSessionEvidence(of('hash_mismatch')).problem).toBe('hash_mismatch');
  });

  it('xét mọi tệp, không chỉ tệp cuối: tệp lỗi lưu ở giữa không bị tệp tốt phía sau che', () => {
    const summary = summarizeSessionEvidence(of('local_save_failed', 'queued'));
    expect(summary).toMatchObject({ saved: 1, notSaved: 1, label: 'saved_on_device' });
  });

  it('vấn đề nặng nhất thắng; nhãn là của video đi chậm nhất', () => {
    expect(summarizeSessionEvidence(of('upload_failed', 'hash_mismatch')).problem).toBe(
      'hash_mismatch',
    );
    expect(summarizeSessionEvidence(of('verified', 'uploading', 'uploaded')).label).toBe(
      'uploading',
    );
    expect(summarizeSessionEvidence(of('verified', 'queued')).label).toBe('saved_on_device');
    expect(summarizeSessionEvidence(of('verified', 'uploaded')).label).toBe('uploaded');
  });

  it('tệp đang ghi/lưu: inProgress, chưa có nhãn đã lưu', () => {
    expect(summarizeSessionEvidence(of('recording', 'saving_local'))).toMatchObject({
      inProgress: 2,
      saved: 0,
      label: null,
    });
  });
});

describe('hasPendingEvidence', () => {
  it('còn tệp đang tự đổi trạng thái (đang lưu, chờ/đang tải lên) thì còn chờ', () => {
    for (const s of ['recording', 'saving_local', 'queued', 'uploading', 'uploaded'] as const) {
      expect(hasPendingEvidence(of(s))).toBe(true);
    }
  });
  it('chỉ có tệp ở trạng thái cuối thì không còn chờ', () => {
    expect(hasPendingEvidence(of('verified', 'unrecoverable', 'local_save_failed'))).toBe(false);
    expect(hasPendingEvidence(of('upload_failed', 'needs_attention', 'hash_mismatch'))).toBe(false);
    expect(hasPendingEvidence([])).toBe(false);
  });
});
