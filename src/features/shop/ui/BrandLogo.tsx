import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Text, useTheme } from '@/shared/ui';

/**
 * Hàng logo: khiên trong ô vuông bo góc + tên "Đơn chứng". Hình dựng bằng biểu tượng sẵn có; khi
 * có logo thật, thay NỘI DUNG của `BrandMark` (hoặc cả tệp) tại đây, màn hình không phải sửa.
 */
export function BrandMark({ size = 48 }: { size?: number }) {
  const { colors, radius } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: radius.md, backgroundColor: colors.brand },
      ]}
    >
      <Icon name="brand-shield-check" size={size * 0.62} color={colors.onBrand} />
    </View>
  );
}

/** Logo xếp dọc ở màn Đăng nhập: khiên, tên, dòng khẩu hiệu nhỏ, căn giữa. */
export function StackedBrandLogo({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View testID="stacked-brand-logo" style={styles.stacked}>
      <Icon name="brand-shield-check" size={compact ? 40 : 46} color={colors.brand} />
      <Text
        accessibilityRole="header"
        bold
        style={[styles.stackedName, { color: colors.brandDark }]}
      >
        {t('screens:signIn.brandName')}
      </Text>
      <Text variant="caption" style={{ color: colors.inkMuted, textAlign: 'center' }}>
        {t('screens:signIn.brandTagline')}
      </Text>
    </View>
  );
}

export function BrandLogo() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  return (
    <View style={[styles.row, { gap: spacing.md }]}>
      <BrandMark />
      <Text accessibilityRole="header" style={[styles.name, { color: colors.brandDark }]} bold>
        {t('screens:welcome.brandName')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, lineHeight: 30 },
  stacked: { alignItems: 'center', gap: 2 },
  stackedName: { fontSize: 24, lineHeight: 30 },
});
