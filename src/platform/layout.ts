import { Platform } from 'react-native';

import { MIN_TOUCH_TARGET } from '@/core/theme';

/**
 * Khác biệt bố cục iOS/Android nằm ở đây (docs/engineering/platform-support.md, D-12); màn hình
 * và component không gọi `Platform.OS` trực tiếp.
 */

/** Vùng chạm tối thiểu: 44pt (iOS) / 48dp (Android) - docs/09 mục 3. Đọc lúc gọi để test được. */
export function getMinTouchTarget(): number {
  return Platform.OS === 'ios' ? MIN_TOUCH_TARGET.ios : MIN_TOUCH_TARGET.android;
}

/**
 * Cách `KeyboardAvoidingView` đẩy nội dung (kể cả nút chính ghim đáy) lên khỏi bàn phím.
 * CHƯA kiểm chứng trên thiết bị: Android tràn viền (edge-to-edge) có thể đã tự co cửa sổ khi hiện
 * bàn phím; nếu thấy khoảng trống thừa trên Android thì đổi giá trị Android về `undefined`.
 */
export function getKeyboardAvoidingBehavior(): 'padding' | 'height' | undefined {
  return 'padding';
}
