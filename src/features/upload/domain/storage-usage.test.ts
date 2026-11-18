import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import { countStates, type EvidenceFile, type FileState } from '@/features/evidence';
import type { PackingSession } from '@/features/orders';
import type { ReturnMedia } from '@/features/returns';

import type { EvidenceStatsStores } from './evidence-stats';
import { loadStorageUsage } from './storage-usage';

const SHOP = 'shop-1' as ShopId;
const OTHER_SHOP = 'shop-2' as ShopId;
const UID = 'uid-1';
const GB = 1024 ** 3;

function file(
  id: string,
  state: FileState,
  sizeBytes: number | null,
  options: { shopId?: ShopId; sessionId?: string } = {},
): EvidenceFile {
  return {
    id: id as EvidenceId,
    shopId: options.shopId ?? SHOP,
    orderId: 'o1' as OrderId,
    packageId: 'p1' as PackageId,
    sessionId: (options.sessionId ?? 's-mine') as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: 'evidence/x.mp4',
    sizeBytes,
    durationMs: 1,
    sha256Client: 'ab',
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: 1,
    updatedAtDevice: 1,
  };
}

function media(
  id: string,
  state: FileState,
  sizeBytes: number | null,
  createdBy = UID,
  returnId = 'r1',
): ReturnMedia {
  return {
    id,
    shopId: SHOP,
    returnId: returnId as ReturnCaseId,
    kind: 'photo',
    state,
    localPath: 'evidence/x.jpg',
    sizeBytes,
    sha256Client: 'cd',
    location: null,
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: 1,
    updatedAtDevice: 1,
    createdBy,
  };
}

/** Phiên `s-mine` do UID tạo; phiên `s-other` do tài khoản khác; `s-ghost` không đọc được. */
function stores(files: EvidenceFile[], medias: ReturnMedia[] = []): EvidenceStatsStores {
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
        id === ('s-ghost' as SessionId)
          ? null
          : ({
              id,
              shopId: SHOP,
              createdBy: id === ('s-other' as SessionId) ? 'uid-2' : UID,
            } as unknown as PackingSession),
      getOrder: async () => null,
      countPackedOrders: async () => 0,
    },
    returns: {
      listMediaByStates: async (shop, states) =>
        ofShop(medias, shop).filter((m) => states.includes(m.state)),
      // `r1`: hồ sơ của UID đã đăng bản neo; `r-theirs`: hồ sơ của tài khoản khác, chưa đăng.
      getReturn: async (_shop, id) =>
        ({
          returnCase:
            id === ('r-theirs' as ReturnCaseId)
              ? { id, createdBy: 'uid-2' }
              : { id, createdBy: UID, anchorPublishedAtDevice: 1 },
        }) as never,
      applyMediaEvent: async () => ({ ok: false, error: 'MEDIA_NOT_FOUND' }),
      countMediaByState: async (shop, range) => countStates(ofShop(medias, shop), range),
    },
  };
}

const group = (files: number, bytes: number, unknownSize = 0) => ({ files, bytes, unknownSize });

describe('loadStorageUsage (UI-F03, V1-30)', () => {
  it('máy trống: mọi nhóm bằng 0', async () => {
    expect(await loadStorageUsage(stores([]), SHOP, UID)).toEqual({
      onServer: group(0, 0),
      notOnServer: group(0, 0),
      noLocalCopy: group(0, 0),
      otherAccountFiles: 0,
    });
  });

  it('chia theo trạng thái tệp: uploaded/verified = đã lên máy chủ; còn lại chưa lên; chưa lưu máy riêng', async () => {
    const usage = await loadStorageUsage(
      stores(
        [
          file('a', 'uploaded', 100),
          file('b', 'verified', 200),
          file('c', 'queued', 10),
          file('d', 'uploading', 20),
          file('e', 'upload_failed', 30),
          file('f', 'needs_attention', 40),
          file('g', 'hash_mismatch', 50), // không khớp mã băm: KHÔNG phải đã lên máy chủ
          file('h', 'recording', null),
          file('i', 'saving_local', null),
          file('j', 'local_save_failed', 7),
          file('k', 'unrecoverable', 8),
        ],
        [media('m1', 'verified', 1), media('m2', 'queued', 2)],
      ),
      SHOP,
      UID,
    );
    expect(usage.onServer).toEqual(group(3, 301));
    expect(usage.notOnServer).toEqual(group(6, 152));
    expect(usage.noLocalCopy).toEqual(group(4, 15, 2));
    expect(usage.otherAccountFiles).toBe(0);
  });

  it('chỉ tính tệp của tài khoản đang đăng nhập: tài khoản khác và không rõ người tạo chỉ được đếm riêng', async () => {
    const usage = await loadStorageUsage(
      stores(
        [
          file('a', 'verified', 100),
          file('b', 'verified', 900, { sessionId: 's-other' }),
          file('c', 'queued', 500, { sessionId: 's-ghost' }),
        ],
        [media('m1', 'queued', 40), media('m2', 'verified', 3000, 'uid-2')],
      ),
      SHOP,
      UID,
    );
    expect(usage.onServer).toEqual(group(1, 100));
    expect(usage.notOnServer).toEqual(group(1, 40));
    expect(usage.otherAccountFiles).toBe(3);
  });

  it('ảnh do chính tài khoản chụp trong hồ sơ của người khác (chưa đăng) vẫn tính là của mình', async () => {
    const usage = await loadStorageUsage(
      stores(
        [],
        [media('m1', 'queued', 60, UID, 'r-theirs'), media('m2', 'queued', 5, 'uid-2', 'r-theirs')],
      ),
      SHOP,
      UID,
    );
    expect(usage.notOnServer).toEqual(group(1, 60));
    expect(usage.otherAccountFiles).toBe(1);
  });

  it('không cộng tệp của shop khác (bất biến 8)', async () => {
    const usage = await loadStorageUsage(
      stores([file('a', 'verified', 100), file('b', 'verified', 999, { shopId: OTHER_SHOP })]),
      SHOP,
      UID,
    );
    expect(usage.onServer).toEqual(group(1, 100));
    expect(usage.otherAccountFiles).toBe(0);
  });

  it('tệp chưa biết cỡ: đếm là chưa rõ, không cộng như 0 byte giả; số lớn hơn 4 GiB không tràn', async () => {
    const usage = await loadStorageUsage(
      stores([
        file('a', 'queued', null),
        file('b', 'queued', 3 * GB),
        file('c', 'queued', 3 * GB),
        file('d', 'verified', Number.NaN),
        file('e', 'verified', -1),
      ]),
      SHOP,
      UID,
    );
    expect(usage.notOnServer).toEqual(group(3, 6 * GB, 1));
    expect(usage.onServer).toEqual(group(2, 0, 2));
  });

  it('không uid (cổng chưa biết tài khoản): coi tệp là của máy này như phần còn lại của app', async () => {
    const usage = await loadStorageUsage(stores([file('a', 'verified', 5)]), SHOP, null);
    expect(usage.onServer).toEqual(group(1, 5));
  });
});
