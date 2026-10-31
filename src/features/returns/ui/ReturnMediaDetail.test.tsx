import { fireEvent, screen } from '@testing-library/react-native';

import type { ReturnCaseId, ShopId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore, LOCAL_SHOP_ID } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { mockVideoPlayer, resetMockVideoPlayer } from '@/test-utils/mock-video-player';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import type { ReturnStore } from '../domain';
import { ReturnDoneScreen } from './ReturnDoneScreen';
import { ReturnExteriorScreen } from './ReturnExteriorScreen';
import { ReturnMediaDetailScreen } from './ReturnMediaDetail';
import { ReturnReviewScreen } from './ReturnReviewScreen';

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
  getAvailableDiskBytes: () => null,
}));

const SHOP = LOCAL_SHOP_ID;
const SHA = 'ab'.repeat(32);
const AT = new Date(2026, 9, 28, 14, 5).getTime();
const dev = (type: string) => ({ type, origin: 'device' }) as never;

beforeEach(() => {
  resetMockNavigation();
  resetMockVideoPlayer();
  mockExisting.clear();
  mockFileOps.deleteRecording.mockClear();
  mockFileOps.persistRecording.mockClear();
});

interface SeedOptions {
  shopId?: ShopId;
  id?: string;
  openedBefore?: boolean;
  /** Đi tới D06 (checking, có video) và tùy chọn xác nhận (D07). */
  stage?: 'exterior' | 'checking' | 'confirmed';
  /** Ảnh dừng ở `saving_local` (chưa đóng tệp). */
  photoSaving?: boolean;
}

/** Hồ sơ hoàn + một ảnh kiện (có vị trí) + (từ `checking`) một video mở kiện. */
async function seed(store: ReturnStore, options: SeedOptions = {}) {
  const shopId = options.shopId ?? SHOP;
  const id = (options.id ?? 'ret-1') as ReturnCaseId;
  await store.createReturn({
    id,
    shopId,
    atDevice: AT,
    eventId: `e-${id}`,
    observedCode: null,
    link: null,
    lines: [],
  });
  await store.saveExterior(shopId, id, {
    exterior: { signs: ['dented'], note: '', recordedAtDevice: AT },
    openedBefore: options.openedBefore ? { reason: 'mở sẵn', markedAtDevice: AT } : null,
    eventId: `x-${id}`,
    openedEventId: `y-${id}`,
  });
  const photoId = `p-${id}`;
  const photoPath = `evidence/${photoId}.jpg`;
  await store.createMedia({ id: photoId, shopId, returnId: id, kind: 'photo', atDevice: AT });
  await store.applyMediaEvent(shopId, photoId, dev('STOP_RECORDING'), AT, {
    localPath: 'tmp.jpg',
  });
  if (!options.photoSaving) {
    await store.applyMediaEvent(shopId, photoId, dev('LOCAL_FILE_READABLE'), AT, {
      localPath: photoPath,
      sizeBytes: 2048,
      sha256Client: SHA,
    });
    await store.setMediaLocation(shopId, photoId, {
      status: 'ok',
      lat: 10.762622,
      lng: 106.660172,
      accuracyM: 12,
      atDevice: AT,
    });
  }
  const videoId = `v-${id}`;
  const videoPath = `evidence/${videoId}.mov`;
  const stage = options.stage ?? 'exterior';
  if (stage !== 'exterior') {
    await store.createMedia({ id: videoId, shopId, returnId: id, kind: 'video', atDevice: AT });
    await store.applyMediaEvent(shopId, videoId, dev('STOP_RECORDING'), AT, {
      localPath: 'tmp.mov',
    });
    await store.applyMediaEvent(shopId, videoId, dev('LOCAL_FILE_READABLE'), AT, {
      localPath: videoPath,
      sizeBytes: 4096,
      sha256Client: SHA,
    });
    await store.saveOpeningVideoRecorded(shopId, id, {
      mediaId: videoId,
      interrupted: false,
      atDevice: AT,
      eventId: `v-${id}`,
    });
    await store.saveLines(shopId, id, {
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
      atDevice: AT,
      eventId: `s-${id}`,
    });
  }
  if (stage === 'confirmed') {
    await store.confirmReturn(shopId, id, { finalNote: '', atDevice: AT, eventId: `c-${id}` });
  }
  return { id, photoId, photoPath, videoId, videoPath };
}

async function openDetail(store: ReturnStore, params: { returnId?: string; mediaId?: string }) {
  mockNavigation.params = params;
  await renderWithProviders(<ReturnMediaDetailScreen />, {
    returnStore: store,
    orderStore: createMemoryOrderStore(),
  });
}

describe('V1-17b: chi tiết ảnh/video hàng hoàn (UI-E04)', () => {
  it('ảnh đã lưu: hiện ảnh từ tệp trên máy, loại, hồ sơ, giờ thiết bị, mã băm; KHÔNG hiện vị trí', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId, photoPath } = await seed(store);
    mockExisting.add(photoPath);
    await openDetail(store, { returnId: id, mediaId: photoId });
    const photo = await screen.findByTestId('evidence-photo');
    expect(photo.props.source).toEqual({ uri: `file:///docs/${photoPath}` });
    expect(screen.getByTestId('screen-UI-E04-mediaId')).toBeOnTheScreen();
    expect(screen.getAllByText('Chi tiết bằng chứng').length).toBeGreaterThan(0);
    expect(screen.getByText('Ảnh kiện hàng hoàn')).toBeOnTheScreen();
    expect(screen.getByText('28/10/2026 14:05')).toBeOnTheScreen();
    expect(screen.getByTestId('evidence-detail-return')).toHaveTextContent(/Hồ sơ hàng hoàn/);
    expect(screen.getByTestId('evidence-detail-order')).toHaveTextContent(/Chưa liên kết/);
    expect(screen.getByTestId('evidence-detail-badge')).toHaveTextContent(/Đã lưu trên máy/);
    expect(screen.getByText(/Mã băm chỉ chứng minh tệp không đổi/)).toBeOnTheScreen();
    // Q-26k: không tọa độ, không độ chính xác, không chữ "vị trí".
    expect(screen.queryByText(/10[.,]76|106[.,]66|12 m|[Vv]ị trí/)).toBeNull();
    expect(screen.queryByTestId('evidence-detail-duration')).toBeNull();
    expect(screen.queryByTestId('return-media-limited')).toBeNull();
  });

  it('chỉ đọc: chỉ có nút Quay lại, không xóa/sửa/cắt/chia sẻ (kể cả ảnh còn xóa được ở D03)', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId, photoPath } = await seed(store);
    mockExisting.add(photoPath);
    await openDetail(store, { returnId: id, mediaId: photoId });
    await screen.findByTestId('evidence-photo');
    expect(screen.queryAllByRole('button')).toHaveLength(1);
    expect(screen.queryByText(/Xóa ảnh|Sửa|Cắt|Ghi đè|Chia sẻ/)).toBeNull();
  });

  it('video mở kiện: trình phát đúng loại, không tự phát hay cache (adapter V1-17)', async () => {
    const store = createMemoryReturnStore();
    const { id, videoId, videoPath } = await seed(store, { stage: 'checking' });
    mockExisting.add(videoPath);
    await openDetail(store, { returnId: id, mediaId: videoId });
    expect(await screen.findByTestId('evidence-video-player')).toBeOnTheScreen();
    expect(mockVideoPlayer.uri).toBe(`file:///docs/${videoPath}`);
    expect(screen.getByText('Video mở kiện hàng hoàn')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-photo')).toBeNull();
  });

  it.each(['photo', 'video'] as const)(
    'kiện mở trước khi quay: %s mang nhãn "Hạn chế bằng chứng" kèm lý do',
    async (kind) => {
      const store = createMemoryReturnStore();
      const seeded = await seed(store, { openedBefore: true, stage: 'checking' });
      mockExisting.add(seeded.photoPath);
      mockExisting.add(seeded.videoPath);
      await openDetail(store, {
        returnId: seeded.id,
        mediaId: kind === 'photo' ? seeded.photoId : seeded.videoId,
      });
      const card = await screen.findByTestId('return-media-limited');
      expect(card).toHaveTextContent(/Hạn chế bằng chứng/);
      expect(card).toHaveTextContent(/mở trước/i);
    },
  );

  it('ảnh đang lưu (saving_local): không mở tệp chưa đóng', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId } = await seed(store, { photoSaving: true });
    mockExisting.add('tmp.jpg');
    await openDetail(store, { returnId: id, mediaId: photoId });
    expect(await screen.findByText('Ảnh đang được lưu.')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-photo')).toBeNull();
  });

  it('tệp không còn trên máy (máy chủ chưa có bản): nói thẳng, không hiện nhãn "Đã lưu trên máy"', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId } = await seed(store);
    await openDetail(store, { returnId: id, mediaId: photoId });
    expect(await screen.findByText('Ảnh không còn trên máy này.')).toBeOnTheScreen();
    expect(
      screen.getByText('Tệp không còn trên máy này và máy chủ chưa xác nhận có bản.'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-detail-badge')).toBeNull();
    expect(mockFileOps.deleteRecording).not.toHaveBeenCalled();
  });

  it('media của hồ sơ khác hồ sơ trên đường dẫn: không tìm thấy', async () => {
    const store = createMemoryReturnStore();
    const a = await seed(store, { id: 'ret-a' });
    const b = await seed(store, { id: 'ret-b' });
    mockExisting.add(a.photoPath);
    await openDetail(store, { returnId: b.id, mediaId: a.photoId });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
    expect(screen.getByText('Không tìm thấy bằng chứng này.')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-photo')).toBeNull();
  });

  it('hồ sơ của shop khác (đoán ID): không tìm thấy', async () => {
    const store = createMemoryReturnStore();
    const other = await seed(store, { shopId: 'shop-khac' as ShopId });
    mockExisting.add(other.photoPath);
    await openDetail(store, { returnId: other.id, mediaId: other.photoId });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
    expect(screen.queryByTestId('evidence-photo')).toBeNull();
  });

  it.each([
    ['ID lạ', 'khong-co'],
    ['thiếu mediaId', undefined],
  ])('%s: không tìm thấy', async (_label, mediaId) => {
    const store = createMemoryReturnStore();
    const { id } = await seed(store);
    await openDetail(store, mediaId ? { returnId: id, mediaId } : { returnId: id });
    expect(await screen.findByTestId('evidence-detail-not-found')).toBeOnTheScreen();
  });
});

describe('V1-17b: lối vào từ D03, D06, D07', () => {
  it('D03: ảnh đã lưu có "Xem ảnh" mở đúng route; nút Xóa vẫn còn', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId } = await seed(store);
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnExteriorScreen />, { returnStore: store });
    await fireEvent.press(await screen.findByTestId(`return-photo-open-${photoId}`));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.returnMediaDetail, {
      returnId: id,
      mediaId: photoId,
    });
    expect(screen.getByTestId(`return-photo-delete-${photoId}`)).toBeOnTheScreen();
  });

  it('D03: ảnh chưa lưu xong không có "Xem ảnh"', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId } = await seed(store, { photoSaving: true });
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnExteriorScreen />, { returnStore: store });
    await screen.findByTestId(`return-photo-${photoId}`);
    expect(screen.queryByTestId(`return-photo-open-${photoId}`)).toBeNull();
  });

  it('D06: hàng ảnh và video mở đúng route', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId, videoId } = await seed(store, { stage: 'checking' });
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnReviewScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    await fireEvent.press(await screen.findByTestId(`return-summary-open-photo-${photoId}`));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnMediaDetail, {
      returnId: id,
      mediaId: photoId,
    });
    await fireEvent.press(await screen.findByTestId('return-summary-open-video'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnMediaDetail, {
      returnId: id,
      mediaId: videoId,
    });
  });

  it('D07: hồ sơ đã xác nhận, hàng "Xem ảnh 1" và "Xem video mở kiện" mở đúng route', async () => {
    const store = createMemoryReturnStore();
    const { id, photoId, videoId } = await seed(store, { stage: 'confirmed' });
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnDoneScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    const photoRow = await screen.findByTestId(`return-summary-open-photo-${photoId}`);
    expect(photoRow).toHaveTextContent(/Xem ảnh 1/);
    await fireEvent.press(photoRow);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnMediaDetail, {
      returnId: id,
      mediaId: photoId,
    });
    await fireEvent.press(screen.getByTestId('return-summary-open-video'));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.returnMediaDetail, {
      returnId: id,
      mediaId: videoId,
    });
  });
});
