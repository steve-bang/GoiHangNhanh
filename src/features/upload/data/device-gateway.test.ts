import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { UploadSessionStore } from '@/platform';

import type { UploadSession } from '../domain/create-upload-gateway';
import type { UploadRequest } from '../domain/ports';
import { createDeviceUploadGateway } from './device-gateway';

const mockUploadFile = jest.fn();
let mockNextSession: UploadSession = { status: 'ready', url: 'u', method: 'POST', headers: {} };

jest.mock('@/platform', () => ({
  ...jest.requireActual('@/platform'),
  uploadFileResumable: (...args: unknown[]) => mockUploadFile(...args),
}));
jest.mock('./firebase-ports', () => ({
  createFirebaseUploadPorts: () => ({
    declarer: { declare: async () => undefined },
    sessions: { create: async () => mockNextSession },
    serverStates: { read: async () => new Map() },
  }),
}));

const request: UploadRequest = {
  evidenceId: 'e1' as EvidenceId,
  shopId: 's1' as ShopId,
  owner: {
    kind: 'packing',
    orderId: 'o1' as OrderId,
    sessionId: 'ss1' as SessionId,
    packageId: 'p1' as PackageId,
  },
  kind: 'video',
  createdAtDevice: 1,
  durationMs: 1000,
  localPath: 'evidence/e1.mp4',
  sizeBytes: 5_000_000,
  sha256Client: 'ab'.repeat(32),
};

const docs = {} as RemoteDocuments;

function makeStore() {
  const cleared: [string, string][] = [];
  const store: UploadSessionStore = {
    get: async () => null,
    save: async () => undefined,
    clear: async (shopId, evidenceId) => {
      cleared.push([shopId, evidenceId]);
    },
  };
  return { store, cleared };
}

beforeEach(() => {
  mockUploadFile.mockReset();
  mockUploadFile.mockResolvedValue({ ok: true });
  mockNextSession = { status: 'ready', url: 'u', method: 'POST', headers: {} };
});

describe('createDeviceUploadGateway: tải tiếp được', () => {
  it('có kho phiên: truyền cho bộ tải cùng shop, bằng chứng và kích thước tệp', async () => {
    const { store } = makeStore();
    const gateway = createDeviceUploadGateway(docs, '1.0', store);
    expect(await gateway.upload(request)).toEqual({ kind: 'received' });
    const [, path, contentType, , , resume] = mockUploadFile.mock.calls[0] as unknown[];
    expect(path).toBe('evidence/e1.mp4');
    expect(contentType).toBe('video/mp4');
    expect(resume).toEqual({
      store,
      shopId: 's1',
      evidenceId: 'e1',
      sizeBytes: 5_000_000,
    });
  });

  it('không có kho phiên: không truyền resume (tải nguyên tệp như trước)', async () => {
    const gateway = createDeviceUploadGateway(docs, '1.0');
    expect(await gateway.upload(request)).toEqual({ kind: 'received' });
    expect((mockUploadFile.mock.calls[0] as unknown[])[5]).toBeUndefined();
  });

  it('máy chủ báo already_received: bỏ phiên dở của tệp, không gửi gì', async () => {
    mockNextSession = { status: 'already_received' };
    const { store, cleared } = makeStore();
    const gateway = createDeviceUploadGateway(docs, '1.0', store);
    expect(await gateway.upload(request)).toEqual({ kind: 'received' });
    expect(mockUploadFile).not.toHaveBeenCalled();
    expect(cleared).toEqual([['s1', 'e1']]);
  });

  it('lỗi từ bộ tải được phân loại như cũ (mạng không tốn lượt)', async () => {
    mockUploadFile.mockResolvedValue({ ok: false, kind: 'network', code: 'NETWORK' });
    const { store } = makeStore();
    const gateway = createDeviceUploadGateway(docs, '1.0', store);
    expect(await gateway.upload(request)).toEqual({ kind: 'network', code: 'NETWORK' });
  });

  it('kho phiên lỗi khi bỏ phiên (already_received): không làm hỏng kết quả', async () => {
    mockNextSession = { status: 'already_received' };
    const store: UploadSessionStore = {
      get: async () => null,
      save: async () => undefined,
      clear: async () => {
        throw new Error('db');
      },
    };
    const gateway = createDeviceUploadGateway(docs, '1.0', store);
    expect(await gateway.upload(request)).toEqual({ kind: 'received' });
  });
});
