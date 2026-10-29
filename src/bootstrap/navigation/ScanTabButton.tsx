import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Icon, useTheme } from '@/shared/ui';
import { layout } from '@/core/theme';

/** Đường kính nút Quét giữa thanh tab; nút nhô lên khỏi thanh theo mẫu thiết kế. */
const { size: SCAN_BUTTON_SIZE, lift: SCAN_BUTTON_LIFT } = layout.component.tabBar.scanButton;

type Props = Pick<ComponentProps<typeof Pressable>, 'onPress' | 'testID'> & { label: string };

/**
 * Nút tròn giữa thanh tab (mẫu thiết kế): không phải tab, chỉ mở màn quét. Nhãn "Quét mã đơn hàng" có thật cho
 * trình đọc màn hình (mẫu thiết kế không in chữ dưới nút).
 */
export function ScanTabButton({ onPress, testID, label }: Props) {
  const { tokens } = useTheme();
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
            backgroundColor: tokens.color.brand.primary,
            borderColor: tokens.color.surface.raised,
            minWidth: Math.max(SCAN_BUTTON_SIZE, getMinTouchTarget()),
            opacity: pressed ? layout.opacity.pressed : 1,
          },
        ]}
      >
        <Icon name="scan-solid" size={30} color={tokens.color.text.onAction} />
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
    borderWidth: layout.component.tabBar.scanButton.ring,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -SCAN_BUTTON_LIFT,
    ...layout.component.tabBar.scanButton.elevation,
  },
});
