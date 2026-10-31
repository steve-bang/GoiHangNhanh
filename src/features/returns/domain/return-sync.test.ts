import type { ReturnCaseId, ShopId } from '@/core/ids';

import { createReturnSync, type RemoteReturnWriter } from './return-sync';
import type { ReturnStore } from './return-store';
import type { ReturnCase } from './types';

const SHOP = 'shop-a' as ShopId;

const makeCase = (id: string, createdBy = 'u-1'): ReturnCase => ({
  id: id as ReturnCaseId,
  shopId: SHOP,
  seq: 1,
  code: 'RH-00001',
  status: 'receiving',
  sourceOrderId: null,
  observedCode: null,
  exterior: null,
  openedBefore: null,
  openingVideo: null,
  finalNote: '',
  confirmedAtDevice: null,
  createdAtDevice: 1,
  updatedAtDevice: 1,
  createdBy,
});

function setup(cases: ReturnCase[], overrides: { uid?: () => string | null } = {}) {
  const pending = [...cases];
  const marked: string[] = [];
  const published: string[] = [];
  const store: Pick<ReturnStore, 'listReturnsPendingRemote' | 'markReturnPublished'> = {
    listReturnsPendingRemote: jest.fn(async (_s, _l, uid) =>
      pending.filter((c) => c.createdBy === uid),
    ),
    markReturnPublished: jest.fn(async (_s, id) => {
      marked.push(id);
      const i = pending.findIndex((c) => c.id === id);
      if (i >= 0) pending.splice(i, 1);
    }),
  };
  const remote: RemoteReturnWriter = {
    publishReturn: jest.fn(async (c) => void published.push(c.id)),
  };
  let online = true;
  const sync = createReturnSync({
    store,
    remote,
    now: () => 77,
    isOnline: () => online,
    currentUid: overrides.uid ?? (() => 'u-1'),
  });
  return { sync, store, remote, marked, published, setOnline: (v: boolean) => void (online = v) };
}

describe('createReturnSync', () => {
  it('đăng hồ sơ chờ rồi mới đánh dấu đã đăng', async () => {
    const t = setup([makeCase('r1'), makeCase('r2')]);
    expect(await t.sync.runOnce(SHOP)).toEqual({ published: 2, failed: 0 });
    expect(t.published).toEqual(['r1', 'r2']);
    expect(t.marked).toEqual(['r1', 'r2']);
  });

  it('chỉ hỏi kho hồ sơ của CHÍNH uid đang đăng nhập (không đăng thay người khác)', async () => {
    const t = setup([makeCase('mine', 'u-1'), makeCase('theirs', 'u-2')]);
    await t.sync.runOnce(SHOP);
    expect(t.store.listReturnsPendingRemote).toHaveBeenCalledWith(SHOP, expect.any(Number), 'u-1');
    expect(t.published).toEqual(['mine']);
  });

  it('chưa đăng nhập hoặc mất mạng: không làm gì', async () => {
    const signedOut = setup([makeCase('r1')], { uid: () => null });
    expect(await signedOut.sync.runOnce(SHOP)).toMatchObject({ skipped: 'signed_out' });
    const offline = setup([makeCase('r1')]);
    offline.setOnline(false);
    expect(await offline.sync.runOnce(SHOP)).toMatchObject({ skipped: 'offline' });
    expect(offline.remote.publishReturn).not.toHaveBeenCalled();
  });

  it('đăng lỗi: KHÔNG đánh dấu đã đăng, lượt sau thử lại; lỗi một hồ sơ không chặn hồ sơ khác', async () => {
    const t = setup([makeCase('bad'), makeCase('good')]);
    let calls = 0;
    (t.remote.publishReturn as jest.Mock).mockImplementation(async (c: ReturnCase) => {
      calls += 1;
      if (c.id === 'bad' && calls === 1) throw new Error('network');
      t.published.push(c.id);
    });
    expect(await t.sync.runOnce(SHOP)).toEqual({ published: 1, failed: 1 });
    expect(t.marked).toEqual(['good']);
    expect(await t.sync.runOnce(SHOP)).toEqual({ published: 1, failed: 0 });
    expect(t.marked).toEqual(['good', 'bad']);
  });

  it('phiên đổi giữa lượt (đăng xuất/đổi tài khoản): dừng, không đăng bằng danh tính cũ', async () => {
    let uid: string | null = 'u-1';
    const t = setup([makeCase('r1'), makeCase('r2')], { uid: () => uid });
    (t.remote.publishReturn as jest.Mock).mockImplementation(async (c: ReturnCase) => {
      t.published.push(c.id);
      uid = 'u-2';
    });
    expect(await t.sync.runOnce(SHOP)).toEqual({ published: 1, failed: 0 });
    expect(t.published).toEqual(['r1']);
  });

  it('lỗi kho: không ném, tính vào failed', async () => {
    const t = setup([]);
    (t.store.listReturnsPendingRemote as jest.Mock).mockRejectedValue(new Error('db'));
    expect(await t.sync.runOnce(SHOP)).toEqual({ published: 0, failed: 1 });
  });

  it('lượt chồng nhau bị bỏ qua (busy)', async () => {
    const t = setup([makeCase('r1')]);
    let release: () => void = () => undefined;
    (t.remote.publishReturn as jest.Mock).mockImplementation(
      () => new Promise<void>((resolve) => void (release = resolve)),
    );
    const first = t.sync.runOnce(SHOP);
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(await t.sync.runOnce(SHOP)).toMatchObject({ skipped: 'busy' });
    release();
    await first;
  });
});
