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

// expo-crypto là mô-đun native: trong Jest `randomUUID` không chạy. Thay bằng bộ sinh có thứ tự để
// ID trong test khác nhau và đoán được.
jest.mock('expo-crypto', () => {
  let counter = 0;
  return {
    randomUUID: () => {
      counter += 1;
      return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
    },
  };
});

// Mặc định trong test không mở SQLite thật: kho bộ nhớ (null = dùng kho bộ nhớ). Kho SQLite được test
// riêng bằng SQLite của Node (src/features/orders/data/sqlite-order-store.test.ts).
jest.mock('@/platform/local-db', () => ({ openLocalDatabase: async () => null }));

// Vị trí thiết bị (expo-location là mô-đun native): mặc định có vị trí. Điều khiển qua `mockLocation`
// trong `src/test-utils/mock-location.ts`; test của chính adapter dùng `jest.unmock`.
jest.mock(
  '@/platform/location',
  () => jest.requireActual('@/test-utils/mock-location').locationMock,
);

// Trạng thái mạng (NetInfo là mô-đun native): mặc định có mạng Wi‑Fi. Điều khiển qua
// `setMockConnectivity` trong `src/test-utils/mock-connectivity.ts`; test của adapter dùng `jest.unmock`.
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
jest.mock(
  '@/platform/connectivity',
  () => jest.requireActual('@/test-utils/mock-connectivity').connectivityMock,
);

// Trình phát video cục bộ (expo-video là mô-đun native): thay bằng View ghi lại URI và `onError`.
// Điều khiển qua `mockVideoPlayer` trong `src/test-utils/mock-video-player.tsx`; test của adapter
// dùng `jest.unmock`.
jest.mock(
  '@/platform/video-player',
  () => jest.requireActual('@/test-utils/mock-video-player').videoPlayerMock,
);
