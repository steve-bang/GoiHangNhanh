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
 * Thẻ đơn (UI-E01), cỡ gọn theo nhóm chữ form (decisions.md Q-18): hàng đầu là mã đơn (15sp đậm,
 * nổi bật nhất) + MỘT trạng thái bằng chứng; kế đó nguồn bán + mã vận đơn (13sp), sản phẩm đầu tiên
 * (hoặc *Chưa khai báo sản phẩm*); chân thẻ là thời điểm tạo + MỘT hành động. Màu không là tín hiệu
 * duy nhất: trạng thái luôn có chữ + biểu tượng (do `statusBadge`). Chân thẻ là vùng riêng, nút hành
 * cao đủ vùng chạm tối thiểu (`getMinTouchTarget`) và KHÔNG dùng `hitSlop` mở ra ngoài, nên không
 * chồng lên vùng thông tin (chạm vùng đó luôn chỉ mở chi tiết, không bấm nhầm hành động).
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
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm + 2,
            paddingBottom: 0,
            gap: spacing.xs,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.codeRow, { gap: spacing.sm }]}>
          <Text variant="body" bold numberOfLines={1} ellipsizeMode="middle" style={styles.code}>
            {orderCode}
          </Text>
          <View testID={testID ? `${testID}-status` : undefined}>{statusBadge}</View>
        </View>
        <View style={[styles.wrapRow, { columnGap: spacing.md }]}>
          <View style={styles.sourceRow}>
            {source ? <SourceIcon source={source} size={18} /> : null}
            <Text variant="formLabel" color="inkMuted" style={styles.shrink}>
              {sourceLabel}
            </Text>
          </View>
          {trackingLabel ? (
            <Text
              variant="formLabel"
              color="inkMuted"
              numberOfLines={1}
              ellipsizeMode="middle"
              style={styles.shrink}
            >
              {trackingLabel}
            </Text>
          ) : null}
        </View>
        {product ? (
          <View style={[styles.wrapRow, { columnGap: spacing.sm }]}>
            <Text variant="formButton" color="ink" numberOfLines={1} style={styles.shrink}>
              {product.name}
            </Text>
            {product.variant ? (
              <Text variant="formBody" color="inkMuted" numberOfLines={1} style={styles.shrink}>
                {product.variant}
              </Text>
            ) : null}
            {extraProductsLabel ? (
              <Text variant="caption" color="inkMuted">
                {extraProductsLabel}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.undeclared}>
            <Icon name="info" size={16} color={colors.warning} />
            <Text variant="formButton" style={[styles.shrink, { color: colors.warning }]}>
              {undeclared}
            </Text>
          </View>
        )}
      </Pressable>
      <View style={[styles.footer, { paddingLeft: spacing.md, paddingRight: spacing.xs }]}>
        <Text variant="caption" color="inkMuted" style={styles.shrink}>
          {dateLabel}
        </Text>
        <Pressable
          testID={testID ? `${testID}-action` : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${orderCode}`}
          onPress={onPressAction}
          style={({ pressed }) => [
            styles.action,
            { minHeight: getMinTouchTarget(), paddingHorizontal: spacing.sm },
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="formButtonSmall" style={{ color: colors.brand }}>
            {actionLabel}
          </Text>
          <Icon name="forward" size={16} color={colors.brand} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  codeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  code: { flexShrink: 1 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 0 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  shrink: { flexShrink: 1 },
  undeclared: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
