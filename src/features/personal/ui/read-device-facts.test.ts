import { createMemoryOrderStore } from '@/features/orders';

import { readDeviceFacts } from './read-device-facts';

describe('readDeviceFacts', () => {
  it('đọc được: trả đúng giá trị toàn máy', async () => {
    const store = {
      ...createMemoryOrderStore(),
      hasRecordingOnDevice: async () => true,
      countUnsyncedOnDevice: async () => 4,
    };
    await expect(readDeviceFacts(store)).resolves.toEqual({ recording: true, unsynced: 4 });
  });

  it('từng mục lỗi riêng: mục đó null, mục kia vẫn đọc được, không ném', async () => {
    const store = {
      ...createMemoryOrderStore(),
      hasRecordingOnDevice: async () => {
        throw new Error('x');
      },
      countUnsyncedOnDevice: async () => 2,
    };
    await expect(readDeviceFacts(store)).resolves.toEqual({ recording: null, unsynced: 2 });
  });
});
