import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import { countStates, type EvidenceFile, type FileState } from '@/features/evidence';
import type { PackingSession } from '@/features/orders';
import type { ReturnMedia } from '@/features/returns';

import {
  deviceDayRange,
  loadEvidenceTotals,
  loadTodayStats,
  type EvidenceStatsStores,
} from './evidence-stats';

const SHOP = 'shop-1' as ShopId;
const OTHER = 'shop-2' as ShopId;
const UID = 'uid-1';

// Giờ THIẾT BỊ (múi giờ của máy chạy test): 30/10/2026 15:00.
const NOW = new Date(2026, 9, 30, 15, 0).getTime();
const MIDNIGHT = new Date(2026, 9, 30, 0, 0).getTime();
const NEXT_MIDNIGHT = new Date(2026, 9, 31, 0, 0).getTime();

function file(id: string, state: FileState, at: number, shopId = SHOP): EvidenceFile {
  return {
    id: id as EvidenceId,
    shopId,
    orderId: 'o1' as OrderId,
    packageId: 'p1' as PackageId,
    sessionId: 's1' as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: 'evidence/x.mp4',
    sizeBytes: 10,
    durationMs: 1,
    sha256Client: 'ab',
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: state === 'needs_attention' ? 'FILE_MISSING' : null,
    createdAtDevice: at,
    updatedAtDevice: at,
  };
}

function media(id: string, state: FileState, at: number): ReturnMedia {
  return {
    id,
    shopId: SHOP,
    returnId: 'r1' as ReturnCaseId,
    kind: 'photo',
    state,
    localPath: 'evidence/x.jpg',
    sizeBytes: 5,
    sha256Client: 'cd',
    location: null,
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: at,
    updatedAtDevice: at,
    createdBy: UID,
  };
}

function stores(
  files: EvidenceFile[],
  medias: ReturnMedia[],
  packed: (shop: ShopId, from: number, to: number) => number = () => 0,
): EvidenceStatsStores {
  const ofShop = <T extends { shopId: ShopId }>(items: T[], shop: ShopId) =>
    items.filter((i) => i.shopId === shop);
  return {
    files: {
      listByStates: async (shop, states) =>
        ofShop(files, shop).filter((f) => states.includes(f.state)),
      get: async () => null,
      applyEvent: async () => ({ ok: false, error: 'FILE_NOT_FOUND' }),
      countByState: async (shop, range) => countStates(ofShop(files, shop), range),
    },
    orders: {
      getSession: async (_shop, id) =>
        ({ id, shopId: SHOP, createdBy: UID }) as unknown as PackingSession,
      getOrder: async () => null,
      countPackedOrders: async (shop, range) => packed(shop, range.fromDevice, range.toDevice),
    },
    returns: {
      listMediaByStates: async (shop, states) =>
        ofShop(medias, shop).filter((m) => states.includes(m.state)),
      getReturn: async () => null,
      applyMediaEvent: async () => ({ ok: false, error: 'MEDIA_NOT_FOUND' }),
      countMediaByState: async (shop, range) => countStates(ofShop(medias, shop), range),
    },
  };
}

describe('deviceDayRange: "hôm nay" theo giờ thiết bị', () => {
  it('từ 0 giờ hôm nay tới trước 0 giờ hôm sau', () => {
    expect(deviceDayRange(NOW)).toEqual({ fromDevice: MIDNIGHT, toDevice: NEXT_MIDNIGHT });
    expect(deviceDayRange(MIDNIGHT)).toEqual({ fromDevice: MIDNIGHT, toDevice: NEXT_MIDNIGHT });
    expect(deviceDayRange(NEXT_MIDNIGHT - 1).fromDevice).toBe(MIDNIGHT);
  });
});

describe('loadTodayStats (Trang chủ, V1-10)', () => {
  it('máy trống: cả ba ô là 0', async () => {
    expect(await loadTodayStats(stores([], []), SHOP, UID, NOW)).toEqual({
      packed: 0,
      uploaded: 0,
      needsAction: 0,
    });
  });

  it('Đã tải lên: chỉ uploaded/verified, chỉ trong hôm nay theo giờ thiết bị, gồm ảnh hàng hoàn', async () => {
    const s = stores(
      [
        file('a', 'uploaded', MIDNIGHT), // đúng 0 giờ: tính
        file('b', 'verified', NOW),
        file('c', 'verified', MIDNIGHT - 1), // 23:59:59.999 hôm qua: không
        file('d', 'verified', NEXT_MIDNIGHT), // 0 giờ hôm sau: không
        file('e', 'queued', NOW), // chưa được máy chủ nhận: không
        file('f', 'uploading', NOW),
        file('g', 'hash_mismatch', NOW),
        file('h', 'verified', NOW, OTHER), // shop khác: không
      ],
      [media('m1', 'uploaded', NOW), media('m2', 'queued', NOW)],
    );
    const stats = await loadTodayStats(s, SHOP, UID, NOW);
    expect(stats.uploaded).toBe(3);
  });

  it('Lỗi – cần xử lý: đúng bộ lọc Lỗi của Trung tâm đồng bộ, không giới hạn trong hôm nay', async () => {
    const s = stores(
      [
        file('a', 'needs_attention', MIDNIGHT - 5 * 86_400_000), // lỗi cũ vẫn tính
        file('b', 'hash_mismatch', NOW),
        file('c', 'upload_failed', NOW), // nhãn "Lỗi" (docs/09 mục 3), như UI-F01
        file('d', 'queued', NOW),
        file('e', 'needs_attention', NOW, OTHER),
      ],
      [media('m1', 'local_save_failed', NOW)],
    );
    const stats = await loadTodayStats(s, SHOP, UID, NOW);
    expect(stats.needsAction).toBe(4);
  });

  it('Đơn đã đóng gói: hỏi kho đúng shop và đúng khoảng hôm nay', async () => {
    const calls: [ShopId, number, number][] = [];
    const s = stores([], [], (shop, from, to) => {
      calls.push([shop, from, to]);
      return 4;
    });
    expect((await loadTodayStats(s, SHOP, UID, NOW)).packed).toBe(4);
    expect(calls).toEqual([[SHOP, MIDNIGHT, NEXT_MIDNIGHT]]);
  });
});

describe('loadEvidenceTotals (Dữ liệu bằng chứng, V1-10)', () => {
  it('máy trống: mọi số là 0', async () => {
    expect(await loadEvidenceTotals(stores([], []), SHOP)).toEqual({
      total: 0,
      onDevice: 0,
      pending: 0,
      cloud: 0,
    });
  });

  it('tổng / trên máy / đang chờ / trên đám mây theo trạng thái tệp, chỉ shop đang dùng', async () => {
    const s = stores(
      [
        file('rec', 'recording', 1), // chưa có bản lưu: tổng + đang chờ
        file('q', 'queued', 1), // trên máy + đang chờ
        file('up', 'uploaded', 1), // trên máy, chưa kiểm tra khớp: không lên "đám mây"
        file('v', 'verified', 1), // trên máy + đám mây
        file('lost', 'unrecoverable', 1), // chỉ tổng
        file('x', 'verified', 1, OTHER),
      ],
      [media('m1', 'verified', 1), media('m2', 'local_save_failed', 1)],
    );
    expect(await loadEvidenceTotals(s, SHOP)).toEqual({
      total: 7,
      onDevice: 4,
      pending: 3,
      cloud: 2,
    });
  });
});
