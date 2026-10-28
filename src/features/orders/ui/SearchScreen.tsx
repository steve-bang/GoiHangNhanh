import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import {
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SearchField,
  SkeletonCard,
  Text,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import { normalizeSearchInput } from '../domain';
import { OrderMatchSheet } from './OrderMatchSheet';
import { OrderResultRow } from './OrderResultRow';
import { useOrderLookup } from './use-order-lookup';
import { useOrderSearch } from './use-order-search';
import { useRecentSearches } from './use-recent-searches';

/**
 * UI-B03 Tìm đơn (ORD-02): tìm theo chuỗi con của mã đơn/mã vận đơn trong kho cục bộ của shop hiện
 * tại. Gõ -> chờ ngắn rồi mới truy vấn, kết quả cũ không ghi đè mới, chuỗi rỗng/quá ngắn không truy
 * vấn. Bấm Tìm/Enter = XÁC NHẬN: ghi lịch sử, và nếu đúng MỘT đơn khớp chính xác thì mở thẳng chi tiết,
 * nhiều đơn khớp thì `OrderMatchSheet` bắt chọn (không chọn kết quả đầu; bất biến 5). Không thấy: lối
 * *Tạo đơn với mã này* (chỉ chuyển sang Tạo đơn nhanh, KHÔNG tự tạo). Lịch sử tìm lưu cục bộ theo shop,
 * có xóa (decisions.md Q-22f/u).
 */
export function SearchScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const [text, setText] = useState('');
  const [retry, setRetry] = useState(0);
  const [confirmClear, setConfirmClear] = useState(false);
  const search = useOrderSearch(text, retry);
  const recent = useRecentSearches();
  const match = useOrderLookup();
  const normalized = normalizeSearchInput(text);

  const confirm = async () => {
    if (!normalized) return;
    void recent.record(normalized.text);
    const result = await match.lookup(normalized.text);
    if (!result) return; // đã bị lần Enter sau thay thế: không điều hướng lần nữa
    if (result.kind === 'one') {
      match.reset();
      navigation.push(ROUTES.orderDetail, { orderId: result.row.order.id });
    } else if (result.kind !== 'many' && result.kind !== 'error') {
      match.reset(); // không có khớp chính xác: để danh sách tìm theo chuỗi con hiện
    }
  };
  const openOrder = (orderId: OrderId) => {
    if (normalized) void recent.record(normalized.text);
    navigation.push(ROUTES.orderDetail, { orderId });
  };
  const createWithCode = () =>
    normalized && navigation.push(ROUTES.quickOrder, { code: normalized.text });

  return (
    <Screen
      form
      title={t('nav:titles.UI-B03')}
      onBack={navigation.back}
      inTabs
      contentGap={tokens.space.md}
      testID="screen-UI-B03"
    >
      <SearchField
        compact
        testID="search-input"
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => void confirm()}
        placeholder={t('screens:orderSearch.placeholder')}
        onScan={() => navigation.push(ROUTES.scan)}
        scanLabel={t('screens:orders.scanAction')}
        scanTestID="search-scan"
      />

      {search.kind === 'idle' ? (
        <View testID="search-recent" style={{ gap: tokens.space.sm }}>
          <View style={styles.recentHead}>
            <Text variant="formButton" color="ink" accessibilityRole="header" style={styles.flex}>
              {t('screens:orderSearch.recentTitle')}
            </Text>
            {recent.items.length > 0 ? (
              <Pressable
                testID="search-recent-clear"
                accessibilityRole="button"
                onPress={() => setConfirmClear(true)}
                style={{ minHeight: getMinTouchTarget(), justifyContent: 'center' }}
              >
                <Text variant="formButtonSmall" style={{ color: tokens.color.action.primary }}>
                  {t('screens:orderSearch.clearAll')}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {recent.items.length === 0 ? (
            <Text variant="formBody" color="inkMuted" testID="search-recent-empty">
              {t(
                text.trim().length > 0
                  ? 'screens:orderSearch.hint'
                  : 'screens:orderSearch.recentEmpty',
              )}
            </Text>
          ) : (
            recent.items.map((item) => (
              <View key={item.text} style={styles.recentRow}>
                <Pressable
                  testID={`search-recent-${item.text}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setText(item.text);
                    void recent.record(item.text);
                  }}
                  style={[
                    styles.recentMain,
                    { minHeight: getMinTouchTarget(), gap: tokens.space.sm },
                  ]}
                >
                  <Icon name="search" size={18} color={tokens.color.text.secondary} />
                  <Text variant="formBody" color="ink" numberOfLines={1} style={styles.flex}>
                    {item.text}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`search-recent-remove-${item.text}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('screens:orderSearch.removeItem', { text: item.text })}
                  onPress={() => void recent.remove(item.text)}
                  style={{
                    minWidth: getMinTouchTarget(),
                    minHeight: getMinTouchTarget(),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="close" size={18} color={tokens.color.text.secondary} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}

      {search.kind === 'loading' ? (
        <View testID="search-loading" style={{ gap: tokens.space.sm }}>
          <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
            {t('screens:orderSearch.loading')}
          </Text>
          <SkeletonCard />
        </View>
      ) : null}

      {search.kind === 'results' ? (
        <View testID="search-results" style={{ gap: tokens.space.sm }}>
          <Text variant="formButton" color="ink" accessibilityRole="header">
            {t('screens:orderSearch.resultsTitle')}
          </Text>
          {search.rows.map(({ item, evidence }) => (
            <OrderResultRow
              key={item.order.id}
              testID={`search-result-${item.order.id}`}
              order={item.order}
              firstLine={item.firstLine}
              lineCount={item.lineCount}
              evidence={evidence}
              onPress={() => openOrder(item.order.id)}
            />
          ))}
          {search.truncated ? (
            <Text variant="caption" color="textMuted" testID="search-truncated">
              {t('screens:orderSearch.truncated')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {search.kind === 'empty' ? (
        <View testID="search-empty">
          <EmptyState
            compact
            iconCircle
            icon="search"
            title={t('screens:orderSearch.emptyTitle')}
            message={t('screens:orderSearch.emptyMessage')}
            actionLabel={t('screens:orderSearch.createWithCode')}
            onAction={createWithCode}
          />
        </View>
      ) : null}

      {search.kind === 'error' ? (
        <ErrorState
          variant="card"
          testID="search-error"
          title={t('screens:orderSearch.error')}
          retryLabel={t('common:actions.retry')}
          onRetry={() => setRetry((n) => n + 1)}
        />
      ) : null}

      <OrderMatchSheet
        state={match.state}
        onClose={match.reset}
        onRetry={(code) => void match.lookup(code)}
      />
      <ConfirmDialog
        visible={confirmClear}
        title={t('screens:orderSearch.clearTitle')}
        message={t('screens:orderSearch.clearMessage')}
        cancelLabel={t('screens:orderSearch.clearCancel')}
        confirmLabel={t('screens:orderSearch.clearConfirm')}
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          void recent.clear();
        }}
        confirmTestID="search-recent-clear-confirm"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  recentHead: { flexDirection: 'row', alignItems: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.xs },
  recentMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
});
