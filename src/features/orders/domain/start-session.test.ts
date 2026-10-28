import type { PackageId, SessionId } from '@/core/ids';

import {
  buildPackingSession,
  findBlockingSession,
  isSessionActive,
  isSessionStatusActive,
} from './start-session';
import { buildOrder, type IdFactory } from './build-order';
import { LOCAL_SHOP_ID } from './local-shop';
import type { OrderDetails } from './types';

let n = 0;
const ids: IdFactory = {
  orderId: () => `o${(n += 1)}` as never,
  lineId: () => `l${(n += 1)}` as never,
  packageId: () => `p${(n += 1)}` as never,
};
function details(): OrderDetails {
  const r = buildOrder(
    {
      orderCode: 'DH1',
      source: 'shopee',
      trackingCode: 'SPX1',
      lines: [{ name: 'Áo', variant: 'Đen', quantity: 2 }],
    },
    { shopId: LOCAL_SHOP_ID, ids, nowDevice: 1 },
  );
  if (!r.ok) throw new Error('fixture');
  return r.details;
}

describe('buildPackingSession (A03)', () => {
  it('gắn phiên với đơn và kiện bằng ID nội bộ, trạng thái created, thời gian thiết bị', () => {
    const d = details();
    const pkg = d.packages[0];
    if (!pkg) throw new Error('fixture');
    const r = buildPackingSession(d, pkg.id, { sessionId: 's1' as SessionId, nowDevice: 99 });
    if (!r.ok) throw new Error('phải hợp lệ');
    expect(r.session).toMatchObject({
      id: 's1',
      orderId: d.order.id,
      packageId: pkg.id,
      shopId: LOCAL_SHOP_ID,
      startedAtDevice: 99,
      sessionStatus: 'created',
    });
    expect(r.session.snapshot).toMatchObject({
      orderCode: 'DH1',
      trackingCode: 'SPX1',
      packageIndex: 1,
      packageCount: 1,
      takenAtDevice: 99,
    });
  });
  it('ảnh chụp không đổi khi đơn được sửa sau đó (bản sao, không tham chiếu)', () => {
    const d = details();
    const pkg = d.packages[0];
    if (!pkg) throw new Error('fixture');
    const r = buildPackingSession(d, pkg.id, { sessionId: 's1' as SessionId, nowDevice: 99 });
    if (!r.ok) throw new Error('phải hợp lệ');
    const edited = d.lines.map((l) => ({ ...l, quantity: 50 }));
    expect(edited[0]?.quantity).toBe(50);
    expect(r.session.snapshot.lines).toEqual([{ name: 'Áo', variant: 'Đen', quantity: 2 }]);
    expect(r.session.snapshot.lines).not.toBe(d.lines);
  });
  it('kiện không thuộc đơn thì không tạo phiên', () => {
    expect(
      buildPackingSession(details(), 'p-la' as PackageId, {
        sessionId: 's1' as SessionId,
        nowDevice: 1,
      }),
    ).toEqual({ ok: false, reason: 'package_not_in_order' });
  });
});

describe('phiên đang thực hiện', () => {
  it('created là đang thực hiện; trạng thái lạ (bản app khác ghi) thì không', () => {
    expect(isSessionStatusActive('created')).toBe(true);
    expect(isSessionStatusActive('finished')).toBe(false);
    expect(isSessionStatusActive('')).toBe(false);
    expect(isSessionActive({ sessionStatus: 'created' })).toBe(true);
  });
});

describe('findBlockingSession (R-11)', () => {
  const sess = (packageId: string, sessionStatus: string, id = 's') =>
    ({ id, packageId, sessionStatus }) as never;
  it('ended/confirmed của đúng kiện chặn là recorded; interrupted/needs_attention là unfinished', () => {
    expect(findBlockingSession([sess('p1', 'ended')], 'p1' as PackageId)?.kind).toBe('recorded');
    expect(findBlockingSession([sess('p1', 'confirmed')], 'p1' as PackageId)?.kind).toBe(
      'recorded',
    );
    expect(findBlockingSession([sess('p1', 'interrupted')], 'p1' as PackageId)?.kind).toBe(
      'unfinished',
    );
    expect(findBlockingSession([sess('p1', 'needs_attention')], 'p1' as PackageId)?.kind).toBe(
      'unfinished',
    );
    expect(
      findBlockingSession(
        [sess('p1', 'interrupted', 'a'), sess('p1', 'ended', 'b')],
        'p1' as PackageId,
      )?.kind,
    ).toBe('recorded');
  });
  it('không chặn: kiện khác, phiên created/recording (có luồng mở lại riêng), trạng thái lạ, không có phiên', () => {
    expect(findBlockingSession([sess('p2', 'ended')], 'p1' as PackageId)).toBeNull();
    expect(
      findBlockingSession([sess('p1', 'created'), sess('p1', 'recording')], 'p1' as PackageId),
    ).toBeNull();
    expect(findBlockingSession([sess('p1', 'xyz')], 'p1' as PackageId)).toBeNull();
    expect(findBlockingSession([], 'p1' as PackageId)).toBeNull();
  });
});
