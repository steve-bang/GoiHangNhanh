import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { layout } from '@/core/theme';

interface OfflineBannerProps {
  visible: boolean;
}

/**
 * Banner nhỏ ngoại tuyến (UI-F04). Nói đúng: bằng chứng sẽ được đồng bộ khi có mạng; không nói đã
 * sao lưu. Màu cam + biểu tượng + chữ (không dùng đỏ vì không phải lỗi mất dữ liệu).
 */
export function OfflineBanner({ visible }: OfflineBannerProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (!visible) return null;
  return (
    <View
      accessible
      accessibilityRole="alert"
      style={[
        styles.row,
        {
          backgroundColor: tokens.status.offline.bg,
          paddingHorizontal: tokens.space.lg,
          paddingVertical: tokens.space.sm,
        },
      ]}
    >
      <Icon name="wifi-off" size={18} color={tokens.status.offline.fg} />
      <Text variant="caption" bold style={{ color: tokens.status.offline.fg, flexShrink: 1 }}>
        {t('common:offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
});
