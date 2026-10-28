import type { ShopId } from '@/core/ids';

import { isRemoteSessionStatus } from './remote-documents';
import type { OrderStore } from './order-store';
import type { Order, OrderDetails, OrderPackage, PackingSession } from './types';

/**
 * Cổng ghi lên máy chủ (Firestore). Cả hai thao tác phải IDEMPOTENT: tài liệu đã có thì giữ nguyên,
 * không ghi đè (Rules cấm sửa các trường định danh), để thử lại sau khi mất phản hồi là an toàn.
 */
export interface RemoteOrderWriter {
  /**
   * Đảm bảo đơn + dòng + kiện CÓ trên máy chủ (chỉ tạo phần còn thiếu). Chỉ người tạo đơn đăng được
   * (ném lỗi nếu tài khoản hiện tại khác `order.createdBy`); chỉ đăng kiện do chính tài khoản đó tạo.
   */
  publishOrder(details: OrderDetails): Promise<void>;
  /** Đảm bảo MỘT kiện có trên máy chủ (đơn đã đăng). Chỉ người tạo kiện đăng được. */
  publishPackage(order: Order, pkg: OrderPackage): Promise<void>;
  /** Đảm bảo phiên có trên máy chủ rồi đặt trạng thái `status` (đơn đã được đăng trước đó). */
  publishSession(session: PackingSession, status: string): Promise<void>;
}

export interface OrderSyncDeps {
  readonly store: OrderStore;
  readonly remote: RemoteOrderWriter;
  readonly now: () => number;
  readonly isOnline: () => boolean;
  /** uid đang đăng nhập (nguồn: Auth). `null` = chưa đăng nhập: không đăng gì. */
  readonly currentUid: () => string | null;
}

export interface OrderSyncSummary {
  readonly skipped?: 'offline' | 'busy' | 'signed_out';
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
 *
 * Chỉ đăng bản ghi do CHÍNH tài khoản đang đăng nhập tạo (`createdBy`; Rules ép `createdBy == uid`):
 * máy dùng chung nhiều người không ghi nhầm người tạo, bản ghi của người khác hoặc không rõ người tạo
 * ở lại máy cho đến khi chính họ đăng nhập (Q-23g).
 */
export function createOrderSync(deps: OrderSyncDeps): OrderSync {
  // Lưu ý: nếu một lệnh ghi treo giữa chừng (mất mạng, batch.commit chưa trả), `running` của lượt đó
  // giữ nguyên cho đến khi lệnh settle; lượt mới trong lúc đó trả `skipped: 'busy'`. Đây là hành vi
  // chấp nhận được, không phải lỗi: `OrderSyncRunner` tạo bộ đồng bộ mới khi trạng thái mạng đổi.
  const { store, remote, now, isOnline, currentUid } = deps;
  let running = false;

  return {
    async runOnce(shopId) {
      const summary = { ordersPublished: 0, sessionsPublished: 0, failed: 0 };
      if (running) return { ...summary, skipped: 'busy' };
      if (!isOnline()) return { ...summary, skipped: 'offline' };
      const uid = currentUid();
      if (!uid) return { ...summary, skipped: 'signed_out' };
      running = true;
      try {
        for (const details of await store.listOrdersPendingRemote(shopId, BATCH, uid)) {
          if (!isOnline()) break;
          try {
            await remote.publishOrder(details);
            // Chỉ đánh dấu đúng các kiện vừa đăng (từ bản `details` đã đọc), không phải kiện thêm giữa chừng.
            await store.markOrderPublished(
              shopId,
              details.order.id,
              now(),
              uid,
              details.packages.map((p) => p.id),
            );
            summary.ordersPublished += 1;
          } catch {
            summary.failed += 1;
          }
        }
        const pendingSessions = await store.listSessionsPendingRemote(shopId, BATCH, uid);
        for (const { session, status, packagePending } of pendingSessions) {
          if (!isOnline()) break;
          if (!isRemoteSessionStatus(status)) continue; // trạng thái lạ: không đăng, không đoán
          try {
            // Kiện thêm sau khi đơn đã đăng: đảm bảo kiện của phiên có trên máy chủ trước (Rules).
            // Chỉ khi kho báo kiện CHƯA đăng; đăng rồi thì không đọc lại gì (mỗi lần phiên đổi trạng
            // thái mà đọc lại cả cây đơn sẽ tốn 1 + số dòng + số kiện lượt đọc Firestore).
            // Kiện do người khác tạo mà chưa đăng thì phiên không có mặt ở danh sách (chờ họ đăng).
            if (packagePending) {
              const details = await store.getOrder(shopId, session.orderId);
              const pkg = details?.packages.find((p) => p.id === session.packageId);
              if (!details || !pkg) throw new Error('package_missing');
              await remote.publishPackage(details.order, pkg);
              await store.markPackagePublished(shopId, pkg.id, now());
            }
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
