import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Text, useTheme } from '@/shared/ui';
import { layout } from '@/core/theme';

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
  const { tokens } = useTheme();
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
          backgroundColor: tokens.color.brand.soft,
          borderRadius: tokens.radius.lg,
        },
      ]}
    >
      <Text variant="formLabel" style={{ color: tokens.color.action.link }}>
        {t('screens:preview.copy')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.space.md },
});
