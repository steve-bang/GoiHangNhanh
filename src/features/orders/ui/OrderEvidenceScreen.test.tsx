import { useState } from 'react';
import { Pressable } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { PackageId, SessionId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import type { FileState } from '@/features/evidence';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { CurrentShopProvider, createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import type { OrderEvidenceItem, OrderStore } from '../domain';
import { buildPackingSession } from '../domain/start-session';
import { OrderEvidenceScreen } from './OrderEvidenceScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
// Hôm nay nguồn thật luôn rỗng; các nhánh khác kiểm bằng dữ liệu giả CỦA TEST (không nằm trong app).
const mockItems: OrderEvidenceItem[] = [];
jest.mock('../data/order-evidence-source', () => ({
  loadEvidenceStates: async (_shop: string, ids: string[]) =>
    new Map<string, FileState[]>(
      mockItems.length ? ids.map((id) => [id, mockItems.map((i) => i.state)]) : [],
    ),
  loadEvidenceItems: async () => mockItems,
}));

const AT = new Date(2026, 9, 27, 9, 30).getTime();

beforeEach(() => {
  resetMockNavigation();
  mockItems.length = 0;
});

function item(id: string, state: FileState, extra: Partial<OrderEvidenceItem> = {}) {
  mockItems.push({ id, group: 'pack', kind: 'video', capturedAtDevice: AT, state, ...extra });
}

async function open(store: OrderStore, orderId: string | undefined) {
  mockNavigation.params = orderId ? { orderId } : {};
  await renderWithProviders(<OrderEvidenceScreen />, { orderStore: store });
}

describe('UI-E03 Bằng chứng của đơn', () => {
  it('đơn chưa có bằng chứng: trạng thái trống trung thực, mã đơn ở đầu, không nhãn đồng bộ', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-1', { at: AT });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    expect(await screen.findByText('Đơn này chưa có bằng chứng.')).toBeOnTheScreen();
    expect(screen.getByTestId('order-evidence-code')).toHaveTextContent('DH-EV-1');
    expect(screen.getByText('Đóng gói (0)')).toBeOnTheScreen();
    expect(screen.getByText('Hàng hoàn (0)')).toBeOnTheScreen();
    expect(screen.queryByText(/Đã đồng bộ|Đã tải lên|Đã xác minh|Đang tải lên/)).toBeNull();
  });

  it('CTA Quay đóng gói truyền đúng orderId (chưa có phiên)', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-2', { at: AT });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    await fireEvent.press(await screen.findByTestId('order-evidence-record'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderPreview, {
      orderId: d.order.id,
    });
  });

  it('CTA mở lại đúng phiên/kiện đang thực hiện (không tạo phiên chồng)', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-3', { at: AT, lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(d);
    const pkg = d.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(d, pkg.id as PackageId, {
      sessionId: 'sess-ev3' as SessionId,
      nowDevice: AT,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await open(store, d.order.id);
    await fireEvent.press(await screen.findByTestId('order-evidence-record'));
    await waitFor(() =>
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.packRecord, {
        sessionId: 'sess-ev3',
      }),
    );
    expect(await store.listSessionsOfOrder(d.order.shopId, d.order.id)).toHaveLength(1);
  });

  it('nhóm Hàng hoàn trống có câu riêng', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-4', { at: AT });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    await fireEvent.press(await screen.findByText('Hàng hoàn (0)'));
    expect(screen.getByText('Chưa có bằng chứng hàng hoàn.')).toBeOnTheScreen();
  });

  it('dữ liệu thật (giả của test): nhãn theo trạng thái TỆP; tệp lỗi chỉ trỏ tới trung tâm đồng bộ; không còn CTA quay', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-5', { at: AT });
    await store.saveNewOrder(d);
    item('a', 'recording');
    item('b', 'queued', { kind: 'photo' });
    item('c', 'uploading');
    item('d', 'verified', { kind: 'photo' });
    item('e', 'upload_failed');
    await open(store, d.order.id);
    expect(await screen.findByText('Đóng gói (5)')).toBeOnTheScreen();
    expect(screen.getByTestId('evidence-status-a')).toBeOnTheScreen();
    expect(screen.getAllByText('Video đóng gói')).toHaveLength(3);
    expect(screen.getAllByText('Ảnh đóng gói')).toHaveLength(2);
    expect(screen.queryByTestId('order-evidence-record')).toBeNull();
    // chỉ tệp lỗi có lối tới trung tâm đồng bộ; màn không tự tải lên lại
    expect(screen.queryByTestId('evidence-open-sync-a')).toBeNull();
    await fireEvent.press(screen.getByTestId('evidence-open-sync-e'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync);
  });

  it('nhãn "Đã lưu trên máy" không bị hiện thành đã đồng bộ', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-EV-6', { at: AT });
    await store.saveNewOrder(d);
    item('a', 'queued');
    await open(store, d.order.id);
    expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(screen.queryByText(/Đã đồng bộ|Đã tải lên|Đã xác minh/)).toBeNull();
  });

  it('ID lạ hoặc đơn của shop khác là không tìm thấy, không lộ mã đơn', async () => {
    const store = createMemoryOrderStore();
    const other = makeOrder('SECRET', { at: AT, shopId: 'shop-khac' as ShopId });
    await store.saveNewOrder(other);
    await open(store, other.order.id);
    expect(await screen.findByTestId('order-evidence-not-found')).toBeOnTheScreen();
    expect(screen.queryByText('SECRET')).toBeNull();
  });

  it('đổi shop trong phiên: không giữ dữ liệu của shop cũ', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('SHOP-A-ORDER', { at: AT, shopId: 'shop-a' as ShopId });
    await store.saveNewOrder(d);
    mockNavigation.params = { orderId: d.order.id };
    function Harness() {
      const [shop, setShop] = useState('shop-a');
      return (
        <>
          <Pressable testID="switch" onPress={() => setShop('shop-b')} />
          <CurrentShopProvider shopId={shop}>
            <OrderEvidenceScreen />
          </CurrentShopProvider>
        </>
      );
    }
    await renderWithProviders(<Harness />, { orderStore: store });
    expect(await screen.findByText('SHOP-A-ORDER')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId('switch')));
    await waitFor(() => expect(screen.queryByText('SHOP-A-ORDER')).toBeNull());
  });
});
