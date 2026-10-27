import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { useTheme } from './theme';

interface SearchFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Vừa là gợi ý vừa là nhãn đọc màn hình (ví dụ "Tìm theo mã đơn hoặc mã vận đơn"). */
  placeholder: string;
  onSubmitEditing?: () => void;
  testID?: string;
}

/** Ô tìm lớn có biểu tượng kính lúp và nút xóa nội dung. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  testID,
}: SearchFieldProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius, typography } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: Math.max(touch, 52),
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.md,
          paddingLeft: spacing.md,
        },
      ]}
    >
      <Icon name="search" color={colors.textMuted} />
      <TextInput
        testID={testID}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        {...(onSubmitEditing ? { onSubmitEditing } : {})}
        autoCapitalize="none"
        autoCorrect={false}
        style={[typography.body, styles.input, { color: colors.text }]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.clearText')}
          onPress={() => onChangeText('')}
          style={[styles.clear, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="close" color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  input: { flex: 1, paddingVertical: 8 },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
