import type { OrderId, OrderLineId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';

import { toCodeKey } from '../domain/codes';
import { MAX_RECENT_SEARCHES } from '../domain/search';
import type { OrderStore } from '../domain/order-store';
import {
  compareListItems,
  isAfterCursor,
  lastActivityOf,
  matchesListQuery,
  type OrderListItem,
} from '../domain/order-list';
import { stampCreator, type CreatorUidProvider } from '../domain/creator';
import { canChangeSessionStatus } from '../domain/session-status';
import {
  findActiveSession,
  isSessionActive,
  isSessionStatusRecording,
} from '../domain/start-session';
import type { Order, OrderDetails, OrderLine, OrderPackage, PackingSession } from '../domain/types';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Kho trong bộ nhớ (Jest, bản web chụp ảnh giao diện, và khi không mở được SQLite). Mất khi app
 * đóng: KHÔNG dùng để giữ dữ liệu thật. Cùng hợp đồng với kho SQLite (order-store.contract.ts).
 */
export function createMemoryOrderStore(
  options: { creatorUid?: CreatorUidProvider } = {},
): OrderStore {
  const creatorUid = (): string | null => options.creatorUid?.() ?? null;
  const orders = new Map<OrderId, Order>();
  const lines = new Map<OrderLineId, OrderLine>();
  const packages = new Map<string, OrderPackage>();
  const sessions = new Map<SessionId, PackingSession>();
  const publishedOrders = new Map<OrderId, number>();
  const publishedSessions = new Map<SessionId, string>();
  const publishedPackages = new Map<string, number>();
  /** shopId -> (khóa chuẩn hóa -> mục). */
  const searches = new Map<string, Map<string, { text: string; lastUsedAtDevice: number }>>();

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

  const listMatching = (shopId: ShopId, query: Parameters<OrderStore['countOrders']>[1]) =>
    [...orders.values()]
      .filter((o) => o.shopId === shopId)
      .filter((o) => matchesListQuery(o, linesOf(o.id).length, query))
      .map((order): OrderListItem => {
        const orderLines = linesOf(order.id);
        const orderSessions = sessionsOf(shopId, order.id);
        const first = orderLines[0];
        const active = orderSessions.find((s) => isSessionActive(s));
        return {
          order,
          firstLine: first
            ? { name: first.name, variant: first.variant, quantity: first.quantity }
            : null,
          lineCount: orderLines.length,
          activeSession: active ? { id: active.id, packageId: active.packageId } : null,
          lastActivityDevice: lastActivityOf(order, orderSessions),
        };
      })
      .sort(compareListItems);

  return {
    async listOrders(shopId, query, page) {
      const all = listMatching(shopId, query);
      const after = page.after;
      const rest = after ? all.filter((item) => isAfterCursor(item, after)) : all;
      const items = rest.slice(0, page.limit);
      const last = items[items.length - 1];
      return copy({
        items,
        nextCursor:
          rest.length > page.limit && last
            ? { lastActivityDevice: last.lastActivityDevice, orderId: last.order.id }
            : null,
      });
    },
    async countOrders(shopId, query) {
      return listMatching(shopId, query).length;
    },
    async saveNewOrder(details) {
      if (orders.has(details.order.id)) throw new AppError('ORDER_SAVE_FAILED');
      const incoming = copy(details);
      const uid = creatorUid();
      orders.set(incoming.order.id, stampCreator(incoming.order, uid));
      for (const line of incoming.lines) lines.set(line.id, line);
      for (const pkg of incoming.packages) packages.set(pkg.id, stampCreator(pkg, uid));
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
    async updateOrder(shopId, orderId, edit) {
      const order = orderOf(shopId, orderId);
      if (!order) throw new AppError('ORDER_NOT_FOUND');
      if (sessionsOf(shopId, orderId).length > 0) throw new AppError('ORDER_HAS_SESSION');
      const incoming = copy(edit.lines);
      // Kiểm tra trước khi ghi (bộ nhớ không có giao dịch): dòng phải thuộc đơn này, ID dòng mới
      // không được trùng dòng của đơn khác; sai thì không đổi gì.
      for (const line of incoming) {
        const other = lines.get(line.id);
        if (line.orderId !== orderId || (other && other.orderId !== orderId)) {
          throw new AppError('ORDER_SAVE_FAILED');
        }
      }
      orders.set(orderId, { ...order, source: edit.source, trackingCode: edit.trackingCode });
      const keep = new Set(incoming.map((l) => l.id));
      for (const existing of linesOf(orderId))
        if (!keep.has(existing.id)) lines.delete(existing.id);
      for (const line of incoming) lines.set(line.id, line);
      return copy<OrderDetails>({
        order: orders.get(orderId) as Order,
        lines: linesOf(orderId),
        packages: packagesOf(orderId),
      });
    },
    async addPackage(shopId, pkg) {
      if (
        !orderOf(shopId, pkg.orderId) ||
        packages.has(pkg.id) ||
        packagesOf(pkg.orderId).some((p) => p.index === pkg.index)
      ) {
        throw new AppError('ORDER_SAVE_FAILED');
      }
      packages.set(pkg.id, stampCreator(copy(pkg), creatorUid()));
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
      sessions.set(session.id, stampCreator(copy(session), creatorUid()));
    },
    async getSession(shopId, id) {
      const session = sessions.get(id);
      return session && session.shopId === shopId ? copy(session) : null;
    },
    async updateSessionStatus(shopId, id, status) {
      const session = sessions.get(id);
      if (!session || session.shopId !== shopId) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      if (!canChangeSessionStatus(session.sessionStatus, status)) {
        throw new AppError('LOCAL_SAVE_UNAVAILABLE');
      }
      sessions.set(id, { ...session, sessionStatus: status });
    },
    async listSessionsOfOrder(shopId, orderId) {
      return sessionsOf(shopId, orderId).map(copy);
    },
    // Chưa có kho tệp bằng chứng: không có tệp nào để chưa đồng bộ (xem OrderStore.countUnsynced).
    async countUnsynced() {
      return 0;
    },
    async countUnsyncedOnDevice() {
      return 0;
    },
    async hasRecordingOnDevice() {
      return [...sessions.values()].some((s) => isSessionStatusRecording(s.sessionStatus));
    },
    async recordSearch(shopId, text, nowDevice) {
      const clean = text.trim().replace(/\s+/g, ' ');
      if (clean.length === 0) return;
      const mine = searches.get(shopId) ?? new Map();
      mine.set(toCodeKey(clean), { text: clean, lastUsedAtDevice: nowDevice });
      const newestFirst = [...mine.entries()].sort(
        (a, b) => b[1].lastUsedAtDevice - a[1].lastUsedAtDevice,
      );
      for (const [key] of newestFirst.slice(MAX_RECENT_SEARCHES)) mine.delete(key);
      searches.set(shopId, mine);
    },
    async listRecentSearches(shopId, limit) {
      return [...(searches.get(shopId)?.values() ?? [])]
        .sort((a, b) => b.lastUsedAtDevice - a.lastUsedAtDevice)
        .slice(0, limit)
        .map((s) => ({ ...s }));
    },
    async removeRecentSearch(shopId, text) {
      searches.get(shopId)?.delete(toCodeKey(text));
    },
    async clearRecentSearches(shopId) {
      searches.delete(shopId);
    },
    async listOrdersPendingRemote(shopId, limit, uid) {
      return [...orders.values()]
        .filter(
          (o) =>
            o.shopId === shopId &&
            o.createdBy === uid &&
            !publishedOrders.has(o.id) &&
            sessionsOf(shopId, o.id).length > 0,
        )
        .sort((a, b) => a.createdAtDevice - b.createdAtDevice)
        .slice(0, limit)
        .map((o) =>
          copy<OrderDetails>({ order: o, lines: linesOf(o.id), packages: packagesOf(o.id) }),
        );
    },
    async markOrderPublished(shopId, orderId, atDevice, uid, packageIds) {
      if (!orderOf(shopId, orderId)) return;
      publishedOrders.set(orderId, atDevice);
      for (const pkg of packagesOf(orderId)) {
        if (
          packageIds.includes(pkg.id) &&
          pkg.createdBy === uid &&
          !publishedPackages.has(pkg.id)
        ) {
          publishedPackages.set(pkg.id, atDevice);
        }
      }
    },
    async markPackagePublished(shopId, packageId, atDevice) {
      const pkg = packages.get(packageId);
      if (pkg && orderOf(shopId, pkg.orderId)) publishedPackages.set(packageId, atDevice);
    },
    async listSessionsPendingRemote(shopId, limit, uid) {
      return [...sessions.values()]
        .filter(
          (s) =>
            s.shopId === shopId &&
            s.createdBy === uid &&
            s.sessionStatus !== 'created' &&
            publishedSessions.get(s.id) !== s.sessionStatus &&
            publishedOrders.has(s.orderId) &&
            (publishedPackages.has(s.packageId) || packages.get(s.packageId)?.createdBy === uid),
        )
        .sort((a, b) => a.startedAtDevice - b.startedAtDevice)
        .slice(0, limit)
        .map((s) => ({
          session: copy(s),
          status: s.sessionStatus as string,
          packagePending: !publishedPackages.has(s.packageId),
        }));
    },
    async markSessionPublished(shopId, sessionId, status) {
      const session = sessions.get(sessionId);
      if (session && session.shopId === shopId) publishedSessions.set(sessionId, status);
    },
    async isSessionPublished(shopId, sessionId) {
      return sessions.get(sessionId)?.shopId === shopId && publishedSessions.has(sessionId);
    },
    async hasRecordingInProgress(shopId) {
      return [...sessions.values()].some(
        (s) => s.shopId === shopId && isSessionStatusRecording(s.sessionStatus),
      );
    },
  };
}
