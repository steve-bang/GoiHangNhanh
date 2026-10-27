import { fireEvent, screen } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { QuantityStepper } from './QuantityStepper';

const flat = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as never) as Record<string, number | string>;

describe('QuantityStepper (ô liền "- 2 +")', () => {
  const original = Platform.OS;
  afterEach(() => {
    Platform.OS = original;
  });

  it('là MỘT ô liền: hai nút và giá trị cùng nằm trong một khung có viền, không còn nút rời', async () => {
    await renderWithProviders(<QuantityStepper value={2} onChange={jest.fn()} />);
    const box = screen.getByTestId('quantity-stepper');
    const minus = screen.getByRole('button', { name: 'Giảm số lượng' });
    const plus = screen.getByRole('button', { name: 'Tăng số lượng' });
    expect(minus.parent).toBe(box);
    expect(plus.parent).toBe(box);
    expect(screen.getByText('2').parent).toBe(box);
    expect(flat(box).borderWidth).toBeGreaterThan(0);
    // Nút không tự có viền riêng: chỉ khung ngoài có viền.
    expect(flat(minus).borderWidth).toBeUndefined();
  });

  it.each([
    ['ios', 44],
    ['android', 48],
  ] as const)('mỗi nút >= vùng chạm tối thiểu trên %s (%d)', async (os, min) => {
    Platform.OS = os;
    await renderWithProviders(<QuantityStepper value={2} onChange={jest.fn()} />);
    for (const name of ['Giảm số lượng', 'Tăng số lượng']) {
      const style = flat(screen.getByRole('button', { name }));
      expect(style.width).toBeGreaterThanOrEqual(min);
      expect(style.height).toBeGreaterThanOrEqual(min);
    }
  });

  it('nút trừ mờ và không bấm được khi đạt tối thiểu; nút cộng vẫn dùng được', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<QuantityStepper value={1} onChange={onChange} />);
    const minus = screen.getByRole('button', { name: 'Giảm số lượng' });
    expect(minus).toBeDisabled();
    expect(flat(minus).opacity).toBeLessThan(1);
    await fireEvent.press(minus);
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Tăng số lượng' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});
