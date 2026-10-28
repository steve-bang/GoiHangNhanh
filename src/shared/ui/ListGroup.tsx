import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View, type AccessibilityRole } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from './theme';

interface ListGroupProps {
  /** Tiêu đề nhóm (chữ nhỏ đậm, mờ) đặt phía trên thẻ. */
  title?: string;
  /** Các `ListItem`/hàng tự lo lề; mỗi hàng cách nhau một đường kẻ mảnh. */
  children: ReactNode;
  testID?: string;
  /** Vai trò trợ năng của nhóm (ví dụ `radiogroup` khi các hàng là `radio`). Mặc định: không đặt. */
  accessibilityRole?: AccessibilityRole;
  /** Nhãn trợ năng của nhóm (đọc khi vào nhóm). Mặc định: không đặt. */
  accessibilityLabel?: string;
}

/**
 * Nhóm hàng kiểu iOS: một thẻ không padding, đường kẻ mảnh giữa các hàng, tiêu đề nhóm phía trên.
 * Hàng rỗng (`null`/`false`) bị bỏ nên không để lại đường kẻ thừa.
 */
export function ListGroup({
  title,
  children,
  testID,
  accessibilityRole,
  accessibilityLabel,
}: ListGroupProps) {
  const { tokens } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={{ gap: tokens.space.sm }}
    >
      {title ? (
        <Text variant="caption" bold color="textMuted" accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card flush>
        {rows.map((row, index) => (
          <Fragment key={isValidElement(row) && row.key !== null ? row.key : index}>
            {index > 0 ? (
              <View
                style={{
                  height: tokens.borderWidth.thin,
                  backgroundColor: tokens.color.border.default,
                }}
              />
            ) : null}
            {row}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}
