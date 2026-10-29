import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES, type UiCode } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { EmptyState, ErrorState, Screen, SkeletonCard, Text } from '@/shared/ui';

import type { ReturnCaseState } from './use-return-case';

/**
 * Trạng thái chưa sẵn sàng của màn cần một hồ sơ: đang mở, không thấy hồ sơ (ID sai hoặc của shop
 * khác), hoặc lỗi đọc (có Thử lại). Mọi màn tiếp nhận dùng chung để hành vi nhất quán.
 */
export function ReturnLoadState({
  uiCode,
  state,
  onRetry,
}: {
  uiCode: UiCode;
  state: Exclude<ReturnCaseState, { kind: 'ready' }>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const toList = () => navigation.reset(ROUTES.returns);
  return (
    <Screen title={t(`nav:titles.${uiCode}`)} onBack={navigation.back} testID={`screen-${uiCode}`}>
      {state.kind === 'loading' ? (
        <>
          <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
            {t('returns:common.loading')}
          </Text>
          <SkeletonCard />
        </>
      ) : state.kind === 'error' ? (
        <ErrorState
          variant="card"
          testID="return-load-error"
          title={t('errors:RETURN_SAVE_FAILED')}
          retryLabel={t('common:actions.retry')}
          onRetry={onRetry}
        />
      ) : (
        <View testID="return-missing">
          <EmptyState
            title={t('returns:common.missing')}
            message={t('returns:common.missingHint')}
            actionLabel={t('returns:common.backToList')}
            onAction={toList}
          />
        </View>
      )}
    </Screen>
  );
}
