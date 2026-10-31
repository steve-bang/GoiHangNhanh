import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { layout } from '@/core/theme';
import { Icon, Text, useTheme } from '@/shared/ui';

/**
 * Hàng logo: khiên trong ô vuông bo góc + tên "Đơn chứng". Hình dựng bằng biểu tượng sẵn có; khi
 * có logo thật, thay NỘI DUNG của `BrandMark` (hoặc cả tệp) tại đây, màn hình không phải sửa.
 * Màu nhận diện là đồ họa (`brand.primary`); tên thương hiệu là chữ đậm `brand.deep`.
 */
export function BrandMark({ size = layout.component.tile.lg }: { size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.brand.primary,
        },
      ]}
    >
      <Icon name="brand-shield-check" size={size * 0.62} color={tokens.color.text.onAction} />
    </View>
  );
}

/** Logo xếp dọc ở màn Đăng nhập: khiên, tên, dòng khẩu hiệu nhỏ, căn giữa. */
export function StackedBrandLogo({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View testID="stacked-brand-logo" style={styles.stacked}>
      <Icon name="brand-shield-check" size={compact ? 40 : 46} color={tokens.color.brand.primary} />
      <Text
        variant="screenTitle"
        accessibilityRole="header"
        bold
        style={{ color: tokens.color.brand.deep }}
      >
        {t('screens:signIn.brandName')}
      </Text>
      <Text variant="caption" style={[styles.center, { color: tokens.color.text.subtle }]}>
        {t('screens:signIn.brandTagline')}
      </Text>
    </View>
  );
}

export function BrandLogo() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View style={[styles.row, { gap: tokens.space.md }]}>
      <BrandMark />
      <Text
        variant="screenTitle"
        accessibilityRole="header"
        style={{ color: tokens.color.brand.deep }}
        bold
      >
        {t('screens:welcome.brandName')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
  stacked: { alignItems: 'center', gap: layout.space.xxs },
  center: { textAlign: 'center' },
});
