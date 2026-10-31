import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES, type UiCode } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { EmptyState, ErrorState, Screen, SkeletonCard, Text } from '@/shared/ui';

import type { DisputeState } from './use-dispute';

/** Trạng thái chưa sẵn sàng của màn cần một hồ sơ tranh chấp: đang mở, không thấy, hoặc lỗi đọc. */
export function DisputeLoadState({
  uiCode,
  state,
  onRetry,
}: {
  uiCode: UiCode;
  state: Exclude<DisputeState, { kind: 'ready' }>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen title={t(`nav:titles.${uiCode}`)} onBack={navigation.back} testID={`screen-${uiCode}`}>
      {state.kind === 'loading' ? (
        <>
          <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
            {t('disputes:common.loading')}
          </Text>
          <SkeletonCard />
        </>
      ) : state.kind === 'error' ? (
        <ErrorState
          variant="card"
          testID="dispute-load-error"
          title={t('errors:DISPUTE_SAVE_FAILED')}
          retryLabel={t('common:actions.retry')}
          onRetry={onRetry}
        />
      ) : (
        <View testID="dispute-missing">
          <EmptyState
            title={t('disputes:common.missing')}
            message={t('disputes:common.missingHint')}
            actionLabel={t('disputes:common.backToList')}
            onAction={() => navigation.reset(ROUTES.disputes)}
          />
        </View>
      )}
    </Screen>
  );
}
