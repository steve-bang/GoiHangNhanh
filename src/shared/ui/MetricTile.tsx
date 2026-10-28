import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { IconTile } from './IconTile';
import type { IconName } from './Icon';
import { Text } from './Text';
import type { IconTone } from './tone';
import { useTheme } from './theme';

interface MetricTileProps {
  label: string;
  /**
   * Giá trị đo được (số hoặc chữ như "Chưa có thông tin"). Bỏ trống thì chỉ có nhãn (khối tổng quan
   * chưa có số liệu): KHÔNG điền số giả.
   */
  value?: string | number;
  icon: IconName;
  tone?: IconTone;
  /** `stacked`: biểu tượng trên, nhãn dưới, căn giữa (3 ô cạnh nhau); `row`: biểu tượng, nhãn, giá trị cùng hàng. */
  layout?: 'stacked' | 'row';
  onPress?: () => void;
  testID?: string;
}

/**
 * Ô số liệu có biểu tượng (khối "Dữ liệu bằng chứng"). Khác `StatTile` (thẻ nền màu, số lớn của
 * Trang chủ): ô này phẳng, nằm trong một thẻ khác. Luôn có nhãn chữ; không chiều cao cố định.
 */
export function MetricTile({
  label,
  value,
  icon,
  tone = 'brand',
  layout = 'stacked',
  onPress,
  testID,
}: MetricTileProps) {
  const { tokens } = useTheme();
  const spoken = value === undefined ? label : `${label}: ${value}`;
  const stacked = layout === 'stacked';

  const content = (
    <>
      <IconTile icon={icon} tone={tone} />
      <View style={stacked ? styles.stackedText : styles.rowText}>
        <Text variant="caption" bold={!stacked} style={stacked ? styles.centered : undefined}>
          {label}
        </Text>
        {value !== undefined ? (
          <Text
            variant={typeof value === 'number' ? 'sectionTitle' : 'caption'}
            color={typeof value === 'number' ? 'text' : 'textMuted'}
            style={stacked ? styles.centered : undefined}
          >
            {String(value)}
          </Text>
        ) : null}
      </View>
    </>
  );

  const base = {
    gap: tokens.space.sm,
    padding: tokens.space.sm,
    flexDirection: stacked ? 'column' : 'row',
    alignItems: 'center',
  } as const;

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={spoken}
        style={[base, stacked ? styles.flexible : null]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [
        base,
        stacked ? styles.flexible : null,
        { minHeight: getMinTouchTarget(), opacity: pressed ? tokens.opacity.pressed : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flexible: { flex: 1 },
  stackedText: { alignItems: 'center' },
  rowText: { flex: 1 },
  centered: { textAlign: 'center' },
});
