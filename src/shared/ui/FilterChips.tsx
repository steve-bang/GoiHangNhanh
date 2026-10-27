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
}

/**
 * Chip lọc/chọn một. Xuống dòng (flexWrap) thay vì cuộn ngang để không giấu lựa chọn khi chữ lớn.
 * Trạng thái chọn thể hiện bằng nền + viền đậm + `accessibilityState.selected`, không chỉ màu.
 */
export function FilterChips<K extends string>({
  options,
  selectedKey,
  onSelect,
}: FilterChipsProps<K>) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={[styles.wrap, { gap: spacing.sm }]}>
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option.key)}
            style={[
              styles.chip,
              {
                minHeight: getMinTouchTarget(),
                paddingHorizontal: spacing.lg,
                borderRadius: radius.lg,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? colors.brand : colors.border,
                backgroundColor: selected ? colors.brandSoft : colors.surface,
              },
            ]}
          >
            {option.leading}
            <Text bold={selected} style={{ color: selected ? colors.brand : colors.text }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
