import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { toneColors, type IconTone } from './tone';
import { useTheme } from './theme';

export type IconTileSize = 'sm' | 'md' | 'lg';

interface IconTileProps {
  icon: IconName;
  /** Mặc định `brand`. Tông chỉ trang trí: nghĩa luôn có chữ đi kèm ở nơi dùng. */
  tone?: IconTone;
  /** `sm` 28, `md` 44 (mặc định), `lg` 52 (token `component.tile`). */
  size?: IconTileSize;
  /** `square` bo góc (mặc định); `circle` cho biểu tượng trong hộp thoại/thẻ trạng thái. */
  shape?: 'square' | 'circle';
  testID?: string;
}

const GLYPH_SIZE: Record<IconTileSize, number> = { sm: 16, md: 22, lg: 26 };

/**
 * Ô vuông (hoặc tròn) chứa một biểu tượng, nền nhạt theo tông. Trang trí: ẩn khỏi trình đọc màn
 * hình vì chữ liền kề đã nêu nghĩa. Kích thước cố định theo token (không phải chữ nên không co giãn).
 */
export function IconTile({
  icon,
  tone = 'brand',
  size = 'md',
  shape = 'square',
  testID,
}: IconTileProps) {
  const { tokens } = useTheme();
  const colors = toneColors(tokens, tone);
  const side = tokens.component.tile[size];
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: side,
          height: side,
          backgroundColor: colors.bg,
          borderRadius: shape === 'circle' ? tokens.radius.full : tokens.radius.md,
        },
      ]}
    >
      <Icon name={icon} size={GLYPH_SIZE[size]} color={colors.fg} />
    </View>
  );
}

const styles = StyleSheet.create({ tile: { alignItems: 'center', justifyContent: 'center' } });
