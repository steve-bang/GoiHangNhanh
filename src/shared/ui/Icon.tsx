// Import trực tiếp từng bộ icon để bundle chỉ chứa font Ionicons (import gốc kéo theo mọi bộ font).
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { StatusIconName } from '@/core/theme';

import { useTheme } from './theme';

type GlyphName = ComponentProps<typeof Ionicons>['name'];

/**
 * Tên biểu tượng trừu tượng của ứng dụng -> glyph Ionicons. Đổi bộ icon chỉ sửa bảng này.
 * Biểu tượng trạng thái bằng chứng (StatusIconName, core/theme) nằm chung bảng: mỗi nhãn một glyph
 * riêng; `device-saved` KHÔNG được là dấu tick/đã xong (docs/09 mục 5.5, A.2).
 */
export const ICON_GLYPHS = {
  // trạng thái bằng chứng (docs/09 mục 3)
  'device-saved': 'phone-portrait-outline',
  clock: 'time-outline',
  'cloud-upload': 'cloud-upload-outline',
  'cloud-done': 'cloud-done-outline',
  'shield-check': 'shield-checkmark-outline',
  'alert-triangle': 'warning-outline',
  // điều hướng và hành động
  home: 'home-outline',
  orders: 'list-outline',
  returns: 'arrow-undo-outline',
  sync: 'sync-outline',
  user: 'person-circle-outline',
  back: 'chevron-back',
  close: 'close',
  forward: 'chevron-forward',
  help: 'help-circle-outline',
  search: 'search-outline',
  add: 'add',
  remove: 'remove',
  package: 'cube-outline',
  scan: 'scan-outline',
  keyboard: 'keypad-outline',
  flashlight: 'flashlight-outline',
  camera: 'videocam-outline',
  stop: 'stop',
  'wifi-off': 'cloud-offline-outline',
  info: 'information-circle-outline',
  inbox: 'file-tray-outline',
  // đăng nhập mạng xã hội và hình thương hiệu (màn Chào mừng)
  apple: 'logo-apple',
  google: 'logo-google',
  'brand-shield': 'shield',
  'brand-shield-check': 'shield-checkmark',
  check: 'checkmark',
  leaf: 'leaf',
  'package-solid': 'cube',
  // màn thiết lập tài khoản/shop (UI-A03, A04, A06)
  'arrow-back': 'arrow-back',
  mail: 'mail-outline',
  lock: 'lock-closed-outline',
  eye: 'eye-outline',
  'eye-off': 'eye-off-outline',
  'play-circle': 'play-circle',
  bag: 'bag-handle',
  music: 'musical-notes',
  heart: 'heart',
  store: 'storefront',
  ellipsis: 'ellipsis-horizontal',
  clipboard: 'clipboard',
  // màn đăng nhập và đặt lại mật khẩu (UI-A03 đăng nhập, UI-A07..A09)
  'lock-solid': 'lock-closed',
  phone: 'phone-portrait-outline',
  bulb: 'bulb',
  send: 'paper-plane',
  sparkle: 'sparkles',
  'check-circle': 'checkmark-circle',
} as const satisfies Record<string, GlyphName>;

export type IconName = keyof typeof ICON_GLYPHS;

/** Kiểm tra lúc biên dịch: mọi tên biểu tượng trạng thái bằng chứng đều có glyph. */
const _statusIconsCovered: Record<StatusIconName, GlyphName> = ICON_GLYPHS;
void _statusIconsCovered;

interface IconProps {
  name: IconName;
  size?: number;
  /** Màu tuyệt đối (ví dụ màu tab bar do navigator truyền). Mặc định: màu chữ. */
  color?: string;
}

/** Biểu tượng trang trí: bị ẩn khỏi trình đọc màn hình; nghĩa luôn có chữ đi kèm. */
export function Icon({ name, size = 22, color }: IconProps) {
  const theme = useTheme();
  return (
    <Ionicons
      name={ICON_GLYPHS[name]}
      size={size}
      color={color ?? theme.colors.text}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
