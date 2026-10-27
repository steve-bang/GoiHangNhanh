import { View } from 'react-native';

import { getMinTouchTarget } from '@/platform';
import { Icon, Text, useTheme } from '@/shared/ui';

/**
 * Ô chỉ đọc cho thông tin không sửa được ở bản này (email): nền xám nhạt + biểu tượng khóa + chú thích
 * giải thích. Gộp thành MỘT phần tử trợ năng (nhãn, giá trị, chú thích) vì không có thao tác nào.
 */
export function ReadOnlyField({
  label,
  value,
  note,
  testID,
}: {
  label: string;
  value: string;
  note: string;
  testID?: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      style={{ gap: tokens.space.tight }}
      accessible
      accessibilityLabel={`${label}. ${value}. ${note}`}
    >
      <Text bold>{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.space.sm,
          minHeight: Math.max(getMinTouchTarget(), tokens.component.field.minHeight),
          paddingHorizontal: tokens.space.lg,
          paddingVertical: tokens.space.sm,
          backgroundColor: tokens.color.surface.muted,
          borderColor: tokens.color.border.default,
          borderWidth: tokens.borderWidth.thin,
          borderRadius: tokens.radius.md,
        }}
      >
        <Text color="textMuted" style={{ flex: 1, flexShrink: 1 }} testID={testID}>
          {value}
        </Text>
        <Icon name="lock" size={18} color={tokens.color.text.secondary} />
      </View>
      <Text variant="caption" color="textMuted">
        {note}
      </Text>
    </View>
  );
}
