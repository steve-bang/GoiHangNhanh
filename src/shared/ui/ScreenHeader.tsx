import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface ScreenHeaderProps {
  title: string;
  /** Có `onBack` thì hiện nút quay lại (luôn có đường lui an toàn). Màn gốc của tab thì bỏ. */
  onBack?: () => void;
  /** Vùng bên phải, ví dụ nút menu tài khoản. */
  trailing?: ReactNode;
  tone?: 'default' | 'camera';
}

/**
 * Thanh tiêu đề dùng chung (thay header gốc của navigator để iOS/Android giống nhau và tràn viền
 * đúng). Tiêu đề xuống dòng được khi chữ lớn; không cố định chiều cao.
 */
export function ScreenHeader({ title, onBack, trailing, tone = 'default' }: ScreenHeaderProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const touch = getMinTouchTarget();
  const color = tone === 'camera' ? colors.onCamera : colors.text;
  return (
    <View
      style={[
        styles.row,
        { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
      ]}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.back')}
          onPress={onBack}
          style={[styles.side, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="back" size={26} color={color} />
        </Pressable>
      ) : null}
      <Text variant="screenTitle" style={[styles.title, { color }]}>
        {title}
      </Text>
      {trailing ? <View style={styles.side}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  side: { alignItems: 'center', justifyContent: 'center' },
});
