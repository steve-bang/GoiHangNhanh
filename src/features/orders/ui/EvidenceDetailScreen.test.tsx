import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import {
  EvidenceReadUrlError,
  type EvidenceFile,
  type EvidenceFileStore,
  type EvidenceReadUrlApi,
  type FileState,
} from '@/features/evidence';
import { setMockConnectivity, resetMockConnectivity } from '@/test-utils/mock-connectivity';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { mockVideoPlayer, resetMockVideoPlayer } from '@/test-utils/mock-video-player';
import { renderWithProviders } from '@/test-utils/render';

import {
  CurrentShopProvider,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '../data';
import { LOCAL_SHOP_ID } from '../domain/local-shop';
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
  resetMockConnectivity();
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

async function seed(
  code = 'DH-PLAY-1',
  /** Tài khoản tạo phiên (kho đơn ghi `createdBy`); không truyền = không rõ người tạo. */
  creator?: string,
): Promise<{
  store: OrderStore;
  d: OrderDetails;
  file: (state: FileState, extra?: Partial<EvidenceFile>) => EvidenceFile;
}> {
  const store = createMemoryOrderStore(creator ? { creatorUid: () => creator } : {});
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
  /** Tài khoản đang đăng nhập (V1-07); không truyền = như phiên của bộ render test. */
  signedInAs?: string,
  readUrlApi?: EvidenceReadUrlApi,
) {
  mockNavigation.params = params;
  const screenUi = signedInAs ? (
    <CurrentShopProvider shopId={LOCAL_SHOP_ID} uid={signedInAs}>
      <EvidenceDetailScreen />
    </CurrentShopProvider>
  ) : (
    <EvidenceDetailScreen />
  );
  await renderWithProviders(screenUi, {
    orderStore: store,
    evidenceFileStore: fileStore(files),
    ...(readUrlApi ? { readUrlApi } : {}),
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

  it.each<[string | undefined, string]>([
    [
      'u-khac',
      'Tệp do tài khoản khác tạo trên máy này. Chỉ tài khoản đó đăng nhập lại mới tải lên được.',
    ],
    [
      undefined,
      'Không rõ tài khoản nào tạo tệp này nên không tải lên được. Tệp vẫn được giữ trên máy.',
    ],
  ])(
    'V1-07: phiên do tài khoản %s tạo: "Chờ tải lên" + lý do máy này không tải (không "Đang tải lên")',
    async (creator, note) => {
      const { store, d, file } = await seed('DH-PLAY-1', creator);
      mockExisting.add(PATH);
      await open(store, [file('uploading')], { orderId: d.order.id, evidenceId: 'ev-1' }, 'u-1');
      expect(await screen.findByText('Chờ tải lên')).toBeOnTheScreen();
      expect(screen.getByTestId('evidence-detail-hint')).toHaveTextContent(note);
      expect(screen.queryByText('Đang tải lên')).toBeNull();
    },
  );

  it('V1-07: phiên do CHÍNH tài khoản đang đăng nhập tạo: nhãn như cũ, không có câu tài khoản khác', async () => {
    const { store, d, file } = await seed('DH-PLAY-1', 'u-1');
    mockExisting.add(PATH);
    await open(store, [file('queued')], { orderId: d.order.id, evidenceId: 'ev-1' }, 'u-1');
    expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(screen.queryByText(/tài khoản/)).toBeNull();
  });

  it.each<FileState>(['queued', 'needs_attention', 'upload_failed', 'unrecoverable'])(
    'tệp %s không còn trên máy: nói bằng chứng đã mất, không nhãn "Đã lưu trên máy", không trình phát',
    async (state) => {
      const { store, d, file } = await seed();
      await open(store, [file(state)], { orderId: d.order.id, evidenceId: 'ev-1' });
      expect(await screen.findByText('Video không còn trên máy này.')).toBeOnTheScreen();
      expect(
        screen.getByText('Tệp không còn trên máy này và máy chủ chưa xác nhận có bản.'),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/từ máy chủ\./)).toBeNull();
      expect(screen.queryByTestId('evidence-detail-status')).toBeNull();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
      expect(screen.queryByText(/Đã xác minh|Đã tải lên/)).toBeNull();
      expect(screen.queryByTestId('evidence-video-player')).toBeNull();
      expect(screen.queryByTestId('evidence-detail-readonly')).toBeNull();
      // Thông tin tệp vẫn còn để đối chiếu.
      expect(screen.getByText('DH-PLAY-1')).toBeOnTheScreen();
    },
  );

  it('tệp hash_mismatch không còn trên máy: câu riêng (máy chủ có bản không khớp), ẩn nhãn', async () => {
    const { store, d, file } = await seed();
    await open(store, [file('hash_mismatch')], { orderId: d.order.id, evidenceId: 'ev-1' });
    expect(await screen.findByText('Video không còn trên máy này.')).toBeOnTheScreen();
    expect(
      screen.getByText('Bản trên máy chủ không khớp với tệp gốc, và tệp gốc trên máy đã mất.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/chưa được tải lên máy chủ/)).toBeNull();
    expect(screen.queryByText(/chưa hỗ trợ xem lại tệp từ máy chủ/)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-status')).toBeNull();
    expect(screen.queryByText(/Đã lưu trên máy|Đã xác minh|Lỗi – cần xử lý/)).toBeNull();
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
  });

  /** Cổng xin URL giả: ghi lại số lần gọi, trả lần lượt kết quả (hết thì lặp lại kết quả cuối). */
  function readUrlApi(...results: (string | EvidenceReadUrlError)[]) {
    let calls = 0;
    const get = jest.fn(async (): Promise<{ url: string; expiresAtMs: number }> => {
      const next = results[Math.min(calls, results.length - 1)];
      calls += 1;
      if (next instanceof EvidenceReadUrlError) throw next;
      return { url: next as string, expiresAtMs: Date.now() + 900_000 };
    });
    return { api: { get } as EvidenceReadUrlApi, get };
  }

  it('tệp còn trên máy: phát từ máy, KHÔNG gọi máy chủ dù đã verified', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    const { api, get } = readUrlApi('https://signed.example/ev-1');
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    await screen.findByTestId('evidence-video-player');
    expect(mockVideoPlayer.uri).toBe(`file:///docs/${PATH}`);
    expect(get).not.toHaveBeenCalled();
  });

  it.each<[FileState, string]>([
    ['verified', 'Đã xác minh'],
    ['uploaded', 'Đã tải lên'],
  ])(
    'tệp %s không còn trên máy: xem từ máy chủ qua URL https, giữ nhãn, không báo "không xem được"',
    async (state, label) => {
      const { store, d, file } = await seed();
      const { api, get } = readUrlApi('https://signed.example/ev-1?sig=x');
      await open(store, [file(state)], { orderId: d.order.id, evidenceId: 'ev-1' }, undefined, api);
      expect(await screen.findByTestId('evidence-video-player')).toBeOnTheScreen();
      expect(mockVideoPlayer.uri).toBe('https://signed.example/ev-1?sig=x');
      expect(get).toHaveBeenCalledTimes(1);
      expect(get).toHaveBeenCalledWith(d.order.shopId, 'ev-1');
      expect(screen.getByText(/Bạn đang xem bản trên máy chủ/)).toBeOnTheScreen();
      expect(screen.queryByText('Video không còn trên máy này.')).toBeNull();
      expect(screen.getByText(label)).toBeOnTheScreen();
      // Không tải ngược về máy, không đụng tệp local (bất biến 4).
      expect(mockFileOps.persistRecording).not.toHaveBeenCalled();
      expect(mockFileOps.deleteRecording).not.toHaveBeenCalled();
    },
  );

  it('đang xin URL: hiện "Đang tải từ máy chủ"', async () => {
    const { store, d, file } = await seed();
    const api: EvidenceReadUrlApi = { get: () => new Promise(() => undefined) };
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    expect(await screen.findByText('Đang tải từ máy chủ')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
  });

  it('phát lỗi (URL hết hạn): tự xin URL mới đúng một lần; lỗi tiếp thì báo lỗi kèm Thử lại', async () => {
    const { store, d, file } = await seed();
    const { api, get } = readUrlApi('https://signed.example/1', 'https://signed.example/2');
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    await screen.findByTestId('evidence-video-player');
    await act(async () => mockVideoPlayer.onError?.());
    await waitFor(() => expect(mockVideoPlayer.uri).toBe('https://signed.example/2'));
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => mockVideoPlayer.onError?.());
    expect(await screen.findByTestId('evidence-media-cloud-error')).toBeOnTheScreen();
    expect(get).toHaveBeenCalledTimes(2);
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
  });

  it('hết hạn nhiều lần khi màn mở lâu: mỗi lần hết hạn đều tự xin lại, không báo lỗi', async () => {
    const { store, d, file } = await seed();
    const { api, get } = readUrlApi(
      'https://signed.example/1',
      'https://signed.example/2',
      'https://signed.example/3',
    );
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    await screen.findByTestId('evidence-video-player');
    const realNow = Date.now();
    const now = jest.spyOn(Date, 'now');
    try {
      now.mockReturnValue(realNow + 16 * 60_000);
      await act(async () => mockVideoPlayer.onError?.());
      await waitFor(() => expect(mockVideoPlayer.uri).toBe('https://signed.example/2'));
      now.mockReturnValue(realNow + 32 * 60_000);
      await act(async () => mockVideoPlayer.onError?.());
      await waitFor(() => expect(mockVideoPlayer.uri).toBe('https://signed.example/3'));
    } finally {
      now.mockRestore();
    }
    expect(get).toHaveBeenCalledTimes(3);
    expect(screen.queryByTestId('evidence-media-cloud-error')).toBeNull();
  });

  it('xin lại mà URL mới vẫn lỗi ngay: báo lỗi kèm Thử lại, số lần gọi không tăng thêm', async () => {
    const { store, d, file } = await seed();
    const { api, get } = readUrlApi('https://signed.example/1', 'https://signed.example/2');
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    await screen.findByTestId('evidence-video-player');
    await act(async () => mockVideoPlayer.onError?.());
    await waitFor(() => expect(mockVideoPlayer.uri).toBe('https://signed.example/2'));
    await act(async () => mockVideoPlayer.onError?.());
    expect(await screen.findByTestId('evidence-media-cloud-error')).toBeOnTheScreen();
    expect(screen.getByText('Thử lại')).toBeOnTheScreen();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('offline: báo lỗi kèm Thử lại, không gọi máy chủ; có mạng lại thì Thử lại phát được', async () => {
    const { store, d, file } = await seed();
    const { api, get } = readUrlApi('https://signed.example/1');
    setMockConnectivity({ online: false, type: 'none' });
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    expect(await screen.findByText(/Không có mạng/)).toBeOnTheScreen();
    expect(get).not.toHaveBeenCalled();
    setMockConnectivity({ online: true, type: 'wifi' });
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    expect(await screen.findByTestId('evidence-video-player')).toBeOnTheScreen();
  });

  it('máy chủ không cho xem (hoặc lỗi mạng): báo lỗi kèm Thử lại', async () => {
    const { store, d, file } = await seed();
    const { api } = readUrlApi(new EvidenceReadUrlError('network'));
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    expect(await screen.findByText(/Chưa kết nối được máy chủ/)).toBeOnTheScreen();
    expect(screen.getByText('Thử lại')).toBeOnTheScreen();
  });

  it('tệp trên máy phát lỗi mà máy chủ đã xác nhận: chuyển sang xem từ máy chủ', async () => {
    const { store, d, file } = await seed();
    mockExisting.add(PATH);
    const { api, get } = readUrlApi('https://signed.example/fallback');
    await open(
      store,
      [file('verified')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    await screen.findByTestId('evidence-video-player');
    expect(get).not.toHaveBeenCalled();
    await act(async () => mockVideoPlayer.onError?.());
    await waitFor(() => expect(mockVideoPlayer.uri).toBe('https://signed.example/fallback'));
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('chưa có cổng máy chủ (cổng giả/chưa kết nối): bằng chứng đã lên máy chủ vẫn báo không xem được, không treo', async () => {
    const { store, d, file } = await seed();
    await open(store, [file('verified')], { orderId: d.order.id, evidenceId: 'ev-1' });
    expect(await screen.findByTestId('evidence-media-cloud-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-video-player')).toBeNull();
  });

  it('chưa lên máy chủ mà mất tệp: báo không xem được, KHÔNG gọi máy chủ', async () => {
    const { store, d, file } = await seed();
    const { api, get } = readUrlApi('https://signed.example/1');
    await open(
      store,
      [file('queued')],
      { orderId: d.order.id, evidenceId: 'ev-1' },
      undefined,
      api,
    );
    expect(await screen.findByText('Video không còn trên máy này.')).toBeOnTheScreen();
    expect(get).not.toHaveBeenCalled();
  });

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
