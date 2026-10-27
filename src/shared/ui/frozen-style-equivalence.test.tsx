import { screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { Button } from './Button';
import { Text } from './Text';

/**
 * `Button` và `Text` còn được các màn đã được khách hàng xác nhận (đăng nhập, đăng ký, OTP...) dùng.
 * Khi thay literal bằng token, style phải GIỮ NGUYÊN: các số dưới đây là giá trị trước khi có token
 * (docs/design-token-spec.md mục 7). Đổi một số ở đây = đổi giao diện màn đã verify: cần khách hàng duyệt.
 */
function styleOf(name: string): Record<string, unknown> {
  const node = screen.getByRole('button', { name });
  return StyleSheet.flatten(node.props.style as never) as Record<string, unknown>;
}

describe('Button giữ nguyên style so với trước khi có token', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('nút chính: cao 56, viền 1.5, bo 12, đệm 16/8, đặc hoàn toàn', async () => {
    Platform.OS = 'android';
    await renderWithProviders(<Button label="Chính" onPress={() => undefined} />);
    expect(styleOf('Chính')).toMatchObject({
      minHeight: 56,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      opacity: 1,
      backgroundColor: '#157852',
    });
  });

  it('nút compact cao 50; nút slim viền 1', async () => {
    Platform.OS = 'android';
    await renderWithProviders(
      <>
        <Button label="Compact" size="compact" onPress={() => undefined} />
        <Button label="Slim" size="slim" variant="secondary" onPress={() => undefined} />
      </>,
    );
    expect(styleOf('Compact')).toMatchObject({ minHeight: 50, borderWidth: 1.5 });
    expect(styleOf('Slim')).toMatchObject({ minHeight: 48, borderWidth: 1 });
  });

  it('vô hiệu 0.45, đang xử lý 0.8', async () => {
    await renderWithProviders(
      <>
        <Button label="Tắt" disabled onPress={() => undefined} />
        <Button label="Bận" loading onPress={() => undefined} />
      </>,
    );
    expect(styleOf('Tắt').opacity).toBe(0.45);
    expect(styleOf('Bận').opacity).toBe(0.8);
  });
});

describe('Text giữ nguyên trọng số', () => {
  it('bold = 700', async () => {
    await renderWithProviders(
      <Text bold testID="t">
        x
      </Text>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('t').props.style as never) as {
      fontWeight?: string;
    };
    expect(style.fontWeight).toBe('700');
  });
});
