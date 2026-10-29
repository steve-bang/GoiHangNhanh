import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { ReturnCaseId } from '@/core/ids';
import { createMemoryOrderStore, LOCAL_SHOP_ID } from '@/features/orders';
import { mockPhoto, resetMockPhoto } from '@/test-utils/mock-camera-photo';
import { mockLocation, resetMockLocation } from '@/test-utils/mock-location';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryReturnStore } from '../data';
import { MAX_RETURN_PHOTOS, type ReturnStore } from '../domain';
import { ReturnExteriorScreen } from './ReturnExteriorScreen';
import { ReturnReviewScreen } from './ReturnReviewScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/camera-photo',
  () => jest.requireActual('@/test-utils/mock-camera-photo').cameraPhotoMock,
);
const mockPersist = jest.fn();
const mockHash = jest.fn();
jest.mock('@/platform/recording-files', () => ({
  persistRecording: (...args: unknown[]) => mockPersist(...args),
  resolveRecordingUri: (stored: string) => `file:///docs/${stored}`,
  recordingExists: () => true,
  getAvailableDiskBytes: () => null,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

const SHOP = LOCAL_SHOP_ID;
const SHA = 'f'.repeat(64);

beforeEach(() => {
  resetMockNavigation();
  resetMockPhoto();
  resetMockLocation();
  mockPersist.mockReset();
  mockHash.mockReset();
  mockPersist.mockImplementation((_temp: string, id: string, ext: string) => ({
    ok: true,
    uri: `evidence/${id}.${ext}`,
    sizeBytes: 4096,
  }));
  mockHash.mockResolvedValue({ ok: true, sha256: SHA, sizeBytes: 4096 });
});

async function seedReturn(store: ReturnStore): Promise<ReturnCaseId> {
  const id = 'ret-photo' as ReturnCaseId;
  await store.createReturn({
    id,
    shopId: SHOP,
    atDevice: 1_000,
    eventId: 'ev-1',
    observedCode: null,
    link: null,
    lines: [],
  });
  return id;
}

async function openD03(store: ReturnStore, id: ReturnCaseId) {
  mockNavigation.params = { returnId: id };
  await renderWithProviders(<ReturnExteriorScreen />, { returnStore: store });
  await screen.findByTestId('return-photos');
}

async function takePhoto() {
  await fireEvent.press(screen.getByTestId('return-photo-capture'));
  await screen.findByTestId('return-photo-camera');
  await act(async () => mockPhoto.signalReady());
  await fireEvent.press(screen.getByTestId('return-photo-shutter'));
}

describe('UI-D03 Ảnh kiện hàng', () => {
  it('chụp ảnh: lưu bền, hiện "Đã lưu trên máy" và KHÔNG hiện trạng thái tải lên', async () => {
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await takePhoto();
    expect(await screen.findByTestId('return-photo-saved')).toBeOnTheScreen();
    const [media] = await store.listMedia(SHOP, id);
    expect(media).toMatchObject({
      state: 'queued',
      localPath: `evidence/${media?.id}.jpg`,
      sha256Client: SHA,
    });
    expect(mockPersist).toHaveBeenCalledWith('file:///cache/Camera/photo.jpg', media?.id, 'jpg');
    expect(await screen.findByTestId(`return-photo-status-${media?.id}`)).toHaveTextContent(
      /Đã lưu trên máy/,
    );
    expect(screen.getByTestId(`return-photo-thumb-${media?.id}`).props.source).toEqual({
      uri: `file:///docs/evidence/${media?.id}.jpg`,
    });
    expect(screen.getByTestId('return-photos-count')).toHaveTextContent(
      `1/${MAX_RETURN_PHOTOS} ảnh`,
    );
    expect(screen.queryByText(/Đang tải lên|Đã tải lên|Chờ tải lên/)).toBeNull();
  });

  describe('vị trí (Q-26k)', () => {
    it('mở camera thì xin quyền vị trí; ghi chú nói rõ đây là số đọc của máy', async () => {
      const store = createMemoryReturnStore();
      const id = await seedReturn(store);
      await openD03(store, id);
      expect(screen.getByTestId('return-photos-location-note')).toHaveTextContent(
        /không chứng minh nơi chụp/,
      );
      await fireEvent.press(screen.getByTestId('return-photo-capture'));
      await screen.findByTestId('return-photo-camera');
      await waitFor(() => expect(mockLocation.requestCalls).toBe(1));
    });

    it('có vị trí: hiện "Có vị trí (±N m)", KHÔNG hiện tọa độ và không nói "xác thực"', async () => {
      const store = createMemoryReturnStore();
      const id = await seedReturn(store);
      await openD03(store, id);
      await takePhoto();
      const [media] = await waitFor(async () => {
        const list = await store.listMedia(SHOP, id);
        expect(list[0]?.location?.status).toBe('ok');
        return list;
      });
      const line = await screen.findByTestId(`return-photo-location-${media?.id}`);
      expect(line).toHaveTextContent('Có vị trí (±12 m)');
      expect(screen.queryByText(/10\.77|106\.7/)).toBeNull();
      expect(screen.queryByText(/xác thực/i)).toBeNull();
    });

    it.each([
      ['denied', /Không có vị trí: chưa cho phép vị trí/],
      ['off', /Không có vị trí: vị trí của máy đang tắt/],
      ['timeout', /Không có vị trí: chưa có tín hiệu kịp lúc/],
      ['unavailable', /Không có vị trí: máy không đọc được/],
    ] as const)('vị trí %s: vẫn chụp và lưu được, ghi rõ lý do', async (status, text) => {
      mockLocation.nextResult = { ok: false, status };
      const store = createMemoryReturnStore();
      const id = await seedReturn(store);
      await openD03(store, id);
      await takePhoto();
      expect(await screen.findByTestId('return-photo-saved')).toBeOnTheScreen();
      const [media] = await store.listMedia(SHOP, id);
      expect(media?.state).toBe('queued');
      expect(await screen.findByTestId(`return-photo-location-${media?.id}`)).toHaveTextContent(
        text,
      );
    });
  });

  it('không có nút xóa ảnh', async () => {
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await takePhoto();
    await screen.findByTestId('return-photo-saved');
    expect(screen.queryByRole('button', { name: /xóa/i })).toBeNull();
  });

  it('chưa cấp quyền camera: hỏi quyền, không mở camera, không chụp', async () => {
    mockPhoto.permission = 'askable';
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await fireEvent.press(screen.getByTestId('return-photo-capture'));
    expect(await screen.findByTestId('return-photo-permission')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-photo-camera')).toBeNull();
    await fireEvent.press(screen.getByTestId('return-photo-allow'));
    expect(mockPhoto.requestCalls).toBe(1);
    expect(await store.listMedia(SHOP, id)).toEqual([]);
  });

  it('quyền bị chặn hẳn: chỉ lối mở Cài đặt', async () => {
    mockPhoto.permission = 'blocked';
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await fireEvent.press(screen.getByTestId('return-photo-capture'));
    expect(await screen.findByTestId('return-photo-open-settings')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-photo-allow')).toBeNull();
  });

  it('camera không mở được: báo ngắn, không chụp được', async () => {
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await fireEvent.press(screen.getByTestId('return-photo-capture'));
    await screen.findByTestId('return-photo-camera');
    await act(async () => mockPhoto.mountError());
    expect(await screen.findByTestId('return-photo-error')).toHaveTextContent(
      /Chưa mở được camera/,
    );
    expect(mockPhoto.captureCalls).toBe(0);
  });

  it('hết dung lượng: báo rõ, ảnh lỗi không tính là đã lưu và không nói "đã lưu"', async () => {
    mockPersist.mockReturnValue({ ok: false, reason: 'STORAGE_FULL' });
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await takePhoto();
    expect(await screen.findByTestId('return-photo-error')).toHaveTextContent(/Máy hết dung lượng/);
    expect(screen.queryByTestId('return-photo-saved')).toBeNull();
    const [media] = await store.listMedia(SHOP, id);
    expect(media?.state).toBe('local_save_failed');
    expect(screen.getByTestId('return-photos-count')).toHaveTextContent(
      `0/${MAX_RETURN_PHOTOS} ảnh`,
    );
  });

  it('chụp lỗi: báo thử lại, bản ghi lỗi', async () => {
    mockPhoto.nextResult = { ok: false, reason: 'PHOTO_FAILED' };
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    await takePhoto();
    expect(await screen.findByTestId('return-photo-error')).toHaveTextContent(
      /Chưa lưu được ảnh này/,
    );
    await waitFor(async () =>
      expect((await store.listMedia(SHOP, id))[0]?.state).toBe('local_save_failed'),
    );
  });

  it('đủ giới hạn ảnh: không còn nút chụp, nói rõ không xóa được', async () => {
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    for (let i = 0; i < MAX_RETURN_PHOTOS; i += 1) {
      const mediaId = `m-${i}`;
      await store.createMedia({
        id: mediaId,
        shopId: SHOP,
        returnId: id,
        kind: 'photo',
        atDevice: i,
      });
      await store.applyMediaEvent(SHOP, mediaId, { type: 'STOP_RECORDING', origin: 'device' }, i, {
        localPath: 'tmp.jpg',
      });
      await store.applyMediaEvent(
        SHOP,
        mediaId,
        { type: 'LOCAL_FILE_READABLE', origin: 'device' },
        i,
        {
          localPath: `evidence/${mediaId}.jpg`,
          sizeBytes: 10,
          sha256Client: SHA,
        },
      );
    }
    await openD03(store, id);
    expect(await screen.findByTestId('return-photos-full')).toBeOnTheScreen();
    expect(screen.queryByTestId('return-photo-capture')).toBeNull();
  });

  it('có dấu hiệu hư hỏng: nhắc nên chụp ảnh (vẫn tùy chọn, không chặn Tiếp tục)', async () => {
    const store = createMemoryReturnStore();
    const id = await seedReturn(store);
    await openD03(store, id);
    expect(screen.queryByTestId('return-photos-damage-hint')).toBeNull();
    await fireEvent.press(screen.getByTestId('return-sign-dented'));
    expect(screen.getByTestId('return-photos-damage-hint')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('return-exterior-continue'));
    await waitFor(async () =>
      expect((await store.getReturn(SHOP, id))?.returnCase.exterior?.signs).toEqual(['dented']),
    );
  });
});

describe('UI-D06 hạn chế ảnh ngoài khi đã/chưa chụp', () => {
  const seedChecking = async (store: ReturnStore) => {
    const id = await seedReturn(store);
    await store.saveExterior(SHOP, id, {
      exterior: { signs: ['dented'], note: '', recordedAtDevice: 2_000 },
      openedBefore: null,
      eventId: 'ev-2',
      openedEventId: 'ev-3',
    });
    await store.saveOpeningVideoMissing(SHOP, id, {
      reason: 'recorder_unavailable',
      atDevice: 3_000,
      eventId: 'ev-4',
    });
    await store.saveLines(SHOP, id, {
      lines: [
        {
          id: 'l1',
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
      eventId: 'ev-5',
    });
    return id;
  };
  const openD06 = async (store: ReturnStore, id: ReturnCaseId) => {
    mockNavigation.params = { returnId: id };
    await renderWithProviders(<ReturnReviewScreen />, {
      returnStore: store,
      orderStore: createMemoryOrderStore(),
    });
    await screen.findByTestId('return-summary-limits');
  };

  it('chưa có ảnh: nêu "Chưa có ảnh bên ngoài kiện."', async () => {
    const store = createMemoryReturnStore();
    const id = await seedChecking(store);
    await openD06(store, id);
    expect(await screen.findByText('Chưa có ảnh bên ngoài kiện.')).toBeOnTheScreen();
  });

  it('đã có ảnh lưu trên máy: bỏ hạn chế ảnh, ghi rõ mới lưu trên máy này', async () => {
    const store = createMemoryReturnStore();
    const id = await seedChecking(store);
    await store.createMedia({ id: 'm1', shopId: SHOP, returnId: id, kind: 'photo', atDevice: 5 });
    await store.applyMediaEvent(SHOP, 'm1', { type: 'STOP_RECORDING', origin: 'device' }, 6, {
      localPath: 'tmp.jpg',
    });
    await store.applyMediaEvent(SHOP, 'm1', { type: 'LOCAL_FILE_READABLE', origin: 'device' }, 7, {
      localPath: 'evidence/m1.jpg',
      sizeBytes: 10,
      sha256Client: SHA,
    });
    await openD06(store, id);
    expect(await screen.findByTestId('return-summary-photos')).toHaveTextContent(
      /mới lưu trên máy này/,
    );
    expect(screen.queryByText('Chưa có ảnh bên ngoài kiện.')).toBeNull();
  });
});
