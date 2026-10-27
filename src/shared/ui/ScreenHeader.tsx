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
  /** Tiêu đề nhỏ (17sp, nửa đậm) cho nhóm màn form/quy trình; vẫn xuống dòng khi chữ lớn. */
  compact?: boolean;
}

/**
 * Thanh tiêu đề dùng chung (thay header gốc của navigator để iOS/Android giống nhau và tràn viền
 * đúng). Tiêu đề xuống dòng được khi chữ lớn; không cố định chiều cao.
 */
export function ScreenHeader({
  title,
  onBack,
  trailing,
  tone = 'default',
  compact = false,
}: ScreenHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  const color = tone === 'camera' ? tokens.color.camera.onCamera : tokens.color.text.primary;
  return (
    <View
      style={[
        styles.row,
        {
          paddingHorizontal: compact ? tokens.space.md : tokens.space.lg,
          paddingVertical: tokens.space.sm,
          gap: compact ? tokens.space.xs : tokens.space.sm,
        },
      ]}
    >
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.back')}
          onPress={onBack}
          style={[styles.side, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="back" size={compact ? 24 : 26} color={color} />
        </Pressable>
      ) : null}
      <Text variant={compact ? 'formTitle' : 'screenTitle'} style={[styles.title, { color }]}>
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
