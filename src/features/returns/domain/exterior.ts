import type { ExteriorSign } from './types';

/** Thứ tự hiển thị các dấu hiệu bên ngoài (docs/05 B03). */
export const EXTERIOR_SIGNS: readonly ExteriorSign[] = [
  'intact',
  'dented',
  'torn',
  'wet',
  'seal_abnormal',
  'label_unreadable',
  'other',
  'unknown',
];

const DAMAGE_SIGNS: readonly ExteriorSign[] = ['dented', 'torn', 'wet', 'seal_abnormal'];

/**
 * Bật/tắt một dấu hiệu. "Nguyên vẹn" loại trừ các dấu hiệu hư hỏng, "Chưa xác định" loại trừ mọi dấu
 * hiệu khác (không thể vừa nguyên vẹn vừa móp). Không có giá trị mặc định: danh sách bắt đầu rỗng
 * (docs/05 B03: không mặc định "nguyên vẹn").
 */
export function toggleExteriorSign(
  current: readonly ExteriorSign[],
  sign: ExteriorSign,
): ExteriorSign[] {
  if (current.includes(sign)) return current.filter((s) => s !== sign);
  if (sign === 'unknown') return ['unknown'];
  if (sign === 'intact') {
    return ['intact', ...current.filter((s) => s === 'label_unreadable' || s === 'other')];
  }
  const withoutConflicts = current.filter(
    (s) => s !== 'unknown' && !(isDamage(sign) && s === 'intact'),
  );
  return [...withoutConflicts, sign];
}

const isDamage = (sign: ExteriorSign) => DAMAGE_SIGNS.includes(sign);

/** Đã chọn ít nhất một dấu hiệu (kể cả "Chưa xác định"). Chưa chọn gì thì chưa xác nhận được. */
export function isExteriorChosen(signs: readonly ExteriorSign[]): boolean {
  return signs.length > 0;
}

/** Có dấu hiệu hư hỏng: nên chụp vị trí đó trước khi mở (docs/05 B03). */
export function hasDamageSign(signs: readonly ExteriorSign[]): boolean {
  return signs.some((s) => DAMAGE_SIGNS.includes(s));
}
