import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryDeviceSettingsStore, type DeviceSettingsStore } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { SecurityScreen } from './SecurityScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

const LOCKED = ['twoFactor', 'devices', 'dataAccess'] as const;

async function setup(gateways = createFakePersonalGateways()) {
  await renderWithProviders(<SecurityScreen />, { personalGateways: gateways });
  return gateways;
}

describe('SecurityScreen (UI-I05, khung 14)', () => {
  it('tài khoản mật khẩu: Đổi mật khẩu mở route con; tiêu đề "Quyền riêng tư và bảo mật"', async () => {
    await setup();
    expect(screen.getByTestId('screen-UI-I05')).toBeOnTheScreen();
    expect(screen.getAllByText('Quyền riêng tư và bảo mật').length).toBeGreaterThan(0);
    const row = await screen.findByTestId('security-password');
    await fireEvent.press(row);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.changePassword);
  });

  it('ba hàng chưa làm: khóa "Sắp có", đọc là không dùng được kèm gợi ý, bấm không điều hướng', async () => {
    await setup();
    await screen.findByTestId('security-password');
    expect(screen.getByText('Xác nhận 2 lớp')).toBeOnTheScreen();
    expect(screen.getByText('Thiết bị đăng nhập')).toBeOnTheScreen();
    expect(screen.getByText('Dữ liệu và quyền truy cập')).toBeOnTheScreen();
    expect(screen.getByText('Xóa tài khoản')).toBeOnTheScreen();
    for (const id of LOCKED) {
      const row = screen.getByTestId(`security-${id}`);
      expect(row).toHaveTextContent(/Sắp có/);
      expect(row.props.accessibilityState).toMatchObject({ disabled: true });
      expect(row.props.accessibilityLabel).toMatch(/\. Sắp có$/);
      expect(row.props.accessibilityHint).toBe('Chưa dùng được. Tính năng này sắp có.');
      await fireEvent.press(row);
    }
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });

  it('"Xóa tài khoản" không còn khóa hoàn toàn: mở màn thông tin (nút xóa trong màn đó vẫn khóa), nhóm riêng, chữ đỏ', async () => {
    await setup();
    await screen.findByTestId('security-password');
    const row = screen.getByTestId('security-deleteAccount');
    expect(row.props.accessibilityState?.disabled).toBeFalsy();
    expect(row).not.toHaveTextContent(/Sắp có/);
    expect(screen.getByTestId('security-group-danger')).toContainElement(row);
    await fireEvent.press(row);
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.deleteAccount);
  });

  it('không nói như đã có 2FA/mã hóa/bảo vệ, không "Chưa bật" cho tính năng chưa tồn tại', async () => {
    await setup();
    await screen.findByTestId('security-password');
    expect(screen.getByTestId('screen-UI-I05')).not.toHaveTextContent(
      /chưa bật|đã bật|mã hóa|bảo vệ|an toàn|đầu cuối/i,
    );
  });

  it.each([
    ['apple', 'Mật khẩu do Apple quản lý.'],
    ['google', 'Mật khẩu do Google quản lý.'],
  ] as const)(
    'tài khoản %s: hàng Đổi mật khẩu chỉ là ghi chú, không điều hướng',
    async (method, note) => {
      await setup(createFakePersonalGateways({ profile: { signInMethod: method } }));
      const row = await screen.findByTestId('security-password-social');
      expect(row).toHaveTextContent(new RegExp(note.replace('.', '\\.')));
      expect(screen.queryByTestId('security-password')).toBeNull();
      await fireEvent.press(row);
      expect(mockNavigation.push).not.toHaveBeenCalled();
    },
  );

  it('đang tải hồ sơ: hàng Đổi mật khẩu chưa bấm được (chưa biết cách đăng nhập)', async () => {
    await renderWithProviders(<SecurityScreen />, {
      personalGateways: {
        ...createFakePersonalGateways(),
        account: {
          ...createFakePersonalGateways().account,
          getProfile: () => new Promise(() => undefined),
        },
      } as never,
    });
    const row = screen.getByTestId('security-password-loading');
    await fireEvent.press(row);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });

  it('không tải được hồ sơ: hàng báo lỗi, chạm để thử lại, không vào Đổi mật khẩu', async () => {
    await setup(createUnavailablePersonalGateways() as never);
    const row = await screen.findByTestId('security-password-retry');
    expect(row).toHaveTextContent(/Chưa tải được thông tin tài khoản\./);
    expect(row.props.accessibilityHint).toBe('Chạm để thử lại.');
    await fireEvent.press(row);
    await waitFor(() => expect(screen.getByTestId('security-password-retry')).toBeOnTheScreen());
    expect(mockNavigation.push).not.toHaveBeenCalled();
    // Các hàng khóa vẫn hiện, lỗi một khu vực không làm mất cả màn.
    expect(screen.getByTestId('security-twoFactor')).toBeOnTheScreen();
  });

  describe('Gửi báo lỗi ứng dụng (V1-16)', () => {
    const LABEL = { name: /Gửi báo lỗi ứng dụng/ };

    async function openWith(store: DeviceSettingsStore) {
      await renderWithProviders(<SecurityScreen />, {
        personalGateways: createFakePersonalGateways(),
        deviceSettingsStore: store,
      });
      const toggle = await screen.findByRole('switch', LABEL);
      await waitFor(() =>
        expect(toggle.props.accessibilityState).toMatchObject({ disabled: false }),
      );
      return toggle;
    }

    it('mặc định bật, mô tả nói rõ không kèm tài khoản/email/mã đơn/video, nằm nhóm riêng', async () => {
      const toggle = await openWith(createMemoryDeviceSettingsStore());
      expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
      expect(screen.getByTestId('security-group-diagnostics')).toContainElement(toggle);
      expect(
        screen.getByText(
          'Khi ứng dụng gặp lỗi, gửi mã lỗi và loại máy để sửa lỗi. Không kèm tài khoản, email, mã đơn hay video.',
        ),
      ).toBeOnTheScreen();
    });

    it('tắt: lưu vào cài đặt máy; bật lại: báo hiệu lực đầy đủ từ lần mở sau', async () => {
      const store = createMemoryDeviceSettingsStore();
      const toggle = await openWith(store);
      await act(async () => fireEvent.press(toggle));
      await waitFor(async () => expect(await store.read('privacy.crash_reports')).toBe('false'));
      expect(screen.getByRole('switch', LABEL).props.accessibilityState).toMatchObject({
        checked: false,
      });
      await waitFor(() =>
        expect(screen.getByRole('switch', LABEL).props.accessibilityState).toMatchObject({
          disabled: false,
        }),
      );
      await act(async () => fireEvent.press(screen.getByRole('switch', LABEL)));
      await waitFor(async () => expect(await store.read('privacy.crash_reports')).toBe('true'));
      expect(
        await screen.findByText('Đã bật báo lỗi. Có hiệu lực đầy đủ từ lần mở ứng dụng sau.'),
      ).toBeOnTheScreen();
    });

    it('đã lưu tắt thì hiện tắt', async () => {
      const store = createMemoryDeviceSettingsStore();
      await store.write('privacy.crash_reports', 'false', 1);
      const toggle = await openWith(store);
      expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    });

    it('ghi cài đặt lỗi: báo lỗi, công tắc giữ nguyên', async () => {
      const toggle = await openWith({
        read: async () => undefined,
        write: async () => {
          throw new Error('đầy');
        },
      });
      await act(async () => fireEvent.press(toggle));
      expect(await screen.findByText('Chưa lưu được cài đặt. Bạn thử lại nhé.')).toBeOnTheScreen();
      expect(screen.getByRole('switch', LABEL).props.accessibilityState).toMatchObject({
        checked: true,
      });
    });
  });
});
