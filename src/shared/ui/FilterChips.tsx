import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Text } from './Text';
import { useTheme } from './theme';

export interface ChipOption<K extends string> {
  key: K;
  label: string;
  /** Hình nhỏ trang trí trước nhãn (nhãn chữ vẫn luôn có). */
  leading?: ReactNode;
}

interface FilterChipsProps<K extends string> {
  options: readonly ChipOption<K>[];
  selectedKey: K;
  onSelect: (key: K) => void;
  /**
   * `outlined` (mặc định): chọn = nền xanh nhạt + viền đậm. `solid` (mockup 03, chọn kiện): chọn = nền
   * xanh đặc chữ trắng, chưa chọn = nền xám nhạt không viền; chữ 14sp.
   */
  appearance?: 'outlined' | 'solid';
  /** Phần tử đặt cùng hàng sau các chip (ví dụ "+ Thêm kiện"); xuống dòng khi hết chỗ. */
  trailing?: ReactNode;
  /**
   * `compact`: chip thấp, chữ 14sp (formButton), nhưng vùng chạm vẫn >= tối thiểu nhờ `hitSlop`
   * (tab Đơn hàng; decisions.md Q-18). Mặc định giữ cỡ cũ cho các màn khác.
   */
  size?: 'regular' | 'compact';
}

/**
 * Chip lọc/chọn một. Xuống dòng (flexWrap) thay vì cuộn ngang để không giấu lựa chọn khi chữ lớn.
 * Trạng thái chọn thể hiện bằng nền + `accessibilityState.selected` (và viền đậm ở kiểu `outlined`),
 * không chỉ màu: kiểu `solid` đổi cả màu chữ và độ đậm chữ.
 */
export function FilterChips<K extends string>({
  options,
  selectedKey,
  onSelect,
  appearance = 'outlined',
  trailing,
  size = 'regular',
}: FilterChipsProps<K>) {
  const { colors, spacing, radius } = useTheme();
  const solid = appearance === 'solid';
  const compact = size === 'compact';
  const touch = getMinTouchTarget();
  const height = compact ? COMPACT_CHIP_HEIGHT : touch;
  const slop = Math.max(0, Math.ceil((touch - height) / 2));
  return (
    <View style={[styles.wrap, { gap: spacing.sm }]}>
      {options.map((option) => {
        const selected = option.key === selectedKey;
        const chipStyle = solid
          ? {
              borderRadius: radius.lg,
              borderWidth: 0,
              borderColor: colors.brand,
              backgroundColor: selected ? colors.brand : colors.surfaceMuted,
            }
          : {
              borderRadius: radius.lg,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.brand : colors.border,
              backgroundColor: selected ? colors.brandSoft : colors.surface,
            };
        const textColor = solid
          ? selected
            ? colors.onBrand
            : colors.ink
          : selected
            ? colors.brand
            : colors.text;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.key)}
            hitSlop={slop > 0 ? { top: slop, bottom: slop } : undefined}
            style={[
              styles.chip,
              {
                minHeight: height,
                paddingHorizontal: compact ? spacing.md : solid ? spacing.xl : spacing.lg,
                ...chipStyle,
              },
            ]}
          >
            {option.leading}
            {solid || compact ? (
              <Text variant="formButton" style={{ color: textColor }}>
                {option.label}
              </Text>
            ) : (
              <Text bold={selected} style={{ color: textColor }}>
                {option.label}
              </Text>
            )}
          </Pressable>
        );
      })}
      {trailing}
    </View>
  );
}

/** Chiều cao nhìn thấy của chip cỡ gọn; vùng chạm được bù bằng hitSlop. */
const COMPACT_CHIP_HEIGHT = 34;

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
