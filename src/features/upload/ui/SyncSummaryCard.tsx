import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, IconTile, Text, useTheme } from '@/shared/ui';

interface SyncSummaryCardProps {
  /** Số tệp ở nhóm Lỗi (kể cả tệp của tài khoản khác). */
  errorCount: number;
  /** Số tệp đang tải + chờ tải. */
  waitingCount: number;
  /**
   * Mọi tệp lỗi đều còn trên máy (không có lỗi mất/hỏng tệp). Chỉ khi đúng mới được nói "Tệp vẫn ở trên
   * máy" (bất biến 11: không trấn an sai).
   */
  stillOnDevice: boolean;
  /** Số tệp lỗi đủ điều kiện Thử lại (R-3); từ 2 trở lên mới có nút "Thử lại tất cả". */
  retryableCount: number;
  retrying: boolean;
  onRetryAll: () => void;
  /** Lối đi khi cả màn rỗng (chỉ hiện ở biến thể "không có việc"). */
  emptyAction?: { label: string; onPress: () => void } | undefined;
}

/**
 * Khối trạng thái tổng ở đầu UI-F01: ba biến thể theo mức nghiêm trọng (có lỗi / đang chờ / không có việc).
 * Chỉ nêu SỐ TỆP thật: không phần trăm, không thanh tiến độ, không chữ "an toàn"/"đầy đủ". Nút chính duy
 * nhất của màn chỉ xuất hiện khi có lỗi thử lại được. Vùng đọc lại tự động (live region) khi số đổi.
 */
export function SyncSummaryCard({
  errorCount,
  waitingCount,
  stillOnDevice,
  retryableCount,
  retrying,
  onRetryAll,
  emptyAction,
}: SyncSummaryCardProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const hasError = errorCount > 0;
  const title = hasError
    ? t('screens:sync.summary.errorTitle', { count: errorCount })
    : waitingCount > 0
      ? t('screens:sync.summary.waiting', { count: waitingCount })
      : t('screens:sync.summary.none');
  // Dòng phụ chỉ có khi đang có lỗi: số tệp đang chờ (nếu có) và nơi tệp đang nằm (nếu đúng sự thật).
  const detail = hasError
    ? [
        waitingCount > 0 ? t('screens:sync.summary.waiting', { count: waitingCount }) : null,
        stillOnDevice ? t('screens:sync.summary.onDevice') : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return (
    <Card tone={hasError ? 'warning' : 'default'} testID="sync-summary-card">
      <View style={{ gap: tokens.space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
          <IconTile
            icon={hasError ? 'alert' : waitingCount > 0 ? 'sync' : 'inbox'}
            tone={hasError ? 'warning' : 'neutral'}
            shape="circle"
          />
          <View
            accessibilityLiveRegion="polite"
            style={{ flex: 1, flexShrink: 1, gap: tokens.space.xs }}
          >
            <Text variant="sectionTitle" testID="sync-summary">
              {title}
            </Text>
            {detail ? (
              <Text variant="formBody" color="textMuted" testID="sync-summary-detail">
                {detail}
              </Text>
            ) : null}
          </View>
        </View>
        {hasError && retryableCount > 1 ? (
          <Button
            label={t('screens:sync.retryAll', { count: retryableCount })}
            onPress={onRetryAll}
            disabled={retrying}
            loading={retrying}
            testID="sync-retry-all"
          />
        ) : null}
        {!hasError && waitingCount === 0 && emptyAction ? (
          <Button
            variant="secondary"
            label={emptyAction.label}
            onPress={emptyAction.onPress}
            testID="sync-empty-action"
          />
        ) : null}
      </View>
    </Card>
  );
}
