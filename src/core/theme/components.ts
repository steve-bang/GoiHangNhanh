import { borderWidthScale, elevationScale } from './primitives';

/**
 * Tầng 3 - quy tắc riêng của thành phần, chỉ khi không suy ra được từ semantic (docs/design-token-spec.md
 * mục 4.6). Không tạo token cho card/textField/orderCard/badge: chúng chỉ ghép semantic.
 * Vùng chạm tối thiểu KHÔNG ở đây: lấy từ `@/platform` (`getMinTouchTarget`).
 */
export const components = {
  button: {
    /** Cao tối thiểu nút chính: lớn hơn vùng chạm để bấm một tay. */
    minHeight: { primary: 56, compact: 50 },
    borderWidth: { regular: borderWidthScale.strong, slim: borderWidthScale.thin },
  },
  /** Ô nhập/tìm kiếm: cao tối thiểu, lớn hơn vùng chạm để gõ một tay. */
  field: { minHeight: 52 },
  /** Ô vuông chứa biểu tượng/ảnh nhỏ (avatar, thumbnail dòng sản phẩm, lối tắt tròn). */
  tile: { sm: 28, md: 44, lg: 52, xl: 56 },
  actionCard: { minHeight: 88 },
  stepper: { valueMinWidth: 48 },
  scanFrame: { cornerRadius: 14 },
  record: {
    stopOuter: 84,
    stopInner: 68,
    stopRing: borderWidthScale.ring,
    stopAreaMinHeight: 88,
    dot: 10,
    /** Nút phụ trên khung quay (đèn pin): tối thiểu 48 để bấm khi cầm máy. */
    controlMin: 48,
  },
  tabBar: {
    scanButton: {
      size: 62,
      lift: 18,
      ring: borderWidthScale.ring,
      elevation: elevationScale.floating,
    },
  },
} as const;

export type Components = typeof components;
