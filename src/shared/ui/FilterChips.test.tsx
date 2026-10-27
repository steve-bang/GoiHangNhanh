import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '@/core/theme';
import { renderWithProviders } from '@/test-utils/render';

import { FilterChips } from './FilterChips';
import { Text } from './Text';

const OPTIONS = [
  { key: 'a', label: 'Kiện 1' },
  { key: 'b', label: 'Kiện 2' },
] as const;

const bg = (name: string) =>
  (
    StyleSheet.flatten(screen.getByRole('button', { name }).props.style as never) as {
      backgroundColor?: string;
    }
  ).backgroundColor;

describe('FilterChips kiểu solid (chọn kiện)', () => {
  it('chip được chọn tô đặc xanh, chip chưa chọn nền xám nhạt; trạng thái chọn vẫn báo cho trình đọc', async () => {
    await renderWithProviders(
      <FilterChips appearance="solid" options={OPTIONS} selectedKey="a" onSelect={jest.fn()} />,
    );
    expect(bg('Kiện 1')).toBe(colors.brand);
    expect(bg('Kiện 2')).toBe(colors.surfaceMuted);
    expect(screen.getByRole('button', { name: 'Kiện 1', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Kiện 2', selected: false })).toBeOnTheScreen();
    const color = (label: string) =>
      (StyleSheet.flatten(screen.getByText(label).props.style as never) as { color?: string })
        .color;
    expect(color('Kiện 1')).toBe(colors.onBrand);
  });

  it('phần tử trailing nằm CÙNG hàng (cùng khung xuống dòng) với các chip', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <FilterChips
        appearance="solid"
        options={OPTIONS}
        selectedKey="a"
        onSelect={onSelect}
        trailing={
          <Pressable testID="add" accessibilityRole="button">
            <Text>Thêm kiện</Text>
          </Pressable>
        }
      />,
    );
    const row = screen.getByTestId('add').parent;
    expect(screen.getByRole('button', { name: 'Kiện 1' }).parent).toBe(row);
    expect(screen.getByRole('button', { name: 'Kiện 2' }).parent).toBe(row);
    const style = StyleSheet.flatten(row?.props.style as never) as { flexWrap?: string };
    expect(style.flexWrap).toBe('wrap');
    await fireEvent.press(screen.getByRole('button', { name: 'Kiện 2' }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('kiểu mặc định (outlined) không đổi: chọn = nền xanh nhạt', async () => {
    await renderWithProviders(
      <FilterChips options={OPTIONS} selectedKey="a" onSelect={jest.fn()} />,
    );
    expect(bg('Kiện 1')).toBe(colors.brandSoft);
    expect(bg('Kiện 2')).toBe(colors.surface);
  });
});
