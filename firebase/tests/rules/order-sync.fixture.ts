import type { SessionId } from '@/core/ids';
import { buildOrder } from '@/features/orders/domain/build-order';
import { buildPackingSession } from '@/features/orders/domain/start-session';

/** Đơn + phiên mẫu do chính mã ứng dụng dựng (khác dữ liệu nền viết tay của helpers.ts). */
export function makeOrderFixture(shopId: string, orderId: string) {
  let n = 0;
  const result = buildOrder(
    {
      orderCode: 'SYNC-01',
      source: 'shopee',
      trackingCode: 'SPX123',
      lines: [
        { name: 'Áo', variant: 'Đen / XL', quantity: 2 },
        { name: 'Quần', variant: '', quantity: 1 },
      ],
    },
    {
      shopId: shopId as never,
      nowDevice: 1_700_000_000_000,
      ids: {
        orderId: () => orderId as never,
        lineId: () => `${orderId}-line-${(n += 1)}` as never,
        packageId: () => `${orderId}-pkg` as never,
      },
    },
  );
  if (!result.ok) throw new Error('fixture invalid');
  const pkg = result.details.packages[0];
  if (!pkg) throw new Error('fixture invalid');
  const built = buildPackingSession(result.details, pkg.id, {
    sessionId: `${orderId}-session` as SessionId,
    nowDevice: 1_700_000_100_000,
  });
  if (!built.ok) throw new Error('fixture invalid');
  return { details: result.details, session: built.session };
}
