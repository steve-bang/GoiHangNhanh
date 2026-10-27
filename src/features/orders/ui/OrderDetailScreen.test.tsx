import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';

import { typography } from '@/core/theme';
import { AppError } from '@/core/errors/app-error';
import type { PackageId, SessionId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import type { FileState } from '@/features/evidence';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import {
  mockNavigation,
  resetMockNavigation,
  setMockScreenFocused,
} from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import { formatDeviceDateTime, type OrderStore } from '../domain';
import { buildPackingSession } from '../domain/start-session';
import { OrderDetailScreen } from './OrderDetailScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
const mockCopy = jest.fn<Promise<boolean>, [string]>();
jest.mock('@/platform/clipboard', () => ({ copyText: (text: string) => mockCopy(text) }));
const mockEvidence = new Map<string, FileState[]>();
jest.mock('../data/order-evidence-source', () => ({
  loadEvidenceStates: async () => mockEvidence,
}));

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  mockCopy.mockReset();
  mockCopy.mockResolvedValue(true);
  mockEvidence.clear();
});

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture');
  return value;
}

/** Kiện đầu tiên của đơn mẫu (luôn có một kiện). */
function firstPackageId(d: { packages: readonly { id: PackageId }[] }): PackageId {
  const pkg = d.packages[0];
  if (!pkg) throw new Error('fixture');
  return pkg.id;
}

const CREATED = new Date(2026, 9, 27, 9, 30).getTime();

async function open(store: OrderStore, orderId: string | undefined) {
  mockNavigation.params = orderId ? { orderId } : {};
  await renderWithProviders(<OrderDetailScreen />, { orderStore: store });
}

async function withSession(store: OrderStore, code: string, at = CREATED + 120_000) {
  const d = makeOrder(code, { at: CREATED, lines: [{ name: 'Áo' }] });
  await store.saveNewOrder(d);
  const built = buildPackingSession(d, firstPackageId(d), {
    sessionId: `sess-${code}` as SessionId,
    nowDevice: at,
  });
  if (!built.ok) throw new Error('fixture');
  await store.saveSession(built.session);
  return d;
}

describe('UI-E02 Chi tiết đơn (chỉ đọc)', () => {
  it('bố cục gọn: tiêu đề header cỡ formTitle, mã đơn 17sp (không còn 24sp)', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-GON', { at: CREATED, lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    const size = (el: { props: { style?: unknown } }) =>
      (StyleSheet.flatten(el.props.style as never) as { fontSize: number }).fontSize;
    expect(size(await screen.findByText('Chi tiết đơn'))).toBe(typography.formTitle.fontSize);
    expect(size(screen.getByTestId('detail-order-code'))).toBe(typography.formTitle.fontSize);
  });

  it('hiện đủ: mã đơn, nguồn, mã vận đơn, giờ tạo (giờ thiết bị), sản phẩm "Do bạn nhập", kiện, bằng chứng, lịch sử', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('DH-10245', {
      source: 'shopee',
      tracking: 'SPX-77',
      at: CREATED,
      lines: [
        { name: 'Áo thun cotton', variant: 'Đen / XL', quantity: 2 },
        { name: 'Áo thun cotton', variant: 'Trắng / L' },
      ],
    });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    expect(await screen.findByTestId('screen-UI-E02')).toBeOnTheScreen();
    expect(screen.getByTestId('detail-order-code')).toHaveTextContent('DH-10245');
    expect(screen.getByTestId('detail-source')).toHaveTextContent('Shopee');
    expect(screen.getByTestId('detail-tracking-code')).toHaveTextContent('SPX-77');
    expect(screen.getByTestId('detail-created-at')).toHaveTextContent(
      formatDeviceDateTime(CREATED),
    );
    expect(screen.getByText('Theo giờ trên thiết bị của bạn.')).toBeOnTheScreen();
    expect(screen.getAllByText('Áo thun cotton')).toHaveLength(2);
    expect(screen.getByText('Đen / XL')).toBeOnTheScreen();
    expect(screen.getByText('Trắng / L')).toBeOnTheScreen();
    expect(screen.getAllByText('Do bạn nhập')).toHaveLength(2);
    expect(screen.getByText('Kiện 1')).toBeOnTheScreen();
    expect(screen.getByTestId(`detail-package-${firstPackageId(d)}`)).toBeOnTheScreen();
    expect(screen.getByText('Chưa có phiên quay')).toBeOnTheScreen();
    expect(screen.getByTestId('detail-no-evidence')).toHaveTextContent('Chưa có video đóng gói.');
    expect(screen.getByText('Đã tạo đơn')).toBeOnTheScreen();
    // chỉ đọc: không có nút Sửa
    expect(screen.queryByRole('button', { name: /Sửa|Chỉnh sửa/ })).toBeNull();
    expect(screen.queryByText(/Đã đồng bộ|Hoàn tất/)).toBeNull();
  });

  it('nhãn Chưa khai báo sản phẩm + câu bổ sung CHỈ khi chưa có dòng; thiếu mã vận đơn có câu riêng và không có nút Sao chép mã vận đơn', async () => {
    const store = createMemoryOrderStore();
    const none = makeOrder('NONE', { at: CREATED });
    const some = makeOrder('SOME', { at: CREATED, lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(none);
    await store.saveNewOrder(some);
    await open(store, none.order.id);
    expect(await screen.findByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
    expect(screen.getByTestId('detail-undeclared-hint')).toHaveTextContent(
      'Bạn chưa khai báo sản phẩm cho đơn này.',
    );
    expect(screen.getByTestId('detail-no-tracking')).toHaveTextContent('Chưa có mã vận đơn.');
    expect(screen.queryByTestId('copy-tracking-code')).toBeNull();
  });

  it('đơn có dòng thì không hiện nhãn Chưa khai báo sản phẩm', async () => {
    const store = createMemoryOrderStore();
    const some = makeOrder('SOME', { at: CREATED, lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(some);
    await open(store, some.order.id);
    await screen.findByTestId('detail-order-code');
    expect(screen.queryByText('Chưa khai báo sản phẩm')).toBeNull();
    expect(screen.queryByTestId('detail-undeclared-hint')).toBeNull();
  });

  describe('Sao chép', () => {
    it('chép mã đơn và mã vận đơn, báo Đã sao chép; lỗi thì báo rõ', async () => {
      const store = createMemoryOrderStore();
      const d = makeOrder('CP-1', { tracking: 'TRK-1', at: CREATED });
      await store.saveNewOrder(d);
      await open(store, d.order.id);
      await fireEvent.press(await screen.findByTestId('copy-order-code'));
      expect(mockCopy).toHaveBeenLastCalledWith('CP-1');
      expect(await screen.findByText('Đã sao chép')).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId('copy-tracking-code'));
      expect(mockCopy).toHaveBeenLastCalledWith('TRK-1');
      mockCopy.mockResolvedValue(false);
      await fireEvent.press(screen.getByTestId('copy-order-code'));
      expect(await screen.findByText('Chưa sao chép được.')).toBeOnTheScreen();
      expect(screen.queryByText('Đã sao chép')).toBeNull();
    });
  });

  describe('không tìm thấy', () => {
    it('ID không tồn tại: hiện "không tìm thấy" có đường về danh sách, không lộ dữ liệu', async () => {
      const store = createMemoryOrderStore();
      await store.saveNewOrder(makeOrder('SECRET-CODE', { at: CREATED }));
      await open(store, 'khong-co');
      expect(await screen.findByTestId('order-not-found')).toBeOnTheScreen();
      expect(screen.getByText('Không tìm thấy đơn này trong máy.')).toBeOnTheScreen();
      expect(screen.queryByText('SECRET-CODE')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Về danh sách đơn' }));
      expect(mockNavigation.back).toHaveBeenCalled();
    });

    it('đơn của shop khác (dù biết ID) cũng là không tìm thấy', async () => {
      const store = createMemoryOrderStore();
      const theirs = makeOrder('THEIRS-CODE', {
        at: CREATED,
        shopId: 'shop-khac' as ShopId,
        tracking: 'THEIR-TRK',
        lines: [{ name: 'Hàng của họ' }],
      });
      await store.saveNewOrder(theirs);
      await open(store, theirs.order.id);
      expect(await screen.findByTestId('order-not-found')).toBeOnTheScreen();
      for (const leaked of ['THEIRS-CODE', 'THEIR-TRK', 'Hàng của họ']) {
        expect(screen.queryByText(leaked)).toBeNull();
      }
    });

    it('thiếu tham số orderId cũng là không tìm thấy', async () => {
      await open(createMemoryOrderStore(), undefined);
      expect(await screen.findByTestId('order-not-found')).toBeOnTheScreen();
    });
  });

  it('lỗi đọc: hiện lỗi có Thử lại, không giả làm "không tìm thấy"', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('ERR', { at: CREATED });
    await store.saveNewOrder(d);
    let broken = true;
    const flaky: OrderStore = {
      ...store,
      getOrder: async (...args) => {
        if (broken) throw new AppError('ORDER_SAVE_FAILED');
        return store.getOrder(...args);
      },
    };
    await open(flaky, d.order.id);
    expect(await screen.findByTestId('order-detail-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('order-not-found')).toBeNull();
    broken = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('detail-order-code')).toHaveTextContent('ERR');
  });

  describe('phiên created không phải bằng chứng', () => {
    it('hiện ở Kiện hàng và Lịch sử như "đã bắt đầu phiên quay", nhưng mục Bằng chứng vẫn "Chưa có video"; không nói đã lưu video', async () => {
      const store = createMemoryOrderStore();
      const d = await withSession(store, 'SESS');
      await open(store, d.order.id);
      await screen.findByTestId('detail-order-code');
      expect(screen.getByTestId('detail-no-evidence')).toBeOnTheScreen();
      expect(screen.getByText('Đã bắt đầu phiên quay kiện 1')).toBeOnTheScreen();
      expect(
        screen.getByText(
          `Có phiên quay đang mở, bắt đầu lúc ${formatDeviceDateTime(CREATED + 120_000)}`,
        ),
      ).toBeOnTheScreen();
      const items = screen.getAllByTestId('detail-history-item');
      expect(items).toHaveLength(2);
      expect(within(must(items[0])).getByText('Đã tạo đơn')).toBeOnTheScreen(); // theo thứ tự thời gian
      expect(screen.queryByText(/Đã lưu|đã lưu video|Video đã/)).toBeNull();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
    });
  });

  describe('Quay ngay', () => {
    it('đơn chưa có phiên: đi qua màn Xác nhận đơn bằng ID đơn', async () => {
      const store = createMemoryOrderStore();
      const d = makeOrder('REC', { at: CREATED });
      await store.saveNewOrder(d);
      await open(store, d.order.id);
      await fireEvent.press(await screen.findByTestId('order-detail-record'));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderPreview, {
        orderId: d.order.id,
      });
    });

    it('đơn đã có phiên đang thực hiện: mở lại phiên đó, không tạo phiên chồng', async () => {
      const store = createMemoryOrderStore();
      const d = await withSession(store, 'REOPEN');
      await open(store, d.order.id);
      await fireEvent.press(await screen.findByTestId('order-detail-record'));
      await waitFor(() =>
        expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.packRecord, {
          sessionId: 'sess-REOPEN',
        }),
      );
      expect(await store.listSessionsOfOrder(d.order.shopId, d.order.id)).toHaveLength(1);
    });

    it('đơn đã có bằng chứng: không có nút Quay ngay, hiện nhãn trạng thái bằng chứng', async () => {
      const store = createMemoryOrderStore();
      const d = makeOrder('HAS-EV', { at: CREATED });
      await store.saveNewOrder(d);
      mockEvidence.set(d.order.id, ['verified', 'uploaded']);
      await open(store, d.order.id);
      await screen.findByTestId('detail-order-code');
      expect(screen.queryByTestId('order-detail-record')).toBeNull();
      expect(screen.getByText('Đã tải lên')).toBeOnTheScreen(); // không che bằng "Đã xác minh"
      expect(screen.queryByTestId('detail-no-evidence')).toBeNull();
    });
  });

  it('lấy lại focus thì nạp lại (phiên vừa tạo hiện ở lịch sử)', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('FOCUS', { at: CREATED, lines: [{ name: 'Áo' }] });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    await screen.findByTestId('detail-order-code');
    expect(screen.getAllByTestId('detail-history-item')).toHaveLength(1);
    await act(async () => setMockScreenFocused(false));
    const built = buildPackingSession(d, firstPackageId(d), {
      sessionId: 'sess-later' as SessionId,
      nowDevice: CREATED + 5000,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await act(async () => setMockScreenFocused(true));
    await waitFor(() => expect(screen.getAllByTestId('detail-history-item')).toHaveLength(2));
  });

  it('nút quay lại của header gọi back', async () => {
    const store = createMemoryOrderStore();
    const d = makeOrder('BACK', { at: CREATED });
    await store.saveNewOrder(d);
    await open(store, d.order.id);
    await fireEvent.press(await screen.findByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalled();
  });
});
