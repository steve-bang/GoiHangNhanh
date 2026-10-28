import type { SessionId } from '@/core/ids';
import type { RemoteDocuments, RemoteWriteSpec } from '@/api/contract';

import { buildPackingSession } from '../domain/start-session';
import type { OrderDetails } from '../domain/types';
import { makeOrder } from './order-store.contract';
import {
  createRemoteOrderWriter,
  RemoteCreatorMismatchError,
  RemoteNotSignedInError,
} from './remote-order-writer';

function fakeDocs(uid: string | null = 'uid-1') {
  const created: RemoteWriteSpec[][] = [];
  const updates: { path: string; fields: unknown }[] = [];
  const docs: RemoteDocuments = {
    values: { serverTimestamp: () => 'SERVER_TS', timestamp: (ms) => `TS:${ms}` },
    currentUid: () => uid,
    createMissing: async (writes) => void created.push([...writes]),
    updateFields: async (path, fields) => void updates.push({ path, fields }),
    getFields: async () => null,
    getManyFields: async () => new Map(),
    callFunction: async () => {
      throw new Error('unused');
    },
  };
  return { docs, created, updates };
}

/** Bản ghi như kho trả ra khi tài khoản `uid` tạo (kho điền createdBy). */
const ownedBy = (uid: string, details: OrderDetails): OrderDetails => ({
  ...details,
  order: { ...details.order, createdBy: uid },
  packages: details.packages.map((p) => ({ ...p, createdBy: uid })),
});

const sessionOf = (creator = 'uid-1') => {
  const raw = makeOrder('W-1', { lines: [{ name: 'Áo' }] });
  const details = ownedBy(creator, raw);
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(details, pkg.id, {
    sessionId: 's1' as SessionId,
    nowDevice: 5,
  });
  if (!built.ok) throw new Error('fixture');
  return { details, session: { ...built.session, createdBy: creator } };
};

describe('createRemoteOrderWriter', () => {
  it('đăng đơn: một lần tạo phần còn thiếu với đơn + dòng + kiện, người tạo là uid hiện tại', async () => {
    const t = fakeDocs();
    const { details } = sessionOf();
    await createRemoteOrderWriter(t.docs).publishOrder(details);
    expect(t.created).toHaveLength(1);
    expect(t.created[0]).toHaveLength(1 + details.lines.length + details.packages.length);
    expect(t.created[0]?.[0]?.data).toMatchObject({ createdBy: 'uid-1', createdAt: 'SERVER_TS' });
  });

  it('đăng phiên recording: chỉ tạo, không cập nhật trạng thái', async () => {
    const t = fakeDocs();
    await createRemoteOrderWriter(t.docs, '1.2.3').publishSession(sessionOf().session, 'recording');
    expect(t.created[0]?.[0]?.data).toMatchObject({ status: 'recording', appVersion: '1.2.3' });
    expect(t.updates).toEqual([]);
  });

  it('đăng phiên đã kết thúc: tạo rồi cập nhật trạng thái', async () => {
    const t = fakeDocs();
    const { session } = sessionOf();
    await createRemoteOrderWriter(t.docs).publishSession(session, 'ended');
    expect(t.updates).toEqual([
      { path: `shops/${session.shopId}/sessions/${session.id}`, fields: { status: 'ended' } },
    ]);
  });

  it('không đăng thay người khác: đơn/kiện/phiên của tài khoản khác ném RemoteCreatorMismatchError, không ghi gì', async () => {
    const t = fakeDocs('uid-2');
    const { details, session } = sessionOf('uid-1');
    const writer = createRemoteOrderWriter(t.docs);
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    await expect(writer.publishOrder(details)).rejects.toBeInstanceOf(RemoteCreatorMismatchError);
    await expect(writer.publishPackage(details.order, pkg)).rejects.toBeInstanceOf(
      RemoteCreatorMismatchError,
    );
    await expect(writer.publishSession(session, 'ended')).rejects.toBeInstanceOf(
      RemoteCreatorMismatchError,
    );
    // Bản ghi không rõ người tạo cũng không đăng.
    const unknown = makeOrder('W-2', { lines: [{ name: 'Áo' }] });
    await expect(writer.publishOrder(unknown)).rejects.toBeInstanceOf(RemoteCreatorMismatchError);
    expect(t.created).toEqual([]);
    expect(t.updates).toEqual([]);
  });

  it('đăng đơn của mình: kiện do người khác thêm bị bỏ qua (chờ chính họ), kiện của mình được đăng', async () => {
    const t = fakeDocs('uid-1');
    const { details } = sessionOf('uid-1');
    const base = details.packages[0];
    if (!base) throw new Error('fixture');
    const withForeign: OrderDetails = {
      ...details,
      packages: [base, { ...base, id: 'pkg-khac' as never, index: 2, createdBy: 'uid-2' }],
    };
    await createRemoteOrderWriter(t.docs).publishOrder(withForeign);
    const paths = (t.created[0] ?? []).map((w) => w.path);
    expect(paths.some((p) => p.endsWith(`/packages/${base.id}`))).toBe(true);
    expect(paths.some((p) => p.endsWith('/packages/pkg-khac'))).toBe(false);
  });

  it('đăng một kiện của mình: chỉ tài liệu kiện, người tạo là uid hiện tại', async () => {
    const t = fakeDocs('uid-1');
    const { details } = sessionOf('uid-1');
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    await createRemoteOrderWriter(t.docs).publishPackage(details.order, pkg);
    expect(t.created).toHaveLength(1);
    expect(t.created[0]).toHaveLength(1);
    expect(t.created[0]?.[0]).toMatchObject({
      path: `shops/${details.order.shopId}/orders/${details.order.id}/packages/${pkg.id}`,
      data: { createdBy: 'uid-1', index: pkg.index },
    });
  });

  it('chưa đăng nhập: ném RemoteNotSignedInError, không ghi gì', async () => {
    const t = fakeDocs(null);
    const { details, session } = sessionOf();
    const writer = createRemoteOrderWriter(t.docs);
    await expect(Promise.resolve().then(() => writer.publishOrder(details))).rejects.toBeInstanceOf(
      RemoteNotSignedInError,
    );
    await expect(
      Promise.resolve().then(() => writer.publishSession(session, 'ended')),
    ).rejects.toBeInstanceOf(RemoteNotSignedInError);
    expect(t.created).toEqual([]);
  });
});
