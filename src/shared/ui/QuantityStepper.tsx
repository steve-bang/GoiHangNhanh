import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Số lượng tối thiểu; mặc định 1 (docs/09 mục 5.5, A.8: số lượng mặc định là 1). */
  min?: number;
}

/** Tăng/giảm số lượng bằng chạm, không bắt gõ. */
export function QuantityStepper({ value, onChange, min = 1 }: QuantityStepperProps) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const touch = Math.max(getMinTouchTarget(), 48);
  const button = (icon: 'add' | 'remove', label: string, next: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={[
        styles.button,
        {
          width: touch,
          height: touch,
          borderColor: colors.brand,
          borderRadius: radius.md,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Icon name={icon} color={colors.brand} />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {button('remove', t('common:actions.decrease'), value - 1, value <= min)}
      <Text bold accessibilityLiveRegion="polite" style={styles.value}>
        {String(value)}
      </Text>
      {button('add', t('common:actions.increase'), value + 1, false)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  value: { minWidth: 40, textAlign: 'center' },
});
