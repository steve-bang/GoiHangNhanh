import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface ErrorStateProps {
  /** Điều gì xảy ra (một câu). */
  title: string;
  /** Ảnh hưởng/việc làm tiếp (tối đa một câu); bỏ trống nếu không cần. */
  message?: string;
  /** Có thì hiện nút thử lại; thử lại theo TỪNG KHU VỰC, không tải lại cả màn. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Đang thử lại: khóa nút, chống bấm đúp. */
  retrying?: boolean;
  /** `card`: nền thẻ lỗi (board 07), căn giữa trong thẻ bo góc, nút thử lại là nút chính. Mặc định `inline` như cũ. */
  variant?: 'inline' | 'card';
  testID?: string;
}

/**
 * Trạng thái lỗi cục bộ của một khu vực (hồ sơ, cửa hàng, gói...), độc lập với khu vực khác. Không
 * thay cho `EmptyState` (chưa có dữ liệu). Chữ do bên gọi lấy từ i18n theo mã lỗi (docs/09 mục 5.1).
 */
export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  retrying = false,
  variant = 'inline',
  testID,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      style={[
        styles.container,
        { gap: tokens.space.sm, padding: tokens.space.lg },
        variant === 'card'
          ? {
              backgroundColor: tokens.color.feedback.danger.bg,
              borderRadius: tokens.radius.md,
              padding: tokens.space.xl,
            }
          : null,
      ]}
    >
      <Icon name="alert" size={32} color={tokens.color.feedback.danger.fg} />
      <Text bold style={styles.centered}>
        {title}
      </Text>
      {message ? (
        <Text color="textMuted" style={styles.centered}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <Button
          label={retryLabel ?? t('common:actions.retry')}
          onPress={onRetry}
          variant={variant === 'card' ? 'primary' : 'secondary'}
          loading={retrying}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  centered: { textAlign: 'center' },
});
