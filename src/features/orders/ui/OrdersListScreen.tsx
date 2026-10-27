import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  FilterChips,
  Icon,
  OrderCard,
  Screen,
  SearchField,
  SkeletonCard,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import {
  EMPTY_FILTERS,
  ORDER_LIST_PAGE_SIZE,
  STATUS_CHIPS,
  canRecordNow,
  countAdvancedFilters,
  formatDeviceDateTime,
  hasActiveFilters,
  type OrderListFilters,
  type StatusChip,
} from '../domain';
import { OrderEvidenceBadge, useEvidenceSummaryText } from './OrderEvidenceBadge';
import { OrderFiltersSheet } from './OrderFiltersSheet';
import { useOrderList, type OrderListRow } from './use-order-list';
import { useStartPacking } from './use-start-packing';

/**
 * Chip trạng thái hiển thị. P1 chỉ "Tất cả" và "Chưa có video": các chip trạng thái bằng chứng khác
 * (Đã lưu trên máy, Đang tải lên, Lỗi...) thêm vào đây cùng `STATUS_CHIPS` khi đã có dữ liệu bằng
 * chứng thật, để không hiện chip luôn ra rỗng.
 */
const CHIP_LABEL_KEYS: Record<StatusChip, string> = {
  all: 'screens:orders.filterAll',
  no_video: 'screens:orders.filterNoVideo',
};

/**
 * UI-E01 Danh sách đơn: dữ liệu THẬT từ kho cục bộ của shop hiện tại. Tìm theo mã đơn/mã vận đơn
 * (phản hồi ngay), chip trạng thái, bộ lọc nâng cao, kéo làm mới, phân trang keyset, nạp lại khi màn
 * lấy lại focus. Bộ lọc và từ khóa nằm trong state của màn nên vẫn còn khi vào chi tiết rồi quay lại
 * (ngăn xếp tab giữ màn). Thẻ chỉ có MỘT trạng thái bằng chứng ở mức đơn; hôm nay chưa có bằng chứng
 * thật nên mọi đơn là "Chưa có video" (decisions.md Q-18).
 */
export function OrdersListScreen({ pageSize }: { pageSize?: number } = {}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const start = useStartPacking({ navigate: 'push' });
  const filterSlop = Math.max(0, Math.ceil((getMinTouchTarget() - FILTER_BUTTON_HEIGHT) / 2));
  const [filters, setFilters] = useState<OrderListFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const list = useOrderList(filters, pageSize ? { pageSize } : {});

  const advanced = countAdvancedFilters(filters);
  const filtered = hasActiveFilters(filters);

  const chipOptions: ChipOption<StatusChip>[] = STATUS_CHIPS.map((key) => ({
    key,
    label: t(CHIP_LABEL_KEYS[key]),
  }));

  const openOrder = useCallback(
    (row: OrderListRow) => navigation.push(ROUTES.orderDetail, { orderId: row.item.order.id }),
    [navigation],
  );
  // "Quay ngay": đơn đã có phiên đang thực hiện thì mở lại phiên đó (không tạo phiên chồng); chưa có
  // thì qua màn Xác nhận đơn như các đường vào khác.
  const recordNow = useCallback(
    (row: OrderListRow) => {
      const active = row.item.activeSession;
      if (active) start.begin(row.item.order.id, active.packageId);
      else navigation.push(ROUTES.orderPreview, { orderId: row.item.order.id });
    },
    [navigation, start],
  );

  const countLabel = (() => {
    if (list.total === null) return null;
    const base = t(filtered ? 'screens:orders.count.matching' : 'screens:orders.count.all', {
      count: list.total,
    });
    return filters.period
      ? t('screens:orders.count.withPeriod', {
          period: t(`screens:orders.filters.period.${filters.period}`),
          text: base,
        })
      : base;
  })();

  const headerRight = (
    <View style={styles.headerButtons}>
      <HeaderButton
        testID="orders-scan"
        icon="scan"
        label={t('screens:orders.scanAction')}
        onPress={() => navigation.push(ROUTES.scan)}
      />
      <HeaderButton
        testID="orders-create"
        icon="add"
        label={t('screens:orders.createAction')}
        onPress={() => navigation.push(ROUTES.quickOrder)}
      />
    </View>
  );

  const clearAll = () => setFilters(EMPTY_FILTERS);

  const emptyComponent = (() => {
    if (list.status === 'loading') {
      return (
        <View style={{ gap: tokens.space.sm }} testID="orders-loading">
          <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
            {t('screens:orders.loading')}
          </Text>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      );
    }
    if (list.status === 'error') {
      return (
        <Card compact tone="danger" testID="orders-error">
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="formBody" accessibilityRole="alert">
              {t('screens:orders.loadError')}
            </Text>
            <Button
              size="slim"
              label={t('common:actions.retry')}
              onPress={list.retry}
              testID="orders-retry"
            />
          </View>
        </Card>
      );
    }
    if (filtered) {
      return (
        <View testID="orders-no-results">
          <EmptyState
            compact
            icon="search"
            title={t('screens:orders.noResultsTitle')}
            message={t('screens:orders.noResultsMessage')}
            actionLabel={t('screens:orders.clearAll')}
            onAction={clearAll}
          />
        </View>
      );
    }
    return (
      <View testID="orders-empty">
        <EmptyState
          compact
          title={t('screens:orders.emptyTitle')}
          message={t('screens:orders.emptyMessage')}
          actionLabel={t('screens:orders.emptyAction')}
          onAction={() => navigation.push(ROUTES.quickOrder)}
        />
      </View>
    );
  })();

  return (
    <Screen
      form
      title={t('nav:titles.UI-E01')}
      headerRight={headerRight}
      contentGap={tokens.space.sm}
      scroll={false}
      inTabs
      testID="screen-UI-E01"
    >
      <SearchField
        compact
        testID="orders-search"
        value={filters.search}
        onChangeText={(search) => setFilters((prev) => ({ ...prev, search }))}
        placeholder={t('screens:orders.search')}
      />
      <FilterChips
        size="compact"
        options={chipOptions}
        selectedKey={filters.status}
        onSelect={(status) => setFilters((prev) => ({ ...prev, status }))}
      />
      <View style={[styles.countRow, { gap: tokens.space.md }]}>
        <Text
          testID="orders-count"
          variant="formBody"
          color="inkMuted"
          accessibilityLiveRegion="polite"
          style={styles.flex}
        >
          {countLabel ?? ' '}
        </Text>
        <Pressable
          testID="orders-open-filters"
          accessibilityRole="button"
          accessibilityLabel={t(
            advanced > 0 ? 'screens:orders.filters.openWithCount' : 'screens:orders.filters.open',
            { count: advanced },
          )}
          onPress={() => setSheetOpen(true)}
          hitSlop={{ top: filterSlop, bottom: filterSlop }}
          style={[
            styles.filterButton,
            {
              minHeight: FILTER_BUTTON_HEIGHT,
              borderColor: advanced > 0 ? tokens.color.action.primary : tokens.color.border.field,
              backgroundColor: advanced > 0 ? tokens.color.brand.soft : tokens.color.surface.raised,
              borderRadius: tokens.radius.lg,
              paddingHorizontal: tokens.space.md,
            },
          ]}
        >
          <Icon
            name="filter"
            size={16}
            color={advanced > 0 ? tokens.color.action.primary : tokens.color.text.strong}
          />
          <Text
            variant="formButton"
            style={{ color: advanced > 0 ? tokens.color.action.primary : tokens.color.text.strong }}
          >
            {t(
              advanced > 0 ? 'screens:orders.filters.openWithCount' : 'screens:orders.filters.open',
              {
                count: advanced,
              },
            )}
          </Text>
        </Pressable>
      </View>
      {list.error && list.rows.length > 0 ? (
        <Card compact tone="danger" testID="orders-refresh-error">
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="formBody" accessibilityRole="alert">
              {t('screens:orders.loadError')}
            </Text>
            <Button
              size="slim"
              variant="secondary"
              label={t('common:actions.retry')}
              onPress={list.retry}
            />
          </View>
        </Card>
      ) : null}
      {start.error ? (
        <Card compact tone="danger" testID="orders-start-error">
          <Text variant="formBody" accessibilityRole="alert">
            {t(`errors:${start.error}`)}
          </Text>
        </Card>
      ) : null}
      <FlatList
        testID="orders-list"
        style={styles.flex}
        contentContainerStyle={{ gap: tokens.space.sm, paddingBottom: tokens.space.lg }}
        data={list.rows}
        keyExtractor={(row) => row.item.order.id}
        initialNumToRender={ORDER_LIST_PAGE_SIZE}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        onEndReachedThreshold={0.5}
        onEndReached={list.loadMore}
        renderItem={({ item: row }) => (
          <OrderRow row={row} onOpen={() => openOrder(row)} onRecord={() => recordNow(row)} />
        )}
        ListEmptyComponent={emptyComponent}
        ListFooterComponent={
          list.loadingMore ? (
            <View testID="orders-loading-more" style={styles.footer}>
              <ActivityIndicator color={tokens.color.action.primary} />
              <Text variant="formBody" color="inkMuted">
                {t('screens:orders.loadingMore')}
              </Text>
            </View>
          ) : list.moreError ? (
            <View testID="orders-more-error" style={styles.footer}>
              <Text variant="formBody" color="inkMuted">
                {t('screens:orders.loadMoreError')}
              </Text>
              <Button
                size="slim"
                variant="secondary"
                label={t('common:actions.retry')}
                onPress={list.loadMore}
              />
            </View>
          ) : undefined
        }
      />
      <OrderFiltersSheet
        visible={sheetOpen}
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
      {start.permissionSheet}
    </Screen>
  );
}

function OrderRow({
  row,
  onOpen,
  onRecord,
}: {
  row: OrderListRow;
  onOpen: () => void;
  onRecord: () => void;
}) {
  const { t } = useTranslation();
  const { order, firstLine, lineCount } = row.item;
  const record = canRecordNow(row.evidence);
  const statusText = useEvidenceSummaryText(row.evidence);
  return (
    <OrderCard
      testID={`order-card-${order.id}`}
      orderCode={order.orderCode}
      source={order.source}
      sourceLabel={t(`common:sources.${order.source}`)}
      {...(order.trackingCode
        ? { trackingLabel: t('screens:orders.card.tracking', { code: order.trackingCode }) }
        : {})}
      product={firstLine ? { name: firstLine.name, variant: firstLine.variant } : null}
      {...(lineCount > 1
        ? { extraProductsLabel: t('screens:orders.card.moreLines', { count: lineCount - 1 }) }
        : {})}
      dateLabel={t('screens:orders.card.createdAt', {
        time: formatDeviceDateTime(order.createdAtDevice),
      })}
      statusBadge={<OrderEvidenceBadge summary={row.evidence} />}
      statusText={statusText}
      actionLabel={t(record ? 'screens:orders.card.recordNow' : 'screens:orders.card.viewDetail')}
      onPress={onOpen}
      onPressAction={record ? onRecord : onOpen}
    />
  );
}

function HeaderButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: 'scan' | 'add';
  label: string;
  onPress: () => void;
  testID: string;
}) {
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minWidth: touch, minHeight: touch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={22} color={tokens.color.action.primary} />
    </Pressable>
  );
}

/** Chiều cao nhìn thấy của nút Bộ lọc; vùng chạm được bù bằng hitSlop. */
const FILTER_BUTTON_HEIGHT = 34;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center' },
  countRow: { flexDirection: 'row', alignItems: 'center' },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.space.tight,
    borderWidth: layout.borderWidth.thin,
  },
  footer: { alignItems: 'center', gap: layout.space.sm, padding: layout.space.md },
});
