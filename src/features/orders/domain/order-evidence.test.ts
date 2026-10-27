import { ALL_FILE_STATES, FILE_STATES, type FileState } from '@/features/evidence';

import { canRecordNow, summarizeOrderEvidence } from './order-evidence';

const S = FILE_STATES;
const label = (l: string) => ({ kind: 'label', label: l });

describe('summarizeOrderEvidence (trạng thái bằng chứng mức đơn)', () => {
  it('không có tệp bằng chứng nào = Chưa có video', () => {
    expect(summarizeOrderEvidence([])).toEqual({ kind: 'none' });
  });

  it.each<[FileState, object]>([
    [S.RECORDING, { kind: 'capture', phase: 'recording' }],
    [S.SAVING_LOCAL, { kind: 'capture', phase: 'saving_local' }],
    [S.QUEUED, label('saved_on_device')],
    [S.UPLOADING, label('uploading')],
    [S.UPLOADED, label('uploaded')],
    [S.VERIFIED, label('verified')],
    [S.LOCAL_SAVE_FAILED, label('error')],
    [S.UPLOAD_FAILED, label('error')],
    [S.HASH_MISMATCH, label('error')],
    [S.NEEDS_ATTENTION, label('error')],
    [S.UNRECOVERABLE, label('error')],
  ])('một tệp ở trạng thái %s', (state, expected) => {
    expect(summarizeOrderEvidence([state])).toEqual(expected);
  });

  it('chỉ hiện Đã xác minh khi TẤT CẢ tệp đã xác minh', () => {
    expect(summarizeOrderEvidence([S.VERIFIED, S.VERIFIED])).toEqual(label('verified'));
    expect(summarizeOrderEvidence([S.VERIFIED, S.UPLOADED])).toEqual(label('uploaded'));
    expect(summarizeOrderEvidence([S.VERIFIED, S.QUEUED])).toEqual(label('saved_on_device'));
    expect(summarizeOrderEvidence([S.VERIFIED, S.UPLOADING])).toEqual(label('uploading'));
  });

  it('lỗi lẫn đã tải lên/đã xác minh: hiện lỗi, không che bằng nhãn tốt', () => {
    expect(summarizeOrderEvidence([S.UPLOADED, S.UPLOAD_FAILED])).toEqual(label('error'));
    expect(summarizeOrderEvidence([S.VERIFIED, S.HASH_MISMATCH, S.VERIFIED])).toEqual(
      label('error'),
    );
  });

  it('thứ tự ưu tiên: lỗi > đang ghi > đang lưu > đang tải lên > đã lưu trên máy > đã tải lên > đã xác minh', () => {
    const order: FileState[] = [
      S.UPLOAD_FAILED,
      S.RECORDING,
      S.SAVING_LOCAL,
      S.UPLOADING,
      S.QUEUED,
      S.UPLOADED,
      S.VERIFIED,
    ];
    for (let i = 0; i < order.length; i += 1) {
      const rest = order.slice(i);
      const expected = summarizeOrderEvidence([rest[0] as FileState]);
      // đảo thứ tự đầu vào không đổi kết quả
      expect(summarizeOrderEvidence(rest)).toEqual(expected);
      expect(summarizeOrderEvidence([...rest].reverse())).toEqual(expected);
    }
  });

  it('mọi cặp trạng thái tệp: kết quả không phụ thuộc thứ tự và không tốt hơn tệp xấu nhất', () => {
    for (const a of ALL_FILE_STATES) {
      for (const b of ALL_FILE_STATES) {
        expect(summarizeOrderEvidence([a, b])).toEqual(summarizeOrderEvidence([b, a]));
      }
    }
  });

  it('không bao giờ trả Đã tải lên/Đã xác minh nếu còn một tệp chưa tới đó', () => {
    for (const bad of ALL_FILE_STATES.filter((s) => s !== S.UPLOADED && s !== S.VERIFIED)) {
      const result = summarizeOrderEvidence([S.VERIFIED, S.UPLOADED, bad]);
      expect(result).not.toEqual(label('verified'));
      expect(result).not.toEqual(label('uploaded'));
    }
  });

  it('"Quay ngay" chỉ khi đơn chưa có video', () => {
    expect(canRecordNow(summarizeOrderEvidence([]))).toBe(true);
    for (const state of ALL_FILE_STATES) {
      expect(canRecordNow(summarizeOrderEvidence([state]))).toBe(false);
    }
  });
});
