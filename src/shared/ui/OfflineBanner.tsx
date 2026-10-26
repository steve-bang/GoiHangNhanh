import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface OfflineBannerProps {
  visible: boolean;
}

/**
 * Banner nhỏ ngoại tuyến (UI-F04). Nói đúng: bằng chứng sẽ được đồng bộ khi có mạng; không nói đã
 * sao lưu. Màu cam + biểu tượng + chữ (không dùng đỏ vì không phải lỗi mất dữ liệu).
 */
export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  if (!visible) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        styles.row,
        {
          backgroundColor: colors.warningSoft,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
        },
      ]}
    >
      <Icon name="wifi-off" size={18} color={colors.warning} />
      <Text variant="caption" bold style={{ color: colors.warning, flexShrink: 1 }}>
        {t('common:offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
