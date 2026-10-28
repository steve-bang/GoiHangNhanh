import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import { AppError } from '@/core/errors/app-error';
import type { PackageId, SessionId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import {
  mockNavigation,
  resetMockNavigation,
  setMockScreenFocused,
} from '@/test-utils/mock-navigation';
import { StyleSheet } from 'react-native';

import { typography } from '@/core/theme';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import { formatDeviceDateTime, type OrderStore } from '../domain';
import { buildPackingSession } from '../domain/start-session';
import { OrdersListScreen } from './OrdersListScreen';
import type { FileState } from '@/features/evidence';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);

/** Trạng thái tệp giả theo đơn: hôm nay chưa có nguồn bằng chứng thật, test thay bằng dữ liệu giả. */
const mockEvidence = new Map<string, FileState[]>();
jest.mock('../data/order-evidence-source', () => ({
  loadEvidenceStates: async () => mockEvidence,
}));

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
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

const NOW = new Date(2026, 9, 27, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function seed(
  store: OrderStore,
  code: string,
  options: Parameters<typeof makeOrder>[1] = {},
) {
  const details = makeOrder(code, options);
  await store.saveNewOrder(details);
  return details;
}

async function open(
  store: OrderStore = createMemoryOrderStore(),
  props: { pageSize?: number } = {},
) {
  const view = await renderWithProviders(<OrdersListScreen {...props} />, { orderStore: store });
  return { store, view };
}

const cards = () => screen.queryAllByTestId(/^order-card-order-\d+$/);
const codesOnScreen = () =>
  cards().map((card) => within(card).getAllByRole('text')[0]?.props.children as string);

describe('UI-E01 Danh sách đơn (dữ liệu thật)', () => {
  it('đang nạp lần đầu: hiện skeleton, không có thẻ giả, không dòng "minh họa"', async () => {
    const store = createMemoryOrderStore();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow: OrderStore = {
      ...store,
      listOrders: async (...args) => {
        await gate;
        return store.listOrders(...args);
      },
    };
    await open(slow);
    expect(screen.getByTestId('orders-loading')).toBeOnTheScreen();
    expect(screen.getByText('Đang tải danh sách đơn…')).toBeOnTheScreen();
    expect(cards()).toHaveLength(0);
    expect(screen.queryByText(/minh họa/i)).toBeNull();
    expect(screen.queryByText(/DEMO/)).toBeNull();
    await act(async () => release());
    expect(await screen.findByTestId('orders-empty')).toBeOnTheScreen();
    expect(screen.queryByTestId('orders-loading')).toBeNull();
  });

  it('header gọn: tiêu đề cỡ formTitle (17sp), không dùng cỡ screenTitle 24sp', async () => {
    await open(createMemoryOrderStore());
    await screen.findByTestId('orders-empty');
    const flat = StyleSheet.flatten(screen.getAllByText('Đơn hàng')[0]?.props.style as never) as {
      fontSize: number;
    };
    expect(flat.fontSize).toBe(typography.formTitle.fontSize);
  });

  it('ô tìm có nút quét mã ở cuối khi trống; gõ chữ thì nút xóa thế chỗ', async () => {
    await open();
    await screen.findByTestId('orders-empty');
    await fireEvent.press(screen.getByTestId('orders-scan'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
    await fireEvent.changeText(screen.getByTestId('orders-search'), 'DH');
    expect(screen.queryByTestId('orders-scan')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa nội dung đã nhập' }));
    expect(screen.getByTestId('orders-scan')).toBeOnTheScreen();
  });

  it('chưa có đơn nào: trạng thái rỗng có hành động tạo đơn đầu tiên', async () => {
    await open();
    expect(await screen.findByText('Chưa có đơn hàng nào')).toBeOnTheScreen();
    expect(screen.getByText('Tạo đơn đầu tiên để bắt đầu lưu bằng chứng nhé.')).toBeOnTheScreen();
    expect(screen.queryByText('Không có kết quả')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo đơn hàng' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder);
  });

  it('thẻ đơn: mã đơn, nguồn, mã vận đơn, sản phẩm + variant, thời điểm tạo, Chưa có video, Quay ngay', async () => {
    const store = createMemoryOrderStore();
    const a = await seed(store, 'DH-A', {
      source: 'tiktok_shop',
      tracking: 'SPX-1',
      at: NOW,
      lines: [
        { name: 'Áo thun cotton', variant: 'Đen / XL', quantity: 2 },
        { name: 'Áo thun cotton', variant: 'Trắng / L' },
        { name: 'Quần' },
      ],
    });
    await open(store);
    const card = await screen.findByTestId(`order-card-${a.order.id}`);
    expect(within(card).getByText('DH-A')).toBeOnTheScreen();
    expect(within(card).getByText('TikTok Shop')).toBeOnTheScreen();
    expect(within(card).getByText('Mã vận đơn: SPX-1')).toBeOnTheScreen();
    expect(within(card).getByText('Áo thun cotton')).toBeOnTheScreen();
    expect(within(card).getByText('Đen / XL')).toBeOnTheScreen();
    expect(within(card).getByText('SL: 2')).toBeOnTheScreen();
    expect(within(card).getByText('và 2 sản phẩm khác')).toBeOnTheScreen();
    expect(within(card).getByText(`Tạo lúc ${formatDeviceDateTime(NOW)}`)).toBeOnTheScreen();
    expect(within(card).getByText('Chưa có video')).toBeOnTheScreen();
    expect(within(card).queryByText('Chưa khai báo sản phẩm')).toBeNull();
    expect(within(card).getByText('Quay ngay')).toBeOnTheScreen();
    expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn');
  });

  it('nhãn Chưa khai báo sản phẩm CHỈ khi chưa có dòng nào; không có mã vận đơn thì không hiện dòng đó', async () => {
    const store = createMemoryOrderStore();
    const none = await seed(store, 'NONE', { at: NOW });
    const some = await seed(store, 'SOME', { at: NOW - 1, lines: [{ name: 'Áo' }] });
    await open(store);
    const noneCard = await screen.findByTestId(`order-card-${none.order.id}`);
    expect(within(noneCard).getByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
    expect(within(noneCard).queryByText(/Mã vận đơn/)).toBeNull();
    expect(
      within(screen.getByTestId(`order-card-${some.order.id}`)).queryByText(
        'Chưa khai báo sản phẩm',
      ),
    ).toBeNull();
  });

  it('không bao giờ hiện nhãn "Đã đồng bộ" hay "Hoàn tất" chỉ vì đã tạo đơn; phiên created không phải bằng chứng', async () => {
    const store = createMemoryOrderStore();
    const d = await seed(store, 'DH-S', { at: NOW, lines: [{ name: 'Áo' }] });
    const built = buildPackingSession(d, firstPackageId(d), {
      sessionId: 'sess-created' as SessionId,
      nowDevice: NOW + 1,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await open(store);
    const card = await screen.findByTestId(`order-card-${d.order.id}`);
    expect(within(card).getByText('Chưa có video')).toBeOnTheScreen();
    expect(screen.queryByText(/Đã đồng bộ/)).toBeNull();
    expect(screen.queryByText(/Hoàn tất/)).toBeNull();
    expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
  });

  it('sắp theo hoạt động gần nhất: đơn cũ vừa bắt đầu phiên nhảy lên đầu', async () => {
    const store = createMemoryOrderStore();
    const old = await seed(store, 'OLD', { at: NOW - 3 * DAY });
    await seed(store, 'NEWER', { at: NOW - HOUR });
    const built = buildPackingSession(old, firstPackageId(old), {
      sessionId: 'sess-old' as SessionId,
      nowDevice: NOW,
    });
    if (!built.ok) throw new Error('fixture');
    await store.saveSession(built.session);
    await open(store);
    await screen.findByTestId(`order-card-${old.order.id}`);
    const ids = cards().map((c) => c.props.testID);
    expect(ids[0]).toBe(`order-card-${old.order.id}`);
  });

  describe('tìm kiếm', () => {
    async function seeded() {
      const store = createMemoryOrderStore();
      await seed(store, 'dh-100', { tracking: 'spx 999', at: NOW });
      await seed(store, 'DH-200', { at: NOW - 1 });
      await open(store);
      await screen.findAllByTestId(/^order-card-/);
      return store;
    }

    it('theo mã đơn (không phân biệt hoa/thường, bỏ khoảng trắng thừa) và theo mã vận đơn', async () => {
      await seeded();
      await fireEvent.changeText(screen.getByTestId('orders-search'), '  DH-100 ');
      await waitFor(() => expect(cards()).toHaveLength(1));
      expect(screen.getByText('dh-100')).toBeOnTheScreen();
      expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn phù hợp');
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'SPX   999');
      await waitFor(() => expect(screen.getByText('dh-100')).toBeOnTheScreen());
      expect(cards()).toHaveLength(1);
    });

    it('không có kết quả khác với chưa có đơn nào; xóa từ khóa bằng nút xóa nhanh trả lại danh sách', async () => {
      await seeded();
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'khong-co-ma-nay');
      expect(await screen.findByTestId('orders-no-results')).toBeOnTheScreen();
      expect(screen.getByText('Không có kết quả')).toBeOnTheScreen();
      expect(screen.queryByText('Chưa có đơn hàng nào')).toBeNull();
      expect(screen.queryByTestId('orders-error')).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: 'Xóa nội dung đã nhập' }));
      await waitFor(() => expect(cards()).toHaveLength(2));
      expect(screen.getByTestId('orders-search')).toHaveDisplayValue('');
    });

    it('"Xóa tìm kiếm và bộ lọc" ở trạng thái không kết quả xóa cả từ khóa lẫn chip', async () => {
      await seeded();
      await fireEvent.press(screen.getByRole('button', { name: 'Chưa có video' }));
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'zzz');
      await screen.findByTestId('orders-no-results');
      await fireEvent.press(screen.getByRole('button', { name: 'Xóa tìm kiếm và bộ lọc' }));
      await waitFor(() => expect(cards()).toHaveLength(2));
      expect(screen.getByRole('button', { name: 'Tất cả', selected: true })).toBeOnTheScreen();
    });

    it('từ khóa chỉ có khoảng trắng coi như không tìm', async () => {
      await seeded();
      await fireEvent.changeText(screen.getByTestId('orders-search'), '   ');
      await waitFor(() => expect(cards()).toHaveLength(2));
      expect(screen.getByTestId('orders-count')).toHaveTextContent(/^2 đơn$/);
    });
  });

  describe('chip và bộ lọc', () => {
    it('chỉ có chip Tất cả và Chưa có video (chip trạng thái bằng chứng khác ẩn cho tới khi có dữ liệu thật)', async () => {
      await open();
      await screen.findByTestId('orders-empty');
      expect(screen.getByRole('button', { name: 'Tất cả', selected: true })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Chưa có video' })).toBeOnTheScreen();
      for (const hidden of ['Đang tải lên', 'Đã tải lên', 'Đã xác minh', 'Lỗi – cần xử lý']) {
        expect(screen.queryByRole('button', { name: hidden })).toBeNull();
      }
    });

    it('lọc theo nguồn bán, đếm đúng, nút Bộ lọc hiện số; Xóa bộ lọc rồi Áp dụng trả lại đủ', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'S1', { source: 'shopee', at: NOW });
      await seed(store, 'S2', { source: 'shopee', at: NOW - 1 });
      await seed(store, 'T1', { source: 'tiktok_shop', at: NOW - 2 });
      await open(store);
      await screen.findAllByTestId(/^order-card-/);
      expect(screen.getByTestId('orders-count')).toHaveTextContent(/^3 đơn$/);

      await fireEvent.press(screen.getByTestId('orders-open-filters'));
      const sheet = await screen.findByTestId('orders-filters-sheet');
      expect(within(sheet).queryByText('Tùy chọn')).toBeNull(); // chưa làm khoảng ngày tự chọn
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Shopee' }));
      await fireEvent.press(screen.getByTestId('orders-filters-apply'));
      await waitFor(() => expect(cards()).toHaveLength(2));
      expect(screen.getByTestId('orders-count')).toHaveTextContent('2 đơn phù hợp');
      expect(screen.getByRole('button', { name: 'Bộ lọc (1)' })).toBeOnTheScreen();

      await fireEvent.press(screen.getByTestId('orders-open-filters'));
      await fireEvent.press(await screen.findByTestId('orders-filters-clear'));
      await fireEvent.press(screen.getByTestId('orders-filters-apply'));
      await waitFor(() => expect(cards()).toHaveLength(3));
      expect(screen.getByRole('button', { name: 'Bộ lọc' })).toBeOnTheScreen();
      expect(screen.getByTestId('orders-count')).toHaveTextContent(/^3 đơn$/);
    });

    it('Đóng sheet bỏ bản nháp, không đổi bộ lọc đang áp dụng', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'S1', { source: 'shopee', at: NOW });
      await seed(store, 'T1', { source: 'tiktok_shop', at: NOW - 1 });
      await open(store);
      await screen.findAllByTestId(/^order-card-/);
      await fireEvent.press(screen.getByTestId('orders-open-filters'));
      const sheet = await screen.findByTestId('orders-filters-sheet');
      await fireEvent.press(within(sheet).getByRole('button', { name: 'Shopee' }));
      const closers = screen.getAllByRole('button', { name: 'Đóng' });
      await fireEvent.press(must(closers[closers.length - 1]));
      expect(cards()).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Bộ lọc' })).toBeOnTheScreen();
    });

    it('lọc thời gian tạo đơn: nhãn đếm có phạm vi thời gian và chính xác', async () => {
      jest.useFakeTimers({
        doNotFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'queueMicrotask',
          'nextTick',
        ],
      });
      jest.setSystemTime(NOW);
      try {
        const store = createMemoryOrderStore();
        await seed(store, 'TODAY', { at: NOW - HOUR });
        await seed(store, 'LAST-WEEK', { at: NOW - 10 * DAY });
        await seed(store, 'LAST-MONTH', { at: NOW - 20 * DAY });
        await seed(store, 'OLDER', { at: NOW - 60 * DAY });
        await open(store);
        await screen.findAllByTestId(/^order-card-/);
        const apply = async (label: string) => {
          await fireEvent.press(screen.getByTestId('orders-open-filters'));
          const sheet = await screen.findByTestId('orders-filters-sheet');
          await fireEvent.press(within(sheet).getByRole('button', { name: label }));
          await fireEvent.press(screen.getByTestId('orders-filters-apply'));
        };
        await apply('Hôm nay');
        await waitFor(() => expect(cards()).toHaveLength(1));
        expect(screen.getByTestId('orders-count')).toHaveTextContent('Hôm nay · 1 đơn phù hợp');
        await apply('30 ngày qua');
        await waitFor(() => expect(cards()).toHaveLength(3));
        expect(screen.getByTestId('orders-count')).toHaveTextContent('30 ngày qua · 3 đơn phù hợp');
        await apply('7 ngày qua');
        await waitFor(() => expect(cards()).toHaveLength(1));
      } finally {
        jest.useRealTimers();
      }
    });

    it('lọc trạng thái khai báo suy ra từ số dòng sản phẩm', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'HAS', { at: NOW, lines: [{ name: 'Áo' }] });
      await seed(store, 'NONE', { at: NOW - 1 });
      await open(store);
      await screen.findAllByTestId(/^order-card-/);
      const apply = async (label: string) => {
        await fireEvent.press(screen.getByTestId('orders-open-filters'));
        const sheet = await screen.findByTestId('orders-filters-sheet');
        await fireEvent.press(within(sheet).getByRole('button', { name: label }));
        await fireEvent.press(screen.getByTestId('orders-filters-apply'));
      };
      await apply('Chưa khai báo sản phẩm');
      await waitFor(() => expect(cards()).toHaveLength(1));
      expect(screen.getByText('NONE')).toBeOnTheScreen();
      await apply('Đủ thông tin cơ bản');
      await waitFor(() => expect(screen.getByText('HAS')).toBeOnTheScreen());
      expect(cards()).toHaveLength(1);
    });

    it('chip Chưa có video: hôm nay mọi đơn đều chưa có video nên vẫn thấy đủ', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'A', { at: NOW });
      await seed(store, 'B', { at: NOW - 1 });
      await open(store);
      await screen.findAllByTestId(/^order-card-/);
      await fireEvent.press(screen.getByRole('button', { name: 'Chưa có video' }));
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Chưa có video', selected: true }),
        ).toBeOnTheScreen(),
      );
      expect(cards()).toHaveLength(2);
    });
  });

  describe('lỗi', () => {
    it('lỗi nạp: trạng thái lỗi có nút Thử lại (không phải "rỗng"); thử lại thành công thì hiện danh sách', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'OK', { at: NOW });
      let broken = true;
      const flaky: OrderStore = {
        ...store,
        listOrders: async (...args) => {
          if (broken) throw new AppError('ORDER_SAVE_FAILED');
          return store.listOrders(...args);
        },
      };
      await open(flaky);
      expect(await screen.findByTestId('orders-error')).toBeOnTheScreen();
      expect(
        screen.getByText('Chưa tải được danh sách đơn hàng. Bạn thử lại nhé.'),
      ).toBeOnTheScreen();
      expect(screen.queryByText('Chưa có đơn hàng nào')).toBeNull();
      expect(screen.queryByText('Không có kết quả')).toBeNull();
      broken = false;
      await fireEvent.press(
        within(screen.getByTestId('orders-error')).getByRole('button', { name: 'Thử lại' }),
      );
      await waitFor(() => expect(cards()).toHaveLength(1));
      expect(screen.queryByTestId('orders-error')).toBeNull();
    });

    it('lỗi khi đổi từ khóa: không để thẻ của bộ lọc cũ nằm dưới từ khóa mới', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'AAA', { at: NOW });
      let broken = false;
      const flaky: OrderStore = {
        ...store,
        listOrders: async (...args) => {
          if (broken) throw new AppError('ORDER_SAVE_FAILED');
          return store.listOrders(...args);
        },
      };
      await open(flaky);
      await screen.findByText('AAA');
      broken = true;
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'A');
      expect(await screen.findByTestId('orders-error')).toBeOnTheScreen();
      expect(cards()).toHaveLength(0);
    });

    it('kéo làm mới lỗi khi đã có danh sách: giữ danh sách cũ và hiện dải lỗi có Thử lại', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'KEEP', { at: NOW });
      let broken = false;
      const flaky: OrderStore = {
        ...store,
        listOrders: async (...args) => {
          if (broken) throw new AppError('ORDER_SAVE_FAILED');
          return store.listOrders(...args);
        },
      };
      await open(flaky);
      await screen.findByText('KEEP');
      broken = true;
      await act(async () =>
        screen.getByTestId('orders-list').props.refreshControl.props.onRefresh(),
      );
      expect(await screen.findByTestId('orders-refresh-error')).toBeOnTheScreen();
      expect(screen.getByText('KEEP')).toBeOnTheScreen();
    });
  });

  describe('phân trang, làm mới, nạp lại khi focus', () => {
    const endReached = async () =>
      act(async () => {
        fireEvent(screen.getByTestId('orders-list'), 'endReached');
      });

    it('cuộn gần cuối tải trang kế; không trùng thẻ; hết dữ liệu thì dừng', async () => {
      const store = createMemoryOrderStore();
      for (let i = 1; i <= 5; i += 1) await seed(store, `P${i}`, { at: NOW - i });
      await open(store, { pageSize: 2 });
      await screen.findByText('P1');
      expect(cards()).toHaveLength(2);
      expect(screen.getByTestId('orders-count')).toHaveTextContent('5 đơn');
      await endReached();
      await waitFor(() => expect(cards()).toHaveLength(4));
      await endReached();
      await waitFor(() => expect(cards()).toHaveLength(5));
      await endReached(); // đã hết: không gọi thêm, không thêm thẻ
      expect(cards()).toHaveLength(5);
      expect(codesOnScreen()).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    });

    it('đơn mới chèn vào giữa chừng không làm trùng thẻ ở trang sau', async () => {
      const store = createMemoryOrderStore();
      for (let i = 1; i <= 4; i += 1) await seed(store, `Q${i}`, { at: NOW - 100 * i });
      await open(store, { pageSize: 2 });
      await screen.findByText('Q1');
      await seed(store, 'INSERTED-TOP', { at: NOW + 500 });
      await endReached();
      await waitFor(() => expect(cards()).toHaveLength(4));
      expect(codesOnScreen()).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
    });

    it('tải trang kế lỗi: giữ danh sách, hiện Thử lại ở cuối; thử lại tải được', async () => {
      const store = createMemoryOrderStore();
      for (let i = 1; i <= 3; i += 1) await seed(store, `R${i}`, { at: NOW - i });
      let failMore = false;
      const flaky: OrderStore = {
        ...store,
        listOrders: async (shop, query, page) => {
          if (failMore && page.after) throw new AppError('ORDER_SAVE_FAILED');
          return store.listOrders(shop, query, page);
        },
      };
      await open(flaky, { pageSize: 2 });
      await screen.findByText('R1');
      failMore = true;
      await endReached();
      const failure = await screen.findByTestId('orders-more-error');
      expect(cards()).toHaveLength(2);
      failMore = false;
      await fireEvent.press(within(failure).getByRole('button', { name: 'Thử lại' }));
      await waitFor(() => expect(cards()).toHaveLength(3));
    });

    it('kéo xuống làm mới: thấy đơn mới tạo', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'OLD', { at: NOW - 10 });
      await open(store);
      await screen.findByText('OLD');
      await seed(store, 'FRESH', { at: NOW });
      await act(async () =>
        screen.getByTestId('orders-list').props.refreshControl.props.onRefresh(),
      );
      await waitFor(() => expect(screen.getByText('FRESH')).toBeOnTheScreen());
    });

    it('màn lấy lại focus (quay về từ Tạo đơn/chi tiết) thì nạp lại: đơn mới hiện, giữ từ khóa', async () => {
      const store = createMemoryOrderStore();
      await seed(store, 'AAA-1', { at: NOW - 10 });
      await open(store);
      await screen.findByText('AAA-1');
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'AAA');
      await waitFor(() =>
        expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn phù hợp'),
      );
      await act(async () => setMockScreenFocused(false)); // đi sang màn Tạo đơn
      await seed(store, 'AAA-2', { at: NOW });
      await seed(store, 'OTHER', { at: NOW });
      await act(async () => setMockScreenFocused(true)); // quay lại
      await waitFor(() => expect(screen.getByText('AAA-2')).toBeOnTheScreen());
      expect(screen.queryByText('OTHER')).toBeNull(); // từ khóa còn nguyên
      expect(screen.getByTestId('orders-search')).toHaveDisplayValue('AAA');
    });

    it('quay lại màn: nạp lại đúng số thẻ đã cuộn tới, không trở về trang đầu', async () => {
      const store = createMemoryOrderStore();
      for (let i = 1; i <= 5; i += 1) await seed(store, `Z${i}`, { at: NOW - i });
      await open(store, { pageSize: 2 });
      await screen.findByText('Z1');
      await endReached();
      await waitFor(() => expect(cards()).toHaveLength(4));
      await act(async () => setMockScreenFocused(false));
      await act(async () => setMockScreenFocused(true));
      await waitFor(() => expect(screen.getByTestId('orders-count')).toHaveTextContent('5 đơn'));
      expect(cards()).toHaveLength(4);
    });
  });

  describe('hành động trên thẻ', () => {
    it('chạm thẻ mở chi tiết bằng ID nội bộ (không phải mã đơn)', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-OPEN', { at: NOW });
      await open(store);
      await fireEvent.press(await screen.findByTestId(`order-card-${d.order.id}-body`));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
        orderId: d.order.id,
      });
    });

    it('Quay ngay (đơn chưa có phiên) đi qua màn Xác nhận đơn với ID đơn', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-REC', { at: NOW });
      await open(store);
      await fireEvent.press(await screen.findByTestId(`order-card-${d.order.id}-action`));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderPreview, {
        orderId: d.order.id,
      });
    });

    it('Quay ngay khi đơn đã có phiên đang thực hiện: mở lại đúng phiên đó, không tạo phiên chồng', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-ACT', { at: NOW, lines: [{ name: 'Áo' }] });
      const built = buildPackingSession(d, firstPackageId(d), {
        sessionId: 'sess-existing' as SessionId,
        nowDevice: NOW + 1,
      });
      if (!built.ok) throw new Error('fixture');
      await store.saveSession(built.session);
      await open(store);
      await fireEvent.press(await screen.findByTestId(`order-card-${d.order.id}-action`));
      await waitFor(() =>
        expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.packRecord, {
          sessionId: 'sess-existing',
        }),
      );
      expect(await store.listSessionsOfOrder(d.order.shopId, d.order.id)).toHaveLength(1);
      expect(mockNavigation.replace).not.toHaveBeenCalled(); // danh sách không bị thay thế
    });

    it('chưa có quyền camera: hiện hộp thoại xin quyền, chưa mở màn quay', async () => {
      mockScanner.permission = 'askable';
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-PERM', { at: NOW, lines: [{ name: 'Áo' }] });
      const built = buildPackingSession(d, firstPackageId(d), {
        sessionId: 'sess-perm' as SessionId,
        nowDevice: NOW + 1,
      });
      if (!built.ok) throw new Error('fixture');
      await store.saveSession(built.session);
      await open(store);
      await fireEvent.press(await screen.findByTestId(`order-card-${d.order.id}-action`));
      expect(await screen.findByTestId('start-permission-allow')).toBeOnTheScreen();
      expect(mockNavigation.push).not.toHaveBeenCalledWith(ROUTES.packRecord, expect.anything());
    });

    it('đơn đã có bằng chứng: hành động chỉ còn Xem chi tiết (không Quay ngay) và hiện đúng nhãn gộp, kể cả lỗi lẫn đã tải lên', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-EV', { at: NOW });
      const e = await seed(store, 'DH-OK', { at: NOW - 1 });
      mockEvidence.set(d.order.id, ['uploaded', 'upload_failed']);
      mockEvidence.set(e.order.id, ['verified', 'verified']);
      await open(store);
      const card = await screen.findByTestId(`order-card-${d.order.id}`);
      expect(within(card).getByText('Lỗi – cần xử lý')).toBeOnTheScreen();
      expect(within(card).queryByText('Quay ngay')).toBeNull();
      expect(within(card).getByText('Xem chi tiết')).toBeOnTheScreen();
      expect(within(card).queryByText('Chưa có video')).toBeNull();
      const ok = screen.getByTestId(`order-card-${e.order.id}`);
      expect(within(ok).getByText('Đã xác minh')).toBeOnTheScreen();
      await fireEvent.press(within(card).getByText('Xem chi tiết'));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.orderDetail, {
        orderId: d.order.id,
      });
    });

    it('thẻ không hiện % tải lên', async () => {
      const store = createMemoryOrderStore();
      const d = await seed(store, 'DH-UP', { at: NOW });
      mockEvidence.set(d.order.id, ['uploading']);
      await open(store);
      const card = await screen.findByTestId(`order-card-${d.order.id}`);
      expect(within(card).getByText('Đang tải lên')).toBeOnTheScreen();
      expect(within(card).queryByText(/%/)).toBeNull();
    });
  });

  it('nút quét và nút tạo ở đầu trang dẫn tới Quét mã và Tạo đơn nhanh', async () => {
    await open();
    await screen.findByTestId('orders-empty');
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.scan);
    await fireEvent.press(screen.getByRole('button', { name: 'Tạo đơn' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.quickOrder);
    expect(screen.getByText('Đơn hàng')).toBeOnTheScreen();
  });

  it('cô lập shop: không thấy đơn của shop khác', async () => {
    const store = createMemoryOrderStore();
    await seed(store, 'MINE', { at: NOW });
    await seed(store, 'THEIRS', { at: NOW, shopId: 'shop-khac' as ShopId });
    await open(store);
    await screen.findByText('MINE');
    expect(screen.queryByText('THEIRS')).toBeNull();
    expect(screen.getByTestId('orders-count')).toHaveTextContent(/^1 đơn$/);
  });
});
