import type { DiscrepancyKind, LineCondition, ReceivedLine } from './types';

/**
 * So số lượng thực nhận với số dự kiến (bản sao từ đơn gốc). Chỉ phân loại để GỢI Ý ghi sai lệch,
 * không tự kết luận nguyên nhân hay bên chịu trách nhiệm (CLAUDE.md #5).
 * - `unentered`: chưa nhập số lượng thực nhận (không mặc định bằng dự kiến).
 * - `no_reference`: chưa có dữ liệu đối chiếu (hồ sơ chưa liên kết đơn, hoặc dòng ngoài dự kiến): KHÔNG
 *   được hiểu là dự kiến 0.
 */
export type LineComparison = 'unentered' | 'no_reference' | 'matched' | 'short' | 'excess';

export function compareLine(
  line: Pick<ReceivedLine, 'receivedQuantity' | 'expected'>,
): LineComparison {
  if (line.receivedQuantity === null) return 'unentered';
  if (line.expected === null) return 'no_reference';
  if (line.receivedQuantity === line.expected.quantity) return 'matched';
  return line.receivedQuantity < line.expected.quantity ? 'short' : 'excess';
}

const BY_COMPARISON: Partial<Record<LineComparison, DiscrepancyKind>> = {
  short: 'missing',
  excess: 'excess',
};
const BY_CONDITION: Partial<Record<LineCondition, DiscrepancyKind>> = {
  damaged: 'damaged',
  missing_accessory: 'missing_accessory',
  unknown: 'unknown',
};

/** Loại sai lệch nên gợi ý cho một dòng (rỗng nếu không có dấu hiệu khác thường). Người dùng chọn. */
export function suggestDiscrepancyKinds(
  line: Pick<ReceivedLine, 'receivedQuantity' | 'expected' | 'condition'>,
): DiscrepancyKind[] {
  const kinds: DiscrepancyKind[] = [];
  const byQuantity = BY_COMPARISON[compareLine(line)];
  if (byQuantity) kinds.push(byQuantity);
  const byCondition = line.condition ? BY_CONDITION[line.condition] : undefined;
  if (byCondition) kinds.push(byCondition);
  return kinds;
}

/** Dòng đã nhập đủ để kiểm kê: có tên và đã nhập số lượng thực nhận (kể cả 0). */
export function isLineComplete(line: Pick<ReceivedLine, 'name' | 'receivedQuantity'>): boolean {
  return line.name.trim() !== '' && line.receivedQuantity !== null;
}
