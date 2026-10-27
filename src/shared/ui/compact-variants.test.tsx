import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { typography } from '@/core/theme';
import { getMinTouchTarget } from '@/platform';
import { renderWithProviders } from '@/test-utils/render';

import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { FilterChips } from './FilterChips';
import { OrderCard } from './OrderCard';
import { SearchField } from './SearchField';
import { Text } from './Text';

const style = (el: { props: { style?: unknown } }) =>
  StyleSheet.flatten(el.props.style as never) as Record<string, number | string | undefined>;

describe('biến thể gọn (tab Đơn hàng dùng nhóm chữ form, Q-18)', () => {
  it('FilterChips compact: chip thấp, chữ formButton, vùng chạm bù bằng hitSlop >= tối thiểu', async () => {
    const onSelect = jest.fn();
    await renderWithProviders(
      <FilterChips
        size="compact"
        options={[
          { key: 'a', label: 'Tất cả' },
          { key: 'b', label: 'Chưa có video' },
        ]}
        selectedKey="a"
        onSelect={onSelect}
      />,
    );
    const chip = screen.getByRole('button', { name: 'Chưa có video' });
    const s = style(chip);
    const slop = chip.props.hitSlop as { top: number; bottom: number };
    expect(s.minHeight).toBeLessThan(getMinTouchTarget());
    expect(Number(s.minHeight) + slop.top + slop.bottom).toBeGreaterThanOrEqual(
      getMinTouchTarget(),
    );
    expect(style(screen.getByText('Chưa có video')).fontSize).toBe(typography.formButton.fontSize);
    fireEvent.press(chip);
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('SearchField compact: chữ formBody 14sp, cao tối thiểu bằng vùng chạm', async () => {
    await renderWithProviders(
      <SearchField compact value="" onChangeText={jest.fn()} placeholder="Tìm" />,
    );
    expect(style(screen.getByLabelText('Tìm')).fontSize).toBe(typography.formBody.fontSize);
  });

  it('EmptyState compact: mô tả 14sp, vẫn có nút hành động cụ thể', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState
        compact
        title="Trống"
        message="Mô tả"
        actionLabel="Tạo đơn"
        onAction={onAction}
      />,
    );
    expect(style(screen.getByText('Mô tả')).fontSize).toBe(typography.formBody.fontSize);
    fireEvent.press(screen.getByRole('button', { name: 'Tạo đơn' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('Card compact: padding nhỏ hơn mặc định', async () => {
    await renderWithProviders(
      <>
        <Card testID="c1" compact>
          <Text>a</Text>
        </Card>
        <Card testID="c2">
          <Text>b</Text>
        </Card>
      </>,
    );
    expect(Number(style(screen.getByTestId('c1')).padding)).toBeLessThan(
      Number(style(screen.getByTestId('c2')).padding),
    );
  });

  it('OrderCard: mã đơn 15sp đậm (nhỏ hơn 24sp cũ), dòng phụ >= 13sp, hành động có hitSlop đủ vùng chạm', async () => {
    await renderWithProviders(
      <OrderCard
        testID="oc"
        orderCode="DH-1"
        sourceLabel="Shopee"
        trackingLabel="Mã vận đơn: X"
        product={{ name: 'Áo', variant: 'Đen' }}
        dateLabel="Tạo lúc 1"
        statusBadge={<Text>Chưa có video</Text>}
        statusText="Chưa có video"
        actionLabel="Quay ngay"
        onPress={jest.fn()}
        onPressAction={jest.fn()}
      />,
    );
    expect(style(screen.getByText('DH-1')).fontSize).toBe(15);
    expect(style(screen.getByText('Shopee')).fontSize).toBeGreaterThanOrEqual(13);
    const action = screen.getByTestId('oc-action');
    const slop = action.props.hitSlop as { top: number; bottom: number };
    expect(Number(style(action).minHeight) + slop.top + slop.bottom).toBeGreaterThanOrEqual(
      getMinTouchTarget(),
    );
  });
});
