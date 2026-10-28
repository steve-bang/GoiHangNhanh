import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CurrentShopProvider, useCurrentShopId } from './current-shop';
import { LOCAL_SHOP_ID } from '../domain/local-shop';

function Probe() {
  return <Text testID="shop">{useCurrentShopId()}</Text>;
}

describe('useCurrentShopId', () => {
  it('không có provider: dùng shop cục bộ tạm', async () => {
    await render(<Probe />);
    expect(screen.getByTestId('shop')).toHaveTextContent(LOCAL_SHOP_ID);
  });

  it('phiên chưa biết shop (null): dùng shop cục bộ tạm, không đoán shop khác', async () => {
    await render(
      <CurrentShopProvider shopId={null}>
        <Probe />
      </CurrentShopProvider>,
    );
    expect(screen.getByTestId('shop')).toHaveTextContent(LOCAL_SHOP_ID);
  });

  it('theo shop của phiên và đổi theo khi phiên đổi shop', async () => {
    const view = await render(
      <CurrentShopProvider shopId="shop-a">
        <Probe />
      </CurrentShopProvider>,
    );
    expect(screen.getByTestId('shop')).toHaveTextContent('shop-a');
    await view.rerender(
      <CurrentShopProvider shopId="shop-b">
        <Probe />
      </CurrentShopProvider>,
    );
    expect(screen.getByTestId('shop')).toHaveTextContent('shop-b');
  });
});
