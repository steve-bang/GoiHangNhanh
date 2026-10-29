import type { ReturnCaseId, ShopId } from '@/core/ids';

import { returnAnchorWrite } from './remote-documents';

const v = { serverTimestamp: () => 'SERVER_TS', timestamp: (ms: number) => `TS(${ms})` };
const base = {
  id: 'r-1' as ReturnCaseId,
  shopId: 'shop-a' as ShopId,
  code: 'RH-00012',
  createdAtDevice: 1234,
};

describe('returnAnchorWrite', () => {
  it('chỉ chứa định danh: không đơn gốc, tình trạng, dòng, sai lệch hay vị trí', () => {
    const w = returnAnchorWrite(base, 'u-1', v, '1.2.3');
    expect(w.path).toBe('shops/shop-a/returns/r-1');
    expect(w.data).toEqual({
      shopId: 'shop-a',
      code: 'RH-00012',
      dataSource: 'user_entered',
      createdAtDevice: 'TS(1234)',
      createdAt: 'SERVER_TS',
      createdBy: 'u-1',
      appVersion: '1.2.3',
    });
  });

  it('bỏ khóa appVersion khi không biết; hồ sơ đã liên kết đơn vẫn không mang đơn gốc', () => {
    const w = returnAnchorWrite({ ...base, sourceOrderId: 'o-1' } as never, 'u-1', v);
    expect(Object.keys(w.data)).not.toContain('appVersion');
    expect(Object.keys(w.data)).not.toContain('sourceOrderId');
  });
});
