import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Viền đỏ khi bắt buộc mà chưa chọn; bên gọi vẫn phải hiện câu lỗi bằng chữ. */
  error?: boolean;
  testID?: string;
}

/** Hộp kiểm có nhãn: cả hàng là vùng chạm (>= tối thiểu), nhãn tự xuống dòng khi chữ lớn. */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  error = false,
  testID,
}: CheckboxProps) {
  const { tokens } = useTheme();
  const size = tokens.component.checkbox.size;
  const border = error
    ? tokens.color.action.destructive
    : checked
      ? tokens.color.brand.primary
      : tokens.color.text.secondary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: getMinTouchTarget(),
          gap: tokens.space.md,
          opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
        },
      ]}
    >
      <View
        style={[
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: tokens.radius.sm,
            borderWidth: tokens.borderWidth.emphasis,
            borderColor: border,
            backgroundColor: checked ? tokens.color.brand.primary : tokens.color.surface.raised,
          },
        ]}
      >
        {checked ? <Icon name="check" size={16} color={tokens.color.text.onAction} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  box: { alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
