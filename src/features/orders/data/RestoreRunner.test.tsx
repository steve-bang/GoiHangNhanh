import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { RemoteDocuments, RemoteListRequest } from '@/api/contract';
import { resetMockConnectivity, setMockConnectivity } from '@/test-utils/mock-connectivity';
import { renderWithProviders } from '@/test-utils/render';

import { RestoreBanner } from '../ui/RestoreBanner';
import { CurrentShopProvider } from './current-shop';
import { createMemoryOrderStore } from './memory-order-store';
import { OrderStoreProvider } from './OrderStoreProvider';
import { RestoreProvider } from './RestoreProvider';
import { RestoreRunner } from './RestoreRunner';
import { createRestoreController, type RestoreController } from './restore-status';

jest.mock('@/platform/app-state', () => ({ subscribeAppActive: () => () => undefined }));
// Web/Jest không có SQLite: kho khôi phục là bản trong bộ nhớ (không ghi gì), đủ để kiểm tra luồng.
jest.mock('@/platform/local-db', () => ({ openLocalDatabase: async () => null }));

afterEach(() => resetMockConnectivity());

const SHOP = 'shop-that';
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));

function fakeDocs(listPage: RemoteDocuments['listPage']): RemoteDocuments {
  return {
    values: { serverTimestamp: () => 'TS', timestamp: (ms) => ms },
    currentUid: () => 'uid',
    createMissing: async () => undefined,
    updateFields: async () => undefined,
    getFields: async () => null,
    getManyFields: async () => new Map(),
    listPage,
    callFunction: async () => {
      throw new Error('unused');
    },
  };
}

const mount = (docs: RemoteDocuments | null, controller: RestoreController, shopId = SHOP) =>
  render(
    <CurrentShopProvider shopId={shopId}>
      <OrderStoreProvider store={createMemoryOrderStore()}>
        <RestoreProvider controller={controller}>
          <RestoreRunner docs={docs} />
        </RestoreProvider>
      </OrderStoreProvider>
    </CurrentShopProvider>,
  );

describe('RestoreRunner', () => {
  it('máy trống: hiện đang lấy lại rồi chạy hết các giai đoạn đến xong', async () => {
    const controller = createRestoreController();
    const kinds: string[] = [];
    controller.subscribe(() => kinds.push(controller.get().kind));
    const listPage = jest.fn(async (_request: RemoteListRequest) => ({ docs: [], next: null }));
    await mount(fakeDocs(listPage), controller);
    await flush();
    expect(kinds).toContain('running');
    expect(controller.get().kind).toBe('done');
    // ba giai đoạn: đơn, phiên, bằng chứng
    expect(listPage.mock.calls.map(([r]) => r.path)).toEqual([
      `shops/${SHOP}/orders`,
      `shops/${SHOP}/sessions`,
      `shops/${SHOP}/evidence`,
    ]);
  });

  it('không có cổng, shop cục bộ tạm hoặc chưa biết shop: không đọc gì', async () => {
    const controller = createRestoreController();
    const listPage = jest.fn(async (_request: RemoteListRequest) => ({ docs: [], next: null }));
    await mount(null, controller);
    await mount(fakeDocs(listPage), controller, 'local-shop');
    await flush();
    expect(listPage).not.toHaveBeenCalled();
    expect(controller.get().kind).toBe('idle');
  });

  it('mất mạng: chờ có mạng (không lỗi), có mạng lại thì tự chạy tiếp', async () => {
    setMockConnectivity({ online: false });
    const controller = createRestoreController();
    const listPage = jest.fn(async (_request: RemoteListRequest) => ({ docs: [], next: null }));
    await mount(fakeDocs(listPage), controller);
    await flush();
    expect(controller.get().kind).toBe('waiting_network');
    expect(listPage).not.toHaveBeenCalled();
    await act(async () => setMockConnectivity({ online: true }));
    await flush();
    expect(controller.get().kind).toBe('done');
  });

  it('lỗi mạng của máy chủ: chờ mạng; lỗi khác: báo lỗi và Thử lại chạy lại được', async () => {
    const controller = createRestoreController();
    let failure: unknown = Object.assign(new Error('x'), { code: 'unavailable' });
    const listPage = jest.fn(async (_request: RemoteListRequest) => {
      if (failure) throw failure;
      return { docs: [], next: null };
    });
    await mount(fakeDocs(listPage), controller);
    await flush();
    expect(controller.get().kind).toBe('waiting_network');

    failure = Object.assign(new Error('y'), { code: 'permission-denied' });
    await act(async () => controller.retry());
    await flush();
    expect(controller.get().kind).toBe('failed');

    failure = null;
    await act(async () => controller.retry());
    await flush();
    expect(controller.get().kind).toBe('done');
  });
});

describe('RestoreBanner', () => {
  const show = async (status: Parameters<RestoreController['set']>[0]) => {
    const controller = createRestoreController();
    controller.set(status);
    await renderWithProviders(
      <RestoreProvider controller={controller}>
        <RestoreBanner />
      </RestoreProvider>,
    );
    return controller;
  };

  it('đang chạy: nói đang lấy lại và đếm số đơn đã về', async () => {
    await show({ kind: 'running', visible: true, orders: 12 });
    expect(screen.getByText('Đang lấy lại đơn hàng của bạn')).toBeOnTheScreen();
    expect(screen.getByText('Đã lấy lại 12 đơn')).toBeOnTheScreen();
  });

  it('máy đã đủ dữ liệu (không hiện) và trạng thái nghỉ: không vẽ gì', async () => {
    await show({ kind: 'running', visible: false, orders: 0 });
    expect(screen.queryByTestId('restore-banner')).toBeNull();
  });

  it('chờ mạng: nói sẽ tự tiếp tục, không có nút Thử lại', async () => {
    await show({ kind: 'waiting_network', visible: true, orders: 3 });
    expect(screen.getByText('Đang chờ có mạng để tiếp tục')).toBeOnTheScreen();
    expect(screen.queryByTestId('restore-banner-retry')).toBeNull();
  });

  it('lỗi: có nút Thử lại gọi chạy lại', async () => {
    const controller = createRestoreController();
    controller.set({ kind: 'failed', visible: true, orders: 0 });
    const retried = jest.fn();
    controller.onRetry(retried);
    await renderWithProviders(
      <RestoreProvider controller={controller}>
        <RestoreBanner />
      </RestoreProvider>,
    );
    fireEvent.press(screen.getByTestId('restore-banner-retry'));
    expect(retried).toHaveBeenCalledTimes(1);
  });

  it('xong: báo số đơn đã lấy lại; xong mà không lấy được gì thì không hiện', async () => {
    await show({ kind: 'done', orders: 5 });
    expect(screen.getByText('Đã lấy lại 5 đơn hàng')).toBeOnTheScreen();
  });
});
