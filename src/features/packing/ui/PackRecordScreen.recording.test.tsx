import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { resetMockPreview } from '@/test-utils/mock-camera-preview';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackConfirmScreen } from './PackConfirmScreen';
import { PackDoneScreen } from './PackDoneScreen';
import { PackRecordScreen } from './PackRecordScreen';

// Nhánh khi recorder thật đã được bật: huy hiệu "Đang quay" + chấm đỏ + đồng hồ như mẫu, và các màn
// xác nhận/hoàn tất mở bằng sessionId. Chưa có recorder thật; test này giữ nhánh sẵn sàng cho đợt sau.
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
  '@/platform/camera-preview',
  () => jest.requireActual('@/test-utils/mock-camera-preview').cameraPreviewMock,
);

beforeEach(() => {
  resetMockNavigation();
  resetMockScanner();
  resetMockPreview();
});

async function setup(ui: React.ReactElement, startedAtDevice = Date.now()) {
  const store = createMemoryOrderStore();
  const details = await seedOrder(store, sampleOrder());
  const session = sampleSession(details, startedAtDevice);
  await store.saveSession(session);
  mockNavigation.params = { sessionId: session.id };
  await renderWithProviders(ui, { orderStore: store });
  return session;
}

describe('recorder bật (RECORDER_ENABLED=true)', () => {
  it('màn quay: "Đang quay" + chấm đỏ + đồng hồ, không có dải "chưa ghi video", không "Xem trước"', async () => {
    await setup(<PackRecordScreen />, Date.now() - 28_000);
    expect(await screen.findByText('Đang quay')).toBeOnTheScreen();
    expect(screen.getByTestId('recording-dot')).toBeOnTheScreen();
    expect(screen.getByText(/^00:2[89]$|^00:3[0-1]$/)).toBeOnTheScreen();
    expect(screen.queryByText('Xem trước')).toBeNull();
    expect(screen.queryByTestId('recording-notice')).toBeNull();
    expect(screen.getByLabelText(/^Đang quay, Thời lượng 00:/)).toBeOnTheScreen();
  });

  it('dừng quay sang Xác nhận video bằng sessionId (không truyền mã đơn)', async () => {
    const session = await setup(<PackRecordScreen />);
    await screen.findByText('Đang quay');
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packConfirm, {
      sessionId: session.id,
    });
  });

  it('Xác nhận video: lấy mã đơn từ phiên, trạng thái Đã lưu trên máy, bấm lưu sang Hoàn tất bằng sessionId', async () => {
    const session = await setup(<PackConfirmScreen />);
    expect(await screen.findByText(/DH1234567890/)).toBeOnTheScreen();
    expect(
      screen.getByText('Video đã lưu trên thiết bị. Đang chờ tải lên máy chủ.'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu bằng chứng' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.packDone, { sessionId: session.id });
  });

  it('Hoàn tất: lấy mã đơn từ phiên', async () => {
    await setup(<PackDoneScreen />);
    expect(await screen.findByText(/DH1234567890/)).toBeOnTheScreen();
    expect(screen.getByText(/Video đã lưu trên thiết bị, đang chờ đồng bộ/)).toBeOnTheScreen();
  });

  it('Xác nhận/Hoàn tất không nhận mã đơn qua tham số "code"', async () => {
    mockNavigation.params = { code: 'DEMO-0001' };
    await renderWithProviders(<PackConfirmScreen />);
    expect(await screen.findByText('Không mở được phiên quay này.')).toBeOnTheScreen();
    expect(screen.queryByText(/DEMO-0001/)).toBeNull();
    expect(screen.queryByText(/đã lưu trên thiết bị/i)).toBeNull();
  });
});
