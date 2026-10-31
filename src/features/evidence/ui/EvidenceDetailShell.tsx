import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { EmptyState, ErrorState, Screen, SkeletonCard, Text, useTheme } from '@/shared/ui';

/** Trạng thái chưa sẵn sàng của một màn UI-E04 (đóng gói, hàng hoàn, tranh chấp). */
export type EvidenceDetailPending = 'loading' | 'notFound' | 'error';

export interface EvidenceDetailShellProps {
  /** Tiêu đề màn (route gốc UI-E04 hoặc route con). */
  readonly title: string;
  /** Route nằm trong nhóm tab (chừa chỗ thanh tab). */
  readonly inTabs: boolean;
  /** `undefined` = đã sẵn sàng, hiện `children`. */
  readonly pending?: EvidenceDetailPending;
  /** Câu dưới "Không tìm thấy bằng chứng này." (theo nơi mở: đơn hay hồ sơ). */
  readonly notFoundMessage: string;
  readonly onRetry?: () => void;
  /** testID của màn: `screen-UI-E04` (route gốc) hoặc `screen-UI-E04-<đoạn cuối>` (route con). */
  readonly testID?: string;
  readonly children?: ReactNode;
}

/**
 * Khung chung của UI-E04 (V1-17, V1-17b): một `Screen` với tiêu đề + Quay lại, hiện đang mở / "Không tìm
 * thấy bằng chứng này." / lỗi đọc, hoặc nội dung đã nạp. Không tìm thấy dùng chung cho ID lạ, shop khác và
 * tệp không thuộc đơn/hồ sơ trên đường dẫn (không lộ thông tin của tệp, bất biến 8).
 */
export function EvidenceDetailShell({
  title,
  inTabs,
  pending,
  notFoundMessage,
  onRetry,
  testID = 'screen-UI-E04',
  children,
}: EvidenceDetailShellProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  return (
    <Screen
      form
      contentGap={tokens.space.md}
      title={title}
      onBack={navigation.back}
      inTabs={inTabs}
      testID={testID}
    >
      {pending === 'loading' ? (
        <>
          <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
            {t('evidence:detail.loading')}
          </Text>
          <SkeletonCard />
        </>
      ) : pending === 'notFound' ? (
        <View testID="evidence-detail-not-found">
          <EmptyState
            compact
            iconCircle
            title={t('evidence:detail.notFoundTitle')}
            message={notFoundMessage}
            actionLabel={t('evidence:detail.back')}
            onAction={navigation.back}
          />
        </View>
      ) : pending === 'error' ? (
        <ErrorState
          variant="card"
          testID="evidence-detail-error"
          title={t('evidence:detail.loadError')}
          retryLabel={t('common:actions.retry')}
          {...(onRetry ? { onRetry } : {})}
        />
      ) : (
        children
      )}
    </Screen>
  );
}
