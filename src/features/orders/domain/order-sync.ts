import type { ShopId } from '@/core/ids';

import { isRemoteSessionStatus } from './remote-documents';
import type { OrderStore } from './order-store';
import type { OrderDetails, PackingSession } from './types';

/**
 * Cổng ghi lên máy chủ (Firestore). Cả hai thao tác phải IDEMPOTENT: tài liệu đã có thì giữ nguyên,
 * không ghi đè (Rules cấm sửa các trường định danh), để thử lại sau khi mất phản hồi là an toàn.
 */
export interface RemoteOrderWriter {
  /** Đảm bảo đơn + dòng + kiện CÓ trên máy chủ (chỉ tạo phần còn thiếu, ví dụ kiện thêm sau). */
  publishOrder(details: OrderDetails): Promise<void>;
  /** Đảm bảo phiên có trên máy chủ rồi đặt trạng thái `status` (đơn đã được đăng trước đó). */
  publishSession(session: PackingSession, status: string): Promise<void>;
}

export interface OrderSyncDeps {
  readonly store: OrderStore;
  readonly remote: RemoteOrderWriter;
  readonly now: () => number;
  readonly isOnline: () => boolean;
}

export interface OrderSyncSummary {
  readonly skipped?: 'offline' | 'busy';
  readonly ordersPublished: number;
  readonly sessionsPublished: number;
  readonly failed: number;
}

export interface OrderSync {
  /** Một lượt đăng theo shop: đơn trước, rồi phiên. Không ném lỗi; lỗi từng mục tính vào `failed`. */
  runOnce(shopId: ShopId): Promise<OrderSyncSummary>;
}

const BATCH = 25;

/**
 * Đồng bộ MỘT CHIỀU (thiết bị -> Firestore) đơn và phiên. Không có hàng đợi riêng: việc cần làm suy
 * ra từ dữ liệu cục bộ (`listOrdersPendingRemote`, `listSessionsPendingRemote`), nên mất tiến trình
 * hay tắt app vẫn đúng. Đơn chỉ đăng khi đã có phiên (lúc đó không còn sửa được); phiên `created`
 * chưa có bằng chứng nên không đăng. Không xóa gì, không ghi đè bản trên máy chủ (Q-23).
 */
export function createOrderSync(deps: OrderSyncDeps): OrderSync {
  const { store, remote, now, isOnline } = deps;
  let running = false;

  return {
    async runOnce(shopId) {
      const summary = { ordersPublished: 0, sessionsPublished: 0, failed: 0 };
      if (running) return { ...summary, skipped: 'busy' };
      if (!isOnline()) return { ...summary, skipped: 'offline' };
      running = true;
      try {
        for (const details of await store.listOrdersPendingRemote(shopId, BATCH)) {
          if (!isOnline()) break;
          try {
            await remote.publishOrder(details);
            await store.markOrderPublished(shopId, details.order.id, now());
            summary.ordersPublished += 1;
          } catch {
            summary.failed += 1;
          }
        }
        for (const { session, status } of await store.listSessionsPendingRemote(shopId, BATCH)) {
          if (!isOnline()) break;
          if (!isRemoteSessionStatus(status)) continue; // trạng thái lạ: không đăng, không đoán
          try {
            // Kiện thêm sau khi đơn đã đăng: đảm bảo kiện của phiên có trên máy chủ trước (Rules).
            const details = await store.getOrder(shopId, session.orderId);
            if (details) await remote.publishOrder(details);
            await remote.publishSession(session, status);
            await store.markSessionPublished(shopId, session.id, status);
            summary.sessionsPublished += 1;
          } catch {
            summary.failed += 1;
          }
        }
      } catch {
        summary.failed += 1; // lỗi kho cục bộ: dừng lượt này, lượt sau chạy lại
      } finally {
        running = false;
      }
      return summary;
    },
  };
}
