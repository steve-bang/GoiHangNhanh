import { fireEvent, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { colors } from '@/core/theme';
import { renderWithProviders } from '@/test-utils/render';

import { Button } from './Button';

function minHeightOf(label: string): number {
  const node = screen.getByRole('button', { name: label });
  const style = StyleSheet.flatten(node.props.style as never) as { minHeight?: number };
  return style.minHeight ?? 0;
}

function backgroundOf(label: string): unknown {
  const node = screen.getByRole('button', { name: label });
  return (StyleSheet.flatten(node.props.style as never) as { backgroundColor?: unknown })
    .backgroundColor;
}

describe('Button', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it.each([
    ['ios', 44],
    ['android', 48],
  ] as const)('vùng chạm tối thiểu trên %s >= %d', async (os, min) => {
    Platform.OS = os;
    await renderWithProviders(
      <Button label="Thử tải lên lại" variant="secondary" onPress={() => undefined} />,
    );
    expect(minHeightOf('Thử tải lên lại')).toBeGreaterThanOrEqual(min);
  });

  it('nút chính cao tối thiểu 56 để bấm một tay', async () => {
    await renderWithProviders(<Button label="Bắt đầu quay" onPress={() => undefined} />);
    expect(minHeightOf('Bắt đầu quay')).toBeGreaterThanOrEqual(56);
  });

  it('chỉ nút phá hủy dùng nền đỏ', async () => {
    await renderWithProviders(
      <>
        <Button label="Chính" onPress={() => undefined} />
        <Button label="Phụ" variant="secondary" onPress={() => undefined} />
        <Button label="Xóa" variant="destructive" onPress={() => undefined} />
      </>,
    );
    expect(backgroundOf('Chính')).toBe(colors.brand);
    expect(backgroundOf('Phụ')).toBe(colors.surface);
    expect(backgroundOf('Xóa')).toBe(colors.danger);
  });

  it('không gọi onPress khi bị vô hiệu hóa', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Lưu" disabled onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('đang xử lý (loading): khóa nút, báo bận, không gọi onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Tạo" loading onPress={onPress} />);
    const node = screen.getByRole('button', { name: 'Tạo' });
    expect(node.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(node);
    expect(onPress).not.toHaveBeenCalled();
  });
});
