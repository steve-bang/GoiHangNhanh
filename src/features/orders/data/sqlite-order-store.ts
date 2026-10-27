import type { OrderId, OrderLineId, PackageId, SessionId, ShopId } from '@/core/ids';
import { AppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { logger } from '@/core/logging/logger';
import { toOrderSource } from '@/core/orders/order-source';
import { applyConnectionSettings, type SqlDatabase } from '@/platform/sql-database';

import type { OrderStore } from '../domain/order-store';
import type {
  Order,
  OrderLine,
  OrderPackage,
  OrderSnapshot,
  PackingSession,
} from '../domain/types';
import { toCodeKey } from '../domain/codes';
import type { OrderListItem, OrderListQuery } from '../domain/order-list';
import { findActiveSession, isSessionStatusActive } from '../domain/start-session';
import { MIGRATIONS } from './sqlite-migrations';

interface OrderRow {
  id: string;
  shop_id: string;
  order_code: string;
  source: string;
  tracking_code: string | null;
  created_at_device: number;
}
interface LineRow {
  id: string;
  order_id: string;
  name: string;
  variant: string | null;
  quantity: number;
  position: number;
  created_at_device: number;
}
interface PackageRow {
  id: string;
  order_id: string;
  idx: number;
  created_at_device: number;
}
interface SessionRow {
  id: string;
  shop_id: string;
  order_id: string;
  package_id: string;
  started_at_device: number;
  snapshot_json: string;
  session_status: string;
}

/** Điều kiện WHERE (tham số hóa) cho danh sách/đếm; luôn bắt đầu bằng cô lập shop (bất biến 8). */
function listConditions(shopId: ShopId, query: OrderListQuery) {
  const conditions = ['o.shop_id = ?'];
  const params: (string | number)[] = [shopId];
  if (query.searchKey !== undefined && query.searchKey !== '') {
    // instr (không dùng LIKE) để %, _ trong mã không thành ký tự đại diện; khóa đã viết hoa sẵn.
    conditions.push(
      "(instr(o.order_code_key, ?) > 0 OR instr(COALESCE(o.tracking_code_key, ''), ?) > 0)",
    );
    params.push(query.searchKey, query.searchKey);
  }
  if (query.source !== undefined) {
    conditions.push('o.source = ?');
    params.push(query.source);
  }
  if (query.createdSinceDevice !== undefined) {
    conditions.push('o.created_at_device >= ?');
    params.push(query.createdSinceDevice);
  }
  if (query.declaration !== undefined) {
    const exists = 'EXISTS (SELECT 1 FROM order_lines l WHERE l.order_id = o.id)';
    conditions.push(query.declaration === 'declared' ? exists : `NOT ${exists}`);
  }
  // query.withoutVideo: chưa có bảng bằng chứng nên không đơn nào có video thật => không điều kiện.
  return { where: conditions.join(' AND '), params };
}

const toOrder = (r: OrderRow): Order => ({
  id: r.id as OrderId,
  shopId: r.shop_id as ShopId,
  orderCode: r.order_code,
  source: toOrderSource(r.source),
  trackingCode: r.tracking_code,
  dataOrigin: 'entered_by_user',
  createdAtDevice: r.created_at_device,
});
const toLine = (r: LineRow): OrderLine => ({
  id: r.id as OrderLineId,
  orderId: r.order_id as OrderId,
  name: r.name,
  variant: r.variant,
  quantity: r.quantity,
  position: r.position,
  dataOrigin: 'entered_by_user',
  createdAtDevice: r.created_at_device,
});
const toPackage = (r: PackageRow): OrderPackage => ({
  id: r.id as PackageId,
  orderId: r.order_id as OrderId,
  index: r.idx,
  createdAtDevice: r.created_at_device,
});

/** Đọc ảnh chụp từ JSON đã lưu: kiểm tra ở biên, không ép kiểu mù (conventions mục 4). */
export function parseSnapshot(json: string): OrderSnapshot {
  const raw: unknown = JSON.parse(json);
  if (!raw || typeof raw !== 'object') throw new Error('snapshot_invalid');
  const s = raw as Record<string, unknown>;
  const lines = Array.isArray(s.lines) ? (s.lines as unknown[]) : null;
  if (
    typeof s.orderCode !== 'string' ||
    typeof s.packageIndex !== 'number' ||
    typeof s.packageCount !== 'number' ||
    typeof s.takenAtDevice !== 'number' ||
    !lines
  ) {
    throw new Error('snapshot_invalid');
  }
  return {
    orderCode: s.orderCode,
    source: toOrderSource(typeof s.source === 'string' ? s.source : undefined),
    trackingCode: typeof s.trackingCode === 'string' ? s.trackingCode : null,
    lines: lines.map((item) => {
      const l = (item ?? {}) as Record<string, unknown>;
      if (typeof l.name !== 'string' || typeof l.quantity !== 'number') {
        throw new Error('snapshot_invalid');
      }
      return {
        name: l.name,
        variant: typeof l.variant === 'string' ? l.variant : null,
        quantity: l.quantity,
      };
    }),
    packageIndex: s.packageIndex,
    packageCount: s.packageCount,
    takenAtDevice: s.takenAtDevice,
  };
}

/**
 * Kho SQLite cục bộ (ADR-017). Mọi lỗi cơ sở dữ liệu đổi thành `AppError` (log chỉ ghi loại lỗi,
 * không ghi dữ liệu): `ORDER_SAVE_FAILED` cho đơn/dòng/kiện, `LOCAL_SAVE_UNAVAILABLE` cho phiên.
 *
 * Cô lập shop (bất biến 8): mọi hàm đọc/sửa theo ID đều kèm điều kiện `shop_id` của cửa hàng được
 * truyền vào (bảng dòng/kiện lọc qua `orders.shop_id`); ID của shop khác coi như không tồn tại. Hiện
 * chỉ có `LOCAL_SHOP_ID` (Q-17d) nên điều kiện này chưa có tác dụng thực tế cho tới khi có đa shop.
 *
 * Mọi thao tác chạy tuần tự qua một hàng đợi trong JS: `withTransactionAsync` của expo-sqlite không
 * độc quyền (truy vấn khác trên cùng kết nối có thể chen vào giữa giao dịch). Không dùng
 * `withExclusiveTransactionAsync` vì nó mở kết nối MỚI (không có PRAGMA khóa ngoại, không dùng được
 * trên web); hàng đợi này giữ một kết nối đã bật khóa ngoại.
 */
export function createSqliteOrderStore(db: SqlDatabase): OrderStore {
  let ready: Promise<void> | null = null;
  let tail: Promise<unknown> = Promise.resolve();

  const migrate = async () => {
    await applyConnectionSettings(db); // ngoài giao dịch; PRAGMA khóa ngoại là theo từng kết nối
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const current = row?.user_version ?? 0;
    for (let version = current; version < MIGRATIONS.length; version += 1) {
      const sql = MIGRATIONS[version];
      if (sql === undefined) break;
      await db.withTransactionAsync(async () => {
        await db.execAsync(sql);
        await db.execAsync(`PRAGMA user_version = ${version + 1}`);
      });
    }
  };

  const guarded = async <T>(failure: ErrorCode, task: () => Promise<T>): Promise<T> => {
    const run = tail.then(async () => {
      if (!ready) {
        ready = migrate().catch((error: unknown) => {
          ready = null; // lần sau thử mở lại
          throw error;
        });
      }
      await ready;
      return task();
    });
    tail = run.catch(() => undefined);
    try {
      return await run;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('orders.local_store_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new AppError(failure, {}, { cause: error });
    }
  };

  const orderDetails = async (shopId: ShopId, id: OrderId) => {
    const row = await db.getFirstAsync<OrderRow>(
      'SELECT * FROM orders WHERE id = ? AND shop_id = ?',
      [id, shopId],
    );
    if (!row) return null;
    const lines = await db.getAllAsync<LineRow>(
      'SELECT * FROM order_lines WHERE order_id = ? ORDER BY position',
      [id],
    );
    const packages = await db.getAllAsync<PackageRow>(
      'SELECT * FROM packages WHERE order_id = ? ORDER BY idx',
      [id],
    );
    return { order: toOrder(row), lines: lines.map(toLine), packages: packages.map(toPackage) };
  };

  const toSession = (row: SessionRow): PackingSession => ({
    id: row.id as SessionId,
    shopId: row.shop_id as ShopId,
    orderId: row.order_id as OrderId,
    packageId: row.package_id as PackageId,
    startedAtDevice: row.started_at_device,
    snapshot: parseSnapshot(row.snapshot_json),
    sessionStatus: 'created',
  });

  const sessionsOfOrder = async (shopId: ShopId, orderId: OrderId) => {
    const rows = await db.getAllAsync<SessionRow>(
      `SELECT * FROM packing_sessions WHERE order_id = ? AND shop_id = ?
       ORDER BY started_at_device DESC`,
      [orderId, shopId],
    );
    return rows.map(toSession);
  };

  const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

  return {
    listOrders: (shopId, query, page) =>
      guarded('ORDER_SAVE_FAILED', async () => {
        const { where, params } = listConditions(shopId, query);
        // Mốc hoạt động tính một lần cho mỗi đơn (nhóm phiên theo đơn), rồi lọc keyset ở truy vấn ngoài.
        const cursor = page.after
          ? 'WHERE (last_activity < ? OR (last_activity = ? AND id < ?))'
          : '';
        const cursorParams = page.after
          ? [page.after.lastActivityDevice, page.after.lastActivityDevice, page.after.orderId]
          : [];
        const rows = await db.getAllAsync<OrderRow & { last_activity: number }>(
          `SELECT * FROM (
             SELECT o.*, MAX(o.created_at_device, COALESCE(s.last_session, 0)) AS last_activity
             FROM orders o
             LEFT JOIN (
               SELECT order_id, MAX(started_at_device) AS last_session
               FROM packing_sessions WHERE shop_id = ? GROUP BY order_id
             ) s ON s.order_id = o.id
             WHERE ${where}
           ) ${cursor}
           ORDER BY last_activity DESC, id DESC LIMIT ?`,
          [shopId, ...params, ...cursorParams, page.limit + 1],
        );
        const pageRows = rows.slice(0, page.limit);
        const ids = pageRows.map((r) => r.id);
        const lineRows = ids.length
          ? await db.getAllAsync<LineRow>(
              `SELECT * FROM order_lines WHERE order_id IN (${placeholders(ids.length)})
               ORDER BY order_id, position`,
              ids,
            )
          : [];
        const sessionRows = ids.length
          ? await db.getAllAsync<
              Pick<SessionRow, 'id' | 'order_id' | 'package_id' | 'session_status'>
            >(
              `SELECT id, order_id, package_id, session_status FROM packing_sessions
               WHERE shop_id = ? AND order_id IN (${placeholders(ids.length)})
               ORDER BY started_at_device DESC`,
              [shopId, ...ids],
            )
          : [];
        const items = pageRows.map((row): OrderListItem => {
          const lines = lineRows.filter((l) => l.order_id === row.id);
          const first = lines[0];
          const active = sessionRows.find(
            (s) => s.order_id === row.id && isSessionStatusActive(s.session_status as 'created'),
          );
          return {
            order: toOrder(row),
            firstLine: first
              ? { name: first.name, variant: first.variant, quantity: first.quantity }
              : null,
            lineCount: lines.length,
            activeSession: active
              ? { id: active.id as SessionId, packageId: active.package_id as PackageId }
              : null,
            lastActivityDevice: row.last_activity,
          };
        });
        const last = items[items.length - 1];
        return {
          items,
          nextCursor:
            rows.length > page.limit && last
              ? { lastActivityDevice: last.lastActivityDevice, orderId: last.order.id }
              : null,
        };
      }),
    countOrders: (shopId, query) =>
      guarded('ORDER_SAVE_FAILED', async () => {
        const { where, params } = listConditions(shopId, query);
        const row = await db.getFirstAsync<{ n: number }>(
          `SELECT COUNT(*) AS n FROM orders o WHERE ${where}`,
          params,
        );
        return row?.n ?? 0;
      }),
    saveNewOrder: (details) =>
      guarded('ORDER_SAVE_FAILED', () =>
        db.withTransactionAsync(async () => {
          const o = details.order;
          await db.runAsync(
            `INSERT INTO orders (id, shop_id, order_code, order_code_key, source, tracking_code,
              tracking_code_key, data_origin, created_at_device) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              o.id,
              o.shopId,
              o.orderCode,
              toCodeKey(o.orderCode),
              o.source,
              o.trackingCode,
              o.trackingCode === null ? null : toCodeKey(o.trackingCode),
              o.dataOrigin,
              o.createdAtDevice,
            ],
          );
          for (const l of details.lines) {
            await db.runAsync(
              `INSERT INTO order_lines (id, order_id, name, variant, quantity, position, data_origin,
                created_at_device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                l.id,
                l.orderId,
                l.name,
                l.variant,
                l.quantity,
                l.position,
                l.dataOrigin,
                l.createdAtDevice,
              ],
            );
          }
          for (const p of details.packages) {
            await db.runAsync(
              'INSERT INTO packages (id, order_id, idx, created_at_device) VALUES (?, ?, ?, ?)',
              [p.id, p.orderId, p.index, p.createdAtDevice],
            );
          }
        }),
      ),
    getOrder: (shopId, id) => guarded('ORDER_SAVE_FAILED', () => orderDetails(shopId, id)),
    findOrdersByCodes: (shopId, query) =>
      guarded('ORDER_SAVE_FAILED', async () => {
        const conditions: string[] = [];
        const params: (string | number | null)[] = [shopId];
        if (query.orderCodeKey !== undefined) {
          conditions.push('order_code_key = ?');
          params.push(query.orderCodeKey);
        }
        if (query.trackingCodeKey !== undefined) {
          conditions.push('tracking_code_key = ?');
          params.push(query.trackingCodeKey);
        }
        if (conditions.length === 0) return [];
        const rows = await db.getAllAsync<OrderRow>(
          `SELECT * FROM orders WHERE shop_id = ? AND (${conditions.join(' OR ')})
           ORDER BY created_at_device DESC`,
          params,
        );
        return rows.map(toOrder);
      }),
    listRecentLines: (shopId, limit) =>
      guarded('ORDER_SAVE_FAILED', async () => {
        const rows = await db.getAllAsync<LineRow>(
          `SELECT l.* FROM order_lines l JOIN orders o ON o.id = l.order_id
           WHERE o.shop_id = ? ORDER BY l.created_at_device DESC, l.position LIMIT ?`,
          [shopId, limit],
        );
        return rows.map(toLine);
      }),
    updateLineQuantity: (shopId, lineId, quantity) =>
      guarded('ORDER_SAVE_FAILED', () =>
        db.withTransactionAsync(async () => {
          const found = await db.getFirstAsync<{ order_id: string }>(
            `SELECT l.order_id FROM order_lines l JOIN orders o ON o.id = l.order_id
             WHERE l.id = ? AND o.shop_id = ?`,
            [lineId, shopId],
          );
          if (!found) throw new AppError('ORDER_SAVE_FAILED');
          const session = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM packing_sessions WHERE order_id = ? LIMIT 1',
            [found.order_id],
          );
          if (session) throw new AppError('ORDER_HAS_SESSION');
          await db.runAsync('UPDATE order_lines SET quantity = ? WHERE id = ?', [quantity, lineId]);
        }),
      ),
    addPackage: (shopId, pkg) =>
      guarded('ORDER_SAVE_FAILED', () =>
        db.withTransactionAsync(async () => {
          const owner = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM orders WHERE id = ? AND shop_id = ?',
            [pkg.orderId, shopId],
          );
          if (!owner) throw new AppError('ORDER_SAVE_FAILED');
          await db.runAsync(
            'INSERT INTO packages (id, order_id, idx, created_at_device) VALUES (?, ?, ?, ?)',
            [pkg.id, pkg.orderId, pkg.index, pkg.createdAtDevice],
          );
        }),
      ),
    saveSession: (s) =>
      guarded('LOCAL_SAVE_UNAVAILABLE', () =>
        db.withTransactionAsync(async () => {
          const owned = await db.getFirstAsync<{ id: string }>(
            `SELECT p.id FROM packages p JOIN orders o ON o.id = p.order_id
             WHERE p.id = ? AND o.id = ? AND o.shop_id = ?`,
            [s.packageId, s.orderId, s.shopId],
          );
          if (!owned) throw new AppError('LOCAL_SAVE_UNAVAILABLE');
          const existing = await sessionsOfOrder(s.shopId, s.orderId);
          if (findActiveSession(existing, s.packageId)) {
            throw new AppError('PACKAGE_SESSION_ACTIVE');
          }
          await db.runAsync(
            `INSERT INTO packing_sessions (id, shop_id, order_id, package_id, started_at_device,
              snapshot_json, session_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              s.id,
              s.shopId,
              s.orderId,
              s.packageId,
              s.startedAtDevice,
              JSON.stringify(s.snapshot),
              s.sessionStatus,
            ],
          );
        }),
      ),
    getSession: (shopId, id: SessionId) =>
      guarded('LOCAL_SAVE_UNAVAILABLE', async () => {
        const row = await db.getFirstAsync<SessionRow>(
          'SELECT * FROM packing_sessions WHERE id = ? AND shop_id = ?',
          [id, shopId],
        );
        return row ? toSession(row) : null;
      }),
    listSessionsOfOrder: (shopId, orderId) =>
      guarded('LOCAL_SAVE_UNAVAILABLE', () => sessionsOfOrder(shopId, orderId)),
  };
}
