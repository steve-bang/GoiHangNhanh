import { join } from 'node:path';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { ROUTES, isTabBarHiddenAt } from '@/core/navigation';

// Router thật nhưng camera giả (có quyền): không có expo-camera native trong Jest.
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);
jest.mock(
  '@/platform/camera-preview',
  () => jest.requireActual('@/test-utils/mock-camera-preview').cameraPreviewMock,
);

const APP_DIR = join(__dirname, '..', '..', 'app');
const TAB_LABELS = ['Trang chủ', 'Đơn hàng', 'Quét mã đơn hàng', 'Thông báo', 'Cá nhân'] as const;

function expectTabBarVisible(visible: boolean) {
  for (const label of TAB_LABELS) {
    const found = screen.queryAllByRole('button', { name: label });
    expect(found).toHaveLength(visible ? 1 : 0);
  }
}

/**
 * Chạy Expo Router thật trên thư mục `src/app` (trong bộ nhớ, không cần máy ảo): kiểm tra thanh tab
 * hiện ở Trang chủ, đủ 5 mục, và ẩn ở màn quay. Không thay thế kiểm thử trên thiết bị.
 */
describe('điều hướng thật (Expo Router, trong bộ nhớ)', () => {
  it('Trang chủ có thanh tab 5 mục theo mẫu thiết kế (D-16)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    expectTabBarVisible(true);
  });

  it('bấm nút Quét giữa mở màn quét toàn màn hình (không có thanh tab), quay lại về Trang chủ', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn hàng' }));
    expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-B01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it.each([
    ['Đơn hàng', 'screen-UI-E01'],
    ['Thông báo', 'screen-UI-I07'],
    ['Cá nhân', 'screen-UI-I01'],
  ])('bấm Quét từ tab %s rồi Back về đúng tab đó (không về Trang chủ)', async (label, testID) => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId(testID)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn hàng' }));
    expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId(testID)).toBeOnTheScreen();
    expect(screen.queryByTestId('screen-UI-B01')).toBeNull();
    expectTabBarVisible(true);
  });

  it('từ màn quét sang Tạo đơn nhanh rồi Back quay về màn quét; Back tiếp về màn trước khi quét', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await fireEvent.press(screen.getByRole('button', { name: 'Đơn hàng' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn hàng' }));
    await fireEvent.press(screen.getByTestId('scan-manual-open'));
    await fireEvent.changeText(screen.getByTestId('scan-manual-code'), 'ABC123');
    await fireEvent.press(screen.getByTestId('scan-manual-lookup'));
    expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
  });

  it('chuyển qua lại giữa các tab Đơn hàng, Thông báo, Cá nhân; thanh tab vẫn hiện', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
    await fireEvent.press(screen.getByRole('button', { name: 'Đơn hàng' }));
    expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Thông báo' }));
    expect(screen.getByTestId('screen-UI-I07')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Cá nhân' }));
    expect(screen.getByTestId('screen-UI-I01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('vào Gói dịch vụ từ tab Cá nhân vẫn giữ thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.plan.path });
    expect(screen.getByTestId('screen-UI-H01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('Hàng hoàn và Đồng bộ không còn là tab: mở được nhưng không có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.returns.path });
    expect(screen.getByTestId('screen-UI-D01')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('màn quay đóng gói không có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: `${ROUTES.packRecord.path}?sessionId=khong-co` });
    expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('màn quay mở kiện hoàn không có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.returnRecord.path });
    expect(screen.getByTestId('screen-UI-D04')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('Tạo đơn nhanh và Xác nhận đơn là route cấp gốc, không có thanh tab (mockup 03)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.quickOrder.path });
    expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
    expectTabBarVisible(false);
    expect(ROUTES.quickOrder.path).toBe('/quick-order');
    expect(ROUTES.orderPreview.path).toBe('/order-preview');
    expect(isTabBarHiddenAt('/quick-order')).toBe(true);
    expect(isTabBarHiddenAt('/order-preview')).toBe(true);
  });

  describe('luồng Quét -> Tạo đơn -> Xác nhận -> Quay (router thật, kho bộ nhớ)', () => {
    async function scanToQuickOrder(code: string) {
      await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
      await fireEvent.press(screen.getByRole('button', { name: 'Đơn hàng' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn hàng' }));
      await fireEvent.press(screen.getByTestId('scan-manual-open'));
      await fireEvent.changeText(screen.getByTestId('scan-manual-code'), code);
      await fireEvent.press(screen.getByTestId('scan-manual-lookup'));
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
      expect(screen.getByTestId('quick-order-code')).toHaveDisplayValue(code);
    }

    it('đi thẳng tới màn quay bằng ID phiên và Back lùi đúng từng bước', async () => {
      await scanToQuickOrder('DH-FLOW-1');
      await fireEvent.changeText(screen.getByTestId('line-name-0'), 'Áo thun');
      await fireEvent.press(screen.getByTestId('quick-save'));
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      expect(screen.getByText('DH-FLOW-1')).toBeOnTheScreen();
      expectTabBarVisible(false);

      // Back từ Xác nhận về Tạo đơn, rồi về màn quét, rồi về tab đứng trước khi quét.
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
    });

    it('Xác nhận -> bắt đầu mở màn quay (không tab), có xem trước camera và dải "chưa ghi video"', async () => {
      await scanToQuickOrder('DH-FLOW-2');
      await fireEvent.press(screen.getByTestId('quick-save'));
      await screen.findByTestId('screen-UI-C01');
      await fireEvent.press(screen.getByTestId('preview-start'));
      expect(await screen.findByText('DH-FLOW-2')).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
      expect(await screen.findByText('Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
      expect(screen.getByTestId('record-camera')).toBeOnTheScreen();
      expect(screen.queryByTestId('screen-UI-C01')).toBeNull(); // đã thay bằng màn quay
      expectTabBarVisible(false);
    });

    it('Bỏ qua, quay ngay đi thẳng tới màn quay, không qua màn Xác nhận', async () => {
      await scanToQuickOrder('DH-FLOW-3');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      expect(await screen.findByTestId('record-camera')).toBeOnTheScreen();
      expect(screen.getByText('DH-FLOW-3')).toBeOnTheScreen();
      expect(screen.queryByTestId('screen-UI-C01')).toBeNull();
    });

    it('Back khi đang ở màn quay bị chặn và hiện cảnh báo; Giữ video ở lại; Kết thúc phiên sang Xác nhận video', async () => {
      await scanToQuickOrder('DH-FLOW-4');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      await screen.findByTestId('record-camera');

      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
      expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Giữ video và quay lại' }));
      expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();

      await act(async () => {
        router.back();
      });
      await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
      expect(screen.getByTestId('screen-UI-C04')).toBeOnTheScreen();
      expect(screen.queryByTestId('screen-UI-C03')).toBeNull();
    });
  });
});
