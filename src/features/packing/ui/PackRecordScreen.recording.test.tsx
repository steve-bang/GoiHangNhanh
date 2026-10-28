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
    expect(await screen.findByText(/Máy cần đủ chỗ cho 10 phút quay/)).toBeOnTheScreen();
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
      // Theo bảng chuyển hợp lệ: created -> recording -> (ended | interrupted | needs_attention).
      await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, 'recording');
      if (status !== 'recording')
        await orders.updateSessionStatus(LOCAL_SHOP_ID, session.id, status);
      mockNavigation.params = { sessionId: session.id };
      await renderWithProviders(<PackRecordScreen />, {
        orderStore: orders,
        evidenceFileStore: files,
      });
      expect(await screen.findByText(/Phiên này không quay thêm được/)).toBeOnTheScreen();
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

describe('giới hạn quay tối đa 10 phút (O-05)', () => {
  // Chỉ giả lập đồng hồ (setInterval + Date + performance) để nhảy qua 10 phút; các hẹn giờ khác và microtask vẫn thật
  // để React/RNTL chạy bình thường.
  beforeEach(() =>
    jest.useFakeTimers({
      now: Date.now(),
      doNotFake: [
        'setTimeout',
        'clearTimeout',
        'setImmediate',
        'clearImmediate',
        'nextTick',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'hrtime',
      ],
    }),
  );
  afterEach(() => jest.useRealTimers());

  const advance = async (seconds: number) => {
    await act(async () => {
      jest.advanceTimersByTime(seconds * 1000);
    });
  };

  async function startRecordingNow() {
    const t = await setup(<PackRecordScreen />);
    await act(async () => mockRecorder.signalReady());
    await advance(0);
    expect(mockRecorder.recordCalls).toBe(1);
    return t;
  }

  it('báo camera giới hạn cứng 600 giây (camera tự dừng và trả tệp hợp lệ khi tới hạn)', async () => {
    await startRecordingNow();
    expect(mockRecorder.lastRecordOptions).toEqual({ maxDurationSec: 600 });
  });

  it('chưa gần hạn: không có dải báo; còn 1 phút: báo sắp tự dừng, vẫn đang quay', async () => {
    await startRecordingNow();
    await advance(8 * 60);
    expect(screen.queryByTestId('recording-notice')).toBeNull();
    await advance(60);
    expect(screen.getByText('Sắp đủ 10 phút. App sẽ tự dừng quay.')).toBeOnTheScreen();
    expect(mockRecorder.stopCalls).toBe(0);
    expect(screen.getByText('Đang quay')).toBeOnTheScreen();
  });

  it('đủ 10 phút: tự dừng đúng một lần, báo đang dừng và lưu; lưu xong sang xác nhận kèm thông báo', async () => {
    const { session, files } = await startRecordingNow();
    await advance(10 * 60);
    expect(mockRecorder.stopCalls).toBe(1);
    expect(screen.getByText('Đã đủ 10 phút. App đang dừng quay và lưu video.')).toBeOnTheScreen();
    await advance(30); // quá hạn thêm: không dừng lần hai
    expect(mockRecorder.stopCalls).toBe(1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mov' }));
    await advance(0);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    expect(
      screen.getByText('Mỗi lần quay tối đa 10 phút nên app đã tự dừng. Video đã lưu trên máy.'),
    ).toBeOnTheScreen();
    expect((await filesOf(files, session.id))[0]?.state).toBe('queued');
  });

  it('camera tự dừng đúng hạn (không do app): vẫn báo cho người dùng', async () => {
    await startRecordingNow();
    await advance(10 * 60 - 1);
    // camera đóng tệp ở hạn mà bộ đếm của app chưa kịp dừng
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await advance(0);
    expect(
      screen.getByText('Mỗi lần quay tối đa 10 phút nên app đã tự dừng. Video đã lưu trên máy.'),
    ).toBeOnTheScreen();
  });

  it('camera tự dừng đúng hạn + băm treo: không còn "Đang quay"/nút Dừng, hiện dải "Đã đủ 10 phút"; lưu xong vẫn báo giới hạn', async () => {
    let finishHash: (value: unknown) => void = () => undefined;
    mockHash.mockReturnValue(new Promise((resolve) => (finishHash = resolve)));
    const { session } = await startRecordingNow();
    await advance(10 * 60 - 1);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await advance(30); // băm chưa xong, đồng hồ vẫn chạy
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Dừng quay' })).toBeNull();
    expect(screen.getByText('Đã đủ 10 phút. App đang dừng quay và lưu video.')).toBeOnTheScreen();
    expect(screen.queryByText(/Sắp đủ 10 phút/)).toBeNull();
    expect(mockRecorder.stopCalls).toBe(0);
    await act(async () => finishHash({ ok: true, sha256: 'ab'.repeat(32), sizeBytes: 4096 }));
    await advance(0);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    expect(
      screen.getByText('Mỗi lần quay tối đa 10 phút nên app đã tự dừng. Video đã lưu trên máy.'),
    ).toBeOnTheScreen();
  });

  it('bấm Dừng ngay sau khi camera dừng đúng hạn (cùng lượt, chưa kịp vẽ lại): thông báo giới hạn không bị nuốt', async () => {
    const { session } = await startRecordingNow();
    await advance(10 * 60 - 1);
    const stopButton = screen.getByRole('button', { name: 'Dừng quay' });
    await act(async () => {
      mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' });
      await Promise.resolve();
      fireEvent.press(stopButton);
    });
    await advance(0);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    expect(
      screen.getByText('Mỗi lần quay tối đa 10 phút nên app đã tự dừng. Video đã lưu trên máy.'),
    ).toBeOnTheScreen();
  });

  it('OS/camera ngắt sớm (phút 9) rồi lưu + băm chậm quá 10 phút: KHÔNG báo giới hạn (không rõ nguyên nhân thì không nêu)', async () => {
    let finishHash: (value: unknown) => void = () => undefined;
    mockHash.mockReturnValue(new Promise((resolve) => (finishHash = resolve)));
    const { session } = await startRecordingNow();
    await advance(9 * 60);
    // camera trả tệp ở phút 9 (ví dụ bị cuộc gọi ngắt); băm chạy lâu
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await advance(2 * 60); // vượt mốc 10 phút của bộ đếm app trong lúc đang băm
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await act(async () => finishHash({ ok: true, sha256: 'ab'.repeat(32), sizeBytes: 4096 }));
    await advance(0);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    expect(screen.queryByText(/app đã tự dừng/)).toBeNull();
    expect(screen.queryByText(/Đã đủ 10 phút/)).toBeNull();
  });

  it('giờ máy nhảy tiến (đồng bộ giờ mạng): bộ đếm đơn điệu KHÔNG tự dừng sớm', async () => {
    await startRecordingNow();
    await advance(60);
    jest.setSystemTime(Date.now() + 20 * 60 * 1000);
    await advance(1);
    expect(mockRecorder.stopCalls).toBe(0);
    expect(screen.getByText('Đang quay')).toBeOnTheScreen();
  });

  it('người dùng tự dừng sớm: không có thông báo giới hạn', async () => {
    const { session } = await startRecordingNow();
    await advance(5 * 60);
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await advance(0);
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
    expect(screen.queryByText(/app đã tự dừng/)).toBeNull();
  });

  it('hết giờ nhưng lưu lỗi: nói lỗi đúng, KHÔNG báo "Video đã lưu"', async () => {
    mockPersist.mockReturnValue({ ok: false, reason: 'STORAGE_FULL' });
    await startRecordingNow();
    await advance(10 * 60);
    await act(async () => mockRecorder.finish({ ok: true, tempUri: 'file:///cache/v.mp4' }));
    await advance(0);
    expect(screen.getByText(/Máy đã đầy bộ nhớ/)).toBeOnTheScreen();
    expect(screen.queryByText(/Video đã lưu trên máy/)).toBeNull();
  });
});
