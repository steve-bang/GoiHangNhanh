import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways } from '../data/fake-gateways';
import { createUnavailableGateways } from '../data/unavailable-gateways';
import type { CreatedShop, Gateways } from '../domain/types';
import { CreateShopScreen } from './CreateShopScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);

const errors = resources.vi.errors;
const fullText = (m: string | { title: string; hint: string }) =>
  typeof m === 'string' ? m : `${m.title} ${m.hint}`;

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});

const nameInput = () => screen.getByTestId('shop-name-input');
const submit = () => screen.getByTestId('create-shop-submit');
const skip = () => screen.getByTestId('create-shop-skip');
const isDisabled = (node: ReturnType<typeof submit>) =>
  Boolean((node.props.accessibilityState as { disabled?: boolean }).disabled);

describe('UI-A04 Tạo hồ sơ shop: giao diện', () => {
  it('hiện tiêu đề, dòng phụ, ô tên có bộ đếm, bốn nguồn bán, nút Tiếp tục và liên kết bỏ qua', async () => {
    await renderWithProviders(<CreateShopScreen />);
    expect(screen.getByTestId('screen-UI-A04')).toBeOnTheScreen();
    expect(screen.getByText('Thông tin shop của bạn')).toBeOnTheScreen();
    expect(
      screen.getByText('Giúp chúng tôi hiểu rõ hơn để phục vụ bạn tốt hơn.'),
    ).toBeOnTheScreen();
    expect(screen.getByText(/^Tên shop/)).toBeOnTheScreen();
    expect(screen.getByText('0/50')).toBeOnTheScreen();
    expect(screen.getByText('Nguồn bán')).toBeOnTheScreen();
    expect(screen.getByText('Chọn các kênh bạn đang sử dụng')).toBeOnTheScreen();
    for (const label of ['Shopee', 'TikTok Shop', 'Lazada', 'Khác']) {
      expect(screen.getByRole('checkbox', { name: label })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Bỏ qua, để sau' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quay lại' })).toBeOnTheScreen();
  });

  it('chỉ "Tên shop" có dấu * (bắt buộc); "Nguồn bán" KHÔNG có dấu *', async () => {
    await renderWithProviders(<CreateShopScreen />);
    const stars = screen.getAllByText('*', { exact: false, includeHiddenElements: true });
    expect(stars).toHaveLength(1);
    expect(screen.getByText('Nguồn bán').props.children).toBe('Nguồn bán');
  });

  it('thanh tiến trình: 3 đoạn, hiện 2/3, nhãn truy cập "Bước 2 trên 3"', async () => {
    await renderWithProviders(<CreateShopScreen />);
    expect(screen.getByText('2/3')).toBeOnTheScreen();
    const progress = screen.getByTestId('step-progress');
    expect(progress.props.accessibilityLabel).toBe('Bước 2 trên 3');
    expect(screen.getByTestId('step-node-1-done')).toBeOnTheScreen();
    expect(screen.getByTestId('step-node-2-current')).toBeOnTheScreen();
    expect(screen.getByTestId('step-node-3-todo')).toBeOnTheScreen();
    expect(screen.queryByText('1/4')).toBeNull();
  });

  it('chặn nhập quá 50 ký tự và đếm ký tự', async () => {
    await renderWithProviders(<CreateShopScreen />);
    expect(nameInput().props.maxLength).toBe(50);
    await fireEvent.changeText(nameInput(), 'Shop Minh Anh');
    expect(screen.getByText('13/50')).toBeOnTheScreen();
    await fireEvent.changeText(nameInput(), 'x'.repeat(80));
    expect(screen.getByText('50/50')).toBeOnTheScreen();
  });

  it('không hiện hình tạm/chữ tạm: câu chữ sạch', () => {
    const values: string[] = [];
    const walk = (node: unknown) => {
      if (typeof node === 'string') values.push(node);
      else if (node && typeof node === 'object') Object.values(node).forEach(walk);
    };
    walk(resources.vi.screens.createShop);
    const text = values.join(' ').toLowerCase();
    for (const word of ['tạm', 'placeholder', 'minh họa', 'giữ chỗ', 'tuyệt đối']) {
      expect(text).not.toContain(word);
    }
  });
});

describe('UI-A04 Tạo hồ sơ shop: tên bắt buộc', () => {
  it('chưa có tên (hoặc chỉ khoảng trắng): Tiếp tục bị khóa và không gọi cổng', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    expect(isDisabled(submit())).toBe(true);
    await fireEvent.press(submit());
    await fireEvent.changeText(nameInput(), '    ');
    expect(isDisabled(submit())).toBe(true);
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('không hiện lỗi khi mới mở màn; hiện lỗi ở ô tên sau khi chạm rồi để trống', async () => {
    await renderWithProviders(<CreateShopScreen />);
    expect(screen.queryByText('Hãy nhập tên shop để tiếp tục.')).toBeNull();
    await fireEvent(nameInput(), 'blur');
    expect(screen.getByText('Hãy nhập tên shop để tiếp tục.')).toBeOnTheScreen();
  });

  it('"Bỏ qua, để sau" khi tên trống: hiện lỗi ở ô tên, KHÔNG tạo shop, không điều hướng', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    await fireEvent.press(screen.getByTestId('source-lazada'));
    await fireEvent.press(skip());
    expect(screen.getByText('Hãy nhập tên shop để tiếp tục.')).toBeOnTheScreen();
    expect(fake.shop.createCalls).toHaveLength(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

describe('UI-A04 Tạo hồ sơ shop: nguồn bán bỏ qua được', () => {
  it('không chọn nguồn nào vẫn bấm Tiếp tục được; gửi danh sách rỗng rồi sang /setup-done', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    await fireEvent.changeText(nameInput(), '  Shop Minh Anh  ');
    expect(isDisabled(submit())).toBe(false);
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toEqual([{ name: 'Shop Minh Anh', sellingSources: [] }]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
  });

  it('chọn nhiều nguồn, "Khác" là một lựa chọn; gửi giá trị enum chứ không phải chuỗi hiển thị', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(screen.getByTestId('source-other'));
    await fireEvent.press(screen.getByTestId('source-tiktok_shop'));
    await fireEvent.press(screen.getByTestId('source-shopee'));
    expect(screen.getByRole('checkbox', { name: 'Khác' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(submit());
    expect(fake.shop.createCalls[0]).toEqual({
      name: 'Shop',
      sellingSources: ['shopee', 'tiktok_shop', 'other'],
    });
  });

  it('bấm lần hai thì bỏ chọn', async () => {
    await renderWithProviders(<CreateShopScreen />);
    const lazada = screen.getByRole('checkbox', { name: 'Lazada' });
    await fireEvent.press(lazada);
    expect(screen.getByRole('checkbox', { name: 'Lazada' }).props.accessibilityState).toMatchObject(
      {
        checked: true,
      },
    );
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Lazada' }));
    expect(screen.getByRole('checkbox', { name: 'Lazada' }).props.accessibilityState).toMatchObject(
      {
        checked: false,
      },
    );
  });

  it('"Bỏ qua, để sau" khi đã có tên: xóa lựa chọn nguồn bán và tiếp tục với danh sách rỗng', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop Minh Anh');
    await fireEvent.press(screen.getByTestId('source-shopee'));
    await fireEvent.press(skip());
    expect(fake.shop.createCalls).toEqual([{ name: 'Shop Minh Anh', sellingSources: [] }]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
    expect(screen.getByRole('checkbox', { name: 'Shopee' }).props.accessibilityState).toMatchObject(
      {
        checked: false,
      },
    );
  });
});

describe('UI-A04 Tạo hồ sơ shop: xử lý và lỗi', () => {
  it('đang xử lý: nút khóa, bấm đúp (kể cả bỏ qua) chỉ tạo một lần', async () => {
    let resolve: (shop: CreatedShop) => void = () => undefined;
    const createShop = jest.fn(
      () =>
        new Promise<CreatedShop>((r) => {
          resolve = r;
        }),
    );
    const fake = createFakeGateways();
    const gateways: Gateways = {
      auth: fake.auth,
      shop: { createShop, updateShop: jest.fn() },
      session: fake.session,
    };
    await renderWithProviders(<CreateShopScreen />, { gateways });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    await fireEvent.press(submit());
    await fireEvent.press(skip());
    expect(createShop).toHaveBeenCalledTimes(1);
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await act(async () => {
      resolve({ id: 's1', name: 'Shop', sellingSources: [] });
    });
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
  });

  it('lỗi mạng: hiện thông báo hai câu, không điều hướng, thử lại được', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<CreateShopScreen />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop');
    fake.shop.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_NETWORK_ERROR)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await fireEvent.press(submit());
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
    expect(screen.queryByTestId('form-error')).toBeNull();
  });

  it('bản "chưa kết nối": báo AUTH_SERVICE_UNAVAILABLE, không báo đã tạo shop', async () => {
    await renderWithProviders(<CreateShopScreen />, { gateways: createUnavailableGateways() });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('nút quay lại gọi back', async () => {
    await renderWithProviders(<CreateShopScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });
});

describe('UI-A04 Tạo hồ sơ shop: giữ giá trị khi quay lại', () => {
  function Harness() {
    const [shown, setShown] = useState(true);
    return (
      <>
        <Pressable testID="toggle" onPress={() => setShown((prev) => !prev)} />
        {shown ? <CreateShopScreen /> : null}
      </>
    );
  }

  it('tên và nguồn bán đã nhập còn nguyên khi màn bị gỡ rồi hiện lại', async () => {
    await renderWithProviders(<Harness />);
    await fireEvent.changeText(nameInput(), 'Shop Minh Anh');
    await fireEvent.press(screen.getByTestId('source-shopee'));
    await fireEvent.press(screen.getByTestId('source-other'));
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(screen.queryByTestId('shop-name-input')).toBeNull();
    await fireEvent.press(screen.getByTestId('toggle'));
    expect(nameInput().props.value).toBe('Shop Minh Anh');
    expect(screen.getByRole('checkbox', { name: 'Shopee' }).props.accessibilityState).toMatchObject(
      {
        checked: true,
      },
    );
    expect(screen.getByRole('checkbox', { name: 'Khác' }).props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(screen.getByRole('checkbox', { name: 'Lazada' }).props.accessibilityState).toMatchObject(
      {
        checked: false,
      },
    );
  });
});

describe('UI-A04 Tạo hồ sơ shop: quay lại sau khi đã tạo shop', () => {
  /** Gỡ rồi hiện lại màn (như Back từ Hoàn tất); trạng thái luồng nằm ở Provider nên còn nguyên. */
  function BackHarness() {
    const [shown, setShown] = useState(true);
    return (
      <>
        <Pressable testID="toggle" onPress={() => setShown((prev) => !prev)} />
        {shown ? <CreateShopScreen /> : null}
      </>
    );
  }
  const goBackAndReturn = async () => {
    await fireEvent.press(screen.getByTestId('toggle'));
    await fireEvent.press(screen.getByTestId('toggle'));
  };

  it('sửa tên rồi Tiếp tục: gọi updateShop đúng một lần với shopId đã có, KHÔNG tạo shop thứ hai', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<BackHarness />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop Cũ');
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(1);
    await goBackAndReturn();
    expect(nameInput().props.value).toBe('Shop Cũ');
    await fireEvent.changeText(nameInput(), 'Shop Mới');
    await fireEvent.press(screen.getByTestId('source-lazada'));
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toEqual([
      { shopId: 'fake-shop-1', name: 'Shop Mới', sellingSources: ['lazada'] },
    ]);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
    // sửa thêm lần nữa: vẫn là cập nhật shop cũ, không bao giờ tạo thêm
    await goBackAndReturn();
    await fireEvent.changeText(nameInput(), 'Shop Mới Nhất');
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toHaveLength(2);
    expect(fake.shop.updateCalls[1]).toMatchObject({
      shopId: 'fake-shop-1',
      name: 'Shop Mới Nhất',
    });
  });

  it('không sửa gì: không gọi cổng nào, đi thẳng /setup-done', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<BackHarness />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    await goBackAndReturn();
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toHaveLength(0);
    expect(mockNavigation.push).toHaveBeenCalledTimes(2);
  });

  it('"Bỏ qua, để sau" sau khi đã tạo kèm nguồn bán: cập nhật về danh sách rỗng, không tạo mới', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<BackHarness />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(screen.getByTestId('source-shopee'));
    await fireEvent.press(submit());
    await goBackAndReturn();
    await fireEvent.press(skip());
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toEqual([
      { shopId: 'fake-shop-1', name: 'Shop', sellingSources: [] },
    ]);
  });

  it('cập nhật lỗi: báo lỗi, không sang bước sau; bấm lại thì thử lại updateShop (vẫn không tạo mới)', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<BackHarness />, { gateways: fake });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    await goBackAndReturn();
    mockNavigation.push.mockClear();
    await fireEvent.changeText(nameInput(), 'Shop Đổi');
    fake.shop.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(submit());
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    await fireEvent.press(submit());
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toHaveLength(2);
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.setupDone);
  });

  it('bản "chưa kết nối": cập nhật cũng báo lỗi, không báo thành công', async () => {
    const fake = createFakeGateways();
    const base = createUnavailableGateways();
    const gateways: Gateways = {
      session: createFakeGateways().session,
      auth: fake.auth,
      shop: { ...base.shop, createShop: fake.shop.createShop.bind(fake.shop) },
    };
    await renderWithProviders(<BackHarness />, { gateways });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    await goBackAndReturn();
    mockNavigation.push.mockClear();
    await fireEvent.changeText(nameInput(), 'Shop Đổi');
    await fireEvent.press(submit());
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_SERVICE_UNAVAILABLE)),
    ).toBeOnTheScreen();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('rời màn trong lúc chờ tạo: shop vẫn được ghi nhận (lần sau chỉ cập nhật), không điều hướng', async () => {
    let resolve: (shop: CreatedShop) => void = () => undefined;
    const createShop = jest.fn(
      () =>
        new Promise<CreatedShop>((r) => {
          resolve = r;
        }),
    );
    const fake = createFakeGateways();
    const gateways: Gateways = {
      session: createFakeGateways().session,
      auth: fake.auth,
      shop: { createShop, updateShop: fake.shop.updateShop.bind(fake.shop) },
    };
    await renderWithProviders(<BackHarness />, { gateways });
    await fireEvent.changeText(nameInput(), 'Shop');
    await fireEvent.press(submit());
    mockNavigation.screenActive = false;
    await act(async () => {
      resolve({ id: 's1', name: 'Shop', sellingSources: [] });
    });
    expect(mockNavigation.push).not.toHaveBeenCalled();
    mockNavigation.screenActive = true;
    await goBackAndReturn();
    await fireEvent.changeText(nameInput(), 'Shop Đổi');
    await fireEvent.press(submit());
    expect(createShop).toHaveBeenCalledTimes(1);
    expect(fake.shop.updateCalls).toEqual([{ shopId: 's1', name: 'Shop Đổi', sellingSources: [] }]);
  });
});
