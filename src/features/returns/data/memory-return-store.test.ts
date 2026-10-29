import type { ReturnCaseId, ShopId } from '@/core/ids';

import { createMemoryReturnStore } from './memory-return-store';
import { makeNewReturn, runReturnStoreContract } from './return-store.contract';

runReturnStoreContract('bộ nhớ', async () => createMemoryReturnStore());

describe('kho bộ nhớ hàng hoàn: ảnh trong tranh chấp', () => {
  it('không xóa ảnh mà kho tranh chấp báo đang giữ; ảnh khác vẫn xóa được', async () => {
    const shop = 'shop-a' as ShopId;
    const held = new Set(['held']);
    const store = createMemoryReturnStore({ isHeldByDispute: async (_s, id) => held.has(id) });
    const made = await store.createReturn(makeNewReturn({ shopId: shop }));
    const returnId = made.returnCase.id as ReturnCaseId;
    for (const id of ['held', 'free']) {
      await store.createMedia({ id, shopId: shop, returnId, kind: 'photo', atDevice: 1 });
    }
    await expect(store.deleteMedia(shop, 'held', 5, 'ev-x')).rejects.toMatchObject({
      code: 'RETURN_PHOTO_IN_USE',
    });
    expect((await store.getReturn(shop, returnId))?.events.map((e) => e.kind)).toEqual(['created']);
    expect((await store.deleteMedia(shop, 'free', 6, 'ev-y')).ok).toBe(true);
    expect((await store.listMedia(shop, returnId)).map((m) => m.id)).toEqual(['held']);
  });
});
