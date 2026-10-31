import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';

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
  owner: {
    kind: 'packing',
    orderId: 'o1' as OrderId,
    sessionId: 'ss1' as SessionId,
    packageId: 'p1' as PackageId,
  },
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
      u.fail[step] = new UploadPortError('retryable', 'HTTP_500');
      expect(await u.gateway.upload(request)).toEqual({ kind: 'retryable', code: 'HTTP_500' });
      const n = setup();
      n.fail[step] = new UploadPortError('network', 'NETWORK');
      expect(await n.gateway.upload(request)).toEqual({ kind: 'network', code: 'NETWORK' });
    }
  });

  it('lỗi không phân loại được tính lượt (retryable), không coi là lỗi mạng', async () => {
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

  describe('hết giờ và hủy (R4)', () => {
    const hang = () => new Promise<never>(() => undefined);

    function hanging(step: 'declare' | 'session' | 'send' | 'read') {
      const seen: { signal?: AbortSignal | undefined } = {};
      const gateway = createUploadGateway(
        {
          declarer: { declare: async () => (step === 'declare' ? hang() : undefined) },
          sessions: {
            create: async () =>
              step === 'session'
                ? hang()
                : ({ status: 'ready', url: 'u', method: 'POST', headers: {} } as const),
          },
          bytes: {
            send: async (_s, _p, _n, signal) => {
              seen.signal = signal;
              return step === 'send' ? hang() : undefined;
            },
          },
          serverStates: { read: async () => (step === 'read' ? hang() : new Map()) },
        },
        50,
      );
      return { gateway, seen };
    }

    it.each(['declare', 'session'] as const)(
      'lệnh %s treo: hết giờ thành lỗi mạng TIMEOUT (không tính lượt)',
      async (step) => {
        const { gateway } = hanging(step);
        expect(await gateway.upload(request)).toEqual({ kind: 'network', code: 'TIMEOUT' });
      },
    );

    it('hỏi trạng thái máy chủ treo: hết giờ thì ném (hàng đợi coi như chưa biết)', async () => {
      const { gateway } = hanging('read');
      await expect(gateway.fetchServerStates(request.shopId, [request.evidenceId])).rejects.toThrow(
        'TIMEOUT',
      );
    });

    it('gửi tệp không có hạn cứng; hủy qua signal thì trả NETWORK_LOST và chuyển signal xuống', async () => {
      const { gateway, seen } = hanging('send');
      const controller = new AbortController();
      const pending = gateway.upload(request, { signal: controller.signal });
      await new Promise((resolve) => setTimeout(resolve, 80)); // quá hạn lệnh ngắn: vẫn chưa xong
      let done = false;
      void pending.then(() => (done = true));
      await Promise.resolve();
      expect(done).toBe(false);
      expect(seen.signal).toBe(controller.signal);
      controller.abort();
      expect(await pending).toEqual({ kind: 'network', code: 'NETWORK_LOST' });
    });

    it('đã hủy trước khi bắt đầu: không gọi máy chủ', async () => {
      const t = setup();
      const controller = new AbortController();
      controller.abort();
      expect(await t.gateway.upload(request, { signal: controller.signal })).toEqual({
        kind: 'network',
        code: 'NETWORK_LOST',
      });
      expect(t.calls).toEqual([]);
    });
  });
});

describe('requestServerCheck (V1-08 Kiểm tra lại)', () => {
  it('chỉ xin phiên (máy chủ đặt yêu cầu xác minh lại), không khai báo, không gửi tệp', async () => {
    const { gateway, calls } = setup({ status: 'already_received' });
    await gateway.requestServerCheck?.('s1' as ShopId, 'e1' as EvidenceId);
    expect(calls).toEqual(['session']);
  });

  it('máy chủ (bất thường) cấp URL thì vẫn KHÔNG gửi tệp', async () => {
    const { gateway, calls } = setup();
    await gateway.requestServerCheck?.('s1' as ShopId, 'e1' as EvidenceId);
    expect(calls).toEqual(['session']);
  });

  it('lỗi giữ đúng phân loại', async () => {
    const { gateway, fail } = setup();
    fail.session = new UploadPortError('attention', 'PERMISSION_DENIED');
    await expect(
      gateway.requestServerCheck?.('s1' as ShopId, 'e1' as EvidenceId),
    ).rejects.toMatchObject({ kind: 'attention', code: 'PERMISSION_DENIED' });
  });
});
