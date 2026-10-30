import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';
import { useRegion } from './use-region';
import { useReloadOnShopUpdated } from './use-shop-revision-reload';

/**
 * Tên cửa hàng đang dùng cho phần đầu Trang chủ (V1-10): cùng nguồn với thẻ cửa hàng ở Cá nhân
 * (`getShopSummary`), tải lại khi đổi tài khoản/shop hoặc vừa đổi tên shop. `undefined` = đang tải;
 * `null` = chưa có shop hoặc không đọc được (bên gọi hiện câu chung, KHÔNG bịa tên).
 */
export function useCurrentShopName(): string | null | undefined {
  const { account } = usePersonalGateways();
  const session = useSession();
  const shop = useRegion(() => account.getShopSummary(), session.key);
  useReloadOnShopUpdated(shop.reload);
  if (shop.state.status === 'loading') return undefined;
  if (shop.state.status === 'error') return null;
  return shop.state.data?.name ?? null;
}
