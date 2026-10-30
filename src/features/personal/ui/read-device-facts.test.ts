import { createLocalOrderStore } from '@/features/orders';
import { createSqliteReturnStore } from '@/features/returns';
import { createNodeSqliteDatabase } from '@/test-utils/node-sqlite';

import { evaluateSignOutGuard } from '../domain/sign-out-guard';
import { readDeviceFacts } from './read-device-facts';

describe('readDeviceFacts + chặn đăng xuất theo tài khoản (V1-07)', () => {
  it('A tạo hồ sơ hàng hoàn chưa gửi, B chụp ảnh vào đó: B vẫn đăng xuất được; không biết uid thì chặn bảo thủ', async () => {
    const db = createNodeSqliteDatabase();
    let uid: string | null = 'uid-a';
    const orders = createLocalOrderStore(async () => db, { creatorUid: () => uid });
    const returns = createSqliteReturnStore(db, { creatorUid: () => uid });
    const made = await returns.createReturn({
      id: 'ret-1' as never,
      shopId: 'shop-a' as never,
      atDevice: 1,
      eventId: 'e-1',
      observedCode: null,
      link: null,
      lines: [],
    });
    uid = 'uid-b';
    await returns.createMedia({
      id: 'ph-b',
      shopId: 'shop-a' as never,
      returnId: made.returnCase.id,
      kind: 'photo',
      atDevice: 2,
    });
    expect(evaluateSignOutGuard(await readDeviceFacts(orders, 'uid-b'))).toEqual({ kind: 'clear' });
    expect(evaluateSignOutGuard(await readDeviceFacts(orders))).toEqual({
      kind: 'unsynced',
      count: 1,
    });
  });
});
