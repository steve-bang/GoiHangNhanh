import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { OrderSourcePicker } from './OrderSourcePicker';

describe('OrderSourcePicker (ORD-10)', () => {
  it('bốn nguồn, một lựa chọn (radio), chọn gọi onChange; không nói đã kết nối sàn', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<OrderSourcePicker value="lazada" onChange={onChange} />);
    for (const name of ['Shopee', 'TikTok Shop', 'Lazada', 'Khác / chưa xác định']) {
      expect(screen.getByText(name)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('source-option-lazada').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('source-option-shopee').props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByTestId('source-option-shopee'));
    expect(onChange).toHaveBeenCalledWith('shopee');
    expect(screen.queryByText(/kết nối|liên kết/i)).toBeNull();
    expect(screen.getByText('Nguồn bán chỉ để bạn phân loại đơn.')).toBeOnTheScreen();
  });
});
