import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Card, Icon, Text, useTheme } from '@/shared/ui';

/**
 * Thông báo trạng thái dữ liệu trên màn (dữ liệu đã lưu, làm mới lỗi): thẻ cảnh báo có biểu tượng và
 * chữ, không chỉ chữ xám. `alert` để trình đọc màn hình đọc ngay khi xuất hiện.
 */
export function Notice({
  children,
  alert = false,
  testID,
}: {
  children: ReactNode;
  alert?: boolean;
  testID?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card tone="warning" compact>
      <View
        testID={testID}
        accessible
        {...(alert ? { accessibilityRole: 'alert' as const } : {})}
        style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}
      >
        <Icon name="info" size={18} color={tokens.color.feedback.warning.fg} />
        <Text variant="caption" style={{ flex: 1, flexShrink: 1 }}>
          {children}
        </Text>
      </View>
    </Card>
  );
}
