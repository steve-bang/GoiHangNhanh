import { render, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { ORDER_SOURCES } from '@/core/orders/order-source';

import { OrderCard } from './OrderCard';
import { SourceIcon } from './SourceIcon';

const HIDDEN = { includeHiddenElements: true } as const;

describe('SourceIcon', () => {
  it.each(['shopee', 'tiktok_shop'] as const)('%s hiện ảnh logo thật', async (source) => {
    await render(<SourceIcon source={source} />);
    expect(screen.getByTestId(`source-icon-image-${source}`, HIDDEN)).toBeOnTheScreen();
  });

  it.each(['lazada', 'other'] as const)('%s dùng ô dự phòng, không có ảnh', async (source) => {
    await render(<SourceIcon source={source} />);
    expect(screen.getByTestId(`source-icon-${source}`, HIDDEN)).toBeOnTheScreen();
    expect(screen.queryByTestId(`source-icon-image-${source}`, HIDDEN)).toBeNull();
  });

  it('mọi nguồn đều ẩn khỏi trình đọc màn hình (trang trí)', async () => {
    for (const source of ORDER_SOURCES) {
      const { unmount } = await render(<SourceIcon source={source} />);
      const node = screen.getByTestId(`source-icon-${source}`, HIDDEN);
      expect(node.props.accessibilityElementsHidden).toBe(true);
      expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
      await unmount();
    }
  });

  it('theo kích thước truyền vào, mặc định 36', async () => {
    const { rerender } = await render(<SourceIcon source="shopee" />);
    const flat = () =>
      Object.assign(
        {},
        ...[screen.getByTestId('source-icon-shopee', HIDDEN).props.style].flat(),
      ) as { width: number; height: number };
    expect(flat().width).toBe(36);
    await rerender(<SourceIcon source="shopee" size={20} />);
    expect(flat().height).toBe(20);
  });
});

describe('OrderCard với nguồn bán', () => {
  it('vẫn có nhãn chữ nguồn bán khi hiện logo', async () => {
    await renderWithProviders(
      <OrderCard
        orderCode="DH1"
        sourceLabel="Shopee"
        source="shopee"
        dateLabel="Hôm nay"
        videoCount={1}
      />,
    );
    expect(screen.getByText('Shopee · Hôm nay')).toBeOnTheScreen();
    expect(screen.getByTestId('source-icon-image-shopee', HIDDEN)).toBeTruthy();
  });
});
