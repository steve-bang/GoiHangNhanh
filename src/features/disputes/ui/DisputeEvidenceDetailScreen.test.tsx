import { fireEvent, screen } from '@testing-library/react-native';

import type { DisputeId, EvidenceId, OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import {
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  LOCAL_SHOP_ID,
} from '@/features/orders';
import { createMemoryReturnStore, type ReturnStore } from '@/features/returns';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { mockVideoPlayer, resetMockVideoPlayer } from '@/test-utils/mock-video-player';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryDisputeStore } from '../data';
import type { DisputeStore, NewDisputeInput } from '../domain';
import { DisputeEvidenceDetailScreen } from './DisputeEvidenceDetailScreen';
import { DisputeSelectEvidenceScreen } from './DisputeSelectEvidenceScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
const mockExisting = new Set<string>();
jest.mock('@/platform/recording-files', () => ({
  recordingExists: (stored: string) => mockExisting.has(stored),
  resolveRecordingUri: (stored: string) => `file:///docs/${stored}`,
  deleteRecording: jest.fn(),
  persistRecording: jest.fn(),
  getAvailableDiskBytes: () => null,
}));

const SHOP = LOCAL_SHOP_ID;
const SHA = 'ab'.repeat(32);
const VIDEO = 'evidence/pack.mp4';
let n = 0;
const nid = () => `t-${(n += 1)}`;

beforeEach(() => {
  resetMockNavigation();
  resetMockVideoPlayer();
  mockExisting.clear();
});

type Files = ReturnType<typeof createMemoryEvidenceFileStore>;
type Orders = ReturnType<typeof createMemoryOrderStore>;

/** Video đóng gói đã lưu trên máy của đơn mẫu. */
async function addPackFile(files: Files, orders: Orders): Promise<EvidenceId> {
  const details = await orders.getOrder(SHOP, 'order-fixture' as OrderId);
  if (!details) throw new Error('seed');
  const session = sampleSession(details, 100);
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
    createdAtDevice: 100,
  });
  const apply = (type: string, patch?: object) =>
    files.applyEvent(SHOP, id, { type, origin: 'device' } as never, 101, patch);
  await apply('STOP_RECORDING');
  await apply('LOCAL_FILE_READABLE', { localPath: VIDEO, sizeBytes: 5, sha256Client: SHA });
  return id;
}

/** Hồ sơ hoàn (tùy chọn kiện mở trước khi quay) + một ảnh kiện đã lưu trên máy. */
async function addReturnPhoto(
  returns: ReturnStore,
  returnId: string,
  options: { openedBefore?: boolean; shopId?: ShopId } = {},
): Promise<{ mediaId: string; path: string }> {
  const shopId = options.shopId ?? SHOP;
  const id = returnId as ReturnCaseId;
  await returns.createReturn({
    id,
    shopId,
    atDevice: 1,
    eventId: nid(),
    observedCode: null,
    link: null,
    lines: [],
  });
  await returns.saveExterior(shopId, id, {
    exterior: { signs: ['torn'], note: '', recordedAtDevice: 2 },
    openedBefore: options.openedBefore ? { reason: 'mở sẵn', markedAtDevice: 2 } : null,
    eventId: nid(),
    openedEventId: nid(),
  });
  const mediaId = `ph-${returnId}`;
  const path = `evidence/${mediaId}.jpg`;
  await returns.createMedia({ id: mediaId, shopId, returnId: id, kind: 'photo', atDevice: 3 });
  const apply = (type: string, patch?: object) =>
    returns.applyMediaEvent(shopId, mediaId, { type, origin: 'device' } as never, 4, patch);
  await apply('STOP_RECORDING', { localPath: 'tmp.jpg' });
  await apply('LOCAL_FILE_READABLE', { localPath: path, sizeBytes: 5, sha256Client: SHA });
  return { mediaId, path };
}

function newDispute(overrides: Partial<NewDisputeInput> = {}): NewDisputeInput {
  return {
    id: nid() as DisputeId,
    shopId: SHOP,
    subject: { kind: 'order', orderId: 'order-fixture' as OrderId, label: 'DH1234567890' },
    issueType: 'damaged',
    note: '',
    createdAtDevice: 1_000,
    ...overrides,
  };
}

const returnSubject = (returnId: string, openingEvidenceLimit = false) => ({
  kind: 'return' as const,
  returnId: returnId as ReturnCaseId,
  label: 'RH-00001',
  orderId: null,
  openingEvidenceLimit,
});

async function render(
  ui: React.ReactElement,
  stores: { orders?: Orders; files?: Files; returns?: ReturnStore; disputes: DisputeStore },
) {
  await renderWithProviders(ui, {
    orderStore: stores.orders ?? createMemoryOrderStore(),
    evidenceFileStore: stores.files ?? createMemoryEvidenceFileStore(),
    returnStore: stores.returns ?? createMemoryReturnStore(),
    disputeStore: stores.disputes,
  });
}

describe('V1-17b: G03 mở chi tiết tệp', () => {
  it('tệp đóng gói: nút "Xem video" mở route xem của tranh chấp, không chọn tệp', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const evidenceId = await addPackFile(files, orders);
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute());
    mockNavigation.params = { disputeId: d.dispute.id };
    await render(<DisputeSelectEvidenceScreen />, { orders, files, disputes });
    const open = await screen.findByTestId(`dispute-file-open-${evidenceId}`);
    expect(open).toHaveTextContent(/Xem video/);
    await fireEvent.press(open);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.disputeEvidenceDetail, {
      disputeId: d.dispute.id,
      evidenceId,
    });
    expect(screen.getByTestId('dispute-add-evidence')).toBeDisabled();
  });

  it('ảnh hàng hoàn của hồ sơ: nút "Xem ảnh" mở route xem của tranh chấp', async () => {
    const returns = createMemoryReturnStore();
    const { mediaId } = await addReturnPhoto(returns, 'r-1');
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute({ subject: returnSubject('r-1') }));
    mockNavigation.params = { disputeId: d.dispute.id };
    await render(<DisputeSelectEvidenceScreen />, { returns, disputes });
    await fireEvent.press(await screen.findByTestId(`dispute-file-open-${mediaId}`));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.disputeEvidenceDetail, {
      disputeId: d.dispute.id,
      evidenceId: mediaId,
    });
  });
});

describe('V1-17b: route xem tệp của tranh chấp', () => {
  it('tệp đóng gói của đơn trong hồ sơ: phát từ tệp trên máy, chỉ đọc', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const evidenceId = await addPackFile(files, orders);
    mockExisting.add(VIDEO);
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute());
    mockNavigation.params = { disputeId: d.dispute.id, evidenceId };
    await render(<DisputeEvidenceDetailScreen />, { orders, files, disputes });
    expect(await screen.findByTestId('evidence-video-player')).toBeOnTheScreen();
    expect(mockVideoPlayer.uri).toBe(`file:///docs/${VIDEO}`);
    expect(screen.getByTestId('screen-UI-E04-evidenceId')).toBeOnTheScreen();
    expect(screen.getByText('DH1234567890')).toBeOnTheScreen();
    expect(screen.queryAllByRole('button')).toHaveLength(1);
  });

  it('ảnh hàng hoàn của hồ sơ, kiện mở trước khi quay: hiện ảnh + "Hạn chế bằng chứng"', async () => {
    const returns = createMemoryReturnStore();
    const { mediaId, path } = await addReturnPhoto(returns, 'r-1', { openedBefore: true });
    mockExisting.add(path);
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute({ subject: returnSubject('r-1', true) }));
    mockNavigation.params = { disputeId: d.dispute.id, evidenceId: mediaId };
    await render(<DisputeEvidenceDetailScreen />, { returns, disputes });
    expect(await screen.findByTestId('evidence-photo')).toBeOnTheScreen();
    expect(screen.getByTestId('return-media-limited')).toHaveTextContent(/Hạn chế bằng chứng/);
    expect(screen.getByTestId('screen-UI-E04-evidenceId')).toBeOnTheScreen();
  });

  it('ảnh của hồ sơ hoàn KHÁC (không thuộc hồ sơ tranh chấp): không tìm thấy', async () => {
    const returns = createMemoryReturnStore();
    await addReturnPhoto(returns, 'r-1');
    const other = await addReturnPhoto(returns, 'r-2');
    mockExisting.add(other.path);
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute({ subject: returnSubject('r-1') }));
    mockNavigation.params = { disputeId: d.dispute.id, evidenceId: other.mediaId };
    await render(<DisputeEvidenceDetailScreen />, { returns, disputes });
    expect(await screen.findByTestId('evidence-detail-not-found')).toHaveTextContent(
      /Không tìm thấy bằng chứng này/,
    );
    expect(screen.queryByTestId('evidence-photo')).toBeNull();
  });

  it('hồ sơ tranh chấp của shop khác (đoán ID): không tìm thấy, không lộ tệp', async () => {
    const orders = createMemoryOrderStore();
    await seedOrder(orders, sampleOrder());
    const files = createMemoryEvidenceFileStore();
    const evidenceId = await addPackFile(files, orders);
    mockExisting.add(VIDEO);
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute({ shopId: 'shop-khac' as ShopId }));
    mockNavigation.params = { disputeId: d.dispute.id, evidenceId };
    await render(<DisputeEvidenceDetailScreen />, { orders, files, disputes });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
  });

  it('ID tệp lạ: không tìm thấy', async () => {
    const disputes = createMemoryDisputeStore();
    const d = await disputes.createDispute(newDispute());
    mockNavigation.params = { disputeId: d.dispute.id, evidenceId: 'khong-co' };
    await render(<DisputeEvidenceDetailScreen />, { disputes });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
  });
});
