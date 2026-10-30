import type { SessionId } from '@/core/ids';

import { makeOrder } from './order-store.contract';
import { buildPackingSession } from '../domain/start-session';
import {
  isRemoteSessionStatus,
  orderWrites,
  sessionWrite,
  type RemoteValues,
} from '../domain/remote-documents';

const values: RemoteValues = { serverTimestamp: () => 'SERVER_TS', timestamp: (ms) => `TS:${ms}` };

describe('orderWrites', () => {
  it('đơn + dòng + kiện đúng đường dẫn, bỏ khóa rỗng, không ghi null', () => {
    const details = makeOrder('dh-01', { lines: [{ name: 'Áo' }, { name: 'Quần', variant: 'L' }] });
    const writes = orderWrites(details, 'uid-1', values);
    const base = `shops/${details.order.shopId}/orders/${details.order.id}`;
    expect(writes.map((w) => w.path)).toEqual([
      base,
      ...details.lines.map((l) => `${base}/lines/${l.id}`),
      ...details.packages.map((p) => `${base}/packages/${p.id}`),
    ]);
    const [order, line1, line2] = writes;
    expect(order?.data).toMatchObject({
      orderCode: 'dh-01',
      orderCodeNormalized: 'DH-01',
      status: 'new',
      rev: 1,
      dataSource: 'user_entered',
      createdAt: 'SERVER_TS',
      createdBy: 'uid-1',
    });
    expect(order?.data).not.toHaveProperty('trackingCode');
    expect(line1?.data).not.toHaveProperty('variant');
    expect(line2?.data).toMatchObject({ variant: 'L', position: 1, quantity: 1 });
    expect(JSON.stringify(writes)).not.toContain('null');
  });

  it('có mã vận đơn thì ghi cả bản chuẩn hóa', () => {
    const details = makeOrder('A', { tracking: 'spx 1' });
    expect(orderWrites(details, 'u', values)[0]?.data).toMatchObject({
      trackingCode: 'spx 1',
      trackingCodeNormalized: expect.any(String),
    });
  });

  it('nguồn "Khác" ghi theo từ vựng máy chủ other_unknown; nguồn sàn giữ nguyên', () => {
    expect(orderWrites(makeOrder('K', { source: 'other' }), 'u', values)[0]?.data).toMatchObject({
      source: 'other_unknown',
    });
    expect(orderWrites(makeOrder('S', { source: 'shopee' }), 'u', values)[0]?.data).toMatchObject({
      source: 'shopee',
    });
  });
});

describe('sessionWrite', () => {
  it('tạo với trạng thái recording, ảnh chụp đơn và giờ thiết bị dạng timestamp', () => {
    const details = makeOrder('S', { lines: [{ name: 'Áo', variant: 'Đen' }] });
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(details, pkg.id, {
      sessionId: 'sess-1' as SessionId,
      nowDevice: 5000,
    });
    if (!built.ok) throw new Error('fixture');
    const write = sessionWrite(built.session, 'u', values, '1.0.0');
    expect(write.path).toBe(`shops/${details.order.shopId}/sessions/sess-1`);
    expect(write.data).toMatchObject({
      kind: 'packing',
      status: 'recording',
      startedAtDevice: 'TS:5000',
      startedAtServer: 'SERVER_TS',
      appVersion: '1.0.0',
      orderSnapshot: { orderCode: 'S', lines: [{ name: 'Áo', variant: 'Đen', quantity: 1 }] },
    });
  });
});

describe('sessionWrite nguồn bán', () => {
  it('ảnh chụp đơn của phiên cũng dùng từ vựng máy chủ cho "Khác"', () => {
    const details = makeOrder('K', { source: 'other' });
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(details, pkg.id, {
      sessionId: 'sess-2' as SessionId,
      nowDevice: 1,
    });
    if (!built.ok) throw new Error('fixture');
    expect(built.session.snapshot.source).toBe('other');
    expect(sessionWrite(built.session, 'u', values).data).toMatchObject({
      orderSnapshot: { source: 'other_unknown' },
    });
  });
});

describe('isRemoteSessionStatus', () => {
  it('chỉ nhận trạng thái Rules cho phép', () => {
    for (const ok of ['recording', 'ended', 'interrupted', 'confirmed', 'needs_attention']) {
      expect(isRemoteSessionStatus(ok)).toBe(true);
    }
    for (const bad of ['created', 'xyz', '']) expect(isRemoteSessionStatus(bad)).toBe(false);
  });
});
