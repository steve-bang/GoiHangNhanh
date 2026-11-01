import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, ShopId } from '@/core/ids';

import { createEvidenceReadUrlApi, EvidenceReadUrlError } from './read-url';

const SHOP = 'shop-1' as ShopId;
const EV = 'ev-1' as EvidenceId;

function docsWith(call: (name: string, data: unknown) => Promise<unknown>): RemoteDocuments {
  return { callFunction: call } as unknown as RemoteDocuments;
}

describe('createEvidenceReadUrlApi', () => {
  it('gọi getEvidenceReadUrl với shopId + evidenceId và trả url + hạn', async () => {
    const call = jest.fn(async () => ({ url: 'https://signed.example/x', expiresAtMs: 5 }));
    const api = createEvidenceReadUrlApi(docsWith(call));
    await expect(api.get(SHOP, EV)).resolves.toEqual({
      url: 'https://signed.example/x',
      expiresAtMs: 5,
    });
    expect(call).toHaveBeenCalledWith('getEvidenceReadUrl', { shopId: SHOP, evidenceId: EV });
  });

  it.each(['unavailable', 'functions/deadline-exceeded'])('mã %s: lỗi mạng', async (code) => {
    const api = createEvidenceReadUrlApi(docsWith(() => Promise.reject({ code })));
    await expect(api.get(SHOP, EV)).rejects.toMatchObject({ reason: 'network' });
  });

  it('internal không kèm details = không tới được máy chủ (mạng); có details = máy chủ lỗi', async () => {
    const noDetails = createEvidenceReadUrlApi(
      docsWith(() => Promise.reject({ code: 'functions/internal' })),
    );
    await expect(noDetails.get(SHOP, EV)).rejects.toMatchObject({ reason: 'network' });
    const withDetails = createEvidenceReadUrlApi(
      docsWith(() =>
        Promise.reject({ code: 'functions/internal', details: { reason: 'server_unexpected' } }),
      ),
    );
    await expect(withDetails.get(SHOP, EV)).rejects.toMatchObject({ reason: 'unavailable' });
  });

  it.each(['permission-denied', 'failed-precondition', 'not-found'])(
    'mã %s: máy chủ không cho xem',
    async (code) => {
      const api = createEvidenceReadUrlApi(
        docsWith(() => Promise.reject({ code: `functions/${code}` })),
      );
      await expect(api.get(SHOP, EV)).rejects.toBeInstanceOf(EvidenceReadUrlError);
      await expect(api.get(SHOP, EV)).rejects.toMatchObject({ reason: 'unavailable' });
    },
  );

  it.each([
    {},
    { url: 'http://insecure.example/x', expiresAtMs: 1 },
    { url: 'file:///x', expiresAtMs: 1 },
    { url: 'https://ok.example/x' },
  ])('phản hồi sai dạng hoặc không phải https bị từ chối: %j', async (payload) => {
    const api = createEvidenceReadUrlApi(docsWith(async () => payload));
    await expect(api.get(SHOP, EV)).rejects.toMatchObject({ reason: 'unavailable' });
  });
});
