import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Text } from './Text';
import { useTheme } from './theme';

interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /** Thông báo lỗi (đỏ, kèm chữ); lỗi gồm điều gì xảy ra + làm gì tiếp (docs/04 quy tắc chung). */
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onSubmitEditing?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  testID?: string;
  /** Phần tử đặt bên phải trong khung ô (nút quét, nút xóa, mũi tên...). Tự chịu trách nhiệm trợ năng. */
  trailing?: ReactNode;
  onFocus?: () => void;
  onBlur?: () => void;
}

/** Ô nhập có nhãn luôn hiện (không dùng placeholder thay nhãn). Cao tối thiểu theo vùng chạm. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  returnKeyType,
  onSubmitEditing,
  autoCapitalize = 'none',
  testID,
  trailing,
  onFocus,
  onBlur,
}: TextFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const frameStyle = {
    minHeight: Math.max(getMinTouchTarget(), 52),
    backgroundColor: colors.surface,
    borderColor: error ? colors.danger : focused ? colors.brand : colors.border,
    borderWidth: focused || error ? 2 : 1,
    borderRadius: radius.md,
  } as const;
  const input = (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      {...(placeholder ? { placeholder } : {})}
      placeholderTextColor={colors.textMuted}
      {...(keyboardType ? { keyboardType } : {})}
      {...(returnKeyType ? { returnKeyType } : {})}
      {...(onSubmitEditing ? { onSubmitEditing } : {})}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={[
        typography.body,
        trailing
          ? { flex: 1, minHeight: frameStyle.minHeight - 2, color: colors.text, paddingVertical: 0 }
          : {
              ...frameStyle,
              color: colors.text,
              paddingHorizontal: spacing.lg,
            },
      ]}
    />
  );
  return (
    <View style={styles.container}>
      <Text bold>{label}</Text>
      {trailing ? (
        <View
          style={[frameStyle, styles.row, { paddingLeft: spacing.lg, paddingRight: spacing.sm }]}
        >
          {input}
          {trailing}
        </View>
      ) : (
        input
      )}
      {error ? (
        <Text variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
