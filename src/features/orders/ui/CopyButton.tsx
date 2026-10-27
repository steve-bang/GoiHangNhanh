import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Text, useTheme } from '@/shared/ui';

/** Nút "Sao chép" cạnh mã đơn/mã vận đơn (Xác nhận đơn, Chi tiết đơn). `label` là nhãn đọc màn hình. */
export function CopyButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[
        styles.button,
        {
          minHeight: getMinTouchTarget(),
          backgroundColor: colors.brandSoft,
          borderRadius: radius.lg,
        },
      ]}
    >
      <Text variant="formLabel" style={{ color: colors.brand }}>
        {t('screens:preview.copy')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
});
