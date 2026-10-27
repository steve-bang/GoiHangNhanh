import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { ProductLineList } from './ProductLineList';

describe('ProductLineList', () => {
  it('chưa có dòng nào thì hiện nhãn Chưa khai báo sản phẩm', async () => {
    await renderWithProviders(<ProductLineList lines={[]} />);
    expect(screen.getByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
  });

  it('đã có dòng sản phẩm thì KHÔNG hiện nhãn Chưa khai báo (docs/09 mục 5.5, A.6)', async () => {
    await renderWithProviders(
      <ProductLineList
        lines={[{ id: 'l1', name: 'Áo thun cotton', variant: 'Đen / XL', quantity: 2 }]}
      />,
    );
    expect(screen.queryByText('Chưa khai báo sản phẩm')).toBeNull();
    expect(screen.getByText('Áo thun cotton')).toBeOnTheScreen();
    expect(screen.getByText('Số lượng 2')).toBeOnTheScreen();
    expect(screen.getByText('Do bạn nhập')).toBeOnTheScreen();
  });

  it('giữ các variant khác nhau thành các dòng riêng, không gộp', async () => {
    await renderWithProviders(
      <ProductLineList
        lines={[
          { id: 'l1', name: 'Áo thun', variant: 'Đen / XL', quantity: 1 },
          { id: 'l2', name: 'Áo thun', variant: 'Trắng / L', quantity: 1 },
        ]}
      />,
    );
    expect(screen.getAllByText('Áo thun')).toHaveLength(2);
    expect(screen.getByText('Đen / XL')).toBeOnTheScreen();
    expect(screen.getByText('Trắng / L')).toBeOnTheScreen();
  });
});
