import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';

import { toCodeKey } from '../domain/codes';
import type { OrderStore } from '../domain/order-store';
import { findActiveSession } from '../domain/start-session';
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

  const orderOf = (shopId: ShopId, id: OrderId) => {
    const order = orders.get(id);
    return order && order.shopId === shopId ? order : undefined;
  };
  const sessionsOf = (shopId: ShopId, orderId: OrderId) =>
    [...sessions.values()]
      .filter((s) => s.orderId === orderId && s.shopId === shopId)
      .sort((a, b) => b.startedAtDevice - a.startedAtDevice);

  return {
    async saveNewOrder(details) {
      if (orders.has(details.order.id)) throw new AppError('ORDER_SAVE_FAILED');
      const incoming = copy(details);
      orders.set(incoming.order.id, incoming.order);
      for (const line of incoming.lines) lines.set(line.id, line);
      for (const pkg of incoming.packages) packages.set(pkg.id, pkg);
    },
    async getOrder(shopId, id) {
      const order = orderOf(shopId, id);
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
    async updateLineQuantity(shopId, lineId, quantity) {
      const line = lines.get(lineId);
      if (!line || !orderOf(shopId, line.orderId)) throw new AppError('ORDER_SAVE_FAILED');
      if (sessionsOf(shopId, line.orderId).length > 0) throw new AppError('ORDER_HAS_SESSION');
      lines.set(lineId, { ...line, quantity });
    },
    async addPackage(shopId, pkg) {
      if (
        !orderOf(shopId, pkg.orderId) ||
        packages.has(pkg.id) ||
        packagesOf(pkg.orderId).some((p) => p.index === pkg.index)
      ) {
        throw new AppError('ORDER_SAVE_FAILED');
      }
      packages.set(pkg.id, copy(pkg));
    },
    async saveSession(session) {
      const pkg = packages.get(session.packageId);
      if (!orderOf(session.shopId, session.orderId) || !pkg || pkg.orderId !== session.orderId) {
        throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      }
      if (findActiveSession(sessionsOf(session.shopId, session.orderId), session.packageId)) {
        throw new AppError('PACKAGE_SESSION_ACTIVE');
      }
      if (sessions.has(session.id)) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      sessions.set(session.id, copy(session));
    },
    async getSession(shopId, id) {
      const session = sessions.get(id);
      return session && session.shopId === shopId ? copy(session) : null;
    },
    async listSessionsOfOrder(shopId, orderId) {
      return sessionsOf(shopId, orderId).map(copy);
    },
  };
}
