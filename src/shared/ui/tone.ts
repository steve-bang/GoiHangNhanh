import type { Theme } from './theme';

/**
 * Tông màu điểm nhấn của ô icon/hộp thoại (board 07). Chỉ là tông trang trí đi kèm chữ; KHÔNG phải
 * trạng thái bằng chứng (đó là việc của `EvidenceStatusBadge` và `semantic.status`). `success` chỉ
 * dành cho việc máy chủ đã xác nhận; `danger` chỉ cho lỗi/phá hủy.
 */
export type IconTone = 'brand' | 'blue' | 'warning' | 'success' | 'danger' | 'neutral';

export interface ToneColors {
  readonly fg: string;
  readonly bg: string;
}

export function toneColors(tokens: Theme['tokens'], tone: IconTone): ToneColors {
  const { feedback, accent } = tokens.color;
  switch (tone) {
    case 'brand':
      return { fg: tokens.color.action.primary, bg: tokens.color.brand.soft };
    case 'blue':
      return accent.blue;
    case 'warning':
      return feedback.warning;
    case 'success':
      return feedback.success;
    case 'danger':
      return feedback.danger;
    case 'neutral':
      return { fg: tokens.color.text.secondary, bg: tokens.color.surface.muted };
  }
}
