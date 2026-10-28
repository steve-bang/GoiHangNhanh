import { StyleSheet, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';
import { SourceIcon, Text, useTheme } from '@/shared/ui';

import {
  formatDeviceDateTime,
  type OrderEvidenceSummary,
  type MatchReason,
  type Order,
} from '../domain';
import { OrderEvidenceBadge, useEvidenceSummaryText } from './OrderEvidenceBadge';

/**
 * Một đơn trong kết quả tìm/hộp chọn đơn trùng. Chạm = mở chi tiết (không có nhãn "Đúng đơn": app
 * không kết luận hộ, bất biến 5). `reasons` chỉ hiện khi cần phân biệt (nhiều đơn trùng mã).
 */
export function OrderResultRow({
  order,
  firstLine,
  lineCount,
  evidence,
  reasons,
  onPress,
  testID,
}: {
  order: Order;
  firstLine: { name: string; variant: string | null; quantity: number } | null;
  lineCount: number;
  evidence: OrderEvidenceSummary;
  reasons?: readonly MatchReason[];
  onPress: () => void;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const statusText = useEvidenceSummaryText(evidence);
  const sourceLabel = t(`common:sources.${order.source}`);
  const product = firstLine
    ? [firstLine.name, firstLine.variant].filter(Boolean).join(' · ')
    : t('common:productLines.undeclared');
  const reasonText = reasons?.map((r) => t(`screens:orderMatch.reason.${r}`)).join(' · ');
  const tracking = order.trackingCode
    ? t('screens:orders.card.tracking', { code: order.trackingCode })
    : null;
  const date = t('screens:orders.card.createdAt', {
    time: formatDeviceDateTime(order.createdAtDevice),
  });
  const spoken = [order.orderCode, sourceLabel, tracking, product, reasonText, date, statusText]
    .filter(Boolean)
    .join('. ');
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: getMinTouchTarget(),
          gap: tokens.space.md,
          padding: tokens.space.md,
          backgroundColor: tokens.color.surface.raised,
          borderColor: tokens.color.border.default,
          borderRadius: tokens.radius.md,
          opacity: pressed ? tokens.opacity.pressed : 1,
        },
      ]}
    >
      <SourceIcon source={order.source} size={tokens.component.tile.md} />
      <View style={[styles.flex, { gap: tokens.space.xs }]}>
        <View style={[styles.head, { gap: tokens.space.sm }]}>
          <Text variant="body" bold numberOfLines={1} ellipsizeMode="middle" style={styles.flex}>
            {order.orderCode}
          </Text>
          <OrderEvidenceBadge summary={evidence} />
        </View>
        <Text variant="formLabel" color="inkMuted" numberOfLines={1}>
          {[sourceLabel, tracking].filter(Boolean).join(' · ')}
        </Text>
        <Text variant="formButton" color="ink" numberOfLines={1}>
          {product}
          {firstLine
            ? ` · ${t('screens:orders.card.quantity', { count: firstLine.quantity })}`
            : ''}
          {lineCount > 1
            ? ` · ${t('screens:orders.card.moreLines', { count: lineCount - 1 })}`
            : ''}
        </Text>
        {reasonText ? (
          <Text variant="caption" bold style={{ color: tokens.color.feedback.warning.fg }}>
            {reasonText}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted">
          {date}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: layout.borderWidth.thin },
  head: { flexDirection: 'row', alignItems: 'center' },
});
