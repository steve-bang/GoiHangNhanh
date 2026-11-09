import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

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
  createMemoryDeviceSettingsStore,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  type DeviceSettingsStore,
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

async function open(
  t: ReturnType<typeof setup>,
  ui = <SyncCenterScreen />,
  deviceSettingsStore: DeviceSettingsStore = createMemoryDeviceSettingsStore(),
) {
  await renderWithProviders(
    <CurrentShopProvider shopId={SHOP} uid="uid-1">
      <UploadQueueContext.Provider value={t.control}>{ui}</UploadQueueContext.Provider>
    </CurrentShopProvider>,
    {
      evidenceFileStore: t.evidenceFileStore,
      orderStore: t.orderStore,
      returnStore: t.returnStore,
      deviceSettingsStore,
    },
  );
}

beforeEach(() => resetMockNavigation());
afterEach(() => resetMockConnectivity());

describe('UI-F01 Trung tâm đồng bộ (dữ liệu thật, V1-08)', () => {
  it('máy chưa có tệp: trạng thái rỗng, không còn dữ liệu minh họa, câu tải khi app mở', async () => {
    await open(setup([]));
    expect(await screen.findByTestId('sync-summary')).toBeOnTheScreen();
    expect(screen.queryByText(/DEMO-/)).toBeNull();
    expect(screen.queryByText(/minh họa/i)).toBeNull();
    // Câu "chỉ tải khi đang mở" nằm trong bảng Cài đặt tải lên (bất biến 11: vẫn phải hiện, chỉ chuyển chỗ).
    await fireEvent.press(screen.getByTestId('sync-upload-settings'));
    expect(await screen.findByTestId('sync-upload-note')).toHaveTextContent(
      'Ứng dụng chỉ tải lên khi đang mở. Đóng ứng dụng thì việc tải tạm dừng, mở lại sẽ tiếp tục.',
    );
    // Mạng bình thường: không có cảnh báo mạng ở đầu màn.
    expect(screen.queryByTestId('sync-note')).toBeNull();
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
    // Có tệp lỗi: mở sẵn bộ lọc Lỗi (việc cần xử lý trước); chưa chọn gì thì chỉ chọn mặc định một lần.
    expect(await screen.findByText('Đang tải (1)')).toBeOnTheScreen();
    expect(await screen.findByTestId('sync-job-pack:bad')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:up')).toBeNull();
    await fireEvent.press(screen.getByText('Đang tải (1)'));
    expect(await screen.findByTestId('sync-job-pack:up')).toBeOnTheScreen();
    expect(screen.getByText('DH-SYNC-1 · Kiện 1')).toBeOnTheScreen();
    expect(screen.getByText('Video · 182,4 MB')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:done')).toBeNull();

    await fireEvent.press(screen.getByText('Chờ tải (1)'));
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

  const twoFiles = () =>
    setup([
      file('up', 'uploading'),
      file('bad', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
    ]);

  it('tham số route filter=error (ô Lỗi ở Trang chủ, V1-10) mở thẳng bộ lọc Lỗi', async () => {
    mockNavigation.params = { filter: 'error' };
    await open(twoFiles());
    expect(await screen.findByTestId('sync-job-pack:bad')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:up')).toBeNull();
  });

  it('tham số filter lạ: về bộ lọc mặc định (có tệp lỗi thì mở Lỗi)', async () => {
    mockNavigation.params = { filter: 'khong-co' };
    await open(twoFiles());
    expect(await screen.findByTestId('sync-job-pack:bad')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:up')).toBeNull();
  });

  it('không có tệp lỗi: bộ lọc mặc định vẫn là Đang tải lên', async () => {
    mockNavigation.params = { filter: 'khong-co' };
    await open(setup([file('up', 'uploading'), file('q', 'queued')]));
    expect(await screen.findByTestId('sync-job-pack:up')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:q')).toBeNull();
  });

  it('khối trạng thái có lỗi: tiêu đề "N tệp cần xử lý", dòng phụ số tệp chờ và nơi tệp nằm', async () => {
    await open(
      setup([
        file('up', 'uploading'),
        file('q', 'queued'),
        file('bad', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
      ]),
    );
    expect(await screen.findByTestId('sync-summary')).toHaveTextContent('1 tệp cần xử lý');
    expect(screen.getByTestId('sync-summary-detail')).toHaveTextContent(
      '2 tệp đang chờ · Tệp vẫn ở trên máy',
    );
    // Không phần trăm, không từ trấn an.
    expect(screen.queryByText(/%|an toàn|đầy đủ/)).toBeNull();
  });

  it('khối trạng thái có lỗi mất tệp trên máy: không nói "Tệp vẫn ở trên máy"', async () => {
    await open(
      setup([
        file('gone', 'needs_attention', { lastErrorCode: 'FILE_MISSING' }),
        file('q', 'queued'),
      ]),
    );
    expect(await screen.findByTestId('sync-summary')).toHaveTextContent('1 tệp cần xử lý');
    expect(screen.getByTestId('sync-summary-detail')).toHaveTextContent('1 tệp đang chờ');
    expect(screen.queryByText(/Tệp vẫn ở trên máy/)).toBeNull();
  });

  it('khối trạng thái chỉ đang chờ: tiêu đề trung tính, không dòng phụ, không nút chính', async () => {
    await open(setup([file('up', 'uploading'), file('q', 'queued')]));
    expect(await screen.findByTestId('sync-summary')).toHaveTextContent('2 tệp đang chờ');
    expect(screen.queryByTestId('sync-summary-detail')).toBeNull();
    expect(screen.queryByTestId('sync-retry-all')).toBeNull();
  });

  it('nút chính "Thử lại tất cả" chỉ khi có từ 2 tệp lỗi thử lại được; 1 tệp thì chỉ nút nhỏ trên hàng', async () => {
    await open(
      setup([
        file('a', 'upload_failed', { lastErrorCode: 'HTTP_500' }),
        file('c', 'needs_attention', { lastErrorCode: 'FILE_MISSING' }),
      ]),
    );
    expect(await screen.findByTestId('sync-summary')).toHaveTextContent('2 tệp cần xử lý');
    expect(screen.queryByTestId('sync-retry-all')).toBeNull();
    expect(screen.getByTestId('sync-job-retry-pack:a')).toBeOnTheScreen();
  });

  it('nút Thử lại tất cả ở đầu màn dùng được từ bộ lọc khác (không phụ thuộc chip đang chọn)', async () => {
    const t = setup([
      file('a', 'upload_failed', { lastErrorCode: 'HTTP_500' }),
      file('b', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
      file('up', 'uploading'),
    ]);
    await open(t);
    await fireEvent.press(await screen.findByText('Đang tải (1)'));
    await fireEvent.press(await screen.findByText('Thử lại tất cả (2)'));
    await waitFor(() => expect(t.control.runNow).toHaveBeenCalledTimes(1));
    expect(t.applyEvent.mock.calls.map((c) => c[1])).toEqual(['a', 'b']);
  });

  it('chip xếp theo ưu tiên Lỗi, Đang tải, Chờ tải, Đã tải lên và có số đếm', async () => {
    await open(
      setup([
        file('up', 'uploading'),
        file('q', 'queued'),
        file('q2', 'queued'),
        file('bad', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' }),
      ]),
    );
    await screen.findByTestId('sync-job-pack:bad');
    const chips = screen
      .getAllByRole('button')
      .filter((b) => typeof b.props.accessibilityState?.selected === 'boolean');
    const labels = ['Lỗi (1)', 'Đang tải (1)', 'Chờ tải (2)', 'Đã tải lên'];
    expect(chips).toHaveLength(labels.length);
    labels.forEach((label, i) => expect(chips[i]).toHaveTextContent(label));
    // Chip Lỗi được chọn sẵn (có tệp lỗi), các chip còn lại không.
    expect(chips.map((c) => c.props.accessibilityState.selected)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it('cả màn rỗng: chỉ MỘT thông điệp (thẻ tóm tắt) kèm nút Mở danh sách đơn, không chip, không dòng rỗng thứ hai', async () => {
    await open(setup([]));
    await screen.findByTestId('sync-summary');
    await waitFor(() => expect(screen.queryByText('Đang đọc danh sách tệp…')).toBeNull());
    expect(screen.queryByText('Không có tệp ở mục này')).toBeNull();
    expect(screen.queryByTestId('sync-tab-empty')).toBeNull();
    expect(screen.queryByText('Đang tải')).toBeNull();
    expect(screen.queryByText('Chờ tải')).toBeNull();
    await fireEvent.press(screen.getByTestId('sync-empty-action'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orders);
  });

  it('chỉ có tệp chờ tải: mở thẳng mục Chờ tải', async () => {
    await open(setup([file('q', 'queued')]));
    expect(await screen.findByTestId('sync-job-pack:q')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-empty-action')).toBeNull();
  });

  it('chỉ có tệp đã tải lên: mở thẳng mục Đã tải lên', async () => {
    await open(setup([file('done', 'uploaded')]));
    expect(await screen.findByTestId('sync-job-pack:done')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-tab-empty')).toBeNull();
  });

  it('tab đang chọn rỗng nhưng tab khác có tệp: một dòng chữ, không nút', async () => {
    await open(setup([file('q', 'queued')]));
    await screen.findByTestId('sync-job-pack:q');
    await fireEvent.press(screen.getByText('Đang tải'));
    expect(await screen.findByTestId('sync-tab-empty')).toHaveTextContent('Không có tệp ở mục này');
    expect(screen.queryByTestId('sync-empty-action')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mở danh sách đơn' })).toBeNull();
  });

  it('máy chưa có tệp: khối trạng thái nói không có tệp nào đang chờ hoặc lỗi', async () => {
    await open(setup([]));
    expect(await screen.findByTestId('sync-summary')).toHaveTextContent(
      'Không có tệp nào đang chờ hoặc lỗi',
    );
  });

  it('hàng tệp: phần thông tin là MỘT nút có nhãn gộp (hồ sơ, loại, trạng thái, lý do) mở chi tiết; nút Thử lại tách riêng', async () => {
    await open(setup([file('bad', 'needs_attention', { lastErrorCode: 'PERMISSION_DENIED' })]));
    const info = await screen.findByTestId('sync-job-details-pack:bad');
    expect(info.props.accessibilityRole).toBe('button');
    expect(info.props.accessibilityLabel).toContain('DH-SYNC-1 · Kiện 1');
    expect(info.props.accessibilityLabel).toContain('Video');
    expect(info.props.accessibilityLabel).toContain('Lỗi – cần xử lý');
    expect(info.props.accessibilityLabel).toContain('Máy chủ chưa nhận tệp sau nhiều lần thử.');
    expect(info.props.accessibilityHint).toBe('Chi tiết');
    // Hành động Thử lại là phần tử riêng, không nằm trong nút thông tin.
    expect(screen.getByTestId('sync-job-retry-pack:bad')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Chi tiết' })).toBeNull();
    // Nút Thử lại là nút nhỏ (slim); nút chính chỉ là "Thử lại tất cả" ở khối trạng thái tổng.
    expect(screen.getByTestId('sync-job-retry-pack:bad')).toHaveTextContent('Thử lại');
    expect(screen.queryByTestId('sync-retry-all')).toBeNull();
    // Chạm phần thông tin mở chi tiết.
    await fireEvent.press(info);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.syncError, { jobId: 'pack:bad' });
  });

  it('hàng tệp đã tải lên: chạm thông tin mở hồ sơ, nhãn nói "Mở hồ sơ"', async () => {
    await open(setup([file('done', 'uploaded')]));
    const info = await screen.findByTestId('sync-job-open-pack:done');
    expect(info.props.accessibilityHint).toBe('Mở hồ sơ');
    await fireEvent.press(info);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.orderEvidence, { orderId: 'o1' });
  });

  it('đang Thử lại: nút của đúng hàng báo bận (khóa bấm đúp) trong lúc chờ kết quả', async () => {
    const t = setup([
      file('a', 'upload_failed', { lastErrorCode: 'HTTP_500' }),
      file('b', 'upload_failed', { lastErrorCode: 'HTTP_500' }),
    ]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = t.evidenceFileStore.applyEvent;
    t.evidenceFileStore.applyEvent = async (...args) => {
      await gate;
      return original(...args);
    };
    await open(t);
    await fireEvent.press(await screen.findByText('Lỗi (2)'));
    await fireEvent.press(await screen.findByTestId('sync-job-retry-pack:a'));
    await waitFor(() =>
      expect(screen.getByTestId('sync-job-retry-pack:a').props.accessibilityState).toMatchObject({
        busy: true,
      }),
    );
    expect(screen.getByTestId('sync-job-retry-pack:b').props.accessibilityState).toMatchObject({
      busy: false,
    });
    await act(async () => release());
    expect(await screen.findByText('Đã đưa vào hàng chờ tải lên.')).toBeOnTheScreen();
  });

  it('kéo để làm mới đọc lại danh sách tệp', async () => {
    const stores = setup([file('up', 'uploading')]);
    await open(stores);
    await screen.findByTestId('sync-job-pack:up');
    const scroll = screen.getByTestId('screen-UI-F01-scroll');
    const { refreshControl } = scroll.props as {
      refreshControl: { props: { onRefresh: () => void } };
    };
    expect(typeof refreshControl.props.onRefresh).toBe('function');
    refreshControl.props.onRefresh();
    expect(await screen.findByTestId('sync-job-pack:up')).toBeOnTheScreen();
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
    expect(await screen.findByText('Chờ tải (1)')).toBeOnTheScreen();
    expect(screen.queryByTestId('sync-job-pack:x')).toBeNull();
    await fireEvent.press(screen.getByText('Chờ tải (1)'));
    const group = await screen.findByTestId('sync-foreign-group');
    expect(group).toHaveTextContent(/Do tài khoản khác tạo trên máy này/);
    expect(group).toHaveTextContent(/Chỉ tài khoản đó đăng nhập lại mới tải lên được/);
    // Nhóm tài khoản khác: không nút Thử lại / Kiểm tra lại, chỉ có phần thông tin.
    expect(within(group).queryByText('Thử lại')).toBeNull();
    expect(within(group).queryByText('Kiểm tra lại')).toBeNull();
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
    expect(screen.getByTestId('sync-summary')).toHaveTextContent('1 tệp cần xử lý');
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

describe('UI-F01: Chỉ tải khi có Wi‑Fi (V1-09)', () => {
  const WIFI_ONLY = { name: 'Chỉ tải khi có Wi‑Fi' };

  it('công tắc nằm trong bảng Cài đặt tải lên, mặc định tắt; bật khi đang dùng mạng di động: cảnh báo và lý do "Đang chờ Wi‑Fi.", nhãn tệp không đổi', async () => {
    setMockConnectivity({ online: true, type: 'cellular' });
    const store = createMemoryDeviceSettingsStore();
    await open(setup([file('q', 'queued'), file('up', 'uploading')]), <SyncCenterScreen />, store);
    // Hàng gọn nêu chế độ hiện tại; công tắc chỉ hiện khi mở bảng.
    const row = await screen.findByTestId('sync-upload-settings');
    expect(row).toHaveTextContent(/Cài đặt tải lên/);
    expect(row).toHaveTextContent(/Tải qua mọi mạng/);
    expect(screen.queryByRole('switch', WIFI_ONLY)).toBeNull();
    await fireEvent.press(row);
    const toggle = await screen.findByRole('switch', WIFI_ONLY);
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('sync-upload-note')).toHaveTextContent(
      /Ứng dụng chỉ tải lên khi đang mở/,
    );
    expect(screen.queryByTestId('sync-note')).toBeNull();
    expect(screen.queryByText('Đang chờ Wi‑Fi.')).toBeNull();

    await act(async () => fireEvent.press(toggle));
    expect(await store.read('upload.wifi_only')).toBe('true');
    expect(screen.getByTestId('sync-upload-settings')).toHaveTextContent(/Chỉ tải khi có Wi‑Fi/);
    expect(await screen.findByTestId('sync-note')).toHaveTextContent(
      'Đang chờ Wi‑Fi. Tệp vẫn ở trên máy, sẽ tải khi máy dùng Wi‑Fi và ứng dụng đang mở.',
    );
    // Tệp còn dở từ lần trước: nhãn "Đang tải lên" giữ nguyên (trạng thái tệp), lý do nói đang chờ.
    expect(screen.getByTestId('sync-job-status-pack:up')).toHaveTextContent(/Đang tải lên/);
    expect(screen.getByTestId('sync-job-status-pack:up')).toHaveTextContent(/Đang chờ Wi‑Fi\./);
    await fireEvent.press(screen.getByText('Chờ tải (1)'));
    const status = await screen.findByTestId('sync-job-status-pack:q');
    expect(status).toHaveTextContent(/Chờ tải lên/);
    expect(status).toHaveTextContent(/Đang chờ Wi‑Fi\./);
  });

  it('đã bật nhưng đang dùng Wi‑Fi: không có lý do chờ Wi‑Fi', async () => {
    const store = createMemoryDeviceSettingsStore();
    await store.write('upload.wifi_only', 'true', 1);
    await open(setup([file('q', 'queued')]), <SyncCenterScreen />, store);
    await fireEvent.press(await screen.findByTestId('sync-upload-settings'));
    await waitFor(() =>
      expect(screen.getByRole('switch', WIFI_ONLY).props.accessibilityState).toMatchObject({
        checked: true,
      }),
    );
    await fireEvent.press(screen.getByText('Chờ tải (1)'));
    expect(await screen.findByTestId('sync-job-status-pack:q')).toHaveTextContent(
      /Đang chờ lượt tải/,
    );
    expect(screen.getByTestId('sync-upload-note')).toHaveTextContent(
      /Ứng dụng chỉ tải lên khi đang mở/,
    );
    expect(screen.queryByTestId('sync-note')).toBeNull();
  });

  it('Thử lại khi đang chờ Wi‑Fi: vẫn đưa vào hàng chờ và nói sẽ tải khi có Wi‑Fi', async () => {
    setMockConnectivity({ online: true, type: 'cellular' });
    const store = createMemoryDeviceSettingsStore();
    await store.write('upload.wifi_only', 'true', 1);
    const t = setup([file('bad', 'upload_failed', { lastErrorCode: 'HTTP_500', attemptCount: 1 })]);
    await open(t, <SyncCenterScreen />, store);
    await fireEvent.press(await screen.findByText('Lỗi (1)'));
    expect(await screen.findByText('Đang chờ Wi‑Fi.')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByTestId('sync-job-retry-pack:bad')));
    expect(
      await screen.findByText('Đã đưa vào hàng chờ. Sẽ tải khi có Wi‑Fi và ứng dụng đang mở.'),
    ).toBeOnTheScreen();
    expect(t.records.get('bad')?.state).toBe('queued');
  });

  it('Đã tải lên khi chờ Wi‑Fi: lý do "Đang chờ Wi‑Fi.", Kiểm tra lại báo kết quả hiện khi có Wi‑Fi (review PR #57)', async () => {
    setMockConnectivity({ online: true, type: 'cellular' });
    const store = createMemoryDeviceSettingsStore();
    await store.write('upload.wifi_only', 'true', 1);
    const t = setup([
      file('old', 'uploaded', { updatedAtDevice: NOW - RECHECK_AFTER_MS - 60_000 }),
    ]);
    await open(t, <SyncCenterScreen />, store);
    const status = await screen.findByTestId('sync-job-status-pack:old');
    await waitFor(() => expect(status).toHaveTextContent(/Đang chờ Wi‑Fi\./));
    expect(status).not.toHaveTextContent(/chưa kiểm tra xong/);
    await act(async () => fireEvent.press(screen.getByTestId('sync-job-recheck-pack:old')));
    await waitFor(() => expect(t.control.requestServerCheck).toHaveBeenCalledWith('old'));
    expect(
      await screen.findByText('Đã nhờ máy chủ kiểm tra lại. Kết quả sẽ hiện khi có Wi‑Fi.'),
    ).toBeOnTheScreen();
    expect(t.records.get('old')?.state).toBe('uploaded');
  });

  it('ghi cài đặt lỗi: báo lỗi, công tắc giữ nguyên', async () => {
    const store: DeviceSettingsStore = {
      read: async () => undefined,
      write: async () => {
        throw new Error('đầy');
      },
    };
    await open(setup([]), <SyncCenterScreen />, store);
    await fireEvent.press(await screen.findByTestId('sync-upload-settings'));
    const toggle = await screen.findByRole('switch', WIFI_ONLY);
    await waitFor(() => expect(toggle.props.accessibilityState).toMatchObject({ disabled: false }));
    await act(async () => fireEvent.press(toggle));
    expect(await screen.findByText('Chưa lưu được cài đặt. Bạn thử lại nhé.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', WIFI_ONLY).props.accessibilityState).toMatchObject({
      checked: false,
    });
  });
});
