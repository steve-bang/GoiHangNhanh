import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
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
  return gateways;
}

async function fill(current: string, next: string, confirm: string) {
  await fireEvent.changeText(screen.getByTestId('change-password-current'), current);
  await fireEvent.changeText(screen.getByTestId('change-password-new'), next);
  await fireEvent.changeText(screen.getByTestId('change-password-confirm'), confirm);
}

const submit = () => fireEvent.press(screen.getByTestId('change-password-submit'));

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
    await fireEvent.press(screen.getByTestId('change-password-sign-in'));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
  });

  it('AUTH_SESSION_EXPIRED: báo hết phiên và có nút Đăng nhập lại', async () => {
    const gateways = await renderChange();
    await fill(FAKE_ACCOUNT_PASSWORD, 'matkhau-moi-1', 'matkhau-moi-1');
    gateways.account.failNext('AUTH_SESSION_EXPIRED');
    await submit();
    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('change-password-sign-in'));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
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
});
