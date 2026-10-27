import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import type { ShopSummary } from '../domain/types';
import { useSession } from './SessionProvider';

/** Dữ liệu và công cụ dùng chung cho test màn cửa hàng (PER-05..07). Chỉ dùng trong test. */
export const SHOP_A: ShopSummary = {
  id: 'shop-a',
  name: 'Shop A',
  role: 'owner',
  status: 'active',
  canEdit: true,
};
export const SHOP_B: ShopSummary = {
  id: 'shop-b',
  name: 'Shop B',
  role: 'member',
  status: 'active',
  canEdit: false,
};
export const SHOP_C: ShopSummary = {
  id: 'shop-c',
  name: 'Shop C',
  role: 'owner',
  status: 'suspended',
  canEdit: true,
};

const USER = { uid: 'fake-user-1', email: 'demo@example.com', displayName: 'An' };

/** Đưa phiên vào trạng thái đã đăng nhập vào `shopId`, và phơi trạng thái phiên ra để kiểm tra. */
export function SessionProbe({ shopId = 'shop-a' }: { shopId?: string | null }) {
  const session = useSession();
  return (
    <>
      <Text testID="probe-status">{session.state.status}</Text>
      <Text testID="probe-key">{session.key}</Text>
      <Text testID="probe-shop-revision">{String(session.state.shopRevision)}</Text>
      <Pressable testID="probe-begin" onPress={() => session.beginSession(USER, shopId)} />
      <Pressable testID="probe-shop-updated" onPress={() => session.notifyShopUpdated()} />
    </>
  );
}

export async function beginProbeSession(): Promise<void> {
  await fireEvent.press(screen.getByTestId('probe-begin'));
  await waitFor(() => expect(screen.getByTestId('probe-status')).toHaveTextContent('signed_in'));
}
