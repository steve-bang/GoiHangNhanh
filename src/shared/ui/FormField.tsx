import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { TextField } from './TextField';
import { useTheme } from './theme';

type TextFieldProps = ComponentProps<typeof TextField>;

interface FormFieldProps extends Omit<TextFieldProps, 'secureTextEntry'> {
  /** Gợi ý luôn hiện dưới ô (ví dụ "Từ 8 ký tự"); không thay thế thông báo lỗi. */
  hint?: string;
}

/**
 * Ô nhập của biểu mẫu: nhãn luôn hiện, lỗi đỏ có chữ (đọc ngay khi hiện), gợi ý tùy chọn. Dựa trên
 * `TextField` (nhãn + lỗi + vùng chạm) để mọi biểu mẫu cùng một hành vi trợ năng.
 */
export function FormField({ hint, ...field }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <TextField {...field} />
      {hint && !field.error ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/** Ô mật khẩu: ẩn mặc định, nút Hiện/Ẩn có nhãn chữ cho trình đọc màn hình. */
export function PasswordField({
  hint,
  autoComplete = 'current-password',
  ...field
}: FormFieldProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const touch = getMinTouchTarget();
  const toggleLabel = revealed
    ? t('common:actions.hidePassword')
    : t('common:actions.showPassword');
  return (
    <View style={styles.field}>
      <TextField
        {...field}
        autoComplete={autoComplete}
        secureTextEntry={!revealed}
        trailing={
          <Pressable
            testID={field.testID ? `${field.testID}-toggle` : undefined}
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            accessibilityState={{ selected: revealed }}
            style={[styles.toggle, { minWidth: touch, minHeight: touch }]}
          >
            <Icon
              name={revealed ? 'eye-off' : 'eye'}
              size={20}
              color={tokens.color.text.secondary}
            />
          </Pressable>
        }
      />
      {hint && !field.error ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: 'stretch' },
  toggle: { alignItems: 'center', justifyContent: 'center' },
});
