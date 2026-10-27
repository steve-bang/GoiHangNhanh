import { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from 'react-native';

import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';

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
  /** Cỡ chữ nhỏ cho nhóm màn form/quy trình (nhãn 13sp, nội dung 14sp; mockup 03). */
  compact?: boolean;
  /** Ẩn nội dung (mật khẩu). Chỉ dùng qua `PasswordField`, nơi có nút Hiện/Ẩn. */
  secureTextEntry?: boolean;
  /** Gợi ý trình quản lý mật khẩu của hệ điều hành điền/lưu đúng loại ô. */
  autoComplete?: 'current-password' | 'new-password' | 'name' | 'email' | 'off';
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
  compact = false,
  secureTextEntry,
  autoComplete,
}: TextFieldProps) {
  const { tokens, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const frameStyle = {
    minHeight: compact
      ? getMinTouchTarget()
      : Math.max(getMinTouchTarget(), tokens.component.field.minHeight),
    backgroundColor: tokens.color.surface.raised,
    borderColor: error
      ? tokens.color.feedback.danger.fg
      : focused
        ? tokens.color.action.primary
        : compact
          ? tokens.color.border.field
          : tokens.color.border.default,
    borderWidth: focused || error ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
    borderRadius: tokens.radius.md,
  } as const;
  const input = (
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      {...(placeholder ? { placeholder } : {})}
      placeholderTextColor={tokens.color.text.secondary}
      {...(keyboardType ? { keyboardType } : {})}
      {...(returnKeyType ? { returnKeyType } : {})}
      {...(onSubmitEditing ? { onSubmitEditing } : {})}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      {...(secureTextEntry ? { secureTextEntry } : {})}
      {...(autoComplete ? { autoComplete } : {})}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={[
        compact ? typography.formBody : typography.body,
        getInputResetStyle(),
        trailing
          ? {
              flex: 1,
              // token-exception: 2 là số cạnh viền (trên + dưới), không phải giá trị thiết kế
              minHeight: frameStyle.minHeight - 2 * tokens.borderWidth.thin,
              color: tokens.color.text.primary,
              paddingVertical: 0,
            }
          : {
              ...frameStyle,
              color: tokens.color.text.primary,
              paddingHorizontal: tokens.space.lg,
            },
      ]}
    />
  );
  return (
    <View style={styles.container}>
      {compact ? (
        <Text variant="formLabel" color="ink">
          {label}
        </Text>
      ) : (
        <Text bold>{label}</Text>
      )}
      {trailing ? (
        <View
          style={[
            frameStyle,
            styles.row,
            { paddingLeft: tokens.space.lg, paddingRight: tokens.space.sm },
          ]}
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
  container: { gap: layout.space.tight },
  row: { flexDirection: 'row', alignItems: 'center' },
});
