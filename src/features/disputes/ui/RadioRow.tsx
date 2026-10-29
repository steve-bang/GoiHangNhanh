import { Pressable } from 'react-native';

import { getMinTouchTarget } from '@/platform';
import { Icon, Text, useTheme } from '@/shared/ui';

/** Một dòng chọn một (radio) cùng kiểu với bảng chọn lý do ở màn quay hàng hoàn. */
export function RadioRow({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      {...(testID ? { testID } : {})}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={{
        minHeight: getMinTouchTarget(),
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.space.md,
        paddingHorizontal: tokens.space.md,
        borderRadius: tokens.radius.md,
        borderWidth: selected ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
        borderColor: selected ? tokens.color.brand.primary : tokens.color.border.default,
        backgroundColor: selected ? tokens.color.brand.soft : tokens.color.surface.raised,
      }}
    >
      <Icon
        name={selected ? 'check-circle' : 'circle-outline'}
        size={tokens.icon.lg}
        color={selected ? tokens.color.brand.primary : tokens.color.text.tertiary}
      />
      <Text variant="formBody" style={{ flex: 1, flexShrink: 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}
