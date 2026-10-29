import type { RemoteDocuments } from '@/api/contract';
import type { ReturnCaseId, ShopId } from '@/core/ids';

import type { ReturnCase } from '../domain/types';
import { createRemoteReturnWriter } from './remote-return-writer';

const returnCase: ReturnCase = {
  id: 'r-1' as ReturnCaseId,
  shopId: 'shop-a' as ShopId,
  seq: 1,
  code: 'RH-00001',
  status: 'receiving',
  sourceOrderId: null,
  observedCode: 'SPX123',
  exterior: null,
  openedBefore: null,
  openingVideo: null,
  finalNote: 'ghi chú nội bộ',
  confirmedAtDevice: null,
  createdAtDevice: 5,
  updatedAtDevice: 5,
  createdBy: 'u-1',
};

const { createdBy: _createdBy, ...withoutCreator } = returnCase;

function docs(uid: string | null) {
  const created: { path: string; data: Readonly<Record<string, unknown>> }[] = [];
  const api: RemoteDocuments = {
    values: { serverTimestamp: () => 'TS', timestamp: (ms) => ms },
    currentUid: () => uid,
    createMissing: async (writes) => void created.push(...writes),
    updateFields: async () => undefined,
    getFields: async () => null,
    getManyFields: async () => new Map(),
    callFunction: async () => {
      throw new Error('unused');
    },
  };
  return { api, created };
}

describe('createRemoteReturnWriter', () => {
  it('đăng bản neo bằng createMissing (idempotent) và không rò mã quan sát hay ghi chú', async () => {
    const t = docs('u-1');
    await createRemoteReturnWriter(t.api, '1.0.0').publishReturn(returnCase);
    expect(t.created).toHaveLength(1);
    expect(t.created[0]?.path).toBe('shops/shop-a/returns/r-1');
    const text = JSON.stringify(t.created[0]?.data);
    expect(text).not.toContain('SPX123');
    expect(text).not.toContain('ghi chú nội bộ');
  });

  it('chưa đăng nhập hoặc khác người tạo: ném lỗi, không ghi gì', async () => {
    const signedOut = docs(null);
    await expect(createRemoteReturnWriter(signedOut.api).publishReturn(returnCase)).rejects.toThrow(
      'REMOTE_NOT_SIGNED_IN',
    );
    const other = docs('u-2');
    await expect(createRemoteReturnWriter(other.api).publishReturn(returnCase)).rejects.toThrow(
      'REMOTE_CREATOR_MISMATCH',
    );
    const noCreator = docs('u-1');
    await expect(
      createRemoteReturnWriter(noCreator.api).publishReturn(withoutCreator),
    ).rejects.toThrow('REMOTE_CREATOR_MISMATCH');
    expect(signedOut.created.length + other.created.length + noCreator.created.length).toBe(0);
  });
});
