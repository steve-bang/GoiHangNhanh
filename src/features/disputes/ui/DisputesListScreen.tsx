import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { formatDeviceDateTime } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Screen,
  SkeletonCard,
  StatusBadge,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

import type { DisputeStatus, DisputeSummary } from '../domain';
import { useDisputeList } from './use-dispute-list';

type Filter = 'all' | DisputeStatus;
const FILTERS: readonly Filter[] = ['all', 'open', 'closed'];

/**
 * UI-G01 Danh sách tranh chấp. Dữ liệu thật từ kho cục bộ. Không tự kết luận kết quả tranh chấp: chỉ
 * nêu trạng thái hồ sơ (đang mở/đã đóng), số bằng chứng đã chọn và nhãn "Hạn chế bằng chứng" của hồ sơ
 * hoàn đi kèm (docs/05 B07).
 */
export function DisputesListScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { state, reload } = useDisputeList();
  const [filter, setFilter] = useState<Filter>('all');

  const options: ChipOption<Filter>[] = FILTERS.map((key) => ({
    key,
    label:
      key === 'all'
        ? t('disputes:list.filterAll')
        : t(`disputes:list.filter${key === 'open' ? 'Open' : 'Closed'}`),
  }));
  const visible = useMemo(
    () =>
      state.kind === 'ready'
        ? state.items.filter((i) => filter === 'all' || i.dispute.status === filter)
        : [],
    [state, filter],
  );
  const create = () => navigation.push(ROUTES.disputeNew);

  const body = (() => {
    if (state.kind === 'loading') {
      return (
        <View style={{ gap: tokens.space.md }} testID="disputes-loading">
          <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
            {t('disputes:common.loading')}
          </Text>
          <SkeletonCard />
        </View>
      );
    }
    if (state.kind === 'error') {
      return (
        <ErrorState
          variant="card"
          testID="disputes-error"
          title={t('disputes:list.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      );
    }
    if (state.items.length === 0) {
      return (
        <View testID="disputes-empty">
          <EmptyState
            icon="shield-check"
            iconCircle
            title={t('disputes:list.emptyTitle')}
            message={t('disputes:list.emptyMessage')}
            actionLabel={t('disputes:list.create')}
            actionVariant="primary"
            onAction={create}
          />
        </View>
      );
    }
    if (visible.length === 0) {
      return (
        <View testID="disputes-no-results">
          <EmptyState
            compact
            iconCircle
            icon="search"
            title={t('disputes:list.noResultsTitle')}
            message={t('disputes:list.noResultsMessage')}
            actionLabel={t('disputes:list.clearFilters')}
            onAction={() => setFilter('all')}
          />
        </View>
      );
    }
    return (
      <View style={{ gap: tokens.space.md }}>
        {visible.map((item) => (
          <DisputeRow
            key={item.dispute.id}
            item={item}
            onPress={() => navigation.push(ROUTES.disputeDetail, { disputeId: item.dispute.id })}
          />
        ))}
        <Text variant="caption" color="textMuted" testID="disputes-local-only">
          {t('disputes:common.localOnly')}
        </Text>
      </View>
    );
  })();

  return (
    <Screen
      title={t('nav:titles.UI-G01')}
      onBack={navigation.back}
      testID="screen-UI-G01"
      footer={
        <Button
          testID="disputes-create"
          label={t('disputes:list.create')}
          icon="add"
          onPress={create}
        />
      }
    >
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} size="compact" />
      {body}
    </Screen>
  );
}

function DisputeRow({ item, onPress }: { item: DisputeSummary; onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { dispute } = item;
  const subject = t(`disputes:subject.${dispute.subject.kind}`, { code: dispute.subject.label });
  const status = t(`disputes:status.${dispute.status}`);
  const limited = dispute.subject.kind === 'return' && dispute.subject.openingEvidenceLimit;
  return (
    <Card
      testID={`dispute-row-${dispute.id}`}
      onPress={onPress}
      accessibilityLabel={`${dispute.code}. ${status}. ${subject}`}
    >
      <View style={{ gap: tokens.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
          <Text variant="cardTitle" style={{ flex: 1, flexShrink: 1 }}>
            {dispute.code}
          </Text>
          <StatusBadge label={status} tone={dispute.status === 'open' ? 'info' : 'neutral'} />
        </View>
        <Text variant="formBody">{subject}</Text>
        <Text variant="formBody" color="textMuted">
          {t(`disputes:issue.${dispute.issueType}`)}
        </Text>
        <Text variant="caption" color="textMuted">
          {item.evidenceCount > 0
            ? t('disputes:list.evidenceCount', { count: item.evidenceCount })
            : t('disputes:list.noEvidence')}
          {' · '}
          {t('disputes:list.createdAt', { time: formatDeviceDateTime(dispute.createdAtDevice) })}
        </Text>
        {limited ? (
          <View style={{ alignSelf: 'flex-start' }} testID={`dispute-limited-${dispute.id}`}>
            <StatusBadge label={t('disputes:common.limited')} tone="warning" icon="alert" />
          </View>
        ) : null}
      </View>
    </Card>
  );
}
