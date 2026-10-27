import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Icon, useTheme } from '@/shared/ui';

/** Đường kính nút Quét giữa thanh tab; nút nhô lên khỏi thanh theo mẫu thiết kế. */
const SCAN_BUTTON_SIZE = 62;
const SCAN_BUTTON_LIFT = 18;

type Props = Pick<ComponentProps<typeof Pressable>, 'onPress' | 'testID'> & { label: string };

/**
 * Nút tròn giữa thanh tab (mẫu thiết kế): không phải tab, chỉ mở màn quét. Nhãn "Quét mã đơn hàng" có thật cho
 * trình đọc màn hình (mẫu thiết kế không in chữ dưới nút).
 */
export function ScanTabButton({ onPress, testID, label }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.slot}>
      <Pressable
        testID={testID ?? 'tab-scan'}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={t('nav:tabs.scanHint')}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: colors.brand,
            borderColor: colors.surface,
            minWidth: Math.max(SCAN_BUTTON_SIZE, getMinTouchTarget()),
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Icon name="scan-solid" size={30} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  button: {
    height: SCAN_BUTTON_SIZE,
    width: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -SCAN_BUTTON_LIFT,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
