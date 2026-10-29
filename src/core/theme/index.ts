import { components } from './components';
import { semantic } from './semantic';

export { colors } from './colors';
export type { ColorRole } from './colors';
export { typography, spacing, radius, MIN_TOUCH_TARGET } from './typography';
export { palette, space, fontWeight, iconSizeScale } from './primitives';
export { semantic, components };
export type { Semantic, StatusTokenKey } from './semantic';
export type { Components } from './components';
export { EVIDENCE_STATUS_PRESENTATION } from './evidence-status';
export type { EvidenceStatusLabel, StatusIconName, StatusPresentation } from './evidence-status';

/**
 * Token KHÔNG đổi theo sáng/tối (spacing, bo góc, viền, độ mờ, bóng, kích thước thành phần): dùng được
 * trong `StyleSheet.create` ở mức module. MÀU luôn qua `useTheme().tokens.color` (ESLint chặn
 * `semantic.color` tĩnh) để chế độ tối sau này không phải sửa từng component.
 */
export const layout = {
  space: semantic.space,
  radius: semantic.radius,
  icon: semantic.icon,
  borderWidth: semantic.borderWidth,
  opacity: semantic.opacity,
  elevation: semantic.elevation,
  component: components,
} as const;
