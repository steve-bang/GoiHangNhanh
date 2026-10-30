import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { EvidenceId, OrderId, PackageId, ReturnCaseId, SessionId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import {
  applyEventToFile,
  type EvidenceFile,
  type EvidenceFileStore,
  type FileState,
} from '@/features/evidence';
import {
  CurrentShopProvider,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  type OrderDetails,
  type OrderStore,
  type PackingSession,
} from '@/features/orders';
import {
  createMemoryReturnStore,
  type ReturnCase,
  type ReturnDetails,
  type ReturnMedia,
  type ReturnStore,
} from '@/features/returns';
import { resetMockConnectivity, setMockConnectivity } from '@/test-utils/mock-connectivity';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { UploadQueueContext, type UploadQueueControl } from '../data/UploadRunner';
import { RECHECK_AFTER_MS } from '../domain';
import { SyncCenterScreen } from './SyncCenterScreen';
import { SyncErrorScreen } from './SyncErrorScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

const SHOP = 'shop-sync' as ShopId;
const NOW = Date.now();

function file(id: string, state: FileState, extra: Partial<EvidenceFile> = {}): EvidenceFile {
  return {
    id: id as EvidenceId,
    shopId: SHOP,
    orderId: 'o1' as OrderId,
    packageId: 'p1' as PackageId,
    sessionId: 's-mine' as SessionId,
    group: 'pack',
    kind: 'video',
    state,
    localPath: `evidence/${id}.mp4`,
    sizeBytes: 191_250_000,
    durationMs: 1000,
    sha256Client: 'ab'.repeat(32),
    attemptCount: 0,
    nextAttemptAtDevice: null,
    lastErrorCode: null,
    createdAtDevice: NOW - 60_000,
    updatedAtDevice: NOW - 60_000,
    ...extra,
  };
}

function setup(files: EvidenceFile[], medias: ReturnMedia[] = []) {
  const records = new Map(files.map((f) => [f.id as string, f]));
  const applyEvent = jest.fn<
    ReturnType<EvidenceFileStore['applyEvent']>,
    Parameters<EvidenceFileStore['applyEvent']>
  >(async (shop, id, event, now, patch) => {
    const current = records.get(id);
    if (!current || current.shopId !== shop) return { ok: false, error: 'FILE_NOT_FOUND' };
    const result = applyEventToFile(current, event, now, patch);
    if (result.ok) records.set(id, result.file);
    return result;
  });
  const evidenceFileStore: EvidenceFileStore = {
    ...createMemoryEvidenceFileStore(),
    listByStates: async (shop, states) =>
      [...records.values()].filter((f) => f.shopId === shop && states.includes(f.state)),
    get: async (shop, id) => {
      const f = records.get(id);
      return f && f.shopId === shop ? f : null;
    },
    applyEvent,
  };
  const orderStore: OrderStore = {
    ...createMemoryOrderStore(),
    getSession: async (_shop, id) =>
      ({ id, createdBy: id === 's-mine' ? 'uid-1' : 'uid-2' }) as PackingSession,
    getOrder: async () =>
      ({
        order: { id: 'o1', orderCode: 'DH-SYNC-1' },
        lines: [],
        packages: [{ id: 'p1', index: 1 }],
      }) as unknown as OrderDetails,
  };
  const returnStore: ReturnStore = {
    ...createMemoryReturnStore(),
    listMediaByStates: async (shop, states) =>
      medias.filter((m) => m.shopId === shop && states.includes(m.state)),
    getReturn: async (_shop, id) =>
      ({
        returnCase: {
          id,
          code: 'HH-0007',
          status: 'confirmed',
          createdBy: 'uid-2',
        } as unknown as ReturnCase,
      }) as ReturnDetails,
  };
  const control: UploadQueueControl = {
    active: true,
    runNow: jest.fn(),
    requestServerCheck: jest.fn(async () => 'requested' as const),
    subscribe: () => () => undefined,
  };
  return { evidenceFileStore, orderStore, returnStore, control, applyEvent, records };
}

async function open(t: ReturnType<typeof setup>, ui = <SyncCenterScreen />) {
  await renderWithProviders(
    <CurrentShopProvider shopId={SHOP} uid="uid-1">
      <UploadQueueContext.Provider value={t.control}>{ui}</UploadQueueContext.Provider>
    </CurrentShopProvider>,
    {
      evidenceFileStore: t.evidenceFileStore,
      orderStore: t.orderStore,
      returnStore: t.returnStore,
    },
  );
}

beforeEach(() => resetMockNavigation());
afterEach(() => resetMockConnectivity());

describe('UI-F01 Trung tâm đồng bộ (dữ liệu thật, V1-08)', () => {
  it('máy chưa có tệp: trạng thái rỗng, không còn dữ liệu minh họa, câu tải khi app mở', async () => {
    await open(setup([]));
    expect(await screen.findByText('Không có tệp ở mục này')).toBeOnTheScreen();
    expect(screen.queryByText(/DEMO-/)).toBeNull();
    expect(screen.queryByText(/minh họa/i)).toBeNull();
    expect(screen.getByTestId('sync-note')).toHaveTextContent(
      'Ứng dụng chỉ tải lên khi đang mở. Đóng ứng dụng thì việc tải tạm dừng, mở lại sẽ tiếp tục.',
    );
  });

  it('bốn bộ lọc theo trạng thái tệp thật, có số đếm; Đã tải lên chỉ tệp máy chủ đã nhận', async () => {
    await open(
      setup([
        file('up', 'uploading'),
        file('q', 'queued'),
        file('bad', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
        file('done', 'uploaded'),
      ]),
    );
    expect(await screen.findByText('Đang tải lên (1)')).toBeOnTheScreen();
    expect(screen.getByTestId('sync-job-pack:up')).toBeOnTheScreen();
    expect(screen.getByText('DH-SYNC-1 · Kiện 1')).toBeOnTheScreen();
    expect(screen.getByText('Video · 182,4 MB')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:done')).toBeNull();

    await fireEvent.press(screen.getByText('Chờ tải lên (1)'));
    expect(await screen.findByTestId('sync-job-pack:q')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:up')).toBeNull();

    await fireEvent.press(screen.getByText('Lỗi (1)'));
    expect(await screen.findByTestId('sync-job-pack:bad')).toBeOnTheScreen();
    expect(screen.getByText('Máy chủ chưa nhận tệp sau nhiều lần thử.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Đã tải lên'));
    expect(await screen.findByTestId('sync-job-pack:done')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:q')).toBeNull();
    expect(screen.queryByTestId('sync-job-pack:bad')).toBeNull();
  });

  it('Thử lại lỗi máy chủ: phát USER_RETRY_ATTENTION (device) một lần dù bấm đúp, rồi chạy hàng đợi một lần', async () => {
    const t = setup([
      file('bad', 'needs_attention', { lastErrorCode: 'HTTP_403', attemptCount: 8 }),
    ]);
    await open(t);
    await fireEvent.press(await screen.findByText('Lỗi (1)'));
    const button = await screen.findByTestId('sync-job-retry-pack:bad');
    await act(async () => {
      fireEvent.press(button);
      fireEvent.press(button);
    });
    await waitFor(() => expect(t.control.runNow).toHaveBeenCalledTimes(1));
    expect(t.applyEvent).toHaveBeenCalledTimes(1);
    expect(t.applyEvent.mock.calls[0]?.[2]).toEqual({
      type: 'USER_RETRY_ATTENTION',
      origin: 'device',
    });
    expect(t.records.get('bad')).toMatchObject({
      state: 'queued',
      attemptCount: 0,
      lastErrorCode: 'HTTP_403',
    });
    expect(await screen.findByText('Đã đưa vào hàng chờ tải lên.')).toBeOnTheScreen();
  });

  it('lỗi tệp cục bộ (tệp mất, quá lớn) và lệch mã băm: không có nút Thử lại', async () => {
    await open(
      setup([
        file('missing', 'needs_attention', { lastErrorCode: 'FILE_MISSING' }),
        file('big', 'needs_attention', { lastErrorCode: 'UPLOAD_FILE_TOO_LARGE' }),
        file('mm', 'hash_mismatch'),
      ]),
    );
    await fireEvent.press(await screen.findByText('Lỗi (3)'));
    expect(await screen.findByTestId('sync-job-pack:missing')).toBeOnTheScreen();
    expect(
      screen.getByText('Tệp quá lớn nên không tải lên được. Tệp vẫn còn trên máy này.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Thử lại')).toBeNull();
    expect(screen.queryByTestId('sync-retry-all')).toBeNull();
  });

  it('Thử lại tất cả chỉ gồm tệp đủ điều kiện', async () => {
    const t = setup([
      file('a', 'upload_failed', { lastErrorCode: 'HTTP_500' }),
      file('b', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
      file('c', 'needs_attention', { lastErrorCode: 'FILE_MISSING' }),
    ]);
    await open(t);
    await fireEvent.press(await screen.findByText('Lỗi (3)'));
    await fireEvent.press(await screen.findByText('Thử lại tất cả (2)'));
    await waitFor(() => expect(t.control.runNow).toHaveBeenCalledTimes(1));
    expect(t.applyEvent.mock.calls.map((c) => [c[1], c[2].type])).toEqual([
      ['a', 'RETRY_UPLOAD'],
      ['b', 'USER_RETRY_ATTENTION'],
    ]);
    expect(t.records.get('c')?.state).toBe('needs_attention');
  });

  it('tệp do tài khoản khác tạo: nhóm riêng có lý do, không có nút Thử lại', async () => {
    const theirs: ReturnMedia = {
      id: 'm1',
      shopId: SHOP,
      returnId: 'r1' as ReturnCaseId,
      kind: 'photo',
      state: 'upload_failed',
      localPath: 'evidence/m1.jpg',
      sizeBytes: 870_400,
      sha256Client: 'cd'.repeat(32),
      location: null,
      attemptCount: 1,
      nextAttemptAtDevice: null,
      lastErrorCode: 'HTTP_500',
      createdAtDevice: NOW,
      updatedAtDevice: NOW,
      createdBy: 'uid-2',
    };
    await open(setup([file('x', 'uploading', { sessionId: 's-theirs' as SessionId })], [theirs]));
    // `uploading` của tài khoản khác: "Chờ tải lên", không lọt vào "Đang tải lên".
    expect(await screen.findByText('Chờ tải lên (1)')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:x')).toBeNull();
    await fireEvent.press(screen.getByText('Chờ tải lên (1)'));
    const group = await screen.findByTestId('sync-foreign-group');
    expect(group).toHaveTextContent(/Do tài khoản khác tạo trên máy này/);
    expect(group).toHaveTextContent(/Chỉ tài khoản đó đăng nhập lại mới tải lên được/);
    await fireEvent.press(screen.getByText('Lỗi (1)'));
    expect(await screen.findByTestId('sync-job-return:m1')).toBeOnTheScreen();
    expect(screen.getByText('Hàng hoàn HH-0007')).toBeOnTheScreen();
    expect(screen.queryByText('Thử lại')).toBeNull();
  });

  it('lỗi cuối (lệch mã băm) của tài khoản khác vẫn nằm trong nhóm tài khoản khác', async () => {
    await open(setup([file('mm', 'hash_mismatch', { sessionId: 's-theirs' as SessionId })]));
    await fireEvent.press(await screen.findByText('Lỗi (1)'));
    const group = await screen.findByTestId('sync-foreign-group');
    expect(group).toHaveTextContent(/DH-SYNC-1/);
    expect(screen.queryByText('Thử lại')).toBeNull();
  });

  it('mất mạng: câu nói rõ; Thử lại vẫn đưa vào hàng chờ và nói sẽ chạy khi có mạng', async () => {
    setMockConnectivity({ online: false });
    const t = setup([file('a', 'upload_failed', { lastErrorCode: 'TIMEOUT' })]);
    await open(t);
    expect(await screen.findByTestId('sync-note')).toHaveTextContent(
      'Máy đang mất mạng. Tệp vẫn ở trên máy, sẽ tải khi có mạng lại.',
    );
    await fireEvent.press(screen.getByText('Lỗi (1)'));
    expect(await screen.findByText('Đang chờ mạng.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('sync-job-retry-pack:a'));
    expect(
      await screen.findByText('Đã đưa vào hàng chờ. Sẽ tải khi có mạng và ứng dụng đang mở.'),
    ).toBeOnTheScreen();
    expect(t.records.get('a')?.state).toBe('queued');
  });

  it('tệp đã tải lên lâu chưa xác minh: Kiểm tra lại nhờ máy chủ, không tự đổi trạng thái', async () => {
    const t = setup([
      file('old', 'uploaded', { updatedAtDevice: NOW - RECHECK_AFTER_MS - 60_000 }),
      file('new', 'uploaded', { updatedAtDevice: NOW }),
    ]);
    await open(t);
    await fireEvent.press(await screen.findByText('Đã tải lên'));
    await fireEvent.press(await screen.findByTestId('sync-job-recheck-pack:old'));
    await waitFor(() => expect(t.control.requestServerCheck).toHaveBeenCalledWith('old'));
    expect(screen.queryByTestId('sync-job-recheck-pack:new')).toBeNull();
    expect(t.applyEvent).not.toHaveBeenCalled();
    expect(t.records.get('old')?.state).toBe('uploaded');
    expect(
      await screen.findByText('Đã nhờ máy chủ kiểm tra lại. Kết quả sẽ hiện ở đây.'),
    ).toBeOnTheScreen();
  });

  it('Chi tiết mở UI-F02 bằng khóa tệp', async () => {
    await open(setup([file('a', 'needs_attention', { lastErrorCode: 'FILE_MISSING' })]));
    await fireEvent.press(await screen.findByText('Lỗi (1)'));
    await fireEvent.press(await screen.findByTestId('sync-job-details-pack:a'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.syncError, { jobId: 'pack:a' });
  });
});

describe('UI-F02 Chi tiết lỗi đồng bộ (V1-08)', () => {
  it('lỗi máy chủ: nguyên nhân, dữ liệu còn trên máy, có Thử lại và Mở hồ sơ', async () => {
    const t = setup([file('a', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' })]);
    mockNavigation.params = { jobId: 'pack:a' };
    await open(t, <SyncErrorScreen />);
    expect(await screen.findByTestId('sync-detail-cause')).toHaveTextContent(
      'Máy chủ chưa nhận tệp sau nhiều lần thử.',
    );
    expect(screen.getByTestId('sync-detail-where')).toHaveTextContent(
      'Tệp gốc vẫn còn trên máy này. Không cần quay hay chụp lại.',
    );
    await fireEvent.press(screen.getByTestId('sync-detail-retry'));
    await waitFor(() => expect(t.control.runNow).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByTestId('sync-detail-open'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderEvidence, { orderId: 'o1' });
  });

  it('lỗi tệp cục bộ: không có Thử lại, nói rõ tệp không còn trên máy', async () => {
    mockNavigation.params = { jobId: 'pack:a' };
    await open(
      setup([file('a', 'needs_attention', { lastErrorCode: 'FILE_MISSING' })]),
      <SyncErrorScreen />,
    );
    expect(await screen.findByTestId('sync-detail-where')).toHaveTextContent(
      'Tệp gốc không còn trên máy này.',
    );
    expect(screen.queryByTestId('sync-detail-retry')).toBeNull();
    expect(screen.getByTestId('sync-detail-no-action')).toBeOnTheScreen();
  });

  it('cần xử lý của tài khoản khác: nói chỉ người tạo tải được, không nói "không thử lại được"', async () => {
    mockNavigation.params = { jobId: 'pack:x' };
    await open(
      setup([
        file('x', 'needs_attention', {
          sessionId: 's-theirs' as SessionId,
          lastErrorCode: 'FILE_MISSING',
        }),
      ]),
      <SyncErrorScreen />,
    );
    expect(await screen.findByTestId('sync-detail-no-action')).toHaveTextContent(
      'Chỉ tài khoản đã tạo tệp mới tải lên được.',
    );
    expect(screen.queryByText('Ứng dụng không thử lại được lỗi này.')).toBeNull();
    expect(screen.queryByTestId('sync-detail-retry')).toBeNull();
  });

  it('tệp đã xác minh hoặc khóa lạ: báo không còn cần xử lý', async () => {
    mockNavigation.params = { jobId: 'pack:a' };
    await open(setup([file('a', 'verified')]), <SyncErrorScreen />);
    expect(await screen.findByText('Tệp này không còn cần xử lý.')).toBeOnTheScreen();
  });
});
