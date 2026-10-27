import type { OrderId, OrderLineId, PackageId, SessionId } from '@/core/ids';
import {
  LOCAL_SHOP_ID,
  type OrderDetails,
  type OrderStore,
  type PackingSession,
} from '@/features/orders';

/** Đơn mẫu cho test: 1 kiện, 2 dòng cùng tên khác variant (không gộp), có mã vận đơn. */
export function sampleOrder(overrides: { withLines?: boolean; tracking?: string | null } = {}) {
  const withLines = overrides.withLines ?? true;
  const orderId = 'order-fixture' as OrderId;
  const details: OrderDetails = {
    order: {
      id: orderId,
      shopId: LOCAL_SHOP_ID,
      orderCode: 'DH1234567890',
      source: 'tiktok_shop',
      trackingCode: overrides.tracking === undefined ? 'SPX1234567890' : overrides.tracking,
      dataOrigin: 'entered_by_user',
      createdAtDevice: 1_000,
    },
    lines: withLines
      ? [
          {
            id: 'line-1' as OrderLineId,
            orderId,
            name: 'Áo thun cotton',
            variant: 'Đen / XL',
            quantity: 2,
            position: 0,
            dataOrigin: 'entered_by_user',
            createdAtDevice: 1_000,
          },
          {
            id: 'line-2' as OrderLineId,
            orderId,
            name: 'Áo thun cotton',
            variant: 'Trắng / L',
            quantity: 1,
            position: 1,
            dataOrigin: 'entered_by_user',
            createdAtDevice: 1_000,
          },
        ]
      : [],
    packages: [{ id: 'pkg-1' as PackageId, orderId, index: 1, createdAtDevice: 1_000 }],
  };
  return details;
}

export async function seedOrder(store: OrderStore, details = sampleOrder()): Promise<OrderDetails> {
  await store.saveNewOrder(details);
  return details;
}

export function sampleSession(details = sampleOrder(), startedAtDevice = 1_000): PackingSession {
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  return {
    id: 'session-fixture' as SessionId,
    shopId: details.order.shopId,
    orderId: details.order.id,
    packageId: pkg.id,
    startedAtDevice,
    snapshot: {
      orderCode: details.order.orderCode,
      source: details.order.source,
      trackingCode: details.order.trackingCode,
      lines: details.lines.map((l) => ({ name: l.name, variant: l.variant, quantity: l.quantity })),
      packageIndex: pkg.index,
      packageCount: details.packages.length,
      takenAtDevice: startedAtDevice,
    },
    sessionStatus: 'created',
  };
}
