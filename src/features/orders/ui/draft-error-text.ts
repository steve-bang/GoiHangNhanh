import type { TFunction } from 'i18next';

import {
  MAX_CODE_LENGTH,
  MAX_LINE_NAME_LENGTH,
  MAX_LINE_VARIANT_LENGTH,
  type DraftError,
} from '../domain';

/**
 * Ô nhập cho gõ/dán QUÁ trần một ký tự (`maxLength = trần + 1`, như ô mã đơn ở Hỗ trợ) để người dùng
 * thấy lời nhắc thay vì hệ điều hành cắt âm thầm mã quét/dán; domain từ chối khi vượt trần (V1-04).
 */
export const INPUT_LIMITS = {
  code: MAX_CODE_LENGTH + 1,
  tracking: MAX_CODE_LENGTH + 1,
  name: MAX_LINE_NAME_LENGTH + 1,
  variant: MAX_LINE_VARIANT_LENGTH + 1,
} as const;

type LineField = 'name' | 'variant' | 'quantity';

/** Lời nhắc của lỗi dòng `lineIndex` cho đúng ô; không có lỗi ở ô đó thì `undefined`. */
export function lineErrorText(
  t: TFunction,
  error: DraftError | { kind: string } | null,
  lineIndex: number,
  field: LineField,
): string | undefined {
  if (!error || !('lineIndex' in error) || error.lineIndex !== lineIndex) return undefined;
  switch (error.kind) {
    case 'name_required':
      return field === 'name' ? t('screens:quickOrder.nameRequired') : undefined;
    case 'name_too_long':
      return field === 'name'
        ? t('screens:quickOrder.nameTooLong', { max: MAX_LINE_NAME_LENGTH })
        : undefined;
    case 'variant_too_long':
      return field === 'variant'
        ? t('screens:quickOrder.variantTooLong', { max: MAX_LINE_VARIANT_LENGTH })
        : undefined;
    case 'invalid_quantity':
      return field === 'quantity' ? t('screens:quickOrder.quantityInvalid') : undefined;
    default:
      return undefined;
  }
}

/** Lời nhắc cho ô mã vận đơn. */
export function trackingErrorText(
  t: TFunction,
  error: DraftError | { kind: string } | null,
): string | undefined {
  return error?.kind === 'invalid_tracking_code'
    ? t('screens:quickOrder.trackingInvalid', { max: MAX_CODE_LENGTH })
    : undefined;
}
