import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface QuickActionProps {
  label: string;
  icon: IconName;
  onPress: () => void;
  testID?: string;
}

/** Lối tắt tròn kèm nhãn bên dưới (hàng 4 lối tắt ở Trang chủ). */
export function QuickAction({ label, icon, onPress, testID }: QuickActionProps) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.item, { minHeight: getMinTouchTarget() }]}
    >
      <View style={[styles.disc, { backgroundColor: tokens.color.brand.soft }]}>
        <Icon name={icon} size={26} color={tokens.color.brand.primary} />
      </View>
      <Text variant="caption" style={styles.label} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: layout.space.tight },
  disc: {
    width: layout.component.tile.xl,
    height: layout.component.tile.xl,
    borderRadius: layout.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { textAlign: 'center' },
});
