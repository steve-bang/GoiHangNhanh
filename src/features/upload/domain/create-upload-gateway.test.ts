import type { EvidenceId, OrderId, SessionId, ShopId } from '@/core/ids';

import {
  createUploadGateway,
  mimeTypeOf,
  UploadPortError,
  type UploadSession,
} from './create-upload-gateway';
import type { UploadRequest } from './ports';

const request: UploadRequest = {
  evidenceId: 'e1' as EvidenceId,
  shopId: 's1' as ShopId,
  orderId: 'o1' as OrderId,
  sessionId: 'ss1' as SessionId,
  kind: 'video',
  createdAtDevice: 1000,
  durationMs: 5000,
  localPath: 'file:///v/e1.mp4',
  sizeBytes: 100,
  sha256Client: 'ab'.repeat(32),
};

function setup(
  session: UploadSession = { status: 'ready', url: 'u', method: 'POST', headers: {} },
) {
  const calls: string[] = [];
  const fail: { declare?: Error; session?: Error; send?: Error } = {};
  const gateway = createUploadGateway({
    declarer: {
      declare: async (r) => {
        calls.push(`declare:${r.mimeType}`);
        if (fail.declare) throw fail.declare;
      },
    },
    sessions: {
      create: async () => {
        calls.push('session');
        if (fail.session) throw fail.session;
        return session;
      },
    },
    bytes: {
      send: async () => {
        calls.push('send');
        if (fail.send) throw fail.send;
      },
    },
    serverStates: { read: async () => new Map([['e1' as EvidenceId, 'verified' as const]]) },
  });
  return { gateway, calls, fail };
}

describe('mimeTypeOf', () => {
  it('suy loại tệp theo đuôi và loại bằng chứng', () => {
    expect(mimeTypeOf('file:///a.MP4', 'video')).toBe('video/mp4');
    expect(mimeTypeOf('file:///a.mov?x=1', 'video')).toBe('video/quicktime');
    expect(mimeTypeOf('file:///a.jpeg', 'photo')).toBe('image/jpeg');
    expect(mimeTypeOf('file:///a.jpg', 'video')).toBeNull();
    expect(mimeTypeOf('file:///a.zip', 'video')).toBeNull();
    expect(mimeTypeOf('file:///khong-duoi', 'photo')).toBeNull();
  });
});

describe('createUploadGateway', () => {
  it('khai báo -> xin phiên -> gửi tệp rồi báo đã nhận', async () => {
    const t = setup();
    expect(await t.gateway.upload(request)).toEqual({ kind: 'received' });
    expect(t.calls).toEqual(['declare:video/mp4', 'session', 'send']);
  });

  it('máy chủ đã có bản gốc: không gửi lại tệp', async () => {
    const t = setup({ status: 'already_received' });
    expect(await t.gateway.upload(request)).toEqual({ kind: 'received' });
    expect(t.calls).toEqual(['declare:video/mp4', 'session']);
  });

  it('loại tệp lạ: cần xử lý, không gọi gì tới máy chủ', async () => {
    const t = setup();
    expect(await t.gateway.upload({ ...request, localPath: 'file:///a.zip' })).toEqual({
      kind: 'attention',
      code: 'UNSUPPORTED_FILE_TYPE',
    });
    expect(t.calls).toEqual([]);
  });

  it('giữ phân loại của lỗi cổng con ở từng bước', async () => {
    for (const step of ['declare', 'session', 'send'] as const) {
      const t = setup();
      t.fail[step] = new UploadPortError('attention', 'AUTH_EXPIRED');
      expect(await t.gateway.upload(request)).toEqual({ kind: 'attention', code: 'AUTH_EXPIRED' });
      const u = setup();
      u.fail[step] = new UploadPortError('retryable', 'NETWORK');
      expect(await u.gateway.upload(request)).toEqual({ kind: 'retryable', code: 'NETWORK' });
    }
  });

  it('lỗi không phân loại được coi là lỗi tạm', async () => {
    const t = setup();
    t.fail.send = new Error('boom');
    expect(await t.gateway.upload(request)).toEqual({
      kind: 'retryable',
      code: 'UPLOAD_EXCEPTION',
    });
  });

  it('đọc trạng thái máy chủ qua cổng con', async () => {
    const t = setup();
    const states = await t.gateway.fetchServerStates(request.shopId, [request.evidenceId]);
    expect(states.get(request.evidenceId)).toBe('verified');
  });
});
