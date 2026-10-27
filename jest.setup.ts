// Cài đặt chung cho project `unit`.
// Font icon của @expo/vector-icons tải bất đồng bộ qua expo-font/expo-asset và không chạy được
// trong Jest. Thay bằng component đơn giản hiển thị tên glyph để test kiểm tra được biểu tượng nào
// được dùng (ví dụ: Đã lưu trên máy không dùng glyph dấu tick).
import type * as ReactTypes from 'react';
import type * as ReactNativeTypes from 'react-native';

jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = jest.requireActual<typeof ReactTypes>('react');
  const { Text } = jest.requireActual<typeof ReactNativeTypes>('react-native');
  const Ionicons = ({ name, color }: { name: string; color?: string }) =>
    React.createElement(Text, { testID: `icon-${name}`, style: { color } }, name);
  return { __esModule: true, default: Ionicons };
});
