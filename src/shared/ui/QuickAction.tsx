import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

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
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.item, { minHeight: getMinTouchTarget() }]}
    >
      <View style={[styles.disc, { backgroundColor: colors.brandSoft }]}>
        <Icon name={icon} size={26} color={colors.brand} />
      </View>
      <Text variant="caption" style={styles.label} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', gap: 6 },
  disc: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  label: { textAlign: 'center' },
});
