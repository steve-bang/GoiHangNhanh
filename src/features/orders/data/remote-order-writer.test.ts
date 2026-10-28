import type { SessionId } from '@/core/ids';
import type { RemoteDocuments, RemoteWriteSpec } from '@/api/contract';

import { buildPackingSession } from '../domain/start-session';
import { makeOrder } from './order-store.contract';
import { createRemoteOrderWriter, RemoteNotSignedInError } from './remote-order-writer';

function fakeDocs(uid: string | null = 'uid-1') {
  const created: RemoteWriteSpec[][] = [];
  const updates: { path: string; fields: unknown }[] = [];
  const docs: RemoteDocuments = {
    values: { serverTimestamp: () => 'SERVER_TS', timestamp: (ms) => `TS:${ms}` },
    currentUid: () => uid,
    createMissing: async (writes) => void created.push([...writes]),
    updateFields: async (path, fields) => void updates.push({ path, fields }),
    getFields: async () => null,
    callFunction: async () => {
      throw new Error('unused');
    },
  };
  return { docs, created, updates };
}

const sessionOf = () => {
  const details = makeOrder('W-1', { lines: [{ name: 'Áo' }] });
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(details, pkg.id, {
    sessionId: 's1' as SessionId,
    nowDevice: 5,
  });
  if (!built.ok) throw new Error('fixture');
  return { details, session: built.session };
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
