import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { FAKE_ACCOUNT_PASSWORD, createFakePersonalGateways } from '../data/fake-personal-gateways';
import { ChangePasswordScreen } from './ChangePasswordScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => {
  resetMockNavigation();
});

async function renderChange(gateways = createFakePersonalGateways()) {
  await renderWithProviders(<ChangePasswordScreen />, { personalGateways: gateways });
  await waitFor(() => expect(screen.getByTestId('change-password-current')).toBeOnTheScreen());
  return gateways;
}

async function fill(current: string, next: string, confirm: string) {
  await fireEvent.changeText(screen.getByTestId('change-password-current'), current);
  await fireEvent.changeText(screen.getByTestId('change-password-new'), next);
  await fireEvent.changeText(screen.getByTestId('change-password-confirm'), confirm);
}

const submit = () => fireEvent.press(screen.getByTestId('change-password-submit'));
const confirmSignOut = async () => {
  const confirm = screen.getAllByText('Đăng xuất').at(-1);
  if (!confirm) throw new Error('Không thấy nút xác nhận');
  await fireEvent.press(confirm);
};

describe('ChangePasswordScreen (route con của UI-I05)', () => {
  it('ba ô mật khẩu đều ẩn mặc định và có nút Hiện', async () => {
    await renderChange();
    for (const id of ['current', 'new', 'confirm']) {
      expect(screen.getByTestId(`change-password-${id}`).props.secureTextEntry).toBe(true);
    }
    await fireEvent.press(screen.getByTestId('change-password-new-toggle'));
    expect(screen.getByTestId('change-password-new').props.secureTextEntry).toBeFalsy();
  });

  it('kiểm tra trước khi gửi: trống, dưới 8 ký tự, hai mật khẩu chưa khớp; không gọi cổng', async () => {
    const gateways = await renderChange();
    await submit();
    expect(screen.getByText('Hãy nhập mật khẩu hiện tại.')).toBeOnTheScreen();
    expect(screen.getByText('Hãy nhập mật khẩu mới.')).toBeOnTheScreen();

    await fill(FAKE_ACCOUNT_PASSWORD, 'ngan', 'ngan');
    expect(screen.getByText('Mật khẩu mới cần ít nhất 8 ký tự.')).toBeOnTheScreen();

    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-2');
    expect(screen.getByText('Hai mật khẩu chưa khớp nhau. Hãy nhập lại.')).toBeOnTheScreen();
    await submit();
    expect(gateways.account.changePasswordCalls).toBe(0);
  });

  it('khung 3: ba ô có dấu sao bắt buộc và gợi ý nhập, chỉ nêu quy tắc thật (8 ký tự), nút "Lưu"', async () => {
    await renderChange();
    for (const [id, label, placeholder] of [
      ['current', 'Mật khẩu hiện tại', 'Nhập mật khẩu hiện tại'],
      ['new', 'Mật khẩu mới', 'Nhập mật khẩu mới'],
      ['confirm', 'Xác nhận mật khẩu mới', 'Nhập lại mật khẩu mới'],
    ] as const) {
      const input = screen.getByTestId(`change-password-${id}`);
      expect(input.props.accessibilityLabel).toBe(label);
      expect(input.props.placeholder).toBe(placeholder);
      expect(
        screen.getByTestId(`change-password-${id}-required`, { includeHiddenElements: true }),
      ).toHaveTextContent('*');
    }
    expect(screen.getByText('Tối thiểu 8 ký tự')).toBeOnTheScreen();
    expect(screen.queryByText(/chữ và số/)).toBeNull();
    expect(screen.queryByText(/giữ tài khoản của bạn an toàn/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-social')).toBeNull();
  });

  it('nút luôn bật khi chưa gửi, không bật/tắt theo nội dung', async () => {
    await renderChange();
    const button = screen.getByTestId('change-password-submit');
    expect(button.props.accessibilityState?.disabled).toBe(false);
    await fill('a', 'b', 'c');
    expect(button.props.accessibilityState?.disabled).toBe(false);
  });

  it('chưa bấm thì chưa báo lỗi; bấm thì lỗi cụ thể tại ô và focus vào ô lỗi ĐẦU TIÊN', async () => {
    const focusSpy = jest.spyOn(TextInput.prototype, 'focus');
    focusSpy.mockClear();
    await renderChange();
    await fireEvent.changeText(screen.getByTestId('change-password-new'), 'ngan');
    expect(screen.queryByText('Mật khẩu mới cần ít nhất 8 ký tự.')).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId('change-password-current'),
      FAKE_ACCOUNT_PASSWORD,
    );
    await submit();
    expect(screen.getByText('Mật khẩu mới cần ít nhất 8 ký tự.')).toBeOnTheScreen();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    // Ô hiện tại đã hợp lệ nên focus đi vào ô mật khẩu mới.
    expect((focusSpy.mock.contexts[0] as { props: { testID: string } }).props.testID).toBe(
      'change-password-new',
    );
    focusSpy.mockRestore();
  });

  it('yêu cầu "Tối thiểu 8 ký tự" đổi biểu tượng, chữ đọc và trạng thái khi đạt, không chỉ đổi màu', async () => {
    await renderChange();
    const row = screen.getByTestId('change-password-requirement');
    expect(row.props.accessibilityLabel).toBe('Tối thiểu 8 ký tự. Chưa đạt');
    expect(screen.getByTestId('icon-ellipse-outline')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('change-password-new'), '1234567');
    expect(screen.getByTestId('change-password-requirement').props.accessibilityLabel).toBe(
      'Tối thiểu 8 ký tự. Chưa đạt',
    );
    await fireEvent.changeText(screen.getByTestId('change-password-new'), '12345678');
    expect(screen.getByTestId('change-password-requirement').props.accessibilityLabel).toBe(
      'Tối thiểu 8 ký tự. Đã đạt',
    );
    expect(screen.getByTestId('icon-checkmark-circle')).toBeOnTheScreen();
    expect(screen.queryByTestId('icon-ellipse-outline')).toBeNull();
  });

  it('mật khẩu mới trùng mật khẩu cũ bị chặn', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, FAKE_ACCOUNT_PASSWORD, FAKE_ACCOUNT_PASSWORD);
    await submit();
    expect(screen.getByText(/đang giống mật khẩu cũ/)).toBeOnTheScreen();
    expect(gateways.account.changePasswordCalls).toBe(0);
  });

  it('thành công: gọi cổng một lần, toast SAU khi xác nhận rồi quay lại', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    await submit();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
    expect(gateways.account.changePasswordCalls).toBe(1);
    expect(await screen.findByText('Đã đổi mật khẩu.')).toBeOnTheScreen();
  });

  it('chống gửi lặp: bấm liên tiếp khi đang gửi chỉ gọi cổng một lần', async () => {
    const gateways = createFakePersonalGateways();
    let release: () => void = () => undefined;
    gateways.account.changePassword = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    const spy = jest.spyOn(gateways.account, 'changePassword');
    await renderChange(gateways);
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    await submit();
    await submit();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Đã đổi mật khẩu.')).toBeNull();
    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it('AUTH_WRONG_CURRENT_PASSWORD (từ cổng): lỗi nằm ở ô mật khẩu hiện tại, giữ nguyên các ô; sửa ô thì xóa lỗi', async () => {
    const gateways = await renderChange();
    await fill('sai-mat-khau', 'matkhau-moi-1', 'matkhau-moi-1');
    await submit();
    expect(await screen.findByText('Mật khẩu hiện tại chưa đúng.')).toBeOnTheScreen();
    expect(screen.getByTestId('change-password-new').props.value).toBe('matkhau-moi-1');
    expect(mockNavigation.back).not.toHaveBeenCalled();
    expect(gateways.account.changePasswordCalls).toBe(1);
    await fireEvent.changeText(
      screen.getByTestId('change-password-current'),
      FAKE_ACCOUNT_PASSWORD,
    );
    expect(screen.queryByText('Mật khẩu hiện tại chưa đúng.')).toBeNull();
  });

  it('AUTH_WEAK_PASSWORD (từ cổng) hiện ở ô mật khẩu mới', async () => {
    await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, '12345678', '12345678');
    await submit();
    expect(await screen.findByText(/Mật khẩu này dễ đoán/)).toBeOnTheScreen();
  });

  it('AUTH_REQUIRES_RECENT_LOGIN: báo lỗi và có nút Đăng nhập lại về luồng đăng nhập sẵn có', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_REQUIRES_RECENT_LOGIN');
    await submit();
    expect(await screen.findByTestId('change-password-error')).toHaveTextContent(
      'Cần đăng nhập lại để xác nhận. Bạn đăng nhập lại rồi thử lại nhé.',
    );
    // Đi qua luồng Đăng xuất an toàn: xác nhận, đăng xuất thật, rồi về Đăng nhập với email điền sẵn.
    await fireEvent.press(screen.getByTestId('change-password-sign-in'));
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn));
    expect(gateways.account.signOutCalls).toBe(1);
  });

  it('Đăng nhập lại khi đang quay: chặn, không đăng xuất, không rời màn (PER-21)', async () => {
    const gateways = createFakePersonalGateways();
    await renderWithProviders(<ChangePasswordScreen />, {
      personalGateways: gateways,
      orderStore: { ...createMemoryOrderStore(), hasRecordingOnDevice: async () => true },
    });
    await waitFor(() => expect(screen.getByTestId('change-password-current')).toBeOnTheScreen());
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_REQUIRES_RECENT_LOGIN');
    await submit();
    await fireEvent.press(await screen.findByTestId('change-password-sign-in'));
    await confirmSignOut();
    expect(await screen.findByTestId('sign-out-recording')).toBeOnTheScreen();
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('Đăng nhập lại khi còn tệp chưa đồng bộ: cảnh báo, không đăng xuất', async () => {
    const gateways = createFakePersonalGateways();
    await renderWithProviders(<ChangePasswordScreen />, {
      personalGateways: gateways,
      orderStore: { ...createMemoryOrderStore(), countUnsyncedOnDevice: async () => 2 },
    });
    await waitFor(() => expect(screen.getByTestId('change-password-current')).toBeOnTheScreen());
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_SESSION_EXPIRED');
    await submit();
    await fireEvent.press(await screen.findByTestId('change-password-sign-in'));
    await confirmSignOut();
    expect(await screen.findByTestId('sign-out-unsynced')).toBeOnTheScreen();
    expect(gateways.account.signOutCalls).toBe(0);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('AUTH_SESSION_EXPIRED: báo hết phiên và có nút Đăng nhập lại', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_SESSION_EXPIRED');
    await submit();
    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('change-password-sign-in'));
    await confirmSignOut();
    await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn));
  });

  it('lỗi mạng: báo tại màn, không có nút đăng nhập lại, thử lại được và không báo thành công', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await submit();
    expect(await screen.findByTestId('change-password-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-sign-in')).toBeNull();
    expect(screen.queryByText('Đã đổi mật khẩu.')).toBeNull();
    await submit();
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['apple', 'Apple'],
    ['google', 'Google'],
  ] as const)(
    'tài khoản %s: thẻ giải thích THAY form, không ô mật khẩu, không nút Lưu, không gọi cổng',
    async (signInMethod, provider) => {
      const gateways = createFakePersonalGateways({ profile: { signInMethod } });
      await renderWithProviders(<ChangePasswordScreen />, { personalGateways: gateways });
      expect(await screen.findByTestId('change-password-social')).toBeOnTheScreen();
      expect(screen.getByText(`Tài khoản ${provider}`)).toBeOnTheScreen();
      expect(screen.getByText(new RegExp(`Bạn đang đăng nhập bằng ${provider}`))).toBeOnTheScreen();
      for (const id of ['current', 'new', 'confirm']) {
        expect(screen.queryByTestId(`change-password-${id}`)).toBeNull();
      }
      expect(screen.queryByTestId('change-password-submit')).toBeNull();
      expect(gateways.account.changePasswordCalls).toBe(0);
    },
  );

  it('đang tải cách đăng nhập: chưa hiện form (không hiện nhầm form cho tài khoản Apple/Google)', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.getProfile = () => new Promise(() => undefined);
    await renderWithProviders(<ChangePasswordScreen />, { personalGateways: gateways });
    expect(screen.getByTestId('change-password-loading')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-current')).toBeNull();
    expect(screen.queryByTestId('change-password-submit')).toBeNull();
  });

  it('không tải được hồ sơ: lỗi tại màn có Thử lại, không form; thử lại xong thì hiện form', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderWithProviders(<ChangePasswordScreen />, { personalGateways: gateways });
    expect(await screen.findByTestId('change-password-load-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('change-password-current')).toBeNull();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('change-password-current')).toBeOnTheScreen());
  });
});
