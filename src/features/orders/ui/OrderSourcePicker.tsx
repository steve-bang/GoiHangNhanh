import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ORDER_SOURCES, type OrderSource } from '@/core/orders/order-source';
import { layout } from '@/core/theme';
import { getMinTouchTarget } from '@/platform';
import { Icon, SourceIcon, Text, useTheme } from '@/shared/ui';

/**
 * Chọn nguồn bán (ORD-10): MỘT lựa chọn trong Shopee / TikTok Shop / Lazada / Khác. Chỉ là phân loại do
 * người dùng chọn cho đơn, KHÔNG ngụ ý đã kết nối sàn (bất biến 10). Không có ô "tên nguồn" cho *Khác*
 * vì `Order` chưa có trường đó (decisions.md Q-22). Dùng ở Tạo đơn; sẵn để dùng lại cho lọc/sửa đơn.
 */
export function OrderSourcePicker({
  value,
  onChange,
  testIDPrefix = 'source-option',
}: {
  value: OrderSource;
  onChange: (source: OrderSource) => void;
  testIDPrefix?: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: tokens.space.xs }}>
      {ORDER_SOURCES.map((source) => {
        const selected = source === value;
        return (
          <Pressable
            key={source}
            testID={`${testIDPrefix}-${source}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(source)}
            style={[
              styles.row,
              {
                minHeight: touch,
                gap: tokens.space.md,
                paddingVertical: tokens.space.sm,
                borderBottomColor: tokens.color.border.default,
              },
            ]}
          >
            <SourceIcon source={source} size={tokens.component.tile.md} />
            <Text variant="formButton" color="ink" style={styles.flex}>
              {t(`common:sources.${source}`)}
            </Text>
            <Icon
              name={selected ? 'check-circle' : 'forward'}
              size={22}
              color={selected ? tokens.color.action.primary : tokens.color.text.secondary}
            />
          </Pressable>
        );
      })}
      <Text variant="caption" color="textMuted">
        {t('screens:quickOrder.sourceNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: layout.borderWidth.thin,
  },
});
