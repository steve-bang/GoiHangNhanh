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

/**
 * Tăng/giảm số lượng bằng chạm, không bắt gõ. Một ô liền "- 2 +" (hai nút ở hai đầu, giá trị giữa,
 * chung một viền bo góc; mockup 03). Mỗi nút cao/rộng >= vùng chạm tối thiểu; nút trừ mờ khi đạt tối
 * thiểu.
 */
export function QuantityStepper({ value, onChange, min = 1 }: QuantityStepperProps) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const touch = getMinTouchTarget();
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
          backgroundColor: colors.brandSoft,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} color={colors.brand} />
    </Pressable>
  );
  return (
    <View
      testID="quantity-stepper"
      style={[
        styles.box,
        { borderColor: colors.brand, borderRadius: radius.md, backgroundColor: colors.surface },
      ]}
    >
      {button('remove', t('common:actions.decrease'), value - 1, value <= min)}
      <Text variant="formButton" accessibilityLiveRegion="polite" style={styles.value}>
        {String(value)}
      </Text>
      {button('add', t('common:actions.increase'), value + 1, false)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    overflow: 'hidden',
  },
  button: { alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 48, textAlign: 'center' },
});
