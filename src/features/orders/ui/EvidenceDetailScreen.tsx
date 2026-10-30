import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { EvidenceId, OrderId } from '@/core/ids';
import { EvidenceDetailView, shortId, type EvidenceDetailRow } from '@/features/evidence';
import { useAppNavigation, useRouteParams } from '@/platform';
import { EmptyState, ErrorState, Screen, SkeletonCard, Text, useTheme } from '@/shared/ui';

import { formatDeviceDateTime, isSessionStatus } from '../domain';
import { useEvidenceDetail, type EvidenceDetailState } from './use-evidence-detail';

/**
 * UI-E04 Chi tiết bằng chứng (V1-17, Q-24a): mở MỘT tệp theo `evidenceId` trên đường dẫn của đơn, phát
 * video/hiện ảnh từ tệp trên máy này, chỉ đọc. Nội dung ở `EvidenceDetailView` (feature evidence); màn
 * này nạp dữ liệu, cô lập shop và dựng dòng liên kết đơn/kiện/phiên.
 */
export function EvidenceDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const { state, reload } = useEvidenceDetail(
    params.orderId as OrderId | undefined,
    params.evidenceId as EvidenceId | undefined,
  );
  const header = {
    form: true,
    contentGap: tokens.space.md,
    title: t('nav:titles.UI-E04'),
    onBack: navigation.back,
    inTabs: true,
    testID: 'screen-UI-E04',
  } as const;

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
          {t('evidence:detail.loading')}
        </Text>
        <SkeletonCard />
      </Screen>
    );
  }
  if (state.kind === 'notFound') {
    return (
      <Screen {...header}>
        <View testID="evidence-detail-not-found">
          <EmptyState
            compact
            iconCircle
            title={t('evidence:detail.notFoundTitle')}
            message={t('evidence:detail.notFound')}
            actionLabel={t('evidence:detail.back')}
            onAction={navigation.back}
          />
        </View>
      </Screen>
    );
  }
  if (state.kind === 'error') {
    return (
      <Screen {...header}>
        <ErrorState
          variant="card"
          testID="evidence-detail-error"
          title={t('evidence:detail.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      </Screen>
    );
  }
  return (
    <Screen {...header}>
      <EvidenceDetailView
        file={state.file}
        kindLabel={t(`screens:orderEvidence.kind.${state.file.group}.${state.file.kind}`)}
        capturedAtLabel={formatDeviceDateTime(state.file.createdAtDevice)}
        links={linkRows(state, t)}
      />
    </Screen>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** Dòng liên kết đơn/kiện/phiên, theo ID lưu trong bản ghi tệp (bất biến 2); thiếu thì "Chưa rõ", không đoán. */
function linkRows(
  state: Extract<EvidenceDetailState, { kind: 'ready' }>,
  t: Translate,
): EvidenceDetailRow[] {
  const { session, packageIndex, orderCode } = state;
  const status =
    session && isSessionStatus(session.sessionStatus)
      ? t(`evidence:detail.sessionStatus.${session.sessionStatus}`)
      : t('evidence:detail.unknown');
  return [
    { key: 'order', label: t('evidence:detail.info.order'), value: orderCode },
    {
      key: 'package',
      label: t('evidence:detail.info.package'),
      value:
        packageIndex === null
          ? t('evidence:detail.unknown')
          : t('evidence:detail.packageValue', { index: packageIndex }),
    },
    {
      key: 'session',
      label: t('evidence:detail.info.session'),
      value: session
        ? t('evidence:detail.sessionValue', {
            status,
            time: formatDeviceDateTime(session.startedAtDevice),
            id: shortId(session.id),
          })
        : t('evidence:detail.unknown'),
    },
  ];
}
