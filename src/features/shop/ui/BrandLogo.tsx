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
});
