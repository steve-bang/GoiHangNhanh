import { screen } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { CurrentShopProvider, createMemoryOrderStore, LOCAL_SHOP_ID } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import type { ReturnStore } from '../domain';
import { ReturnDoneScreen } from './ReturnDoneScreen';
import { ReturnReviewScreen } from './ReturnReviewScreen';
import { ReturnsListScreen } from './ReturnsListScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
beforeEach(() => resetMockNavigation());

const SHOP = LOCAL_SHOP_ID;
const SHA = 'ef'.repeat(32);
const dev = (type: string) => ({ type, origin: 'device' }) as never;
const srv = (type: string) => ({ type, origin: 'server' }) as never;

/** Hồ sơ đã tới `checking` với video quay xong ở trạng thái `upTo`. */
async function seedWithVideo(
  store: ReturnStore,
  options: {
    upTo?: 'queued' | 'uploading' | 'uploaded' | 'verified';
    interrupted?: boolean;
    openedBefore?: boolean;
    confirm?: boolean;
  } = {},
): Promise<ReturnCaseId> {
  const id = `ret-${Math.random().toString(36).slice(2)}` as ReturnCaseId;
  await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: 1_000,
    eventId: `e-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  await store.saveExterior(SHOP, id, {
    exterior: { signs: ['dented'], note: '', recordedAtDevice: 2_000 },
    openedBefore: options.openedBefore ? { reason: 'mở sẵn', markedAtDevice: 2_000 } : null,
    eventId: `x-${id}`,
    openedEventId: `y-${id}`,
  });
  const mediaId = `v-${id}`;
  await store.createMedia({ id: mediaId, shopId: SHOP, returnId: id, kind: 'video', atDevice: 5 });
  await store.applyMediaEvent(SHOP, mediaId, dev('STOP_RECORDING'), 6, { localPath: 'tmp.mov' });
  await store.applyMediaEvent(SHOP, mediaId, dev('LOCAL_FILE_READABLE'), 7, {
    localPath: `evidence/${mediaId}.mov`,
    sizeBytes: 10,
    sha256Client: SHA,
  });
  const upTo = options.upTo ?? 'queued';
  if (upTo !== 'queued') await store.applyMediaEvent(SHOP, mediaId, dev('UPLOAD_STARTED'), 8);
  if (upTo === 'uploaded' || upTo === 'verified') {
    await store.applyMediaEvent(SHOP, mediaId, srv('SERVER_RECEIVED'), 9);
  }
  if (upTo === 'verified') await store.applyMediaEvent(SHOP, mediaId, srv('SERVER_VERIFIED'), 10);
  await store.saveOpeningVideoRecorded(SHOP, id, {
    mediaId,
    interrupted: options.interrupted ?? false,
    atDevice: 3_000,
    eventId: `v-${id}`,
  });
  await store.saveLines(SHOP, id, {
    lines: [
      {
        id: `l-${id}`,
        name: 'Áo',
        variant: null,
        receivedQuantity: 1,
        condition: 'normal',
        note: '',
        expected: null,
      },
    ],
    discrepancies: [],
    atDevice: 4_000,
    eventId: `s-${id}`,
  });
  if (options.confirm) {
    await store.confirmReturn(SHOP, id, { finalNote: '', atDevice: 5_000, eventId: `c-${id}` });
  }
  return id;
}

async function openD06(store: ReturnStore, id: ReturnCaseId, signedInAs?: string) {
  mockNavigation.params = { returnId: id };
  // `signedInAs`: tài khoản đang đăng nhập (V1-07); không truyền = như phiên của bộ render test.
  const ui = signedInAs ? (
    <CurrentShopProvider shopId={SHOP} uid={signedInAs}>
      <ReturnReviewScreen />
    </CurrentShopProvider>
  ) : (
    <ReturnReviewScreen />
  );
  await renderWithProviders(ui, {
    returnStore: store,
    orderStore: createMemoryOrderStore(),
  });
  await screen.findByTestId('return-summary-video');
}

describe('D06/D07: video mở kiện đã quay', () => {
  it('video vừa quay: "Đã quay", nhãn "Đã lưu trên máy" (chưa tải), KHÔNG còn hạn chế "Chưa có video"', async () => {
    const store = createMemoryReturnStore();
    const id = await seedWithVideo(store);
    await openD06(store, id);
    expect(await screen.findByTestId('return-video-recorded')).toHaveTextContent(
      'Đã quay video mở kiện.',
    );
    expect(await screen.findByTestId('return-video-status')).toHaveTextContent(/Đã lưu trên máy/);
    expect(screen.queryByText('Chưa có video mở kiện.')).toBeNull();
    expect(screen.queryByTestId('return-video-opened-before')).toBeNull();
  });

  it.each([
    ['uploading', /Đang tải lên/],
    ['uploaded', /Đã tải lên/],
    ['verified', /Đã xác minh/],
  ] as const)('nhãn video theo trạng thái tệp thật: %s', async (upTo, pattern) => {
    const store = createMemoryReturnStore();
    const id = await seedWithVideo(store, { upTo });
    await openD06(store, id);
    expect(await screen.findByTestId('return-video-status')).toHaveTextContent(pattern);
  });

  it('V1-07: video do tài khoản khác quay trên máy này: "Chờ tải lên" + lý do, không "Đang tải lên"', async () => {
    const store = createMemoryReturnStore({ creatorUid: () => 'u-2' });
    const id = await seedWithVideo(store, { upTo: 'uploading' });
    await openD06(store, id, 'u-1');
    expect(await screen.findByTestId('return-video-status')).toHaveTextContent(/Chờ tải lên/);
    expect(screen.getByTestId('return-video-uploader-note')).toHaveTextContent(
      'Tệp do tài khoản khác tạo trên máy này. Chỉ tài khoản đó đăng nhập lại mới tải lên được.',
    );
    expect(screen.queryByText(/Đang tải lên/)).toBeNull();
  });

  it('V1-07: video do chính tài khoản đang đăng nhập quay: nhãn như cũ, không có câu tài khoản khác', async () => {
    const store = createMemoryReturnStore({ creatorUid: () => 'u-1' });
    const id = await seedWithVideo(store);
    await openD06(store, id, 'u-1');
    expect(await screen.findByTestId('return-video-status')).toHaveTextContent(/Đã lưu trên máy/);
    expect(screen.queryByTestId('return-video-uploader-note')).toBeNull();
  });

  it('V1-07: video của mình trong hồ sơ CHƯA gửi do người khác tạo: "Chờ tải lên" + chờ người tạo hồ sơ', async () => {
    let creator = 'u-2';
    const store = createMemoryReturnStore({ creatorUid: () => creator });
    const original = store.createReturn.bind(store);
    store.createReturn = async (input) => {
      creator = 'u-2';
      const made = await original(input);
      creator = 'u-1';
      return made;
    };
    const id = await seedWithVideo(store);
    await openD06(store, id, 'u-1');
    expect(await screen.findByTestId('return-video-status')).toHaveTextContent(/Chờ tải lên/);
    expect(screen.getByTestId('return-video-uploader-note')).toHaveTextContent(
      'Tệp chỉ tải lên được sau khi người tạo hồ sơ này đăng nhập lại trên máy.',
    );
  });

  it('video bị gián đoạn: nói rõ chưa phải video đầy đủ và vẫn nêu hạn chế bằng chứng', async () => {
    const store = createMemoryReturnStore();
    const id = await seedWithVideo(store, { interrupted: true });
    await openD06(store, id);
    expect(await screen.findByTestId('return-video-recorded')).toHaveTextContent(/bị gián đoạn/);
    expect(
      await screen.findByText('Video mở kiện bị gián đoạn, chỉ giữ được phần đã lưu.'),
    ).toBeOnTheScreen();
  });

  it('kiện đã mở trước khi quay: video chỉ ghi tình trạng hiện tại, hạn chế "mở trước" VẪN còn', async () => {
    const store = createMemoryReturnStore();
    const id = await seedWithVideo(store, { openedBefore: true });
    await openD06(store, id);
    expect(await screen.findByTestId('return-video-opened-before')).toHaveTextContent(
      /không phải quá trình mở/,
    );
    expect(
      await screen.findByText(/Kiện đã mở trước khi quay: thiếu bằng chứng quá trình mở ban đầu/),
    ).toBeOnTheScreen();
  });

  it('D07 và danh sách: video đầy đủ không có nhãn "Hạn chế bằng chứng"; mở trước hoặc gián đoạn thì có', async () => {
    const store = createMemoryReturnStore();
    const clean = await seedWithVideo(store, { confirm: true });
    const opened = await seedWithVideo(store, { confirm: true, openedBefore: true });
    const broken = await seedWithVideo(store, { confirm: true, interrupted: true });
    await renderWithProviders(<ReturnsListScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    await screen.findByTestId(`return-row-${clean}`);
    expect(screen.queryByTestId(`return-limited-${clean}`)).toBeNull();
    expect(screen.getByTestId(`return-limited-${opened}`)).toBeOnTheScreen();
    expect(screen.getByTestId(`return-limited-${broken}`)).toBeOnTheScreen();
  });

  it('D07 hồ sơ đã xác nhận có video đầy đủ: không có nhãn hạn chế ở banner', async () => {
    const store = createMemoryReturnStore();
    const id = await seedWithVideo(store, { confirm: true });
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnDoneScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    await screen.findByTestId('return-done-banner');
    expect(screen.queryByTestId('return-done-limited')).toBeNull();
    expect(await screen.findByTestId('return-video-recorded')).toBeOnTheScreen();
  });
});
