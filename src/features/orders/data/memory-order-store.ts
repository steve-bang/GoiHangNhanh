import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';

import { toCodeKey } from '../domain/codes';
import type { OrderStore } from '../domain/order-store';
import type { Order, OrderDetails, OrderLine, OrderPackage, PackingSession } from '../domain/types';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Kho trong bộ nhớ (Jest, bản web chụp ảnh giao diện, và khi không mở được SQLite). Mất khi app
 * đóng: KHÔNG dùng để giữ dữ liệu thật. Cùng hợp đồng với kho SQLite (order-store.contract.ts).
 */
export function createMemoryOrderStore(): OrderStore {
  const orders = new Map<OrderId, Order>();
  const lines = new Map<OrderLineId, OrderLine>();
  const packages = new Map<string, OrderPackage>();
  const sessions = new Map<SessionId, PackingSession>();

  const linesOf = (orderId: OrderId) =>
    [...lines.values()]
      .filter((l) => l.orderId === orderId)
      .sort((a, b) => a.position - b.position);
  const packagesOf = (orderId: OrderId) =>
    [...packages.values()].filter((p) => p.orderId === orderId).sort((a, b) => a.index - b.index);

  return {
    async saveNewOrder(details) {
      if (orders.has(details.order.id)) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      const incoming = copy(details);
      orders.set(incoming.order.id, incoming.order);
      for (const line of incoming.lines) lines.set(line.id, line);
      for (const pkg of incoming.packages) packages.set(pkg.id, pkg);
    },
    async getOrder(id) {
      const order = orders.get(id);
      if (!order) return null;
      return copy<OrderDetails>({ order, lines: linesOf(id), packages: packagesOf(id) });
    },
    async findOrdersByCodes(shopId: ShopId, query) {
      return [...orders.values()]
        .filter((o) => o.shopId === shopId)
        .filter(
          (o) =>
            (query.orderCodeKey !== undefined && toCodeKey(o.orderCode) === query.orderCodeKey) ||
            (query.trackingCodeKey !== undefined &&
              o.trackingCode !== null &&
              toCodeKey(o.trackingCode) === query.trackingCodeKey),
        )
        .sort((a, b) => b.createdAtDevice - a.createdAtDevice)
        .map(copy);
    },
    async listRecentLines(shopId, limit) {
      return [...lines.values()]
        .filter((l) => orders.get(l.orderId)?.shopId === shopId)
        .sort((a, b) => b.createdAtDevice - a.createdAtDevice)
        .slice(0, limit)
        .map(copy);
    },
    async updateLineQuantity(lineId, quantity) {
      const line = lines.get(lineId);
      if (!line) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      lines.set(lineId, { ...line, quantity });
    },
    async addPackage(pkg) {
      if (!orders.has(pkg.orderId)) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      packages.set(pkg.id, copy(pkg));
    },
    async saveSession(session) {
      if (sessions.has(session.id)) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      sessions.set(session.id, copy(session));
    },
    async getSession(id) {
      const session = sessions.get(id);
      return session ? copy(session) : null;
    },
  };
}
