import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';
import { useTheme } from './theme';

interface ListGroupProps {
  /** Tiêu đề nhóm (chữ nhỏ đậm, mờ) đặt phía trên thẻ. */
  title?: string;
  /** Các `ListItem`/hàng tự lo lề; mỗi hàng cách nhau một đường kẻ mảnh. */
  children: ReactNode;
  testID?: string;
}

/**
 * Nhóm hàng kiểu iOS: một thẻ không padding, đường kẻ mảnh giữa các hàng, tiêu đề nhóm phía trên.
 * Hàng rỗng (`null`/`false`) bị bỏ nên không để lại đường kẻ thừa.
 */
export function ListGroup({ title, children, testID }: ListGroupProps) {
  const { tokens } = useTheme();
  const rows = Children.toArray(children);
  return (
    <View testID={testID} style={{ gap: tokens.space.sm }}>
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
