import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Icon, IconTile, Text, useTheme } from '@/shared/ui';

import type { ShopSummary } from '../domain/types';

interface ShopSwitchRowProps {
  shop: ShopSummary;
  /** Cửa hàng phiên đang dùng: có dấu tích bên trái và nhãn "Đang dùng"; không chọn được (không có gì để chuyển). */
  isCurrent: boolean;
  /** Đã chọn làm đích chuyển (dấu tích bên phải). */
  isSelected: boolean;
  /** Đang kiểm tra điều kiện chuyển: không cho đổi lựa chọn. */
  busy: boolean;
  onSelect: () => void;
  testID: string;
}

/**
 * Một hàng của màn Chuyển cửa hàng (board 07 khung 7a): ô icon, tên, dòng trạng thái màu (Đang dùng / Đang
 * hoạt động / Bị khóa) kèm vai trò, dấu tích bên phải khi được chọn. Cửa hàng đang dùng và cửa hàng bị khóa
 * KHÔNG chọn được. Nhãn trạng thái luôn bằng chữ (màu không là tín hiệu duy nhất). Bị khóa dùng tông cảnh báo
 * (board vẽ đỏ; đỏ chỉ dành cho lỗi/phá hủy).
 */
export function ShopSwitchRow({
  shop,
  isCurrent,
  isSelected,
  busy,
  onSelect,
  testID,
}: ShopSwitchRowProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const suspended = shop.status !== 'active';
  const selectable = !isCurrent && !suspended;
  const status = isCurrent
    ? t('personal:shop.current')
    : suspended
      ? t('personal:shop.status.suspended')
      : t('personal:shop.status.active');
  const role = t(`personal:shop.role.${shop.role}`);
  const label = [
    shop.name,
    status,
    role,
    isSelected ? t('personal:switchShop.selected') : null,
    suspended ? t('personal:switchShop.suspendedHint') : null,
  ]
    .filter(Boolean)
    .join('. ');
  const content = (
    <>
      <IconTile
        icon={isCurrent ? 'check-circle' : suspended ? 'lock-solid' : 'store'}
        tone={suspended ? 'warning' : 'brand'}
      />
      <View style={styles.text}>
        <Text bold>{shop.name}</Text>
        <Text variant="caption">
          <Text variant="caption" bold color={suspended ? 'warning' : 'brand'}>
            {status}
          </Text>
          <Text variant="caption" color="textMuted">
            {` · ${role}`}
          </Text>
        </Text>
      </View>
      {isSelected ? (
        <Icon name="check-circle" size={24} color={tokens.color.action.primary} />
      ) : null}
    </>
  );
  const rowStyle = {
    minHeight: getMinTouchTarget(),
    gap: tokens.space.md,
    paddingVertical: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
  } as const;

  if (!selectable) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        accessibilityState={{ disabled: suspended, selected: isCurrent }}
        style={[styles.row, rowStyle]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onSelect}
      disabled={busy}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: isSelected, disabled: busy }}
      style={({ pressed }) => [
        styles.row,
        rowStyle,
        {
          opacity: busy ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, flexShrink: 1 },
});
