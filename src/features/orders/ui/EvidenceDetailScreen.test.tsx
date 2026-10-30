import { act, screen } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFile, EvidenceFileStore, FileState } from '@/features/evidence';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { mockVideoPlayer, resetMockVideoPlayer } from '@/test-utils/mock-video-player';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryEvidenceFileStore, createMemoryOrderStore } from '../data';
import { makeOrder } from '../data/order-store.contract';
import type { OrderDetails, OrderStore } from '../domain';
import { buildPackingSession } from '../domain/start-session';
import { EvidenceDetailScreen } from './EvidenceDetailScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
const mockExisting = new Set<string>();
const mockFileOps = { deleteRecording: jest.fn(), persistRecording: jest.fn() };
jest.mock('@/platform/recording-files', () => ({
  recordingExists: (stored: string) => mockExisting.has(stored),
  resolveRecordingUri: (stored: string) => `file:///docs/${stored}`,
  deleteRecording: (...a: unknown[]) => mockFileOps.deleteRecording(...a),
  persistRecording: (...a: unknown[]) => mockFileOps.persistRecording(...a),
}));

const AT = new Date(2026, 9, 27, 9, 30).getTime();
const HASH = 'ab'.repeat(32);
const PATH = 'evidence/ev-1.mp4';

beforeEach(() => {
  resetMockNavigation();
  resetMockVideoPlayer();
  mockExisting.clear();
  mockFileOps.deleteRecording.mockClear();
  mockFileOps.persistRecording.mockClear();
});

/** Kho tệp của test: bản ghi tệp đặt sẵn (trạng thái/đường dẫn bất kỳ), vẫn cô lập theo shop. */
function fileStore(files: EvidenceFile[]): EvidenceFileStore {
  return {
    ...createMemoryEvidenceFileStore(),
    get: async (shopId, id) => files.find((f) => f.id === id && f.shopId === shopId) ?? null,
  };
}

async function seed(code = 'DH-PLAY-1'): Promise<{
  store: OrderStore;
  d: OrderDetails;
  file: (state: FileState, extra?: Partial<EvidenceFile>) => EvidenceFile;
}> {
  const store = createMemoryOrderStore();
  const d = makeOrder(code, { at: AT });
  await store.saveNewOrder(d);
  const pkg = d.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(d, pkg.id as PackageId, {
    sessionId: 'sess-play-123456' as SessionId,
    nowDevice: AT,
  });
  if (!built.ok) throw new Error('fixture');
  await store.saveSession({ ...built.session, sessionStatus: 'ended' });
  const file = (state: FileState, extra: Partial<EvidenceFile> = {}): EvidenceFile => ({
    id: 'ev-1' as EvidenceId,
    shopId: d.order.shopId,
    orderId: d.order.id,
    packageId: pkg.id,
    sessionId: 'sess-play-123456' as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: PATH,
    sizeBytes: 191_250_000,
    durationMs: 154_000,
    sha256Client: HASH,
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: AT,
    updatedAtDevice: AT,
    ...extra,
  });
  return { store, d, file };
}

async function open(
  store: OrderStore,
  files: EvidenceFile[],
  params: { orderId?: string; evidenceId?: string },
) {
  mockNavigation.params = params;
  await renderWithProviders(<EvidenceDetailScreen />, {
    orderStore: store,
    evidenceFileStore: fileStore(files),
  });
}

describe('UI-E04 Chi tiết bằng chứng (xem lại trên máy)', () => {
  it('tệp còn trên máy: phát đúng tệp theo evidenceId, thông tin tệp + liên kết, giờ thiết bị', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    await open(store, [file('queued')], { orderId: d.order.id, evidenceId: 'ev-1' });
    expect(await screen.findByTestId('evidence-video-player')).toBeOnTheScreen();
    expect(mockVideoPlayer.uri).toBe(`file:///docs/${PATH}`);
    expect(screen.getByText('Video đóng gói')).toBeOnTheScreen();
    expect(screen.getByText('27/10/2026 09:30')).toBeOnTheScreen();
    expect(screen.getByText('Ghi lúc (giờ trên máy)')).toBeOnTheScreen();
    expect(screen.getByText('2:34')).toBeOnTheScreen();
    expect(screen.getByText('182,4 MB')).toBeOnTheScreen();
    expect(screen.getByText('DH-PLAY-1')).toBeOnTheScreen();
    expect(screen.getByText('Kiện 1')).toBeOnTheScreen();
    expect(screen.getByTestId('evidence-detail-session')).toHaveTextContent(
      /Đã kết thúc, bắt đầu 27\/10\/2026 09:30 \(mã 123456\)/,
    );
    expect(screen.getByText('abababab…abababab')).toBeOnTheScreen();
    expect(screen.getByText(/Mã băm chỉ chứng minh tệp không đổi/)).toBeOnTheScreen();
  });

  it.each<[FileState, string]>([
    ['queued', 'Đã lưu trên máy'],
    ['uploading', 'Đang tải lên'],
    ['uploaded', 'Đã tải lên'],
    ['verified', 'Đã xác minh'],
    ['upload_failed', 'Lỗi – cần xử lý'],
    ['hash_mismatch', 'Lỗi – cần xử lý'],
  ])('trạng thái %s hiện đúng nhãn "%s" (docs/09 mục 3)', async (state, label) => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    await open(store, [file(state)], { orderId: d.order.id, evidenceId: 'ev-1' });
    expect(await screen.findByText(label)).toBeOnTheScreen();
    if (state !== 'verified') expect(screen.queryByText('Đã xác minh')).toBeNull();
    if (state !== 'verified' && state !== 'uploaded') {
      expect(screen.queryByText(/máy chủ đã nhận|lưu an toàn trên máy chủ/i)).toBeNull();
    }
  });

  it.each<FileState>(['queued', 'needs_attention', 'upload_failed', 'unrecoverable'])(
    'tệp %s không còn trên máy: nói bằng chứng đã mất, không nhãn "Đã lưu trên máy", không trình phát',
    async (state) => {
      const { store, d, file } = await seed();
      await open(store, [file(state)], { orderId: d.order.id, evidenceId: 'ev-1' });
      expect(await screen.findByText('Video không còn trên máy này.')).toBeOnTheScreen();
      expect(
        screen.getByText('Tệp chưa được tải lên máy chủ, nên bằng chứng này đã mất.'),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/từ máy chủ\./)).toBeNull();
      expect(screen.queryByTestId('evidence-detail-status')).toBeNull();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
      expect(screen.queryByText(/Đã xác minh|Đã tải lên/)).toBeNull();
      expect(screen.queryByTestId('evidence-video-player')).toBeNull();
      // Thông tin tệp vẫn còn để đối chiếu.
      expect(screen.getByText('DH-PLAY-1')).toBeOnTheScreen();
    },
  );

  it.each<[FileState, string]>([
    ['verified', 'Đã xác minh'],
    ['uploaded', 'Đã tải lên'],
  ])(
    'tệp %s không còn trên máy: máy chủ có bản, giữ nhãn + câu máy chủ, không trình phát',
    async (state, label) => {
      const { store, d, file } = await seed();
      await open(store, [file(state)], { orderId: d.order.id, evidenceId: 'ev-1' });
      expect(await screen.findByText('Video không còn trên máy này.')).toBeOnTheScreen();
      expect(screen.getByText('Ứng dụng chưa hỗ trợ xem lại tệp từ máy chủ.')).toBeOnTheScreen();
      expect(screen.queryByText(/bằng chứng này đã mất/)).toBeNull();
      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByTestId('evidence-detail-hint')).toHaveTextContent(/máy chủ/i);
      expect(screen.queryByTestId('evidence-video-player')).toBeNull();
    },
  );

  it.each<['video' | 'photo', string, RegExp]>([
    ['video', 'Video đã lưu trên máy này. Chưa có bản trên máy chủ.', /Ảnh đã lưu/],
    ['photo', 'Ảnh đã lưu trên máy này. Chưa có bản trên máy chủ.', /Video đã lưu/],
  ])('câu giải thích "Đã lưu trên máy" theo loại tệp (%s)', async (kind, hint, wrong) => {
    const { store, d, file } = await seed();
    const path = kind === 'video' ? PATH : 'evidence/ev-1.jpg';
    mockExisting.add(path);
    await open(store, [file('queued', { kind, localPath: path })], {
      orderId: d.order.id,
      evidenceId: 'ev-1',
    });
    expect(await screen.findByTestId('evidence-detail-hint')).toHaveTextContent(hint);
    expect(screen.queryByText(wrong)).toBeNull();
  });

  it('tệp đang ghi/đang lưu: không mở tệp chưa đóng', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    await open(store, [file('saving_local', { sha256Client: null, sizeBytes: null })], {
      orderId: d.order.id,
      evidenceId: 'ev-1',
    });
    expect(await screen.findByText('Video đang được lưu.')).toBeOnTheScreen();
    expect(screen.getByTestId('evidence-detail-capture')).toHaveTextContent(
      'Đang lưu trên thiết bị',
    );
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
    expect(screen.queryByTestId('evidence-detail-hash')).toBeNull();
  });

  it('trình phát báo lỗi: chuyển sang thông báo, tệp gốc không bị đụng', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    await open(store, [file('queued')], { orderId: d.order.id, evidenceId: 'ev-1' });
    await screen.findByTestId('evidence-video-player');
    await act(async () => mockVideoPlayer.onError?.());
    expect(screen.getByText('Không phát được video này.')).toBeOnTheScreen();
    expect(screen.getByText('Tệp gốc trên máy vẫn được giữ nguyên.')).toBeOnTheScreen();
    expect(mockFileOps.deleteRecording).not.toHaveBeenCalled();
    expect(mockFileOps.persistRecording).not.toHaveBeenCalled();
  });

  it('ảnh: hiện ảnh từ tệp trên máy, không có thời lượng', async () => {
    const { store, d, file } = await seed();
    mockExisting.add('evidence/ev-1.jpg');
    await open(store, [file('queued', { kind: 'photo', localPath: 'evidence/ev-1.jpg' })], {
      orderId: d.order.id,
      evidenceId: 'ev-1',
    });
    expect(await screen.findByTestId('evidence-photo')).toBeOnTheScreen();
    expect(screen.getByText('Ảnh đóng gói')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-detail-duration')).toBeNull();
  });

  it('chỉ đọc: không có nút xóa, sửa, cắt hay chia sẻ', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    await open(store, [file('queued')], { orderId: d.order.id, evidenceId: 'ev-1' });
    await screen.findByTestId('evidence-video-player');
    expect(screen.queryAllByRole('button')).toHaveLength(1); // chỉ nút Quay lại của header
    expect(screen.queryByText(/Xóa|Sửa|Cắt|Ghi đè|Chia sẻ/)).toBeNull();
    expect(screen.getByText(/Tệp gốc trên máy không bị sửa hay xóa/)).toBeOnTheScreen();
  });

  it('tệp thuộc đơn khác đơn trên đường dẫn: không tìm thấy (không suy từ mã đơn)', async () => {
    const { store, file } = await seed();
    const other = makeOrder('DH-OTHER', { at: AT });
    await store.saveNewOrder(other);
    mockExisting.add(PATH);
    await open(store, [file('queued')], { orderId: other.order.id, evidenceId: 'ev-1' });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
  });

  it('tệp của shop khác (đoán ID): không tìm thấy, không lộ mã đơn', async () => {
    const { store, d, file } = await seed('SECRET-CODE');
    mockExisting.add(PATH);
    await open(store, [file('queued', { shopId: 'shop-khac' as ShopId })], {
      orderId: d.order.id,
      evidenceId: 'ev-1',
    });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
    expect(screen.queryByText('SECRET-CODE')).toBeNull();
  });

  it('thiếu tham số: không tìm thấy', async () => {
    const { store } = await seed();
    await open(store, [], { orderId: 'x' as OrderId });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
  });

  it('lỗi đọc kho: thông báo có nút Thử lại', async () => {
    const { store, d } = await seed();
    mockNavigation.params = { orderId: d.order.id, evidenceId: 'ev-1' };
    const broken: EvidenceFileStore = {
      ...createMemoryEvidenceFileStore(),
      get: async () => {
        throw new Error('disk');
      },
    };
    await renderWithProviders(<EvidenceDetailScreen />, {
      orderStore: store,
      evidenceFileStore: broken,
    });
    expect(await screen.findByTestId('evidence-detail-error')).toBeOnTheScreen();
  });
});
