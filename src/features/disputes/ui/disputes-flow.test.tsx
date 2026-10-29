import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { DisputeId, EvidenceId, OrderId, ReturnCaseId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import {
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
  OrderDetailScreen,
} from '@/features/orders';
import { createMemoryReturnStore, type ReturnStore } from '@/features/returns';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryDisputeStore } from '../data';
import type { DisputeStore, NewDisputeInput } from '../domain';
import { DisputeDetailScreen } from './DisputeDetailScreen';
import { DisputeExportScreen } from './DisputeExportScreen';
import { DisputeNewScreen } from './DisputeNewScreen';
import { DisputeSelectEvidenceScreen } from './DisputeSelectEvidenceScreen';
import { DisputesListScreen } from './DisputesListScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
const mockShare = jest.fn();
jest.mock('@/platform/share-text', () => ({
  shareText: (message: string) => mockShare(message),
}));

beforeEach(() => {
  resetMockNavigation();
  mockShare.mockReset();
});

const SHOP = LOCAL_SHOP_ID;
let n = 0;
const nid = () => `d-${(n += 1)}`;
const orderSubject = (orderId = 'order-fixture', label = 'DH1234567890') => ({
  kind: 'order' as const,
  orderId: orderId as OrderId,
  label,
});

function newDispute(overrides: Partial<NewDisputeInput> = {}): NewDisputeInput {
  return {
    id: nid() as DisputeId,
    shopId: SHOP,
    subject: orderSubject(),
    issueType: 'missing_item',
    note: 'Khách báo thiếu',
    createdAtDevice: 1_000,
    ...overrides,
  };
}

const READY = { localPath: 'evidence/x.mp4', sizeBytes: 5, sha256Client: 'ab'.repeat(32) };
type Files = ReturnType<typeof createMemoryEvidenceFileStore>;

/** Tạo tệp của đơn mẫu rồi đưa tới trạng thái `queued` (chưa lên máy chủ) hoặc `verified`. */
async function addFile(
  files: Files,
  orders: ReturnType<typeof createMemoryOrderStore>,
  state: 'queued' | 'verified',
  at: number,
): Promise<EvidenceId> {
  const details = await orders.getOrder(SHOP, 'order-fixture' as OrderId);
  if (!details) throw new Error('seed');
  const session = sampleSession(details, at);
  if (!(await orders.getSession(SHOP, session.id))) await orders.saveSession(session);
  const id = `ev-${nid()}` as EvidenceId;
  await files.create({
    id,
    shopId: SHOP,
    orderId: session.orderId,
    packageId: session.packageId,
    sessionId: session.id,
    group: 'pack',
    kind: 'video',
    createdAtDevice: at,
  });
  const apply = (type: string, origin: 'device' | 'server', patch?: object) =>
    files.applyEvent(SHOP, id, { type, origin } as never, at + 1, patch);
  await apply('STOP_RECORDING', 'device');
  await apply('LOCAL_FILE_READABLE', 'device', READY);
  if (state === 'verified') {
    await apply('UPLOAD_STARTED', 'device');
    await apply('SERVER_RECEIVED', 'server');
    await apply('SERVER_VERIFIED', 'server');
  }
  return id;
}

describe('UI-G01 Danh sách tranh chấp', () => {
  it('chưa có hồ sơ: trạng thái rỗng và nút tạo mở UI-G02', async () => {
    await renderWithProviders(<DisputesListScreen />);
    const empty = await screen.findByTestId('disputes-empty');
    await fireEvent.press(within(empty).getByRole('button', { name: 'Tạo hồ sơ tranh chấp' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.disputeNew);
  });

  it('liệt kê hồ sơ thật, lọc theo trạng thái, nhãn Hạn chế bằng chứng cho hồ sơ hoàn', async () => {
    const store = createMemoryDisputeStore();
    const a = await store.createDispute(newDispute({ createdAtDevice: 1_000 }));
    const b = await store.createDispute(
      newDispute({
        createdAtDevice: 2_000,
        subject: {
          kind: 'return',
          returnId: 'r1' as ReturnCaseId,
          label: 'RH-00001',
          orderId: null,
          openingEvidenceLimit: true,
        },
      }),
    );
    await store.closeDispute(SHOP, a.dispute.id, '', 3_000);
    await renderWithProviders(<DisputesListScreen />, { disputeStore: store });
    const rowA = await screen.findByTestId(`dispute-row-${a.dispute.id}`);
    expect(within(rowA).getByText('TC-00001')).toBeOnTheScreen();
    expect(within(rowA).getByText('Đã đóng')).toBeOnTheScreen();
    const rowB = screen.getByTestId(`dispute-row-${b.dispute.id}`);
    expect(within(rowB).getByText('Hàng hoàn RH-00001')).toBeOnTheScreen();
    expect(screen.getByTestId(`dispute-limited-${b.dispute.id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`dispute-limited-${a.dispute.id}`)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Đang mở' }));
    expect(screen.queryByTestId(`dispute-row-${a.dispute.id}`)).toBeNull();
    expect(screen.getByTestId(`dispute-row-${b.dispute.id}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`dispute-row-${b.dispute.id}`));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.disputeDetail, {
      disputeId: b.dispute.id,
    });
  });

  it('lỗi đọc kho hiện trạng thái lỗi có Thử lại', async () => {
    const store: DisputeStore = {
      ...createMemoryDisputeStore(),
      listDisputes: () => Promise.reject(new Error('boom')),
    };
    await renderWithProviders(<DisputesListScreen />, { disputeStore: store });
    expect(await screen.findByTestId('disputes-error')).toBeOnTheScreen();
  });
});

describe('UI-G02 Tạo hồ sơ tranh chấp', () => {
  it('từ đơn (tham số orderId): chọn vấn đề rồi tạo, chuyển sang chọn bằng chứng', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const store = createMemoryDisputeStore();
    mockNavigation.params = { orderId: 'order-fixture' };
    await renderWithProviders(<DisputeNewScreen />, { orderStore: orders, disputeStore: store });
    expect(await screen.findByText('Đơn DH1234567890')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('dispute-submit'));
    expect(screen.getByTestId('dispute-issue-error')).toBeOnTheScreen();
    expect(await store.listDisputes(SHOP)).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('dispute-issue-damaged'));
    await fireEvent.changeText(screen.getByTestId('dispute-note'), '  Vỡ góc  ');
    await fireEvent.press(screen.getByTestId('dispute-submit'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [created] = await store.listDisputes(SHOP);
    expect(created?.dispute).toMatchObject({
      issueType: 'damaged',
      note: 'Vỡ góc',
      subject: { kind: 'order', orderId: 'order-fixture' },
    });
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.disputeSelectEvidence, {
      disputeId: created?.dispute.id,
    });
  });

  it('từ hồ sơ hoàn có hạn chế: nhãn đi theo và được lưu vào hồ sơ tranh chấp', async () => {
    const returns = createMemoryReturnStore();
    const created = await returns.createReturn({
      id: 'ret-1' as ReturnCaseId,
      shopId: SHOP,
      atDevice: 1_000,
      eventId: nid(),
      observedCode: null,
      link: null,
      lines: [],
    });
    await returns.saveExterior(SHOP, created.returnCase.id, {
      exterior: { signs: ['torn'], note: '', recordedAtDevice: 2_000 },
      openedBefore: null,
      eventId: nid(),
      openedEventId: nid(),
    });
    await returns.saveOpeningVideoMissing(SHOP, created.returnCase.id, {
      reason: 'recorder_unavailable',
      atDevice: 3_000,
      eventId: nid(),
    });
    const store = createMemoryDisputeStore();
    mockNavigation.params = { returnId: created.returnCase.id };
    await renderWithProviders(<DisputeNewScreen />, { returnStore: returns, disputeStore: store });
    expect(await screen.findByTestId('dispute-limited-notice')).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-no-order-notice')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dispute-issue-other'));
    await fireEvent.press(screen.getByTestId('dispute-submit'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    const [made] = await store.listDisputes(SHOP);
    expect(made?.dispute.subject).toMatchObject({
      kind: 'return',
      returnId: 'ret-1',
      openingEvidenceLimit: true,
    });
  });

  it('không có tham số: tìm đơn theo mã, không tìm thấy thì báo, tìm thấy thì chọn được', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    await renderWithProviders(<DisputeNewScreen />, { orderStore: orders });
    await fireEvent.changeText(screen.getByTestId('dispute-order-code'), 'KHONGCO1');
    await fireEvent.press(screen.getByTestId('dispute-find-order'));
    expect(await screen.findByTestId('dispute-order-message')).toHaveTextContent(/Chưa thấy đơn/);
    await fireEvent.changeText(screen.getByTestId('dispute-order-code'), 'DH1234567890');
    await fireEvent.press(screen.getByTestId('dispute-find-order'));
    await fireEvent.press(await screen.findByTestId('dispute-pick-order-order-fixture'));
    expect(await screen.findByTestId('dispute-subject-card')).toHaveTextContent(/Đơn DH1234567890/);
  });

  it('đã có hồ sơ mở cho cùng đối tượng: báo trước và cho mở hồ sơ cũ', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const store = createMemoryDisputeStore();
    const old = await store.createDispute(newDispute());
    mockNavigation.params = { orderId: 'order-fixture' };
    await renderWithProviders(<DisputeNewScreen />, { orderStore: orders, disputeStore: store });
    await fireEvent.press(await screen.findByTestId('dispute-open-existing'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.disputeDetail, {
      disputeId: old.dispute.id,
    });
  });

  it('đơn không tồn tại (hoặc của shop khác): báo không thấy, không cho tạo', async () => {
    mockNavigation.params = { orderId: 'khong-co' };
    await renderWithProviders(<DisputeNewScreen />);
    expect(await screen.findByTestId('dispute-subject-missing')).toBeOnTheScreen();
  });
});

const PHOTO_READY = {
  localPath: 'evidence/p.jpg',
  sizeBytes: 5,
  sha256Client: 'cd'.repeat(32),
};

/** Tạo hồ sơ hàng hoàn kèm ảnh kiện: `queued` (đã lưu trên máy) hoặc `local_save_failed` (lưu lỗi). */
async function seedReturnWithPhoto(
  returns: ReturnStore,
  returnId: string,
  mediaId: string,
  state: 'queued' | 'local_save_failed',
) {
  if (!(await returns.getReturn(SHOP, returnId as ReturnCaseId))) {
    await returns.createReturn({
      id: returnId as ReturnCaseId,
      shopId: SHOP,
      atDevice: 1,
      eventId: `ev-${returnId}`,
      observedCode: null,
      link: null,
      lines: [],
    });
  }
  await returns.createMedia({
    id: mediaId,
    shopId: SHOP,
    returnId: returnId as ReturnCaseId,
    kind: 'photo',
    atDevice: 150,
  });
  const apply = (
    type: 'STOP_RECORDING' | 'LOCAL_FILE_READABLE' | 'LOCAL_WRITE_FAILED',
    patch?: object,
  ) => returns.applyMediaEvent(SHOP, mediaId, { type, origin: 'device' }, 151, patch);
  await apply('STOP_RECORDING', { localPath: 'tmp.jpg' });
  if (state === 'queued') await apply('LOCAL_FILE_READABLE', PHOTO_READY);
  else await apply('LOCAL_WRITE_FAILED');
}

const returnSubject = (returnId: string, orderId: string | null = null) => ({
  kind: 'return' as const,
  returnId: returnId as ReturnCaseId,
  label: 'RH-00001',
  orderId: orderId as OrderId | null,
  openingEvidenceLimit: false,
});

describe('UI-G03 Chọn bằng chứng', () => {
  async function setup() {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute());
    const uploaded = await addFile(files, orders, 'verified', 100);
    const local = await addFile(files, orders, 'queued', 200);
    mockNavigation.params = { disputeId: dispute.dispute.id };
    return { orders, files, store, dispute, uploaded, local };
  }

  it('liệt kê tệp của đơn, cảnh báo tệp chưa lên máy chủ, thêm vào hồ sơ và đánh dấu giữ', async () => {
    const { orders, files, store, dispute, uploaded, local } = await setup();
    await renderWithProviders(<DisputeSelectEvidenceScreen />, {
      orderStore: orders,
      evidenceFileStore: files,
      disputeStore: store,
    });
    await screen.findByTestId(`dispute-file-${uploaded}`);
    expect(screen.queryByTestId(`dispute-file-caution-${uploaded}`)).toBeNull();
    expect(screen.getByTestId(`dispute-file-caution-${local}`)).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-add-evidence')).toBeDisabled();

    await fireEvent.press(screen.getByTestId(`dispute-file-check-${local}`));
    expect(screen.getByTestId('dispute-caution-banner')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dispute-add-evidence'));
    await waitFor(() =>
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.disputeDetail, {
        disputeId: dispute.dispute.id,
      }),
    );
    const saved = await store.getDispute(SHOP, dispute.dispute.id);
    expect(saved?.evidence.map((e) => e.evidenceId)).toEqual([local]);
    expect(await store.listHeldEvidenceIds(SHOP)).toEqual([local]);
  });

  it('tệp đã nằm trong hồ sơ hiện "Đang giữ" và không chọn lại được', async () => {
    const { orders, files, store, dispute, local } = await setup();
    await store.addEvidence(SHOP, dispute.dispute.id, [local], 500);
    await renderWithProviders(<DisputeSelectEvidenceScreen />, {
      orderStore: orders,
      evidenceFileStore: files,
      disputeStore: store,
    });
    const row = await screen.findByTestId(`dispute-file-${local}`);
    expect(within(row).getByText('Đang giữ trong hồ sơ này')).toBeOnTheScreen();
    expect(screen.getByTestId(`dispute-file-check-${local}`)).toBeDisabled();
  });

  it('hồ sơ hoàn chưa liên kết đơn: nói rõ chưa có bằng chứng đóng gói để chọn', async () => {
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(
      newDispute({
        subject: {
          kind: 'return',
          returnId: 'r1' as ReturnCaseId,
          label: 'RH-00001',
          orderId: null,
          openingEvidenceLimit: false,
        },
      }),
    );
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeSelectEvidenceScreen />, { disputeStore: store });
    const empty = await screen.findByTestId('dispute-files-empty');
    expect(empty).toHaveTextContent(/chưa liên kết đơn gốc/);
  });

  it('hồ sơ hoàn: liệt kê thêm ảnh kiện của CHÍNH hồ sơ đó (nhóm Hàng hoàn), không lấy ảnh hồ sơ khác hay ảnh lưu lỗi', async () => {
    const returns = createMemoryReturnStore();
    await seedReturnWithPhoto(returns, 'r-own', 'photo-own', 'queued');
    await seedReturnWithPhoto(returns, 'r-own', 'photo-failed', 'local_save_failed');
    await seedReturnWithPhoto(returns, 'r-other', 'photo-other', 'queued');
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute({ subject: returnSubject('r-own') }));
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeSelectEvidenceScreen />, {
      disputeStore: store,
      returnStore: returns,
    });
    const row = await screen.findByTestId('dispute-file-photo-own');
    expect(within(row).getByText(/Ảnh · Hàng hoàn/)).toBeOnTheScreen();
    expect(within(row).getByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-file-caution-photo-own')).toBeOnTheScreen();
    expect(screen.queryByTestId('dispute-file-photo-failed')).toBeNull();
    expect(screen.queryByTestId('dispute-file-photo-other')).toBeNull();

    await fireEvent.press(screen.getByTestId('dispute-file-check-photo-own'));
    await fireEvent.press(screen.getByTestId('dispute-add-evidence'));
    await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
    expect(
      (await store.getDispute(SHOP, dispute.dispute.id))?.evidence.map((e) => e.evidenceId),
    ).toEqual(['photo-own']);
    expect(await store.listHeldEvidenceIds(SHOP)).toEqual(['photo-own']);
  });

  it('hồ sơ hoàn có đơn gốc: ảnh hàng hoàn nằm chung danh sách với tệp đóng gói', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const packFile = await addFile(files, orders, 'verified', 100);
    const returns = createMemoryReturnStore();
    await seedReturnWithPhoto(returns, 'r-own', 'photo-own', 'queued');
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(
      newDispute({ subject: returnSubject('r-own', 'order-fixture') }),
    );
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeSelectEvidenceScreen />, {
      orderStore: orders,
      evidenceFileStore: files,
      disputeStore: store,
      returnStore: returns,
    });
    expect(await screen.findByTestId(`dispute-file-${packFile}`)).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-file-photo-own')).toBeOnTheScreen();
  });

  it('hồ sơ đã đóng: không có nút thêm', async () => {
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute());
    await store.closeDispute(SHOP, dispute.dispute.id, '', 2_000);
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeSelectEvidenceScreen />, { disputeStore: store });
    await screen.findByTestId('screen-UI-G03');
    expect(screen.queryByTestId('dispute-add-evidence')).toBeNull();
  });
});

describe('UI-G04 Xem trước và xuất', () => {
  it('không có bằng chứng: nêu thiếu, không có nhãn "đầy đủ"; chia sẻ bản tóm tắt văn bản', async () => {
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute());
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeExportScreen />, { disputeStore: store });
    expect(await screen.findByTestId('dispute-notice-no_evidence')).toBeOnTheScreen();
    expect(screen.queryByText(/đầy đủ/i)).toBeNull();
    await fireEvent.press(screen.getByTestId('dispute-share'));
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(mockShare.mock.calls[0]?.[0]).toContain('TC-00001');
    expect(mockShare.mock.calls[0]?.[0]).toContain('Bằng chứng (0)');
  });

  it('tệp chưa lên máy chủ được báo trước; hồ sơ hoàn hạn chế mang nhãn ở bản xem trước và bản chia sẻ', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const local = await addFile(files, orders, 'queued', 100);
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(
      newDispute({
        subject: {
          kind: 'return',
          returnId: 'r1' as ReturnCaseId,
          label: 'RH-00001',
          orderId: 'order-fixture' as OrderId,
          openingEvidenceLimit: true,
        },
      }),
    );
    await store.addEvidence(SHOP, dispute.dispute.id, [local], 300);
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeExportScreen />, {
      orderStore: orders,
      evidenceFileStore: files,
      disputeStore: store,
    });
    expect(await screen.findByTestId('dispute-notice-not_on_cloud')).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-notice-opening_evidence_limit')).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-export-limited')).toBeOnTheScreen();
    expect(screen.getByTestId(`dispute-export-file-${local}`)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dispute-share'));
    expect(mockShare.mock.calls[0]?.[0]).toContain('hạn chế bằng chứng mở kiện');
  });

  it('ảnh hàng hoàn đã chọn được tính vào danh sách và bản chia sẻ, kèm nhãn Hàng hoàn và trạng thái "Đã lưu trên máy"', async () => {
    const returns = createMemoryReturnStore();
    await seedReturnWithPhoto(returns, 'r-own', 'photo-own', 'queued');
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute({ subject: returnSubject('r-own') }));
    await store.addEvidence(SHOP, dispute.dispute.id, ['photo-own' as EvidenceId], 300);
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeExportScreen />, {
      disputeStore: store,
      returnStore: returns,
    });
    const card = await screen.findByTestId('dispute-export-file-photo-own');
    expect(within(card).getByText(/Ảnh \(Hàng hoàn\)/)).toBeOnTheScreen();
    expect(screen.getByTestId('dispute-notice-not_on_cloud')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dispute-share'));
    const shared = String(mockShare.mock.calls[0]?.[0]);
    expect(shared).toContain('Bằng chứng (1)');
    expect(shared).toContain('Ảnh (Hàng hoàn)');
  });
});

describe('UI-G05 Chi tiết và đóng hồ sơ', () => {
  it('hiển thị thông tin, thêm ghi chú vào lịch sử, từ chối ghi chú trống', async () => {
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute());
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeDetailScreen />, { disputeStore: store });
    expect(await screen.findByText('Thiếu hàng')).toBeOnTheScreen();
    expect(screen.getByText('Khách báo thiếu')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dispute-save-note'));
    expect(screen.getByText('Hãy nhập nội dung ghi chú.')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('dispute-add-note'), 'Đã gọi khách');
    await fireEvent.press(screen.getByTestId('dispute-save-note'));
    await waitFor(() => expect(screen.getAllByTestId('dispute-history-item')).toHaveLength(2));
    expect(screen.getByText('Ghi chú: Đã gọi khách')).toBeOnTheScreen();
  });

  it('đóng hồ sơ cần xác nhận, giữ nguyên bằng chứng và lịch sử, rồi khóa chỉnh sửa', async () => {
    const store = createMemoryDisputeStore();
    const dispute = await store.createDispute(newDispute());
    await store.addEvidence(SHOP, dispute.dispute.id, ['ev-x' as EvidenceId], 500);
    mockNavigation.params = { disputeId: dispute.dispute.id };
    await renderWithProviders(<DisputeDetailScreen />, { disputeStore: store });
    await fireEvent.press(await screen.findByTestId('dispute-close'));
    expect(screen.getByText('Đóng hồ sơ tranh chấp?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Chưa đóng' }));
    expect((await store.getDispute(SHOP, dispute.dispute.id))?.dispute.status).toBe('open');

    await fireEvent.press(screen.getByTestId('dispute-close'));
    await act(async () => {
      await fireEvent.press(screen.getByTestId('dispute-close-confirm'));
    });
    await waitFor(() => expect(screen.getByTestId('dispute-closed-hint')).toBeOnTheScreen());
    const saved = await store.getDispute(SHOP, dispute.dispute.id);
    expect(saved?.dispute.status).toBe('closed');
    expect(saved?.evidence).toHaveLength(1);
    expect(screen.queryByTestId('dispute-close')).toBeNull();
    expect(screen.queryByTestId('dispute-save-note')).toBeNull();
    expect(screen.queryByTestId('dispute-detail-add-evidence')).toBeNull();
    expect(await store.listHeldEvidenceIds(SHOP)).toEqual([]);
  });

  it('hồ sơ của shop khác hoặc ID sai: báo không thấy', async () => {
    mockNavigation.params = { disputeId: 'khong-co' };
    await renderWithProviders(<DisputeDetailScreen />);
    expect(await screen.findByTestId('dispute-missing')).toBeOnTheScreen();
  });
});

describe('Lối vào tạo tranh chấp', () => {
  it('chi tiết đơn mở UI-G02 kèm ID đơn', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    mockNavigation.params = { orderId: 'order-fixture' };
    await renderWithProviders(<OrderDetailScreen />, { orderStore: orders });
    await fireEvent.press(await screen.findByTestId('order-detail-dispute'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.disputeNew, {
      orderId: 'order-fixture',
    });
  });
});
