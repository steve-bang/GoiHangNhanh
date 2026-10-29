import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { OrderId, ReturnCaseId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore, LOCAL_SHOP_ID, type OrderStore } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { expectedLinesFromOrder, type NewReceivedLine, type ReturnStore } from '../domain';
import { ReturnDoneScreen } from './ReturnDoneScreen';
import { ReturnExteriorScreen } from './ReturnExteriorScreen';
import { ReturnFindOrderScreen } from './ReturnFindOrderScreen';
import { ReturnItemsScreen } from './ReturnItemsScreen';
import { ReturnRecordScreen } from './ReturnRecordScreen';
import { ReturnReviewScreen } from './ReturnReviewScreen';
import { ReturnsListScreen } from './ReturnsListScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

let n = 0;
const nid = () => `t-${(n += 1)}`;
const SHOP = LOCAL_SHOP_ID;

async function seedReturn(
  store: ReturnStore,
  options: {
    orderId?: OrderId;
    observedCode?: string;
    atDevice?: number;
    lines?: NewReceivedLine[];
    stage?: 'receiving' | 'opening' | 'checking' | 'confirmed';
  } = {},
) {
  const id = `ret-${nid()}` as ReturnCaseId;
  const created = await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: options.atDevice ?? 1_000,
    eventId: nid(),
    observedCode: options.observedCode ?? null,
    link: options.orderId
      ? { linkId: nid(), orderId: options.orderId, basis: 'code_match_confirmed' }
      : null,
    lines: options.lines ?? [],
  });
  const stage = options.stage ?? 'receiving';
  if (stage === 'receiving') return created;
  await store.saveExterior(SHOP, id, {
    exterior: { signs: ['dented'], note: 'móp góc', recordedAtDevice: 2_000 },
    openedBefore: null,
    eventId: nid(),
    openedEventId: nid(),
  });
  if (stage === 'opening') return (await store.getReturn(SHOP, id)) ?? created;
  await store.saveOpeningVideoMissing(SHOP, id, {
    reason: 'recorder_unavailable',
    atDevice: 3_000,
    eventId: nid(),
  });
  if (stage === 'checking') return (await store.getReturn(SHOP, id)) ?? created;
  await store.saveLines(SHOP, id, {
    lines: [
      {
        id: nid(),
        name: 'Áo thun',
        variant: null,
        receivedQuantity: 1,
        condition: 'normal',
        note: '',
        expected: null,
      },
    ],
    discrepancies: [],
    atDevice: 4_000,
    eventId: nid(),
  });
  return store.confirmReturn(SHOP, id, { finalNote: 'ok', atDevice: 5_000, eventId: nid() });
}

const text = (key: string) => screen.getByTestId(key);

describe('UI-D01 Danh sách hàng hoàn (dữ liệu thật)', () => {
  const open = (returnStore: ReturnStore, orderStore?: OrderStore) =>
    renderWithProviders(<ReturnsListScreen />, {
      returnStore,
      ...(orderStore ? { orderStore } : {}),
    });

  it('chưa có hồ sơ: trạng thái rỗng có hành động "Tiếp nhận hàng hoàn" mở UI-D02', async () => {
    await open(createMemoryReturnStore());
    const empty = await screen.findByTestId('returns-empty');
    await fireEvent.press(within(empty).getByRole('button', { name: 'Tiếp nhận hàng hoàn' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnFindOrder);
  });

  it('nút Tiếp nhận hàng hoàn ở chân màn luôn mở UI-D02 (không kèm ID hồ sơ)', async () => {
    await open(createMemoryReturnStore());
    await screen.findByTestId('returns-empty');
    await fireEvent.press(screen.getByTestId('returns-receive'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.returnFindOrder);
  });

  it('liệt kê hồ sơ thật: mã RH, giai đoạn, đơn gốc hoặc "Chưa liên kết", ghi chú chỉ lưu trên máy', async () => {
    const orders = createMemoryOrderStore();
    const order = await seedOrder(orders);
    const store = createMemoryReturnStore();
    const linked = await seedReturn(store, { orderId: order.order.id, atDevice: 2_000 });
    const unlinked = await seedReturn(store, { atDevice: 1_000 });
    await open(store, orders);
    const rowA = await screen.findByTestId(`return-row-${linked.returnCase.id}`);
    expect(within(rowA).getByText(linked.returnCase.code)).toBeOnTheScreen();
    expect(await within(rowA).findByText('Đơn gốc: DH1234567890')).toBeOnTheScreen();
    expect(within(rowA).getByText('Đang tiếp nhận')).toBeOnTheScreen();
    const rowB = screen.getByTestId(`return-row-${unlinked.returnCase.id}`);
    expect(within(rowB).getByText('Chưa liên kết đơn gốc')).toBeOnTheScreen();
    expect(screen.getByTestId('returns-local-only')).toHaveTextContent(/chỉ lưu trên máy này/);
  });

  it('chạm hồ sơ dở dang tiếp tục ĐÚNG bước theo trạng thái, bằng ID hồ sơ', async () => {
    const store = createMemoryReturnStore();
    const stages = ['receiving', 'opening', 'checking', 'confirmed'] as const;
    const routes = [
      ROUTES.returnExterior,
      ROUTES.returnRecord,
      ROUTES.returnItems,
      ROUTES.returnDone,
    ];
    const made = [];
    for (const [i, stage] of stages.entries()) {
      made.push(await seedReturn(store, { stage, atDevice: 1_000 * (i + 1) }));
    }
    await open(store);
    for (const [i, details] of made.entries()) {
      await fireEvent.press(await screen.findByTestId(`return-row-${details.returnCase.id}`));
      expect(mockNavigation.push).toHaveBeenLastCalledWith(routes[i], {
        returnId: details.returnCase.id,
      });
    }
  });

  it('tìm theo mã hồ sơ, mã đơn gốc; lọc theo giai đoạn và "chưa liên kết"; xóa bộ lọc', async () => {
    const orders = createMemoryOrderStore();
    const order = await seedOrder(orders);
    const store = createMemoryReturnStore();
    const linked = await seedReturn(store, {
      orderId: order.order.id,
      stage: 'checking',
      atDevice: 3_000,
    });
    const free = await seedReturn(store, { observedCode: 'SPX-ABC', atDevice: 2_000 });
    await open(store, orders);
    await screen.findByTestId(`return-row-${linked.returnCase.id}`);

    await fireEvent.changeText(screen.getByTestId('returns-search'), 'dh1234');
    await waitFor(() =>
      expect(screen.queryByTestId(`return-row-${free.returnCase.id}`)).toBeNull(),
    );
    expect(screen.getByTestId(`return-row-${linked.returnCase.id}`)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('returns-search'), 'spx-abc');
    await waitFor(() =>
      expect(screen.getByTestId(`return-row-${free.returnCase.id}`)).toBeOnTheScreen(),
    );
    expect(screen.queryByTestId(`return-row-${linked.returnCase.id}`)).toBeNull();

    await fireEvent.changeText(screen.getByTestId('returns-search'), 'khong-co');
    expect(await screen.findByTestId('returns-no-results')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Xóa tìm kiếm và bộ lọc' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Chưa liên kết đơn' }));
    expect(await screen.findByTestId(`return-row-${free.returnCase.id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`return-row-${linked.returnCase.id}`)).toBeNull();
  });

  it('hồ sơ đã tới bước kiểm tra mà thiếu video mang nhãn "Hạn chế bằng chứng"; hồ sơ mới tạo thì chưa', async () => {
    const store = createMemoryReturnStore();
    const fresh = await seedReturn(store, { atDevice: 1_000 });
    const checking = await seedReturn(store, { stage: 'checking', atDevice: 2_000 });
    const confirmed = await seedReturn(store, { stage: 'confirmed', atDevice: 3_000 });
    await open(store);
    await screen.findByTestId(`return-row-${fresh.returnCase.id}`);
    expect(screen.queryByTestId(`return-limited-${fresh.returnCase.id}`)).toBeNull();
    expect(screen.getByTestId(`return-limited-${checking.returnCase.id}`)).toHaveTextContent(
      /Hạn chế bằng chứng/,
    );
    expect(screen.getByTestId(`return-limited-${confirmed.returnCase.id}`)).toBeOnTheScreen();
  });

  it('lỗi đọc: báo lỗi có Thử lại, không hiện danh sách rỗng giả', async () => {
    const base = createMemoryReturnStore();
    let fail = true;
    const store: ReturnStore = {
      ...base,
      listReturns: (shop, limit) =>
        fail ? Promise.reject(new Error('x')) : base.listReturns(shop, limit),
    };
    await open(store);
    expect(await screen.findByTestId('returns-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('returns-empty')).toBeNull();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('returns-empty')).toBeOnTheScreen();
  });

  it('hồ sơ của shop khác không hiện (bất biến 8)', async () => {
    const store = createMemoryReturnStore();
    await store.createReturn({
      id: 'other-1' as ReturnCaseId,
      shopId: 'shop-khac' as never,
      atDevice: 1,
      eventId: nid(),
      observedCode: null,
      link: null,
      lines: [],
    });
    await open(store);
    expect(await screen.findByTestId('returns-empty')).toBeOnTheScreen();
  });
});

describe('UI-D02 Tìm đơn gốc', () => {
  const open = async (returnStore: ReturnStore, orderStore: OrderStore) =>
    renderWithProviders(<ReturnFindOrderScreen />, { returnStore, orderStore });

  const search = async (code: string) => {
    await fireEvent.changeText(screen.getByTestId('return-code'), code);
    await fireEvent.press(screen.getByTestId('return-search'));
  };

  it('không có mã/đơn: vẫn tạo được hồ sơ CHƯA LIÊN KẾT, lưu mã quan sát, sang tình trạng bên ngoài', async () => {
    const store = createMemoryReturnStore();
    await open(store, createMemoryOrderStore());
    await search('SPX-KHONG-CO');
    expect(await screen.findByTestId('return-lookup-none')).toBeOnTheScreen();
    expect(screen.getByText('Chưa tìm thấy đơn gốc')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-unlinked'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [route, params] = mockNavigation.replace.mock.calls[0] as [unknown, { returnId: string }];
    expect(route).toBe(ROUTES.returnExterior);
    const saved = await store.getReturn(SHOP, params.returnId as ReturnCaseId);
    expect(saved?.returnCase.sourceOrderId).toBeNull();
    expect(saved?.returnCase.observedCode).toBe('SPX-KHONG-CO');
    expect(saved?.links).toHaveLength(0);
  });

  it('chưa nhập mã vẫn bấm "Không xác định được đơn gốc" được (mã quan sát để trống)', async () => {
    const store = createMemoryReturnStore();
    await open(store, createMemoryOrderStore());
    await fireEvent.press(screen.getByTestId('return-unlinked'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [, params] = mockNavigation.replace.mock.calls[0] as [unknown, { returnId: string }];
    const saved = await store.getReturn(SHOP, params.returnId as ReturnCaseId);
    expect(saved?.returnCase.observedCode).toBeNull();
  });

  it('mã không hợp lệ (rỗng) khi bấm Tìm: báo tại ô nhập, không tra', async () => {
    await open(createMemoryReturnStore(), createMemoryOrderStore());
    await fireEvent.press(screen.getByTestId('return-search'));
    expect(await screen.findByText('Mã chưa hợp lệ. Hãy nhập lại.')).toBeOnTheScreen();
  });

  it('đúng một đơn khớp (theo mã vận đơn): hiện đơn + nhãn "Do bạn nhập", dùng đơn này tạo hồ sơ liên kết và nạp dòng dự kiến', async () => {
    const orders = createMemoryOrderStore();
    const order = await seedOrder(orders);
    const store = createMemoryReturnStore();
    await open(store, orders);
    await search('spx1234567890');
    expect(await screen.findByText('Tìm thấy 1 đơn')).toBeOnTheScreen();
    expect(screen.getByText('DH1234567890')).toBeOnTheScreen();
    expect(screen.getByText('Khớp mã vận đơn')).toBeOnTheScreen();
    expect(screen.getByText(/do bạn nhập khi đóng gói/i)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-use-order'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [, params] = mockNavigation.replace.mock.calls[0] as [unknown, { returnId: string }];
    const saved = await store.getReturn(SHOP, params.returnId as ReturnCaseId);
    expect(saved?.returnCase.sourceOrderId).toBe(order.order.id);
    expect(saved?.links[0]?.basis).toBe('code_match_confirmed');
    expect(
      saved?.lines.map((l) => [l.name, l.variant, l.expected?.quantity, l.receivedQuantity]),
    ).toEqual([
      ['Áo thun cotton', 'Đen / XL', 2, null],
      ['Áo thun cotton', 'Trắng / L', 1, null],
    ]);
  });

  it('nhiều đơn trùng mã: bắt chọn, không tự chọn đơn đầu; chưa chọn thì nút dùng đơn bị khóa', async () => {
    const orders = createMemoryOrderStore();
    const a = sampleOrder();
    const b = {
      ...sampleOrder({ tracking: null }),
      order: { ...sampleOrder().order, id: 'order-2' as OrderId, orderCode: 'DH1234567890' },
      packages: [
        { id: 'pkg-2' as never, orderId: 'order-2' as OrderId, index: 1, createdAtDevice: 1 },
      ],
      lines: [],
    };
    await orders.saveNewOrder(a);
    await orders.saveNewOrder({ ...b, order: { ...b.order, source: 'shopee' } });
    const store = createMemoryReturnStore();
    await open(store, orders);
    await search('DH1234567890');
    expect(await screen.findByText('Có 2 đơn trùng mã')).toBeOnTheScreen();
    expect(screen.getByTestId('return-use-order')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('return-candidate-order-2'));
    expect(screen.getByTestId('return-use-order')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('return-use-order'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [, params] = mockNavigation.replace.mock.calls[0] as [unknown, { returnId: string }];
    const saved = await store.getReturn(SHOP, params.returnId as ReturnCaseId);
    expect(saved?.returnCase.sourceOrderId).toBe('order-2');
    expect(saved?.links[0]?.basis).toBe('chosen_from_candidates');
  });

  it('đơn đã có hồ sơ hàng hoàn: cảnh báo trùng, KHÔNG tạo ngầm; mở hồ sơ cũ hoặc xác nhận lần khác', async () => {
    const orders = createMemoryOrderStore();
    const order = await seedOrder(orders);
    const store = createMemoryReturnStore();
    const existing = await seedReturn(store, { orderId: order.order.id });
    await open(store, orders);
    await search('DH1234567890');
    await screen.findByText('Tìm thấy 1 đơn');
    await fireEvent.press(screen.getByTestId('return-use-order'));
    expect(await screen.findByTestId('return-duplicate')).toBeOnTheScreen();
    expect(await store.listReturns(SHOP, 10)).toHaveLength(1);
    await fireEvent.press(screen.getByTestId(`return-open-existing-${existing.returnCase.id}`));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnExterior, {
      returnId: existing.returnCase.id,
    });
    await fireEvent.press(screen.getByTestId('return-another'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    expect(await store.listReturns(SHOP, 10)).toHaveLength(2);
  });

  it('mã quan sát đã có hồ sơ chưa liên kết: cũng cảnh báo trùng trước khi tạo', async () => {
    const store = createMemoryReturnStore();
    await seedReturn(store, { observedCode: 'SPX-9' });
    await open(store, createMemoryOrderStore());
    await search('spx-9');
    await screen.findByTestId('return-lookup-none');
    await fireEvent.press(screen.getByTestId('return-unlinked'));
    expect(await screen.findByTestId('return-duplicate')).toBeOnTheScreen();
    expect(await store.listReturns(SHOP, 10)).toHaveLength(1);
  });

  it('lỗi lưu: báo bằng thông báo lỗi, ở lại màn, không điều hướng', async () => {
    const base = createMemoryReturnStore();
    const store: ReturnStore = {
      ...base,
      createReturn: () => Promise.reject(new Error('disk')),
    };
    await open(store, createMemoryOrderStore());
    await fireEvent.press(screen.getByTestId('return-unlinked'));
    expect(await screen.findByTestId('return-find-error')).toHaveTextContent(
      /Chưa lưu được hồ sơ hàng hoàn/,
    );
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  describe('chế độ liên kết đơn gốc sau (có returnId)', () => {
    it('liên kết đơn được chọn, ghi sự kiện "linked_later", rồi quay lại', async () => {
      const orders = createMemoryOrderStore();
      const order = await seedOrder(orders);
      const store = createMemoryReturnStore();
      const made = await seedReturn(store, { stage: 'confirmed' });
      mockNavigation.params = { returnId: made.returnCase.id };
      await open(store, orders);
      expect(await screen.findByText(/Liên kết đơn gốc cho hồ sơ/)).toBeOnTheScreen();
      expect(screen.queryByTestId('return-unlinked')).toBeNull();
      await search('DH1234567890');
      await screen.findByText('Tìm thấy 1 đơn');
      await fireEvent.press(screen.getByTestId('return-link-order'));
      await waitFor(() => expect(mockNavigation.back).toHaveBeenCalled());
      const after = await store.getReturn(SHOP, made.returnCase.id);
      expect(after?.returnCase.sourceOrderId).toBe(order.order.id);
      expect(after?.links.map((l) => l.basis)).toEqual(['linked_later']);
      expect(after?.events.at(-1)?.kind).toBe('linked');
    });

    it('hồ sơ đã có đơn gốc: không đổi được (RETURN_ORDER_CONFLICT)', async () => {
      const orders = createMemoryOrderStore();
      const order = await seedOrder(orders);
      const store = createMemoryReturnStore();
      const made = await seedReturn(store, { orderId: order.order.id });
      mockNavigation.params = { returnId: made.returnCase.id };
      await open(store, orders);
      expect(await screen.findByTestId('return-already-linked')).toBeOnTheScreen();
    });
  });

  it('thiếu hồ sơ ở chế độ liên kết: báo không mở được hồ sơ, có lối về danh sách', async () => {
    mockNavigation.params = { returnId: 'khong-co' };
    await open(createMemoryReturnStore(), createMemoryOrderStore());
    expect(await screen.findByTestId('return-missing')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Về danh sách hàng hoàn' }));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.returns);
  });
});

describe('UI-D03 Tình trạng kiện bên ngoài', () => {
  const open = async (store: ReturnStore, id: string) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnExteriorScreen />, { returnStore: store });
  };

  it('không mặc định "nguyên vẹn": chưa chọn gì bấm Tiếp tục thì báo lỗi, không lưu', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D03');
    expect(screen.getByTestId('return-sign-intact')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    expect(await screen.findByTestId('return-sign-error')).toHaveTextContent(
      /Bạn chưa xác nhận tình trạng bên ngoài/,
    );
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.exterior).toBeNull();
  });

  it('chọn nhiều dấu hiệu + ghi chú, lưu, trạng thái sang "đang mở kiện" và tới màn quay; có gợi ý khi hư hỏng', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D03');
    await fireEvent.press(screen.getByTestId('return-sign-dented'));
    await fireEvent.press(screen.getByTestId('return-sign-wet'));
    expect(screen.getByTestId('return-damage-hint')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('return-exterior-note'), 'móp góc phải');
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnRecord, {
        returnId: made.returnCase.id,
      }),
    );
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.returnCase.status).toBe('opening');
    expect(saved?.returnCase.exterior?.signs).toEqual(['dented', 'wet']);
    expect(saved?.returnCase.exterior?.note).toBe('móp góc phải');
  });

  it('"Nguyên vẹn" và "Móp" loại trừ nhau; "Chưa xác định" là giá trị hợp lệ', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D03');
    await fireEvent.press(screen.getByTestId('return-sign-dented'));
    await fireEvent.press(screen.getByTestId('return-sign-intact'));
    expect(screen.getByTestId('return-sign-dented')).not.toBeChecked();
    await fireEvent.press(screen.getByTestId('return-sign-unknown'));
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.exterior?.signs).toEqual([
      'unknown',
    ]);
  });

  it('kiện đã mở trước khi quay: bắt buộc ghi lý do, hồ sơ đánh dấu thiếu bằng chứng quá trình mở', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D03');
    await fireEvent.press(screen.getByTestId('return-sign-intact'));
    await fireEvent.press(screen.getByTestId('return-opened-before'));
    expect(screen.getByText(/thiếu bằng chứng quá trình mở ban đầu/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    expect(await screen.findByText('Hãy ghi lý do kiện đã mở trước.')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('return-opened-reason'), 'Kiện bị mở khi nhận');
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.returnCase.openedBefore?.reason).toBe('Kiện bị mở khi nhận');
    expect(saved?.events.map((e) => e.kind)).toContain('opened_before_marked');
  });

  it('chưa chụp ảnh nào: nói rõ hồ sơ sẽ ghi chưa có ảnh bên ngoài (không giả vờ có ảnh)', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    expect(await screen.findByTestId('return-photos-empty')).toHaveTextContent(
      /chưa có ảnh bên ngoài/,
    );
    expect(screen.getByTestId('return-photo-capture')).toBeOnTheScreen();
  });

  it('mở lại hồ sơ đã nhập: điền sẵn dấu hiệu và ghi chú', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D03');
    expect(screen.getByTestId('return-sign-dented')).toBeChecked();
    expect(screen.getByTestId('return-exterior-note').props.value).toBe('móp góc');
  });

  it('hồ sơ đã xác nhận không sửa được: chuyển sang màn xem', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'confirmed' });
    await open(store, made.returnCase.id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnDone, {
        returnId: made.returnCase.id,
      }),
    );
  });
});

describe('UI-D04 Quay video mở kiện (chưa nối camera ở R1)', () => {
  const open = async (store: ReturnStore, id: string) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnRecordScreen />, { returnStore: store });
  };

  it('luôn chỉ xem trước: không "Đang quay", không chấm đỏ, có dải nói chưa ghi video; hiện mã hồ sơ', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(screen.queryByTestId('recording-dot')).toBeNull();
    expect(screen.getByText(made.returnCase.code)).toBeOnTheScreen();
    expect(screen.getByText('Chưa liên kết đơn gốc')).toBeOnTheScreen();
    expect(screen.getByText(/chưa ghi được video mở kiện/)).toBeOnTheScreen();
  });

  it('Dừng quay chưa có video: HỎI lý do trước, chưa lưu gì và chưa chuyển bước; đóng bảng thì ở lại màn', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(await screen.findByText('Tiếp tục không có video mở kiện?')).toBeOnTheScreen();
    expect(screen.getByText(/bằng chứng quan trọng nhất/)).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.openingVideo).toBeNull();
    const closers = screen.getAllByRole('button', { name: 'Đóng' });
    await fireEvent.press(closers[closers.length - 1] as never);
    await waitFor(() => expect(screen.queryByTestId('return-skip-sheet')).toBeNull());
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.status).toBe('opening');
  });

  it('chọn lý do rồi "Tiếp tục không có video": ghi nhận đúng lý do (không tạo video giả) và sang kiểm hàng', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await screen.findByTestId('return-skip-sheet');
    // Mặc định là lý do đúng với bản này; người dùng đổi được sang lý do khác.
    expect(screen.getByTestId('return-skip-reason-recorder_unavailable')).toBeSelected();
    await fireEvent.press(screen.getByTestId('return-skip-reason-device_problem'));
    expect(screen.getByTestId('return-skip-reason-device_problem')).toBeSelected();
    await fireEvent.press(screen.getByTestId('return-skip-confirm'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, {
        returnId: made.returnCase.id,
      }),
    );
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.returnCase.status).toBe('checking');
    expect(saved?.returnCase.openingVideo).toMatchObject({
      kind: 'missing',
      reason: 'device_problem',
    });
  });

  it('kiện đã mở trước: chỉ còn lý do đúng sự thật "đã mở trước khi quay", không cho chọn lý do mâu thuẫn', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await store.saveExterior(SHOP, made.returnCase.id, {
      exterior: { signs: ['intact'], note: '', recordedAtDevice: 2_000 },
      openedBefore: { reason: 'mở sẵn', markedAtDevice: 2_000 },
      eventId: nid(),
      openedEventId: nid(),
    });
    await open(store, made.returnCase.id);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await screen.findByTestId('return-skip-sheet');
    expect(screen.queryByTestId('return-skip-reason-user_skipped')).toBeNull();
    expect(screen.queryByTestId('return-skip-reason-recorder_unavailable')).toBeNull();
    expect(screen.getByTestId('return-skip-reason-opened_before_recording')).toBeSelected();
    await fireEvent.press(screen.getByTestId('return-skip-confirm'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.openingVideo?.reason).toBe(
      'opened_before_recording',
    );
  });

  it('rời màn rồi "Kết thúc phiên" cũng phải qua bước hỏi lý do (không bỏ qua video âm thầm)', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(screen.getByText(/sang bước kiểm tra hàng/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(await screen.findByTestId('return-skip-sheet')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('mở lại sau khi đã ghi nhận: không hỏi lại và không ghi thêm lịch sử', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'checking' });
    const before = made.events.length;
    await open(store, made.returnCase.id);
    await screen.findByText('Xem trước');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    expect(screen.queryByTestId('return-skip-sheet')).toBeNull();
    expect((await store.getReturn(SHOP, made.returnCase.id))?.events).toHaveLength(before);
  });

  it('chưa ghi tình trạng bên ngoài: quay lại bước đó, không nhảy cóc', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store);
    await open(store, made.returnCase.id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnExterior, {
        returnId: made.returnCase.id,
      }),
    );
  });
});

describe('UI-D05 Kiểm tra hàng thực nhận', () => {
  const linkedLines = async (orders: OrderStore, store: ReturnStore) => {
    const order = await seedOrder(orders);
    const lines = expectedLinesFromOrder(order, nid);
    const made = await seedReturn(store, {
      orderId: order.order.id,
      lines,
      stage: 'checking',
    });
    return { order, made };
  };
  const open = async (store: ReturnStore, id: string, orders = createMemoryOrderStore()) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnItemsScreen />, { returnStore: store, orderStore: orders });
  };

  it('dòng dự kiến từ đơn gốc: số thực nhận TRỐNG (không mặc định bằng dự kiến), hai variant là hai dòng', async () => {
    const store = createMemoryReturnStore();
    const { made } = await linkedLines(createMemoryOrderStore(), store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    const lines = (await store.getReturn(SHOP, made.returnCase.id))?.lines ?? [];
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(screen.getByTestId(`return-line-qty-${line.id}`).props.value).toBe('');
    }
    expect(screen.getByTestId(`return-expected-${lines[0]?.id}`)).toHaveTextContent('Dự kiến: 2');
    expect(screen.getByText('Đen / XL')).toBeOnTheScreen();
    expect(screen.getByText('Trắng / L')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-no-reference')).toBeNull();
  });

  it('chưa nhập số lượng: không lưu, báo lỗi; số không hợp lệ cũng báo', async () => {
    const store = createMemoryReturnStore();
    const { made } = await linkedLines(createMemoryOrderStore(), store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    await fireEvent.press(screen.getByTestId('return-items-continue'));
    expect(await screen.findByTestId('return-items-summary-error')).toHaveTextContent(
      /Hãy nhập tên hàng và số lượng/,
    );
    const first = (await store.getReturn(SHOP, made.returnCase.id))?.lines[0];
    await fireEvent.changeText(screen.getByTestId(`return-line-qty-${first?.id}`), '1.5');
    expect(await screen.findAllByText('Số lượng nhập chưa hợp lệ.')).not.toHaveLength(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('so sánh với dự kiến: thiếu/thừa/khớp; thiếu gợi ý ghi sai lệch; lưu đủ rồi sang xác nhận', async () => {
    const store = createMemoryReturnStore();
    const { made } = await linkedLines(createMemoryOrderStore(), store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    const [a, b] = (await store.getReturn(SHOP, made.returnCase.id))?.lines ?? [];
    await fireEvent.changeText(screen.getByTestId(`return-line-qty-${a?.id}`), '1');
    expect(
      within(screen.getByTestId(`return-compare-${a?.id}`)).getByText('Ít hơn dự kiến'),
    ).toBeOnTheScreen();
    expect(screen.getByTestId(`return-discrepancy-${a?.id}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`return-kind-${a?.id}-missing`));
    await fireEvent.changeText(
      screen.getByTestId(`return-discrepancy-note-${a?.id}`),
      'thiếu 1 cái',
    );
    await fireEvent.changeText(screen.getByTestId(`return-line-qty-${b?.id}`), '1');
    expect(
      within(screen.getByTestId(`return-compare-${b?.id}`)).getByText('Khớp dự kiến'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId(`return-discrepancy-${b?.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('return-items-continue'));
    await waitFor(() =>
      expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.returnReview, {
        returnId: made.returnCase.id,
      }),
    );
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.lines.map((l) => l.receivedQuantity)).toEqual([1, 1]);
    expect(saved?.lines[0]?.expected?.quantity).toBe(2); // dữ liệu dự kiến giữ nguyên
    expect(saved?.discrepancies).toHaveLength(1);
    expect(saved?.discrepancies[0]).toMatchObject({
      lineId: a?.id,
      kind: 'missing',
      note: 'thiếu 1 cái',
    });
  });

  it('thêm hàng ngoài dự kiến và xóa dòng tự thêm; dòng của đơn gốc không xóa được', async () => {
    const store = createMemoryReturnStore();
    const { made } = await linkedLines(createMemoryOrderStore(), store);
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    const [a] = (await store.getReturn(SHOP, made.returnCase.id))?.lines ?? [];
    expect(screen.queryByTestId(`return-line-remove-${a?.id}`)).toBeNull();
    await fireEvent.press(screen.getByTestId('return-add-line'));
    expect(screen.getByText('Hàng ngoài dự kiến')).toBeOnTheScreen();
    const remove = screen.getAllByText('Xóa dòng');
    await fireEvent.press(remove[0] as never);
    expect(screen.queryByText('Hàng ngoài dự kiến')).toBeNull();
  });

  it('chưa liên kết đơn: nói "Chưa có dữ liệu đơn gốc", có sẵn một dòng trống, KHÔNG hiện dự kiến 0; lưu được kiểm kê thủ công', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'checking' });
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    expect(screen.getByTestId('return-no-reference')).toBeOnTheScreen();
    expect(screen.queryByText(/Dự kiến:/)).toBeNull();
    const inputs = screen.getAllByTestId(/^return-line-name-/);
    await fireEvent.changeText(inputs[0] as never, 'Áo khoác');
    await fireEvent.changeText(screen.getAllByTestId(/^return-line-qty-/)[0] as never, '0');
    await fireEvent.press(screen.getByTestId('return-items-continue'));
    await waitFor(() => expect(mockNavigation.push).toHaveBeenCalled());
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.lines.map((l) => [l.name, l.receivedQuantity, l.expected])).toEqual([
      ['Áo khoác', 0, null],
    ]);
  });

  it('mở lại hồ sơ đã lưu kiểm kê: điền sẵn dòng và sai lệch', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'checking' });
    const line: NewReceivedLine = {
      id: 'l-saved',
      name: 'Giày',
      variant: 'Đen 42',
      receivedQuantity: 2,
      condition: 'damaged',
      note: 'rách đế',
      expected: null,
    };
    await store.saveLines(SHOP, made.returnCase.id, {
      lines: [line],
      discrepancies: [{ id: 'd1', lineId: 'l-saved', kind: 'damaged', note: 'đế rách' }],
      atDevice: 4_000,
      eventId: nid(),
    });
    await open(store, made.returnCase.id);
    await screen.findByTestId('screen-UI-D05');
    expect(screen.getByTestId('return-line-name-l-saved').props.value).toBe('Giày');
    expect(screen.getByTestId('return-line-qty-l-saved').props.value).toBe('2');
    expect(screen.getByTestId('return-kind-l-saved-damaged')).toBeSelected();
    expect(screen.getByTestId('return-discrepancy-note-l-saved').props.value).toBe('đế rách');
  });

  it('chưa qua bước video: quay về đó; đã xác nhận: sang màn xem', async () => {
    const store = createMemoryReturnStore();
    const opening = await seedReturn(store, { stage: 'opening' });
    await open(store, opening.returnCase.id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnRecord, {
        returnId: opening.returnCase.id,
      }),
    );
  });
});

describe('UI-D06 Xác nhận kết quả kiểm tra', () => {
  const open = async (store: ReturnStore, id: string, orders = createMemoryOrderStore()) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnReviewScreen />, { returnStore: store, orderStore: orders });
  };
  const checkedReturn = async (store: ReturnStore, orders: OrderStore, withOrder = false) => {
    const order = withOrder ? await seedOrder(orders) : null;
    const made = await seedReturn(store, {
      ...(order ? { orderId: order.order.id } : {}),
      stage: 'checking',
    });
    await store.saveLines(SHOP, made.returnCase.id, {
      lines: [
        {
          id: 'l1',
          name: 'Áo thun cotton',
          variant: 'Đen / XL',
          receivedQuantity: 1,
          condition: 'normal',
          note: '',
          expected: order
            ? { orderLineId: 'line-1', name: 'Áo thun cotton', variant: 'Đen / XL', quantity: 2 }
            : null,
        },
      ],
      discrepancies: [{ id: 'd1', lineId: 'l1', kind: 'missing', note: 'thiếu 1' }],
      atDevice: 4_000,
      eventId: nid(),
    });
    return made;
  };

  it('tóm tắt đủ: đơn gốc, tình trạng ngoài, video thiếu, hàng nhận so với dự kiến, sai lệch, HẠN CHẾ bằng chứng (không "đầy đủ")', async () => {
    const orders = createMemoryOrderStore();
    const store = createMemoryReturnStore();
    const made = await checkedReturn(store, orders, true);
    await open(store, made.returnCase.id, orders);
    expect(await screen.findByTestId('screen-UI-D06')).toBeOnTheScreen();
    expect(
      await within(screen.getByTestId('return-summary-source')).findByText('DH1234567890'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-exterior')).getByText('Móp, biến dạng'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-video')).getByText('Chưa có video mở kiện.'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-items')).getByText('1 (dự kiến 2)'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-discrepancies')).getByText('Thiếu hàng: thiếu 1'),
    ).toBeOnTheScreen();
    const limits = screen.getByTestId('return-summary-limits');
    expect(within(limits).getByText('Chưa có video mở kiện.')).toBeOnTheScreen();
    expect(within(limits).getByText('Chưa có ảnh bên ngoài kiện.')).toBeOnTheScreen();
    expect(screen.queryByText(/đầy đủ bằng chứng/i)).toBeNull();
    expect(screen.getByTestId('return-discrepancy-warning')).toBeOnTheScreen();
    expect(screen.getByTestId('return-local-only')).toHaveTextContent(/chưa đồng bộ lên máy chủ/);
  });

  it('hồ sơ chưa liên kết: hiện "Chưa liên kết đơn gốc", không số dự kiến; nêu hạn chế chưa liên kết', async () => {
    const orders = createMemoryOrderStore();
    const store = createMemoryReturnStore();
    const made = await checkedReturn(store, orders, false);
    await open(store, made.returnCase.id, orders);
    await screen.findByTestId('screen-UI-D06');
    expect(
      within(screen.getByTestId('return-summary-source')).getByText('Chưa liên kết đơn gốc.'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-items')).getByText('1 (chưa có dữ liệu đối chiếu)'),
    ).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('return-summary-limits')).getByText('Chưa liên kết đơn gốc.'),
    ).toBeOnTheScreen();
  });

  it('Xác nhận hồ sơ: lưu ghi chú cuối, trạng thái đã xác nhận, sang UI-D07', async () => {
    const orders = createMemoryOrderStore();
    const store = createMemoryReturnStore();
    const made = await checkedReturn(store, orders);
    await open(store, made.returnCase.id, orders);
    await screen.findByTestId('screen-UI-D06');
    await fireEvent.changeText(screen.getByTestId('return-final-note'), 'Đã kiểm xong');
    await fireEvent.press(screen.getByTestId('return-confirm'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnDone, {
        returnId: made.returnCase.id,
      }),
    );
    const saved = await store.getReturn(SHOP, made.returnCase.id);
    expect(saved?.returnCase.status).toBe('confirmed');
    expect(saved?.returnCase.finalNote).toBe('Đã kiểm xong');
  });

  it('Lưu tạm về danh sách không xác nhận; Sửa kiểm kê quay lại bước trước', async () => {
    const orders = createMemoryOrderStore();
    const store = createMemoryReturnStore();
    const made = await checkedReturn(store, orders);
    await open(store, made.returnCase.id, orders);
    await screen.findByTestId('screen-UI-D06');
    await fireEvent.press(screen.getByTestId('return-edit-items'));
    expect(mockNavigation.back).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('return-save-later'));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.returns);
    expect((await store.getReturn(SHOP, made.returnCase.id))?.returnCase.status).toBe('checking');
  });

  it('lỗi xác nhận: báo lỗi, ở lại màn, hồ sơ không đổi', async () => {
    const orders = createMemoryOrderStore();
    const base = createMemoryReturnStore();
    const made = await checkedReturn(base, orders);
    const store: ReturnStore = { ...base, confirmReturn: () => Promise.reject(new Error('x')) };
    await open(store, made.returnCase.id, orders);
    await screen.findByTestId('screen-UI-D06');
    await fireEvent.press(screen.getByTestId('return-confirm'));
    expect(await screen.findByTestId('return-confirm-error')).toHaveTextContent(
      /Chưa lưu được hồ sơ/,
    );
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect((await base.getReturn(SHOP, made.returnCase.id))?.returnCase.status).toBe('checking');
  });

  it('chưa tới bước kiểm tra thì quay về bước đó (không xác nhận được)', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'opening' });
    await open(store, made.returnCase.id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnRecord, {
        returnId: made.returnCase.id,
      }),
    );
  });
});

describe('UI-D07 Hoàn tất tiếp nhận / xem hồ sơ', () => {
  const open = async (store: ReturnStore, id: string, orders = createMemoryOrderStore()) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnDoneScreen />, { returnStore: store, orderStore: orders });
  };

  it('nói đúng: kiểm kê ghi nhận trên máy này, chưa phải kết luận; có lịch sử hồ sơ và tóm tắt', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'confirmed' });
    await open(store, made.returnCase.id);
    expect(await screen.findByText('Đã xác nhận hồ sơ')).toBeOnTheScreen();
    expect(screen.getByText(/chưa phải kết luận về nguyên nhân/)).toBeOnTheScreen();
    expect(screen.getAllByTestId('return-history-item').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText('Xác nhận hồ sơ')).toBeOnTheScreen();
    expect(screen.getByTestId('return-summary-limits')).toBeOnTheScreen();
    expect(screen.queryByText(/đã sao lưu|an toàn trên máy chủ/i)).toBeNull();
  });

  it('hồ sơ xác nhận khi thiếu video vẫn mang nhãn "Hạn chế bằng chứng" và nêu lý do thiếu video', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'confirmed' });
    await open(store, made.returnCase.id);
    expect(await screen.findByTestId('return-done-limited')).toHaveTextContent(
      /Hạn chế bằng chứng/,
    );
    expect(screen.getByTestId('return-video-reason')).toHaveTextContent(
      /Lý do: Bản này chưa quay được video/,
    );
  });

  it('hồ sơ chưa liên kết có "Liên kết đơn gốc" mở UI-D02 chế độ liên kết bằng ID hồ sơ', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'confirmed' });
    await open(store, made.returnCase.id);
    await fireEvent.press(await screen.findByTestId('return-link-later'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.returnFindOrder, {
      returnId: made.returnCase.id,
    });
  });

  it('hồ sơ đã liên kết không có nút liên kết lại; hiện mã đơn gốc', async () => {
    const orders = createMemoryOrderStore();
    const order = await seedOrder(orders);
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { orderId: order.order.id, stage: 'confirmed' });
    await open(store, made.returnCase.id, orders);
    expect(await screen.findByTestId('return-done-banner')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-link-later')).toBeNull();
    expect(
      await within(screen.getByTestId('return-summary-source')).findByText('DH1234567890'),
    ).toBeOnTheScreen();
  });

  it('lối đi: về danh sách, hoặc nhận hàng hoàn khác', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'confirmed' });
    await open(store, made.returnCase.id);
    await fireEvent.press(await screen.findByTestId('return-back-to-list'));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.returns);
    await fireEvent.press(screen.getByTestId('return-receive-another'));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnFindOrder);
  });

  it('hồ sơ chưa xác nhận mở màn này thì chuyển về bước đang dở', async () => {
    const store = createMemoryReturnStore();
    const made = await seedReturn(store, { stage: 'checking' });
    await open(store, made.returnCase.id);
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.returnItems, {
        returnId: made.returnCase.id,
      }),
    );
  });

  it('không thấy hồ sơ (ID sai/shop khác): báo không mở được, có lối về danh sách', async () => {
    await open(createMemoryReturnStore(), 'khong-co');
    expect(await screen.findByTestId('return-missing')).toBeOnTheScreen();
  });

  it('lỗi đọc: báo lỗi và Thử lại tải lại được', async () => {
    const base = createMemoryReturnStore();
    const made = await seedReturn(base, { stage: 'confirmed' });
    let fail = true;
    const store: ReturnStore = {
      ...base,
      getReturn: (shop, id) => (fail ? Promise.reject(new Error('x')) : base.getReturn(shop, id)),
    };
    await open(store, made.returnCase.id);
    expect(await screen.findByTestId('return-load-error')).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByTestId('return-done-banner')).toBeOnTheScreen();
  });
});

void text;
