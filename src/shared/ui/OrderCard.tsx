import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderSource } from '@/core/orders/order-source';
import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { SourceIcon } from './SourceIcon';
import { Text } from './Text';
import { useTheme } from './theme';

interface OrderCardProps {
  /** Mã đơn chỉ là chuỗi tìm kiếm/hiển thị, không phải ID (CLAUDE.md bất biến #1). */
  orderCode: string;
  sourceLabel: string;
  /** Có thì hiện logo nguồn bán nhỏ cạnh nhãn chữ (trang trí). */
  source?: OrderSource;
  /** Đã ghép nhãn, ví dụ "Mã vận đơn: SPX123". Không có thì không hiện dòng. */
  trackingLabel?: string;
  /**
   * Sản phẩm đầu tiên (tên, và variant ở dòng riêng). `null` = chưa khai báo: hiện nhãn *Chưa khai
   * báo sản phẩm* (CHỈ khi chưa có dòng nào; docs/09 mục 5.5 A.6).
   */
  product: { name: string; variant?: string | null } | null;
  /** Ví dụ "và 2 sản phẩm khác"; chỉ khi đơn có nhiều dòng. */
  extraProductsLabel?: string;
  dateLabel: string;
  /** Nhãn trạng thái bằng chứng đã dựng sẵn (EvidenceStatusBadge hoặc "Chưa có video"). */
  statusBadge: ReactNode;
  /** Nhãn chữ của trạng thái, để đọc thành một câu trên trình đọc màn hình. */
  statusText: string;
  /** Hành động của thẻ: "Xem chi tiết" hoặc "Quay ngay". Chạm vùng thông tin luôn mở chi tiết. */
  actionLabel: string;
  onPressAction: () => void;
  onPress: () => void;
  testID?: string;
}

/**
 * Thẻ đơn (UI-E01): mã đơn nổi bật nhất, nguồn bán + mã vận đơn là phụ, sản phẩm đầu tiên (hoặc
 * *Chưa khai báo sản phẩm*), thời điểm tạo, MỘT trạng thái bằng chứng và MỘT hành động. Màu không
 * là tín hiệu duy nhất: trạng thái luôn có chữ + biểu tượng (do `statusBadge`).
 */
export function OrderCard({
  orderCode,
  sourceLabel,
  source,
  trackingLabel,
  product,
  extraProductsLabel,
  dateLabel,
  statusBadge,
  statusText,
  actionLabel,
  onPressAction,
  onPress,
  testID,
}: OrderCardProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const undeclared = t('common:productLines.undeclared');
  const spoken = [
    orderCode,
    sourceLabel,
    trackingLabel,
    product ? [product.name, product.variant].filter(Boolean).join(', ') : undeclared,
    extraProductsLabel,
    dateLabel,
    statusText,
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      <Pressable
        testID={testID ? `${testID}-body` : undefined}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        onPress={onPress}
        style={({ pressed }) => [
          {
            padding: spacing.lg,
            paddingBottom: spacing.sm,
            gap: spacing.xs,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Text variant="sectionTitle" numberOfLines={1} ellipsizeMode="middle">
          {orderCode}
        </Text>
        <View style={styles.sourceRow}>
          {source ? <SourceIcon source={source} size={20} /> : null}
          <Text variant="body" color="textMuted" style={styles.shrink}>
            {sourceLabel}
          </Text>
        </View>
        {trackingLabel ? (
          <Text variant="body" color="textMuted" numberOfLines={1} ellipsizeMode="middle">
            {trackingLabel}
          </Text>
        ) : null}
        {product ? (
          <View style={styles.product}>
            <Text variant="body" bold numberOfLines={1}>
              {product.name}
            </Text>
            {product.variant ? (
              <Text variant="body" color="textMuted" numberOfLines={1}>
                {product.variant}
              </Text>
            ) : null}
            {extraProductsLabel ? (
              <Text variant="caption" color="textMuted">
                {extraProductsLabel}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.undeclared}>
            <Icon name="info" size={18} color={colors.warning} />
            <Text variant="body" bold style={{ color: colors.warning }}>
              {undeclared}
            </Text>
          </View>
        )}
        <Text variant="caption" color="textMuted">
          {dateLabel}
        </Text>
      </Pressable>
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.lg,
            minHeight: getMinTouchTarget(),
          },
        ]}
      >
        <Pressable
          testID={testID ? `${testID}-status` : undefined}
          accessible={false}
          onPress={onPress}
          style={styles.shrink}
        >
          {statusBadge}
        </Pressable>
        <Pressable
          testID={testID ? `${testID}-action` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${orderCode}`}
          onPress={onPressAction}
          style={({ pressed }) => [
            styles.action,
            { minHeight: getMinTouchTarget(), opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="body" bold style={{ color: colors.brand }}>
            {actionLabel}
          </Text>
          <Icon name="forward" size={18} color={colors.brand} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shrink: { flexShrink: 1 },
  product: { gap: 0 },
  undeclared: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
