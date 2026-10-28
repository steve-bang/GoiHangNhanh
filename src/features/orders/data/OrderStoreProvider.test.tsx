import { useEffect } from 'react';
import { act, render } from '@testing-library/react-native';

import type { OrderStore } from '../domain/order-store';
import { CurrentShopProvider } from './current-shop';
import { OrderStoreProvider, useOrderStore } from './OrderStoreProvider';
import { makeOrder } from './order-store.contract';

// Không có SQLite thật trong Jest: kho cục bộ rơi về kho bộ nhớ (cùng hợp đồng).
jest.mock('@/platform', () => ({ openLocalDatabase: async () => null }));

const seen: OrderStore[] = [];
function Capture({ onStore }: { onStore: (store: OrderStore) => void }) {
  const store = useOrderStore();
  useEffect(() => onStore(store), [onStore, store]);
  return null;
}

describe('OrderStoreProvider: người tạo bản ghi', () => {
  it('kho ghi uid của phiên đăng nhập HIỆN TẠI mỗi lần lưu (đổi tài khoản thì bản ghi mới mang uid mới)', async () => {
    const tree = (uid: string | null) => (
      <CurrentShopProvider shopId="shop-a" uid={uid}>
        <OrderStoreProvider>
          <Capture onStore={(store) => void seen.push(store)} />
        </OrderStoreProvider>
      </CurrentShopProvider>
    );
    const view = await render(tree('user-a'));
    const store = seen[0];
    if (!store) throw new Error('store');
    const first = makeOrder('P-1', { shopId: 'shop-a' as never });
    await act(async () => store.saveNewOrder(first));
    await view.rerender(tree('user-b'));
    expect(new Set(seen).size).toBe(1); // cùng một kho, không dựng lại
    const second = makeOrder('P-2', { shopId: 'shop-a' as never });
    await act(async () => store.saveNewOrder(second));
    expect((await store.getOrder('shop-a' as never, first.order.id))?.order.createdBy).toBe(
      'user-a',
    );
    expect((await store.getOrder('shop-a' as never, second.order.id))?.order.createdBy).toBe(
      'user-b',
    );
  });
});
