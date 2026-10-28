import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  IconTile,
  Screen,
  SkeletonCard,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import {
  canRecordNow,
  formatDeviceDateTime,
  isSessionActive,
  summarizeOrderEvidence,
  summarizePackEvidence,
  type OrderEvidenceItem,
  type PackingSession,
} from '../domain';
import { OrderEvidenceBadge } from './OrderEvidenceBadge';
import { useOrderDetail } from './use-order-detail';
import { useRecordOrder } from './use-record-order';

type Group = OrderEvidenceItem['group'];

/**
 * UI-E03 Bằng chứng của đơn (ORD-12). Dữ liệu từ `loadEvidenceItems` (hôm nay LUÔN rỗng: chưa có
 * kho tệp bằng chứng), nên hôm nay chỉ có nhánh trống. Mỗi mục hiện nhãn theo trạng thái TỆP
 * (`summarizeOrderEvidence` + `OrderEvidenceBadge`, docs/09 mục 3): "đã tải lên/đã xác minh" chỉ hiện
 * khi trạng thái ấy do cơ chế thật (máy chủ) xác nhận. Màn KHÔNG tự tải lên lại: tệp lỗi chỉ trỏ tới
 * trung tâm đồng bộ (UI-F01). Mở bằng ID nội bộ của đơn; đơn thuộc shop khác = không tìm thấy.
 */
export function OrderEvidenceScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const { state, reload } = useOrderDetail(params.orderId as OrderId | undefined);
  const [group, setGroup] = useState<Group>('pack');
  const header = {
    form: true,
    contentGap: tokens.space.md,
    title: t('nav:titles.UI-E03'),
    onBack: navigation.back,
    inTabs: true,
    testID: 'screen-UI-E03',
  } as const;

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
          {t('screens:orderEvidence.loading')}
        </Text>
        <SkeletonCard />
      </Screen>
    );
  }
  if (state.kind === 'notFound') {
    return (
      <Screen {...header}>
        <View testID="order-evidence-not-found">
          <EmptyState
            compact
            iconCircle
            title={t('screens:orderDetail.notFoundTitle')}
            message={t('screens:orderDetail.notFound')}
            actionLabel={t('screens:orderDetail.backToList')}
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
          testID="order-evidence-error"
          title={t('screens:orderEvidence.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      </Screen>
    );
  }
  return (
    <EvidenceReady
      header={header}
      group={group}
      onGroup={setGroup}
      order={state.details.order}
      sessions={state.sessions}
      items={state.items}
    />
  );
}

interface EvidenceHeader {
  readonly form: true;
  readonly contentGap: number;
  readonly title: string;
  readonly onBack: () => void;
  readonly inTabs: true;
  readonly testID: string;
}

function EvidenceReady({
  header,
  group,
  onGroup,
  order,
  sessions,
  items,
}: {
  header: EvidenceHeader;
  group: Group;
  onGroup: (g: Group) => void;
  order: { id: OrderId; orderCode: string };
  sessions: readonly PackingSession[];
  items: readonly OrderEvidenceItem[];
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const activeSession = sessions.find(isSessionActive) ?? null;
  const { start, recordNow } = useRecordOrder(order.id, activeSession);
  const packItems = items.filter((i) => i.group === 'pack');
  const returnItems = items.filter((i) => i.group === 'return');
  const shown = group === 'pack' ? packItems : returnItems;
  const options: ChipOption<Group>[] = [
    { key: 'pack', label: t('screens:orderEvidence.groupPack', { count: packItems.length }) },
    { key: 'return', label: t('screens:orderEvidence.groupReturn', { count: returnItems.length }) },
  ];
  const record = canRecordNow(summarizePackEvidence(items));

  return (
    <Screen
      {...header}
      footer={
        <>
          {start.error ? (
            <Card compact tone="danger" testID="order-evidence-start-error">
              <Text variant="formBody" accessibilityRole="alert">
                {t(`errors:${start.error}`)}
              </Text>
            </Card>
          ) : null}
          {record ? (
            <Button
              size="compact"
              testID="order-evidence-record"
              label={t('screens:orderEvidence.recordPack')}
              loading={start.busy}
              onPress={recordNow}
            />
          ) : null}
        </>
      }
    >
      <Text
        variant="formBody"
        color="inkMuted"
        numberOfLines={1}
        ellipsizeMode="middle"
        testID="order-evidence-code"
      >
        {order.orderCode}
      </Text>
      <FilterChips
        size="compact"
        appearance="solid"
        options={options}
        selectedKey={group}
        onSelect={onGroup}
      />
      {shown.length === 0 ? (
        <View testID="order-evidence-empty">
          {group === 'pack' ? (
            <EmptyState
              compact
              iconCircle
              icon="camera"
              title={t('screens:orderEvidence.emptyTitle')}
              message={t('screens:orderEvidence.emptyMessage')}
            />
          ) : (
            <EmptyState
              compact
              iconCircle
              icon="package"
              title={t('screens:orderEvidence.emptyReturnTitle')}
              message={t('screens:orderEvidence.emptyReturnMessage')}
            />
          )}
        </View>
      ) : (
        <View style={{ gap: tokens.space.sm }}>
          {shown.map((item) => (
            <EvidenceRow
              key={item.id}
              item={item}
              onOpenSync={() => navigation.push(ROUTES.sync)}
            />
          ))}
        </View>
      )}
      {start.permissionSheet}
    </Screen>
  );
}

function EvidenceRow({ item, onOpenSync }: { item: OrderEvidenceItem; onOpenSync: () => void }) {
  const { t } = useTranslation();
  const summary = summarizeOrderEvidence([item.state]);
  const failed = summary.kind === 'label' && summary.label === 'error';
  return (
    <Card compact testID={`evidence-item-${item.id}`}>
      <View style={styles.row}>
        <IconTile icon={item.kind === 'video' ? 'camera' : 'package'} tone="neutral" />
        <View style={styles.flex}>
          <Text variant="formButton" color="ink">
            {t(`screens:orderEvidence.kind.${item.group}.${item.kind}`)}
          </Text>
          <Text variant="caption" color="textMuted">
            {t('screens:orderEvidence.capturedAt', {
              time: formatDeviceDateTime(item.capturedAtDevice),
            })}
          </Text>
          <OrderEvidenceBadge summary={summary} testID={`evidence-status-${item.id}`} />
        </View>
      </View>
      {failed ? (
        <View>
          <Text variant="formBody" color="ink">
            {t('screens:orderEvidence.errorHint')}
          </Text>
          <Button
            size="slim"
            variant="secondary"
            testID={`evidence-open-sync-${item.id}`}
            label={t('screens:orderEvidence.openSync')}
            onPress={onOpenSync}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
});
