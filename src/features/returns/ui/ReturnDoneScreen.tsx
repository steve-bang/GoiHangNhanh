import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { formatDeviceDateTime } from '@/features/orders';
import { useAppNavigation, useRouteParams } from '@/platform';
import { Button, Card, Icon, Screen, StatusBadge, Text, useTheme } from '@/shared/ui';

import { hasOpeningEvidenceLimit, type ReturnDetails } from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { ReturnSummaryCards } from './ReturnSummaryCards';
import { resumeRoute } from './return-routes';
import { useLinkedOrderCode } from './use-linked-order';
import { useReturnCase } from './use-return-case';

/**
 * UI-D07 Hoàn tất tiếp nhận / xem hồ sơ đã xác nhận (đặc tả B07-B08). Nói đúng: kiểm kê đã ghi nhận trên
 * máy này, chưa phải kết luận về nguyên nhân hay bên chịu trách nhiệm. Hồ sơ chưa liên kết có lối "Liên
 * kết đơn gốc" (ghi vào lịch sử, không ghi đè quan hệ cũ). Không tự mở tranh chấp. Hồ sơ chưa xác nhận mở
 * màn này thì chuyển về đúng bước đang dở.
 */
export function ReturnDoneScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D07" state={state} onRetry={reload} />;
  }
  return <DoneBody details={state.details} />;
}

function DoneBody({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { returnCase } = details;
  const orderCode = useLinkedOrderCode(returnCase.sourceOrderId);
  const redirect = returnCase.status === 'confirmed' ? null : resumeRoute(returnCase.status);
  useEffect(() => {
    if (redirect) navigation.replace(redirect, { returnId: returnCase.id });
  }, [redirect, navigation, returnCase.id]);

  return (
    <Screen
      form
      title={t('nav:titles.UI-D07')}
      onBack={() => navigation.reset(ROUTES.returns)}
      testID="screen-UI-D07"
      footer={
        <>
          <Button
            testID="return-back-to-list"
            label={t('returns:done.backToList')}
            onPress={() => navigation.reset(ROUTES.returns)}
          />
          <Button
            testID="return-receive-another"
            variant="secondary"
            label={t('returns:done.another')}
            onPress={() => navigation.replace(ROUTES.returnFindOrder)}
          />
        </>
      }
    >
      <Card compact testID="return-done-banner">
        <View style={{ gap: tokens.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
            <Icon name="check-circle" size={tokens.icon.lg} color={tokens.color.brand.primary} />
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('returns:done.title')}
            </Text>
          </View>
          <Text variant="formBody" color="inkMuted">
            {t('returns:done.message')}
          </Text>
          {hasOpeningEvidenceLimit(returnCase) ? (
            <View style={{ alignSelf: 'flex-start' }} testID="return-done-limited">
              <StatusBadge label={t('returns:review.limitedBadge')} tone="warning" icon="alert" />
            </View>
          ) : null}
          <Text variant="caption" color="textMuted">
            {`${returnCase.code} · ${
              returnCase.confirmedAtDevice !== null
                ? t('returns:done.confirmedAt', {
                    time: formatDeviceDateTime(returnCase.confirmedAtDevice),
                  })
                : ''
            }`}
          </Text>
        </View>
      </Card>
      <ReturnSummaryCards details={details} orderCode={orderCode} />
      {returnCase.sourceOrderId === null ? (
        <View style={{ gap: tokens.space.xs }}>
          <Button
            testID="return-link-later"
            variant="secondary"
            label={t('returns:done.linkLater')}
            onPress={() => navigation.push(ROUTES.returnFindOrder, { returnId: returnCase.id })}
          />
          <Text variant="caption" color="textMuted">
            {t('returns:done.linkLaterHint')}
          </Text>
        </View>
      ) : null}
      <Card compact testID="return-history">
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="formButton" accessibilityRole="header">
            {t('returns:done.history')}
          </Text>
          {details.events.map((event) => (
            <View key={event.id} style={{ gap: tokens.space.xxs }} testID="return-history-item">
              <Text variant="formBody">{t(`returns:done.events.${event.kind}`)}</Text>
              <Text variant="caption" color="textMuted">
                {formatDeviceDateTime(event.atDevice)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Screen>
  );
}
