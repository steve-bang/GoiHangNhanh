import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore, type OrderStore } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { DeleteAccountScreen } from './DeleteAccountScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
const mockSupportEmail = jest.fn<string | null, []>(() => null);
jest.mock('@/core/config/support-contact', () => ({
  getSupportEmail: () => mockSupportEmail(),
}));

beforeEach(() => {
  resetMockNavigation();
  mockSupportEmail.mockReturnValue(null);
});

const withStore = (overrides: Partial<OrderStore>): OrderStore => ({
  ...createMemoryOrderStore(),
  ...overrides,
});

async function setup(
  options: {
    gateways?: ReturnType<typeof createFakePersonalGateways>;
    store?: OrderStore;
  } = {},
) {
  const gateways = options.gateways ?? createFakePersonalGateways({ shop: { role: 'member' } });
  await renderWithProviders(<DeleteAccountScreen />, {
    personalGateways: gateways,
    orderStore: options.store ?? createMemoryOrderStore(),
  });
  return gateways;
}

const statusOf = (id: string) => screen.findByTestId(`delete-condition-${id}-status`);

describe('Xóa tài khoản (UI-I05 route con, khung 20)', () => {
  it('hiện tiêu đề, câu dẫn theo BA, danh sách điều kiện, giải thích dữ liệu, hộp kiểm và nút', async () => {
    await setup();
    expect(screen.getByTestId('screen-UI-I05-delete-account')).toBeOnTheScreen();
    expect(screen.getByText('Xóa tài khoản?')).toBeOnTheScreen();
    expect(screen.getByTestId('delete-intro')).toHaveTextContent(
      'Đây là thao tác quan trọng. Hãy đọc kỹ thông tin về dữ liệu và quyền truy cập trước khi tiếp tục.',
    );
    expect(screen.getByText('Điều kiện')).toBeOnTheScreen();
    expect(screen.getByTestId('delete-data')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' })).toBeOnTheScreen();
    expect(screen.getByTestId('delete-keep')).toHaveTextContent('Giữ tài khoản của tôi');
  });

  it('sạch: ba mục có nguồn "Đạt"; mục tranh chấp "Chưa kiểm tra được"', async () => {
    await setup();
    await waitFor(async () => expect(await statusOf('recording')).toHaveTextContent('Đạt'));
    expect(await statusOf('unsynced')).toHaveTextContent('Đạt');
    expect(await statusOf('ownership')).toHaveTextContent('Đạt');
    expect(await statusOf('disputes')).toHaveTextContent('Chưa kiểm tra được');
    expect(screen.getByTestId('delete-condition-disputes')).toHaveTextContent(
      /chưa có dữ liệu để kiểm tra/,
    );
    expect(screen.queryByTestId('delete-sync-link')).toBeNull();
  });

  it('đang kiểm tra: chưa hiện "Đạt" trước khi có kết quả', async () => {
    await setup({
      store: withStore({ hasRecordingOnDevice: () => new Promise(() => undefined) }),
    });
    expect(screen.getByTestId('delete-condition-recording')).toHaveTextContent(/Đang kiểm tra/);
    expect(screen.queryByText('Đạt')).toBeNull();
  });

  it('đang quay: "Cần xử lý" kèm hướng dẫn dừng quay', async () => {
    await setup({ store: withStore({ hasRecordingOnDevice: async () => true }) });
    expect(await screen.findByText('Hãy dừng quay trước khi xóa tài khoản.')).toBeOnTheScreen();
    expect(await statusOf('recording')).toHaveTextContent('Cần xử lý');
  });

  it('còn tệp chưa đồng bộ: nêu số thật, có lối tới trung tâm đồng bộ', async () => {
    await setup({ store: withStore({ countUnsyncedOnDevice: async () => 3 }) });
    expect(await screen.findByText('Còn 3 tệp chưa được máy chủ xác nhận.')).toBeOnTheScreen();
    expect(await statusOf('unsynced')).toHaveTextContent('Cần xử lý');
    await fireEvent.press(screen.getByTestId('delete-sync-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
  });

  it('là chủ cửa hàng: cần xử lý, nói cách xử lý chưa được công bố', async () => {
    await setup({ gateways: createFakePersonalGateways() });
    expect(await screen.findByText(/Bạn là chủ 1 cửa hàng\./)).toBeOnTheScreen();
    expect(await statusOf('ownership')).toHaveTextContent('Cần xử lý');
  });

  it('đọc kho/cửa hàng lỗi: "Chưa kiểm tra được", không dấu tích', async () => {
    await setup({
      gateways: createUnavailablePersonalGateways() as never,
      store: withStore({
        hasRecordingOnDevice: async () => {
          throw new Error('x');
        },
        countUnsyncedOnDevice: async () => {
          throw new Error('x');
        },
      }),
    });
    for (const id of ['recording', 'unsynced', 'ownership', 'disputes']) {
      expect(await statusOf(id)).toHaveTextContent('Chưa kiểm tra được');
    }
    expect(screen.queryByText('Đạt')).toBeNull();
  });

  it('nút xóa KHÓA kể cả khi sạch và đã chọn hộp kiểm; bấm không gọi cổng, không điều hướng, không đăng xuất', async () => {
    const gateways = await setup();
    await waitFor(async () => expect(await statusOf('recording')).toHaveTextContent('Đạt'));
    const agree = screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' });
    await fireEvent.press(agree);
    expect(screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' })).toBeChecked();
    const button = screen.getByTestId('delete-submit');
    expect(button).toBeDisabled();
    expect(button.props.accessibilityHint).toBe(
      'Chưa dùng được. Việc xóa tài khoản trong ứng dụng sắp có.',
    );
    await fireEvent.press(button);
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('delete-soon')).toHaveTextContent(
      'Sắp có. Hiện chưa xóa được tài khoản trong ứng dụng.',
    );
  });

  it('chưa có địa chỉ hỗ trợ thật: không nhắc đường dẫn hỗ trợ nào', async () => {
    await setup();
    expect(screen.queryByTestId('delete-support')).toBeNull();
  });

  it('có địa chỉ hỗ trợ thật: hiện lối Liên hệ hỗ trợ (không hứa sẽ xóa)', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.test');
    await setup();
    expect(screen.getByTestId('delete-support')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('delete-support-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.helpContact);
  });

  it('"Giữ tài khoản của tôi" quay lại, không đổi gì', async () => {
    const gateways = await setup();
    await fireEvent.press(screen.getByTestId('delete-keep'));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    expect(gateways.account.signOutCalls).toBe(0);
  });

  it('không dùng cụm hứa quá mức hoặc cấm trong chuỗi của màn', () => {
    const text = JSON.stringify(resources.vi.personal.deleteAccount);
    expect(text).not.toMatch(
      /vui lòng|bảo vệ|an toàn|ngay lập tức|tuyệt đối|khôi phục|vĩnh viễn|đã xóa|xác thực/i,
    );
  });
});
