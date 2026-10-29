import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toCodeKey, formatDeviceDateTime } from '@/features/orders';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Screen,
  SearchField,
  SkeletonCard,
  StatusBadge,
  Text,
  useTheme,
  type ChipOption,
  type StatusBadgeTone,
} from '@/shared/ui';

import {
  matchesFilter,
  stageOf,
  type ReturnFilter,
  type ReturnStage,
  type ReturnSummary,
} from '../domain';
import { resumeRoute } from './return-routes';
import { useReturnList, type LinkedOrderInfo } from './use-return-list';

const FILTERS: readonly ReturnFilter[] = [
  'all',
  'receiving',
  'opening',
  'checking',
  'discrepancy',
  'confirmed',
  'unlinked',
];

/** Tông nhãn giai đoạn. `success` chỉ dành cho việc máy chủ đã xác nhận nên hồ sơ "đã xác nhận" (nghiệp vụ) dùng trung tính. */
const STAGE_TONE: Record<ReturnStage, StatusBadgeTone> = {
  receiving: 'info',
  opening: 'info',
  checking: 'info',
  discrepancy: 'warning',
  confirmed: 'neutral',
};

function matchesQuery(
  summary: ReturnSummary,
  orders: ReadonlyMap<string, LinkedOrderInfo>,
  queryKey: string,
): boolean {
  if (queryKey === '') return true;
  const { code, observedCode, sourceOrderId } = summary.returnCase;
  const linked = sourceOrderId ? orders.get(sourceOrderId) : undefined;
  return [code, observedCode ?? '', linked?.orderCode ?? '', linked?.trackingCode ?? ''].some((v) =>
    toCodeKey(v).includes(queryKey),
  );
}

/**
 * UI-D01 Danh sách hàng hoàn (đặc tả B01). Dữ liệu thật từ kho cục bộ của shop hiện tại: tìm theo mã
 * hồ sơ, mã đơn gốc, mã vận đơn; lọc theo giai đoạn; chạm một hồ sơ để TIẾP TỤC đúng bước (hồ sơ dở dang
 * không mất sau khi đóng app). Hồ sơ không có đơn gốc hiện "Chưa liên kết đơn gốc" (không tự ghép,
 * CLAUDE.md #5). Hồ sơ hiện chỉ lưu trên máy này: nói rõ ở cuối màn (không hứa đã đồng bộ).
 */
export function ReturnsListScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { state, reload } = useReturnList();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ReturnFilter>('all');

  const options: ChipOption<ReturnFilter>[] = FILTERS.map((key) => ({
    key,
    label:
      key === 'all'
        ? t('returns:list.filterAll')
        : key === 'unlinked'
          ? t('returns:list.filterUnlinked')
          : t(`returns:stage.${key}`),
  }));
  const queryKey = toCodeKey(query);
  const visible = useMemo(
    () =>
      state.kind === 'ready'
        ? state.items.filter(
            (item) => matchesFilter(item, filter) && matchesQuery(item, state.orders, queryKey),
          )
        : [],
    [state, filter, queryKey],
  );
  const receive = () => navigation.push(ROUTES.returnFindOrder);
  const filtered = filter !== 'all' || queryKey !== '';

  const body = (() => {
    if (state.kind === 'loading') {
      return (
        <View style={{ gap: tokens.space.md }} testID="returns-loading">
          <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
            {t('returns:list.loading')}
          </Text>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      );
    }
    if (state.kind === 'error') {
      return (
        <ErrorState
          variant="card"
          testID="returns-error"
          title={t('returns:list.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      );
    }
    if (state.items.length === 0) {
      return (
        <View testID="returns-empty">
          <EmptyState
            icon="returns"
            iconCircle
            title={t('returns:list.emptyTitle')}
            message={t('returns:list.emptyMessage')}
            actionLabel={t('returns:list.receive')}
            actionVariant="primary"
            onAction={receive}
          />
        </View>
      );
    }
    if (visible.length === 0 && filtered) {
      return (
        <View testID="returns-no-results">
          <EmptyState
            compact
            iconCircle
            icon="search"
            title={t('returns:list.noResultsTitle')}
            message={t('returns:list.noResultsMessage')}
            actionLabel={t('returns:list.clearFilters')}
            onAction={() => {
              setQuery('');
              setFilter('all');
            }}
          />
        </View>
      );
    }
    return (
      <View style={{ gap: tokens.space.md }}>
        {visible.map((item) => (
          <ReturnRow
            key={item.returnCase.id}
            item={item}
            orderCode={
              item.returnCase.sourceOrderId
                ? state.orders.get(item.returnCase.sourceOrderId)?.orderCode
                : undefined
            }
            onPress={() =>
              navigation.push(resumeRoute(item.returnCase.status), {
                returnId: item.returnCase.id,
              })
            }
          />
        ))}
        <Text variant="caption" color="textMuted" testID="returns-local-only">
          {t('returns:list.localOnly')}
        </Text>
      </View>
    );
  })();

  return (
    <Screen
      title={t('nav:titles.UI-D01')}
      onBack={navigation.back}
      testID="screen-UI-D01"
      footer={
        <Button
          testID="returns-receive"
          label={t('returns:list.receive')}
          icon="add"
          onPress={receive}
        />
      }
    >
      <SearchField
        testID="returns-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('returns:list.search')}
      />
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} size="compact" />
      {body}
    </Screen>
  );
}

function ReturnRow({
  item,
  orderCode,
  onPress,
}: {
  item: ReturnSummary;
  orderCode: string | undefined;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { returnCase } = item;
  const stage = stageOf(item);
  const stageLabel = t(`returns:stage.${stage}`);
  const linkLine = returnCase.sourceOrderId
    ? t('returns:list.linkedOrder', { code: orderCode ?? '…' })
    : t('returns:list.unlinked');
  const showNoVideo = returnCase.status === 'checking' || returnCase.status === 'confirmed';
  return (
    <Card
      testID={`return-row-${returnCase.id}`}
      onPress={onPress}
      accessibilityLabel={`${returnCase.code}. ${stageLabel}. ${linkLine}`}
    >
      <View style={{ gap: tokens.space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
          <Text variant="cardTitle" style={{ flex: 1, flexShrink: 1 }}>
            {returnCase.code}
          </Text>
          <StatusBadge label={stageLabel} tone={STAGE_TONE[stage]} />
        </View>
        <Text variant="formBody" color="textMuted">
          {linkLine}
        </Text>
        <Text variant="caption" color="textMuted">
          {t('returns:list.createdAt', { time: formatDeviceDateTime(returnCase.createdAtDevice) })}
        </Text>
        {item.discrepancyCount > 0 ? (
          <Text variant="caption" bold style={{ color: tokens.status.interrupted.fg }}>
            {t('returns:list.discrepancies', { count: item.discrepancyCount })}
          </Text>
        ) : null}
        {showNoVideo && returnCase.openingVideo !== null ? (
          <Text variant="caption" color="textMuted">
            {t('returns:list.noVideo')}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
