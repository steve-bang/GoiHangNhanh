import type { EvidenceStatusLabel } from '@/core/theme';
import { toDisplayStatus, type FileState } from '@/features/evidence';

/**
 * Trạng thái bằng chứng gộp ở MỨC ĐƠN để hiện trên thẻ danh sách:
 * - `none`: đơn chưa có video thật (không phải nhãn tệp; thẻ hiện "Chưa có video");
 * - `capture`: đang ghi/đang lưu trên thiết bị (hai pha ghi hình, không thuộc 6 nhãn; docs/09 mục 3);
 * - `label`: một trong 6 nhãn chuẩn docs/09 mục 3.
 */
export type OrderEvidenceSummary =
  | { readonly kind: 'none' }
  | { readonly kind: 'capture'; readonly phase: 'recording' | 'saving_local' }
  | { readonly kind: 'label'; readonly label: EvidenceStatusLabel };

/** Càng lớn càng "xấu"/càng cần chú ý; thẻ hiện trạng thái xấu nhất trong mọi tệp của đơn. */
const SEVERITY: Record<string, number> = {
  'label:error': 7,
  'capture:recording': 6,
  'capture:saving_local': 5,
  'label:uploading': 4,
  'label:waiting_upload': 3,
  'label:saved_on_device': 2,
  'label:uploaded': 1,
  'label:verified': 0,
};

/**
 * Gộp trạng thái các tệp bằng chứng của MỘT đơn (phạm vi toàn đơn) thành một trạng thái để hiện.
 * Ưu tiên xấu nhất trước: lỗi/cần xử lý > đang ghi > đang lưu > đang tải lên > chờ tải lên > đã lưu
 * trên máy > đã tải lên > đã xác minh. Vì vậy "Đã xác minh" chỉ hiện khi TẤT CẢ tệp đã xác minh, và
 * "Đã tải lên" không bao giờ che một tệp còn lỗi hay chưa tải. Danh sách rỗng = chưa có video.
 *
 * Đầu vào là trạng thái TỆP (không phải phiên): một phiên `created` chưa ghi tệp nào không phải
 * bằng chứng nên không được đưa vào đây (bất biến 3). Hàm thuần: không đọc dữ liệu.
 */
export function summarizeOrderEvidence(states: readonly FileState[]): OrderEvidenceSummary {
  let worst: OrderEvidenceSummary = { kind: 'none' };
  let worstRank = -1;
  for (const state of states) {
    const display = toDisplayStatus(state);
    const key = display.kind === 'capture' ? `capture:${display.phase}` : `label:${display.label}`;
    const rank = SEVERITY[key] ?? 0;
    if (rank > worstRank) {
      worstRank = rank;
      worst =
        display.kind === 'capture'
          ? { kind: 'capture', phase: display.phase }
          : { kind: 'label', label: display.label };
    }
  }
  return worst;
}

/** "Quay ngay" chỉ khi đơn chưa có video nào; đã có bằng chứng thì thẻ chỉ có "Xem chi tiết". */
export const canRecordNow = (summary: OrderEvidenceSummary): boolean => summary.kind === 'none';
