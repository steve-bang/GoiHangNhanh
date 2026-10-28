import { join } from 'node:path';

import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

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

const isTabBarItem = (element: { props: { testID?: string } }) =>
  !element.props.testID?.startsWith('menu-');

/** Nút của thanh tab (không phải mục menu `menu-*`), phân biệt với mục menu trùng tên trong màn Cá nhân (ví dụ "Thông báo"). */
function tabButton(name: string) {
  const match = screen.getAllByRole('button', { name }).find(isTabBarItem);
  if (!match) throw new Error(`Không thấy nút tab "${name}"`);
  return match;
}

function expectTabBarVisible(visible: boolean) {
  for (const label of TAB_LABELS) {
    const found = screen.queryAllByRole('button', { name: label }).filter(isTabBarItem);
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
    await fireEvent.press(tabButton(label));
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
    await fireEvent.press(tabButton('Đơn hàng'));
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
    await fireEvent.press(tabButton('Đơn hàng'));
    expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
    await fireEvent.press(tabButton('Thông báo'));
    expect(screen.getByTestId('screen-UI-I07')).toBeOnTheScreen();
    await fireEvent.press(tabButton('Cá nhân'));
    expect(screen.getByTestId('screen-UI-I01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('vào Gói dịch vụ từ tab Cá nhân vẫn giữ thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.plan.path });
    expect(screen.getByTestId('screen-UI-H01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('từ Cá nhân vào Sửa họ tên và Đổi mật khẩu (route con UI-I01/UI-I05): thanh tab ẩn trên form, hiện lại khi Back về Cá nhân (Q-20r)', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.profile.path });
    expectTabBarVisible(true);
    // Cổng giả mặc định chưa có họ tên: khung 1e có nút "Cập nhật" mở Sửa họ tên.
    await fireEvent.press(await screen.findByRole('button', { name: 'Cập nhật' }));
    expect(screen.getByTestId('screen-UI-I01-edit-profile')).toBeOnTheScreen();
    // Khung 2: nút Lưu nằm trong nội dung ngay dưới ô (không ghim đáy), chưa có ô email.
    expect(await screen.findByTestId('edit-profile-save')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-profile-email')).toBeNull();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-I01')).toBeOnTheScreen();
    expectTabBarVisible(true);
    await fireEvent.press(screen.getByTestId('change-password-entry'));
    expect(screen.getByTestId('screen-UI-I05-change-password')).toBeOnTheScreen();
    // Khung 3: cổng giả đăng nhập bằng mật khẩu nên hiện form (thẻ Apple/Google chỉ khi không phải mật khẩu).
    expect(await screen.findByTestId('change-password-submit')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-social')).toBeNull();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-I01')).toBeOnTheScreen();
    expectTabBarVisible(true);
  });

  it('Sửa tên cửa hàng và Chuyển cửa hàng ẩn thanh tab; Cài đặt cửa hàng (màn gốc) vẫn có thanh tab', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.shopSettings.path });
    expect(screen.getByTestId('screen-UI-I02')).toBeOnTheScreen();
    expectTabBarVisible(true);
    await act(async () => {
      router.push(ROUTES.shopEdit.path);
    });
    expect(screen.getByTestId('screen-UI-I02-edit')).toBeOnTheScreen();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-I02')).toBeOnTheScreen();
    expectTabBarVisible(true);
    await act(async () => {
      router.push(ROUTES.shopSwitch.path);
    });
    expect(screen.getByTestId('screen-UI-I02-switch')).toBeOnTheScreen();
    expectTabBarVisible(false);
  });

  it('Gói dịch vụ: "Chi tiết gói" và Lịch sử thanh toán (route con UI-H01) ẩn thanh tab, Back về từng màn', async () => {
    await renderRouter(APP_DIR, { initialUrl: ROUTES.plan.path });
    await fireEvent.press(await screen.findByTestId('plan-detail-action'));
    expect(screen.getByTestId('screen-UI-H01-detail')).toBeOnTheScreen();
    expectTabBarVisible(false);
    await fireEvent.press(screen.getByTestId('plan-detail-history'));
    expect(screen.getByTestId('screen-UI-H01-payments')).toBeOnTheScreen();
    expectTabBarVisible(false);
    await act(async () => {
      router.back();
    });
    expect(screen.getByTestId('screen-UI-H01-detail')).toBeOnTheScreen();
    await act(async () => {
      router.back();
    });
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
      await fireEvent.press(tabButton('Đơn hàng'));
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

    it('Xác nhận -> bắt đầu mở màn quay (không tab), có xem trước camera, huy hiệu "Xem trước" và dải "chưa ghi video"', async () => {
      await scanToQuickOrder('DH-FLOW-2');
      await fireEvent.press(screen.getByTestId('quick-save'));
      await screen.findByTestId('screen-UI-C01');
      await fireEvent.press(screen.getByTestId('preview-start'));
      expect(await screen.findByText('DH-FLOW-2')).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
      expect(await screen.findByText('Bản thử giao diện: chưa ghi video')).toBeOnTheScreen();
      expect(screen.getByTestId('record-camera')).toBeOnTheScreen();
      expect(screen.getByText('Xem trước')).toBeOnTheScreen();
      expect(screen.queryByText('Đang quay')).toBeNull(); // chưa ghi tệp nào (bất biến 3, 11)
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

    it('Back khi đang ở màn quay bị chặn; Ở lại màn quay ở lại; Kết thúc phiên quay về Xác nhận đơn (không qua màn "đã lưu"), bắt đầu lại mở lại đúng phiên cũ', async () => {
      await scanToQuickOrder('DH-FLOW-4');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      await screen.findByTestId('record-camera');

      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
      expect(screen.getByText('Phiên quay chưa kết thúc')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Ở lại màn quay' }));
      expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();

      await act(async () => {
        router.back();
      });
      await fireEvent.press(screen.getByRole('button', { name: 'Kết thúc phiên' }));
      // Luồng Quét -> Tạo đơn -> Xác nhận -> Quay -> Dừng: về Xác nhận đơn với thông báo trung thực
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      expect(screen.getByText('Bản thử giao diện: chưa có video nào được lưu.')).toBeOnTheScreen();
      expect(screen.getByTestId('preview-order-code')).toHaveTextContent('DH-FLOW-4');
      expect(screen.queryByTestId('screen-UI-C03')).toBeNull();
      expect(screen.queryByTestId('screen-UI-C04')).toBeNull();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
      expect(screen.queryByText(/Video đã lưu trên thiết bị/)).toBeNull();

      // Bắt đầu lại: mở lại phiên đang thực hiện của kiện, không tạo phiên chồng
      await fireEvent.press(screen.getByTestId('preview-start'));
      expect(await screen.findByTestId('record-camera')).toBeOnTheScreen();
      expect(screen.getByText('DH-FLOW-4')).toBeOnTheScreen();
    });

    it('bấm nút Dừng quay (không qua hộp thoại) quay về Xác nhận đơn kèm thông báo "chưa có video nào được lưu"', async () => {
      await scanToQuickOrder('DH-FLOW-5');
      await fireEvent.press(screen.getByTestId('quick-skip'));
      await screen.findByTestId('record-camera');
      await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' }));
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      expect(screen.queryByText('Phiên quay chưa kết thúc')).toBeNull();
      expect(screen.getByText('Bản thử giao diện: chưa có video nào được lưu.')).toBeOnTheScreen();
      expect(screen.queryByTestId('screen-UI-C04')).toBeNull();
      expect(screen.queryByText(/đã lưu/i)).toBeNull();
    });

    it('mở thẳng UI-C04/UI-C06 bằng liên kết sâu khi chưa ghi: không có badge hay câu "đã lưu"', async () => {
      await renderRouter(APP_DIR, { initialUrl: `${ROUTES.packConfirm.path}?sessionId=bat-ky` });
      expect(screen.getByTestId('screen-UI-C04')).toBeOnTheScreen();
      expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
      expect(screen.queryByText(/đã lưu trên thiết bị/i)).toBeNull();
    });
  });

  describe('tab Đơn hàng: danh sách thật và chi tiết (router thật, kho bộ nhớ)', () => {
    /** Tạo một đơn bằng UI (nút + ở đầu danh sách -> Tạo đơn nhanh -> Lưu), rồi lùi về danh sách. */
    async function createOrderFromList(code: string, product?: string) {
      await fireEvent.press(screen.getByRole('button', { name: 'Tạo đơn mới' }));
      expect(screen.getByTestId('screen-UI-B04')).toBeOnTheScreen();
      await fireEvent.changeText(screen.getByTestId('quick-order-code'), code);
      if (product) await fireEvent.changeText(screen.getByTestId('line-name-0'), product);
      await fireEvent.press(screen.getByTestId('quick-save'));
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      await act(async () => {
        router.back();
      });
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
    }

    async function openOrdersTab() {
      await renderRouter(APP_DIR, { initialUrl: ROUTES.home.path });
      await fireEvent.press(tabButton('Đơn hàng'));
      expect(await screen.findByTestId('orders-empty')).toBeOnTheScreen();
    }

    it('đơn mới tạo từ Tạo đơn nhanh hiện ở danh sách sau khi quay lại', async () => {
      await openOrdersTab();
      await createOrderFromList('DH-LIST-1', 'Áo thun');
      expect(await screen.findByText('DH-LIST-1')).toBeOnTheScreen();
      expect(screen.getByText('Áo thun')).toBeOnTheScreen();
      expect(screen.queryByTestId('orders-empty')).toBeNull();
      expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn');
      expectTabBarVisible(true);
      await createOrderFromList('DH-LIST-2');
      expect(await screen.findByText('DH-LIST-2')).toBeOnTheScreen();
      expect(screen.getByTestId('orders-count')).toHaveTextContent('2 đơn');
    });

    it('vào chi tiết rồi Back giữ nguyên từ khóa tìm kiếm và bộ lọc; chi tiết vẫn có thanh tab', async () => {
      await openOrdersTab();
      await createOrderFromList('AB-1', 'Áo');
      await createOrderFromList('AB-2');
      await createOrderFromList('ZZ-9');
      await fireEvent.changeText(screen.getByTestId('orders-search'), 'ab');
      await waitFor(() =>
        expect(screen.getByTestId('orders-count')).toHaveTextContent('2 đơn phù hợp'),
      );
      await fireEvent.press(screen.getByTestId('orders-open-filters'));
      await fireEvent.press(await screen.findByRole('button', { name: 'Chưa khai báo sản phẩm' }));
      await fireEvent.press(screen.getByTestId('orders-filters-apply'));
      await waitFor(() =>
        expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn phù hợp'),
      );
      await fireEvent.press(screen.getByText('AB-2'));
      expect(await screen.findByTestId('screen-UI-E02')).toBeOnTheScreen();
      expect(screen.getByTestId('detail-order-code')).toHaveTextContent('AB-2');
      expect(screen.getByText('Chưa khai báo sản phẩm')).toBeOnTheScreen();
      expectTabBarVisible(true);
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
      expect(screen.getByTestId('orders-search')).toHaveDisplayValue('ab');
      expect(screen.getByRole('button', { name: 'Bộ lọc (1)' })).toBeOnTheScreen();
      expect(screen.getByTestId('orders-count')).toHaveTextContent('1 đơn phù hợp');
      expect(screen.getByText('AB-2')).toBeOnTheScreen();
      expect(screen.queryByText('AB-1')).toBeNull();
    });

    it('chi tiết với ID lạ là không tìm thấy (deep link), Back về danh sách', async () => {
      await renderRouter(APP_DIR, { initialUrl: '/orders/khong-co' });
      expect(await screen.findByTestId('order-not-found')).toBeOnTheScreen();
    });

    it('"Quay ngay" từ thẻ đi qua Xác nhận đơn của đúng đơn; Back về danh sách còn nguyên', async () => {
      await openOrdersTab();
      await createOrderFromList('DH-REC-1');
      await fireEvent.press(await screen.findByRole('button', { name: /^Quay ngay, DH-REC-1$/ }));
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      expect(screen.getByTestId('preview-order-code')).toHaveTextContent('DH-REC-1');
      expectTabBarVisible(false);
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
      expect(screen.getByText('DH-REC-1')).toBeOnTheScreen();
    });

    it('"Quay ngay" khi đơn đã có phiên đang thực hiện mở lại đúng phiên đó và danh sách vẫn nằm dưới', async () => {
      await openOrdersTab();
      await createOrderFromList('DH-REC-2');
      await fireEvent.press(await screen.findByRole('button', { name: /^Quay ngay, DH-REC-2$/ }));
      await fireEvent.press(await screen.findByTestId('preview-start')); // tạo phiên, sang màn quay
      expect(await screen.findByTestId('record-camera')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Dừng quay' })); // về Xác nhận đơn
      expect(await screen.findByTestId('screen-UI-C01')).toBeOnTheScreen();
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
      // thẻ vẫn là "Chưa có video" (phiên created không phải bằng chứng) nên vẫn "Quay ngay"
      expect(screen.queryByText(/Đã đồng bộ|Hoàn tất|Đã lưu trên máy/)).toBeNull();
      await fireEvent.press(screen.getByRole('button', { name: /^Quay ngay, DH-REC-2$/ }));
      expect(await screen.findByTestId('record-camera')).toBeOnTheScreen();
      expect(screen.getByText('DH-REC-2')).toBeOnTheScreen();
      expect(screen.getByTestId('screen-UI-C03')).toBeOnTheScreen();
    });

    it('nút Quét ở đầu danh sách mở màn quét; Back về đúng danh sách', async () => {
      await openOrdersTab();
      await fireEvent.press(screen.getByRole('button', { name: 'Quét mã đơn' }));
      expect(screen.getByTestId('screen-UI-B02')).toBeOnTheScreen();
      await act(async () => {
        router.back();
      });
      expect(screen.getByTestId('screen-UI-E01')).toBeOnTheScreen();
    });
  });
});
