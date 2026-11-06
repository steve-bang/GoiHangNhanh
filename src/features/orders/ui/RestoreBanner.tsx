import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Card, Icon, Text, useTheme } from '@/shared/ui';

import { useRestoreController, useRestoreStatus } from '../data/RestoreProvider';
import { isRestoreVisible, type RestoreStatus } from '../data/restore-status';

/** Thẻ "đã lấy lại" hiện ngắn rồi tự ẩn. */
const DONE_VISIBLE_MS = 6_000;

/**
 * Thẻ tiến độ khôi phục dữ liệu sau khi cài lại/đổi máy (Trang chủ và Đơn hàng). Nói đúng việc đang làm
 * bằng lời đơn giản, không dọa, không hứa quá: chỉ phần đã lên máy chủ được lấy lại. Máy đã đủ dữ liệu thì
 * không hiện gì. Có mạng lại là app tự chạy tiếp; chỉ khi lỗi khác (không phải mạng) mới có nút Thử lại.
 */
export function RestoreBanner({ testID = 'restore-banner' }: { testID?: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const status = useRestoreStatus();
  const controller = useRestoreController();
  // Thẻ "đã lấy lại" ẩn sau ít giây: nhớ đúng đối tượng trạng thái đã hết hạn (trạng thái mới thì hiện lại).
  const [expired, setExpired] = useState<RestoreStatus | null>(null);
  useEffect(() => {
    if (status.kind !== 'done') return undefined;
    const timer = setTimeout(() => setExpired(status), DONE_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [status]);

  if (!isRestoreVisible(status) || expired === status) return null;

  const view = (() => {
    switch (status.kind) {
      case 'waiting_network':
        return {
          tone: 'warning' as const,
          title: t('screens:restore.waitingTitle'),
          message: t('screens:restore.waitingMessage'),
        };
      case 'failed':
        return {
          tone: 'warning' as const,
          title: t('screens:restore.failedTitle'),
          message: t('screens:restore.failedMessage'),
        };
      case 'done':
        return {
          tone: 'brand' as const,
          title: t('screens:restore.doneTitle', { count: status.orders }),
          message: t('screens:restore.doneMessage'),
        };
      default:
        return {
          tone: 'brand' as const,
          title: t('screens:restore.runningTitle'),
          message:
            status.kind === 'running' && status.orders > 0
              ? t('screens:restore.runningCount', { count: status.orders })
              : t('screens:restore.runningMessage'),
        };
    }
  })();

  return (
    <Card compact tone={view.tone} testID={testID}>
      <View style={{ gap: tokens.space.md }}>
        <View
          accessible
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}
        >
          {status.kind === 'running' ? (
            <ActivityIndicator color={tokens.color.brand.primary} />
          ) : (
            <Icon
              name={
                status.kind === 'done'
                  ? 'cloud-done'
                  : status.kind === 'waiting_network'
                    ? 'wifi-off'
                    : 'alert-triangle'
              }
              size={tokens.icon.md}
              color={tokens.color.brand.primary}
            />
          )}
          <View style={{ flexShrink: 1, flexGrow: 1, gap: tokens.space.xs }}>
            <Text variant="formBody" bold>
              {view.title}
            </Text>
            <Text variant="caption" color="inkMuted">
              {view.message}
            </Text>
          </View>
        </View>
        {status.kind === 'failed' && controller ? (
          <Button
            size="slim"
            variant="secondary"
            testID={`${testID}-retry`}
            label={t('screens:restore.retry')}
            onPress={controller.retry}
          />
        ) : null}
      </View>
    </Card>
  );
}
