import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderSource } from '@/core/orders/order-source';
import { getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';

import { Icon } from './Icon';
import { SourceIcon } from './SourceIcon';
import { Text } from './Text';
import { useTheme } from './theme';

interface OrderCardProps {
  /** Mã đơn chỉ là chuỗi tìm kiếm/hiển thị, không phải ID (CLAUDE.md bất biến #1). */
  orderCode: string;
  sourceLabel: string;
  /** Có thì hiện logo nguồn bán trong ô bên trái thẻ (thay ảnh sản phẩm; trang trí). */
  source?: OrderSource;
  /** Đã ghép nhãn, ví dụ "Mã vận đơn: SPX123". Không có thì không hiện dòng. */
  trackingLabel?: string;
  /**
   * Sản phẩm đầu tiên (tên, và variant ở dòng riêng). `null` = chưa khai báo: hiện nhãn *Chưa khai
   * báo sản phẩm* (CHỈ khi chưa có dòng nào; docs/09 mục 5.5 A.6).
   */
  product: { name: string; variant?: string | null } | null;
  /** Đã ghép nhãn, ví dụ "SL: 2" (số lượng dòng đầu, do người dùng nhập). */
  quantityLabel?: string;
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
 * Thẻ đơn (UI-E01; ORD-01), cỡ gọn theo nhóm chữ form (decisions.md Q-18, Q-22). Bên trái là ô logo
 * nguồn bán (thay ảnh sản phẩm: app không có ảnh sản phẩm). Bên phải: hàng đầu mã đơn (15sp đậm) +
 * MỘT trạng thái bằng chứng ở mức đơn; kế đó nguồn bán + mã vận đơn, sản phẩm đầu tiên + SL (hoặc
 * *Chưa khai báo sản phẩm*). Chân thẻ là thời điểm tạo + MỘT hành động. Màu không là tín hiệu duy
 * nhất: trạng thái luôn có chữ + biểu tượng (do `statusBadge`). Chân thẻ là vùng riêng, nút hành động
 * cao đủ vùng chạm tối thiểu (`getMinTouchTarget`) và KHÔNG dùng `hitSlop` mở ra ngoài, nên không
 * chồng lên vùng thông tin (chạm vùng đó luôn chỉ mở chi tiết, không bấm nhầm hành động).
 */
export function OrderCard({
  orderCode,
  sourceLabel,
  source,
  trackingLabel,
  product,
  quantityLabel,
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
  const { tokens } = useTheme();
  const undeclared = t('common:productLines.undeclared');
  const spoken = [
    orderCode,
    sourceLabel,
    trackingLabel,
    product ? [product.name, product.variant].filter(Boolean).join(', ') : undeclared,
    quantityLabel,
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
          backgroundColor: tokens.color.surface.raised,
          borderColor: tokens.color.border.default,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <Pressable
        testID={testID ? `${testID}-body` : undefined}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        onPress={onPress}
        style={({ pressed }) => [
          styles.body,
          {
            paddingHorizontal: tokens.space.md,
            paddingTop: tokens.space.sm + tokens.space.xxs,
            gap: tokens.space.md,
            opacity: pressed ? tokens.opacity.pressed : 1,
          },
        ]}
      >
        {source ? <SourceIcon source={source} size={tokens.component.tile.md} /> : null}
        <View style={[styles.shrink, { gap: tokens.space.xs }]}>
          <View style={[styles.codeRow, { gap: tokens.space.sm }]}>
            <Text variant="body" bold numberOfLines={1} ellipsizeMode="middle" style={styles.code}>
              {orderCode}
            </Text>
            <View testID={testID ? `${testID}-status` : undefined}>{statusBadge}</View>
          </View>
          <View style={[styles.wrapRow, { columnGap: tokens.space.md }]}>
            <Text variant="formLabel" color="inkMuted" style={styles.shrink}>
              {sourceLabel}
            </Text>
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
            <View style={[styles.wrapRow, { columnGap: tokens.space.sm }]}>
              <Text variant="formButton" color="ink" numberOfLines={1} style={styles.shrink}>
                {product.name}
              </Text>
              {product.variant ? (
                <Text variant="formBody" color="inkMuted" numberOfLines={1} style={styles.shrink}>
                  {product.variant}
                </Text>
              ) : null}
              {quantityLabel ? (
                <Text variant="formBody" color="inkMuted">
                  {quantityLabel}
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
              <Icon name="info" size={16} color={tokens.color.feedback.warning.fg} />
              <Text
                variant="formButton"
                style={[styles.shrink, { color: tokens.color.feedback.warning.fg }]}
              >
                {undeclared}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
      <View
        style={[styles.footer, { paddingLeft: tokens.space.md, paddingRight: tokens.space.xs }]}
      >
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
            { minHeight: getMinTouchTarget(), paddingHorizontal: tokens.space.sm },
            // token-exception: độ mờ nhấn đậm hơn cho nút chữ nhỏ, không dùng ở chỗ khác
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text variant="formButtonSmall" style={{ color: tokens.color.action.primary }}>
            {actionLabel}
          </Text>
          <Icon name="forward" size={16} color={tokens.color.action.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: layout.borderWidth.thin, overflow: 'hidden' },
  body: { flexDirection: 'row', alignItems: 'flex-start' },
  codeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  code: { flexShrink: 1 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 0 },
  shrink: { flexShrink: 1 },
  undeclared: { flexDirection: 'row', alignItems: 'center', gap: layout.space.tight },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.space.sm,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: layout.space.xxs },
});
