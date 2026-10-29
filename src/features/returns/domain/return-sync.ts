import type { ShopId } from '@/core/ids';

import type { ReturnStore } from './return-store';
import type { ReturnCase } from './types';

/**
 * Cổng ghi bản neo hồ sơ hàng hoàn lên máy chủ. PHẢI idempotent: tài liệu đã có thì giữ nguyên, không
 * ghi đè (Rules cấm sửa), để thử lại sau khi mất phản hồi là an toàn. Ném lỗi nếu tài khoản hiện tại
 * khác `returnCase.createdBy` (không đăng thay người khác).
 */
export interface RemoteReturnWriter {
  publishReturn(returnCase: ReturnCase): Promise<void>;
}

export interface ReturnSyncDeps {
  readonly store: Pick<ReturnStore, 'listReturnsPendingRemote' | 'markReturnPublished'>;
  readonly remote: RemoteReturnWriter;
  readonly now: () => number;
  readonly isOnline: () => boolean;
  /** uid đang đăng nhập (nguồn: Auth). `null` = chưa đăng nhập: không đăng gì. */
  readonly currentUid: () => string | null;
}

export interface ReturnSyncSummary {
  readonly skipped?: 'offline' | 'busy' | 'signed_out';
  readonly published: number;
  readonly failed: number;
}

export interface ReturnSync {
  /** Một lượt đăng theo shop. Không ném lỗi; lỗi từng hồ sơ tính vào `failed`. */
  runOnce(shopId: ShopId): Promise<ReturnSyncSummary>;
}

const BATCH = 25;

/**
 * Đồng bộ MỘT CHIỀU (thiết bị -> Firestore) bản neo hồ sơ hàng hoàn (Q-28), theo khuôn `createOrderSync`:
 * không hàng đợi riêng (việc cần làm suy ra từ dữ liệu cục bộ, nên tắt app giữa chừng vẫn đúng), idempotent,
 * chỉ đăng bản ghi do CHÍNH tài khoản đang đăng nhập tạo, không bao giờ xóa hay ghi đè. Hồ sơ chỉ được
 * đăng khi đã có ít nhất một tệp media lưu bền (chưa có gì để gắn thì chưa cần neo). Bên gọi không gọi
 * hàm này với shop cục bộ tạm (`LOCAL_SHOP_ID`).
 */
export function createReturnSync(deps: ReturnSyncDeps): ReturnSync {
  const { store, remote, now, isOnline, currentUid } = deps;
  let running = false;

  return {
    async runOnce(shopId) {
      const summary = { published: 0, failed: 0 };
      if (running) return { ...summary, skipped: 'busy' };
      if (!isOnline()) return { ...summary, skipped: 'offline' };
      const uid = currentUid();
      if (!uid) return { ...summary, skipped: 'signed_out' };
      running = true;
      let published = 0;
      let failed = 0;
      try {
        for (const returnCase of await store.listReturnsPendingRemote(shopId, BATCH, uid)) {
          if (!isOnline() || currentUid() !== uid) break; // mất mạng hoặc phiên đã đổi
          try {
            await remote.publishReturn(returnCase);
            await store.markReturnPublished(shopId, returnCase.id, now());
            published += 1;
          } catch {
            failed += 1;
          }
        }
      } catch {
        failed += 1; // lỗi kho cục bộ: dừng lượt này, lượt sau chạy lại
      } finally {
        running = false;
      }
      return { published, failed };
    },
  };
}
