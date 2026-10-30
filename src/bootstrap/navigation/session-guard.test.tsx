import { join } from 'node:path';

import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { AppError } from '@/core/errors/app-error';
import { ROUTES } from '@/core/navigation';
import type { createFakePersonalGateways } from '@/features/personal';

// Router thật nhưng camera giả (có quyền): không có expo-camera native trong Jest.
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
jest.mock(
  '@/platform/camera-preview',
  () => jest.requireActual('@/test-utils/mock-camera-preview').cameraPreviewMock,
);
// Chế độ chặt như bản Firebase (test mặc định là cổng giả).
jest.mock('@/features/personal/data/session-mode', () => ({ requiresKnownShop: () => true }));
// Cổng cá nhân giả nhưng danh tính phiên do từng bài test quyết định.
const mockIdentity = jest.fn();
jest.mock('@/features/personal/data/personal-gateways', () => {
  const actual = jest.requireActual('@/features/personal/data/personal-gateways');
  let gateways: ReturnType<typeof createFakePersonalGateways> | undefined;
  return {
    ...actual,
    getDefaultPersonalGateways: () => {
      if (!gateways) {
        const { createFakePersonalGateways: create } = jest.requireActual(
          '@/features/personal/data/fake-personal-gateways',
        );
        gateways = create({ latencyMs: 0 }) as ReturnType<typeof createFakePersonalGateways>;
        gateways.account.getSessionIdentity = () => mockIdentity();
      }
      return gateways;
    },
  };
});

const APP_DIR = join(__dirname, '..', '..', 'app');
const WITH_SHOP = {
  uid: 'uid-a',
  email: 'a@x.vn',
  displayName: null,
  signInMethod: 'password',
  shopId: 'shop-a',
};

beforeEach(() => mockIdentity.mockReset());

/**
 * Cổng phiên (V1-06) qua Expo Router thật, trong bộ nhớ: liên kết sâu tới màn nghiệp vụ ở bản Firebase.
 * Không thay thế kiểm thử liên kết sâu `doncung://` trên thiết bị.
 */
describe('cổng phiên trên router thật (chế độ chặt)', () => {
  it('liên kết sâu /quick-order khi chưa đăng nhập -> Chào mừng, không mở Tạo đơn nhanh', async () => {
    mockIdentity.mockResolvedValue(null);
    await renderRouter(APP_DIR, { initialUrl: ROUTES.quickOrder.path });
    expect(await screen.findByTestId('screen-UI-A02')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-B04')).toBeNull();
  });

  it('liên kết sâu /home khi đã đăng nhập nhưng chưa có cửa hàng -> Tạo cửa hàng', async () => {
    mockIdentity.mockResolvedValue({ ...WITH_SHOP, shopId: null });
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    expect(await screen.findByTestId('screen-UI-A04')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-B01')).toBeNull();
  });

  it('đã đăng nhập và biết cửa hàng -> mở đúng màn', async () => {
    mockIdentity.mockResolvedValue(WITH_SHOP);
    await renderRouter(APP_DIR, { initialUrl: ROUTES.quickOrder.path });
    expect(await screen.findByTestId('screen-UI-B04')).toBeOnTheScreen();
  });

  it('offline lần đầu (chưa có đệm userShops): thanh tab và Trang chủ không hiện; Thử lại khi có mạng thì vào', async () => {
    mockIdentity
      .mockRejectedValueOnce(new AppError('AUTH_NETWORK_ERROR'))
      .mockResolvedValue(WITH_SHOP);
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    expect(await screen.findByText('Chưa kết nối được cửa hàng.')).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-B01')).toBeNull();
    expect(screen.queryAllByRole('button', { name: 'Trang chủ' })).toHaveLength(0);
    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Thử lại' }));
    });
    expect(await screen.findByTestId('screen-UI-B01')).toBeOnTheScreen();
  });
});
