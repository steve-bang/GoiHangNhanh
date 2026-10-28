import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';

import type { EvidenceId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import {
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '@/features/orders';
import { mockRecorder, resetMockRecorder } from '@/test-utils/mock-camera-recorder';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackConfirmScreen } from './PackConfirmScreen';
import { PackDoneScreen } from './PackDoneScreen';
import { PackRecordScreen } from './PackRecordScreen';

// Nhánh khi bộ ghi video thật đã bật (RECORDER_ENABLED=true): ghi tệp thật qua CameraRecorder (mock),
// và các màn xác nhận/hoàn tất chỉ nói điều tệp thật của phiên cho phép.
jest.mock('../domain/recorder', () => ({ RECORDER_ENABLED: true }));
jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
jest.mock(
  '@/platform/camera-recorder',
  () => jest.requireActual('@/test-utils/mock-camera-recorder').cameraRecorderMock,
);
let mockFreeBytes: number | null = 10 * 1024 * 1024 * 1024;
const mockPersist = jest.fn();
const mockHash = jest.fn();
jest.mock('@/platform/recording-files', () => ({
  persistRecording: (...args: unknown[]) => mockPersist(...args),
  recordingExists: () => true,
  getAvailableDiskBytes: () => mockFreeBytes,
}));
jest.mock('@/platform/file-hasher', () => ({
  HASH_CHUNK_BYTES: 1,
  hashFile: (...args: unknown[]) => mockHash(...args),
}));

beforeEach(() => {
  mockFreeBytes = 10 * 1024 * 1024 * 1024;
  resetMockNavigation();
  resetMockScanner();
  resetMockRecorder();
  mockPersist.mockReset().mockReturnValue({
    ok: true,
    uri: 'file:///docs/evidence/x.mp4',
    sizeBytes: 4096,
  });
  mockHash.mockReset().mockResolvedValue({ ok: true, sha256: 'cd'.repeat(32), sizeBytes: 4096 });
});

async function setup(ui: React.ReactElement) {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, Date.now());
  await orders.saveSession(session);
  mockNavigation.params = { sessionId: session.id };
  const view = await renderWithProviders(ui, { orderStore: orders, evidenceFileStore: files });
  return { session, files, orders, view };
}

const filesOf = async (
  files: ReturnType<typeof createMemoryEvidenceFileStore>,
  sessionId: string,
) => files.listBySession(LOCAL_SHOP_ID, sessionId as never);

describe('màn quay khi bộ ghi thật bật', () => {
  it('chưa sẵn sàng: "Xem trước", chưa tạo tệp; sẵn sàng: tạo tệp recording rồi "Đang quay"', async () => {
    const { session, files } = await setup(<PackRecordScreen />);
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(await filesOf(files, session.id)).toEqual([]);
    await act(async () => mockRecorder.signalReady());
    expect(await screen.findByText('Đang quay')).toBeOnTheScreen();
    expect(screen.queryByTestId('recording-notice')).toBeNull();
    expect(mockRecorder.recordCalls).toBe(1);
    const [file] = await filesOf(files, session.id);
    expect(file).toMatchObject({ state: 'recording', sessionId: session.id, kind: 'video' });
  });

  it('sẵn sàng hai lần chỉ bắt đầu ghi một lần', async () => {
    await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await act(async () => mockRecorder.signalReady());
    expect(mockRecorder.recordCalls).toBe(1);
  });

  it('dừng quay: lưu bền + băm, tệp vào hàng đợi, rồi sang Xác nhận bằng sessionId', async () => {
    const { session, files } = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(mockRecorder.stopCalls).toBe(1);
    expect(await screen.findByTestId('recording-notice')).toBeOnTheScreen();
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await screen.findByTestId('screen-UI-C03');
    await act(async () => undefined);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    const [file] = await filesOf(files, session.id);
    expect(file).toMatchObject({
      state: 'queued',
      localPath: 'file:///docs/evidence/x.mp4',
      sha256Client: 'cd'.repeat(32),
    });
    expect(mockPersist).toHaveBeenCalledWith('file:///cache/v.mov', file?.id, 'mov');
  });

  it('hết bộ nhớ khi lưu: nói đúng, không sang xác nhận, tệp local_save_failed', async () => {
    mockPersist.mockReturnValue({ ok: false, reason: 'STORAGE_FULL' });
    const { session, files } = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    expect(await screen.findByText(/Máy đã đầy bộ nhớ/)).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalledWith(ROUTES.packConfirm, expect.anything());
    expect((await filesOf(files, session.id))[0]?.state).toBe('local_save_failed');
    expect(screen.queryByText(/đã lưu/i)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Về đơn hàng' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
    });
  });

  it('camera dừng đột ngột: báo video có thể chưa đầy đủ', async () => {
    await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await act(async () => mockRecorder.finish({ ok: false, reason: 'RECORDER_FAILED' }));
    expect(await screen.findByText('Camera dừng đột ngột. Video chưa được lưu.')).toBeOnTheScreen();
  });

  it('A04: dung lượng trống dưới ngưỡng: từ chối bắt đầu với thông báo INSUFFICIENT_STORAGE, chưa tạo tệp/phiên recording, chưa ghi', async () => {
    mockFreeBytes = 10 * 1024 * 1024;
    const { session, files, orders } = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    expect(
      await screen.findByText(/Dung lượng thiết bị không đủ để bắt đầu an toàn/),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(mockRecorder.recordCalls).toBe(0);
    expect(await filesOf(files, session.id)).toEqual([]);
    expect((await orders.getSession(LOCAL_SHOP_ID, session.id))?.sessionStatus).toBe('created');
    await fireEvent.press(screen.getByRole('button', { name: 'Về đơn hàng' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
    });
  });

  it('không đọc được dung lượng trống (null): không chặn quay', async () => {
    mockFreeBytes = null;
    await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    expect(await screen.findByText('Đang quay')).toBeOnTheScreen();
  });

  it('camera không mở được: không treo ở "Đang quay"', async () => {
    await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.mountError());
    expect(await screen.findByText(/Chưa bắt đầu quay được/)).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
  });
});

describe('chỉ phiên created được quay', () => {
  it.each(['recording', 'ended', 'interrupted', 'needs_attention'])(
    'mở lại phiên %s: không bật camera, không tạo tệp, không đổi trạng thái; nói đã quay và có đường về đơn',
    async (status) => {
      const orders = createMemoryOrderStore();
      const files = createMemoryEvidenceFileStore();
      const details = await seedOrder(orders, sampleOrder());
      const session = sampleSession(details, Date.now());
      await orders.saveSession(session);
      await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, status);
      mockNavigation.params = { sessionId: session.id };
      await renderWithProviders(<PackRecordScreen />, {
        orderStore: orders,
        evidenceFileStore: files,
      });
      expect(await screen.findByText(/Phiên này đã quay rồi/)).toBeOnTheScreen();
      expect(mockRecorder.mounted).toBe(false);
      expect(mockRecorder.recordCalls).toBe(0);
      expect(await filesOf(files, session.id)).toEqual([]);
      expect((await orders.getSession(LOCAL_SHOP_ID, session.id))?.sessionStatus).toBe(status);
      await fireEvent.press(screen.getByRole('button', { name: 'Về đơn hàng' }));
      expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
        orderId: session.orderId,
      });
    },
  );
});

describe('rời màn quay (vòng đời bộ ghi)', () => {
  const closeAndEnd = async () => {
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Kết thúc phiên' }));
  };

  it('màn bị gỡ khi đang ghi: vẫn dừng ghi đúng một lần qua tay cầm đã giữ', async () => {
    const { view } = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await act(async () => view.unmount());
    expect(mockRecorder.stopCalls).toBe(1);
  });

  it('màn bị gỡ ngay lúc bắt đầu ghi (trước khi startRecording trả về): dừng ngay, không ghi mãi', async () => {
    let hide: () => void = () => undefined;
    function Host() {
      const [shown, setShown] = useState(true);
      hide = () => setShown(false);
      return shown ? <PackRecordScreen /> : null;
    }
    await setup(<Host />);
    mockRecorder.onRecord = () => hide();
    await act(async () => mockRecorder.signalReady());
    await act(async () => undefined);
    expect(mockRecorder.recordCalls).toBe(1);
    expect(mockRecorder.stopCalls).toBe(1);
  });

  it('hộp thoại ở pha chuẩn bị (chưa bắt đầu ghi): về đơn, không tạo tệp, sau đó camera sẵn sàng cũng không ghi', async () => {
    const { session, files } = await setup(<PackRecordScreen />);
    await screen.findByText('Xem trước');
    await closeAndEnd();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
    });
    await act(async () => mockRecorder.signalReady());
    expect(mockRecorder.recordCalls).toBe(0);
    expect(await filesOf(files, session.id)).toEqual([]);
  });

  it('hộp thoại khi bản ghi đang khởi động: dừng ngay khi bắt đầu xong, rồi lưu và sang xác nhận', async () => {
    const orders = createMemoryOrderStore();
    const base = createMemoryEvidenceFileStore();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const files = {
      ...base,
      create: async (input: Parameters<typeof base.create>[0]) => {
        await gate;
        return base.create(input);
      },
    };
    const details = await seedOrder(orders, sampleOrder());
    const session = sampleSession(details, Date.now());
    await orders.saveSession(session);
    mockNavigation.params = { sessionId: session.id };
    await renderWithProviders(<PackRecordScreen />, {
      orderStore: orders,
      evidenceFileStore: files,
    });
    await act(async () => mockRecorder.signalReady()); // begin chờ files.create
    await closeAndEnd();
    expect(mockRecorder.stopCalls).toBe(0);
    await act(async () => release());
    await act(async () => undefined);
    expect(mockRecorder.recordCalls).toBe(1);
    expect(mockRecorder.stopCalls).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await act(async () => undefined);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
  });

  it('hộp thoại khi đang ghi: dừng và lưu như "Dừng quay"', async () => {
    await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await closeAndEnd();
    expect(mockRecorder.stopCalls).toBe(1);
    expect(await screen.findByTestId('recording-notice')).toBeOnTheScreen();
  });

  it('hộp thoại khi đang lưu: nói việc lưu tiếp tục và về đơn; không dừng lần hai', async () => {
    const { session } = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await screen.findByTestId('recording-notice');
    await fireEvent.press(screen.getByRole('button', { name: 'Rời màn quay' }));
    expect(await screen.findByText(/việc lưu vẫn tiếp tục/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.orderPreview, {
      orderId: session.orderId,
    });
    expect(mockRecorder.stopCalls).toBe(1);
  });
});

describe('Xác nhận / Hoàn tất theo tệp thật của phiên', () => {
  async function withFile(state: 'queued' | 'uploading' | 'local_save_failed' | 'none') {
    const orders = createMemoryOrderStore();
    const files = createMemoryEvidenceFileStore();
    const details = await seedOrder(orders, sampleOrder());
    const session = sampleSession(details, Date.now());
    await orders.saveSession(session);
    if (state !== 'none') {
      const id = 'ev-test' as EvidenceId;
      await files.create({
        id,
        shopId: LOCAL_SHOP_ID,
        orderId: session.orderId,
        packageId: session.packageId,
        sessionId: session.id,
        group: 'pack',
        kind: 'video',
        createdAtDevice: 1,
      });
      const d = (type: string) => ({ type, origin: 'device' }) as never;
      if (state === 'local_save_failed') {
        await files.applyEvent(LOCAL_SHOP_ID, id, d('LOCAL_WRITE_FAILED'), 2);
      } else {
        await files.applyEvent(LOCAL_SHOP_ID, id, d('STOP_RECORDING'), 2);
        await files.applyEvent(LOCAL_SHOP_ID, id, d('LOCAL_FILE_READABLE'), 3, {
          localPath: 'file:///p',
          sizeBytes: 5,
          sha256Client: 'ab'.repeat(32),
        });
        if (state === 'uploading')
          await files.applyEvent(LOCAL_SHOP_ID, id, d('UPLOAD_STARTED'), 4);
      }
    }
    mockNavigation.params = { sessionId: session.id };
    return { orders, files, session };
  }

  it('tệp đã đóng: "Đã lưu trên máy" + câu chờ tải lên; lưu sang Hoàn tất bằng sessionId', async () => {
    const t = await withFile('queued');
    await renderWithProviders(<PackConfirmScreen />, {
      orderStore: t.orders,
      evidenceFileStore: t.files,
    });
    expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(
      screen.getByText('Video đã lưu trên thiết bị. Đang chờ tải lên máy chủ.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Thời lượng/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bằng chứng' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packDone, {
      sessionId: t.session.id,
    });
  });

  it('đang tải lên: nói đang tải, không nói chỉ chờ', async () => {
    const t = await withFile('uploading');
    await renderWithProviders(<PackConfirmScreen />, {
      orderStore: t.orders,
      evidenceFileStore: t.files,
    });
    expect(
      await screen.findByText('Video đã lưu trên thiết bị. Đang tải lên máy chủ.'),
    ).toBeOnTheScreen();
  });

  it('tệp lỗi hoặc chưa có tệp: không nói đã lưu', async () => {
    for (const [state, text] of [
      ['local_save_failed', /Chưa lưu được video của phiên này/],
      ['none', /chưa có video nào được lưu/],
    ] as const) {
      const t = await withFile(state);
      const view = await renderWithProviders(<PackConfirmScreen />, {
        orderStore: t.orders,
        evidenceFileStore: t.files,
      });
      expect(await screen.findByText(text)).toBeOnTheScreen();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
      await view.unmount();
    }
  });

  it('Hoàn tất: số video thật và câu chờ đồng bộ; không có tệp thì không báo hoàn tất', async () => {
    const ok = await withFile('queued');
    const view = await renderWithProviders(<PackDoneScreen />, {
      orderStore: ok.orders,
      evidenceFileStore: ok.files,
    });
    expect(
      await screen.findByText(/Video đã lưu trên thiết bị, đang chờ đồng bộ/),
    ).toBeOnTheScreen();
    expect(screen.getByText('Số video: 1')).toBeOnTheScreen();
    await view.unmount();
    const none = await withFile('none');
    await renderWithProviders(<PackDoneScreen />, {
      orderStore: none.orders,
      evidenceFileStore: none.files,
    });
    expect(await screen.findByText(/chưa có video nào được lưu/)).toBeOnTheScreen();
    expect(screen.queryByText(/đã hoàn tất/i)).toBeNull();
  });
});
