import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { EVIDENCE_STATUS_PRESENTATION, type EvidenceStatusLabel } from '@/core/theme';
import { AccountMenuButton } from '@/features/shop';
import { useAppNavigation } from '@/platform';
import { ILLUSTRATIVE_ORDERS } from '@/shared/fixtures/illustrative-data';
import {
  EmptyState,
  FilterChips,
  OrderCard,
  Screen,
  SearchField,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

type StatusFilter = 'all' | EvidenceStatusLabel;

const STATUS_ORDER = Object.keys(EVIDENCE_STATUS_PRESENTATION) as EvidenceStatusLabel[];

/**
 * UI-E01 Danh sách đơn. Tìm theo mã đơn/vận đơn; lọc theo trạng thái bằng chứng dùng đúng 6 nhãn
 * docs/09 mục 3. Thẻ chỉ: mã, nguồn bán, ngày, số video (không nhồi trường). Lọc nguồn bán và thời
 * gian của đặc tả chưa làm. Lọc/tìm ở đây chạy trên dữ liệu minh họa cục bộ.
 */
export function OrdersListScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  const options: ChipOption<StatusFilter>[] = [
    { key: 'all', label: t('screens:orders.filterAll') },
    ...STATUS_ORDER.map((key) => ({ key, label: t(EVIDENCE_STATUS_PRESENTATION[key].labelKey) })),
  ];
  const needle = query.trim().toLowerCase();
  const visible = ILLUSTRATIVE_ORDERS.filter(
    (order) =>
      (filter === 'all' || order.status === filter) &&
      (needle === '' ||
        order.orderCode.toLowerCase().includes(needle) ||
        (order.trackingCode ?? '').toLowerCase().includes(needle)),
  );

  return (
    <Screen
      title={t('nav:titles.UI-E01')}
      headerRight={<AccountMenuButton />}
      inTabs
      illustrative
      testID="screen-UI-E01"
    >
      <SearchField value={query} onChangeText={setQuery} placeholder={t('screens:orders.search')} />
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} />
      <View style={{ gap: spacing.md }}>
        {visible.map((order) => (
          <OrderCard
            key={order.id}
            orderCode={order.orderCode}
            sourceLabel={t(`common:sources.${order.source}`)}
            dateLabel={order.dateLabel}
            videoCount={order.videoCount}
            {...(order.status ? { status: order.status } : {})}
            onPress={() => navigation.push(ROUTES.orderDetail, { orderId: order.id })}
          />
        ))}
      </View>
      {visible.length === 0 ? (
        <EmptyState
          title={t('screens:orders.emptyTitle')}
          message={t('screens:orders.emptyMessage')}
          actionLabel={t('screens:orders.emptyAction')}
          onAction={() => navigation.push(ROUTES.scan)}
        />
      ) : null}
    </Screen>
  );
}
