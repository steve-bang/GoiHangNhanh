import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, TextInput } from 'react-native';

import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { EditProfileScreen } from './EditProfileScreen';
import { ProfileScreen } from './ProfileScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => {
  resetMockNavigation();
});

const saveButton = () => screen.getByTestId('edit-profile-save');
const isDisabled = () => Boolean(saveButton().props.accessibilityState?.disabled);

async function renderEdit(
  gateways = createFakePersonalGateways({ profile: { displayName: 'Lan' } }),
) {
  await renderWithProviders(<EditProfileScreen />, { personalGateways: gateways });
  await waitFor(() => expect(screen.getByTestId('edit-profile-name')).toBeOnTheScreen());
  return gateways;
}

describe('EditProfileScreen (route con của UI-I01)', () => {
  it('khung 2: nhãn "Họ và tên" có dấu sao bắt buộc, giá trị hiện tại, KHÔNG có ô email, Lưu tắt khi chưa sửa và nằm trong nội dung (không ghim đáy)', async () => {
    await renderEdit();
    expect(screen.getByTestId('edit-profile-name').props.value).toBe('Lan');
    expect(screen.getByText('Họ và tên')).toBeOnTheScreen();
    expect(
      screen.getByTestId('edit-profile-name-required', { includeHiddenElements: true }),
    ).toHaveTextContent('*');
    expect(screen.queryByTestId('edit-profile-email')).toBeNull();
    expect(screen.queryByText('demo@example.com')).toBeNull();
    expect(screen.queryByTestId('icon-lock-closed-outline')).toBeNull();
    expect(screen.getByLabelText('Lưu')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-profile-avatar')).toBeNull();
    expect(screen.queryByText('L', { includeHiddenElements: true })).toBeNull();
    expect(isDisabled()).toBe(true);
  });

  it('nút Lưu chỉ tắt khi chưa có thay đổi; xóa trống thì VẪN bật, bấm mới báo lỗi tại ô và đưa focus vào ô', async () => {
    const focusSpy = jest.spyOn(TextInput.prototype, 'focus');
    focusSpy.mockClear();
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), '   ');
    // Chưa bấm Lưu: chưa báo lỗi, nút vẫn bật.
    expect(screen.queryByText('Hãy nhập họ và tên.')).toBeNull();
    expect(isDisabled()).toBe(false);
    await fireEvent.press(saveButton());
    expect(screen.getByText('Hãy nhập họ và tên.')).toBeOnTheScreen();
    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(isDisabled()).toBe(false);
    expect(gateways.account.updateCalls).toHaveLength(0);

    // Sau lần bấm đầu, lỗi cập nhật theo lúc gõ (quá dài), vẫn không gọi cổng.
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'a'.repeat(51));
    expect(screen.getByText(/rút gọn xuống 50 ký tự/)).toBeOnTheScreen();
    await fireEvent.press(saveButton());
    expect(gateways.account.updateCalls).toHaveLength(0);
    expect(focusSpy).toHaveBeenCalledTimes(2);

    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    expect(screen.queryByText(/rút gọn xuống 50 ký tự/)).toBeNull();
    focusSpy.mockRestore();
  });

  it('lưu thành công: gọi cổng một lần với tên đã cắt khoảng trắng, toast SAU khi xác nhận, rồi quay lại', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), '  Lan Anh  ');
    expect(isDisabled()).toBe(false);
    await fireEvent.press(saveButton());
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
    expect(gateways.account.updateCalls).toEqual([{ displayName: 'Lan Anh' }]);
    expect(mockNavigation.allowLeave).toHaveBeenCalled();
    expect(await screen.findByText('Đã lưu họ tên.')).toBeOnTheScreen();
  });

  it('chống gửi lặp: bấm liên tiếp khi đang lưu chỉ gọi cổng một lần, không báo thành công sớm', async () => {
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan' } });
    let release: () => void = () => undefined;
    const original = gateways.account.updateProfile.bind(gateways.account);
    gateways.account.updateProfile = (input) =>
      new Promise((resolve) => {
        release = () => resolve(original(input));
      });
    await renderEdit(gateways);
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    await fireEvent.press(saveButton());
    await fireEvent.press(saveButton());
    expect(isDisabled()).toBe(true);
    expect(screen.queryByText('Đã lưu họ tên.')).toBeNull();
    expect(mockNavigation.back).not.toHaveBeenCalled();
    await act(async () => {
      release();
    });
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it('PROFILE_SAVE_FAILED: lỗi hiện tại màn, giữ chữ đã gõ, không toast thành công, không quay lại; thử lại được', async () => {
    const gateways = await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    gateways.account.failNext('PROFILE_SAVE_FAILED');
    await fireEvent.press(saveButton());
    expect(await screen.findByTestId('edit-profile-save-error')).toHaveTextContent(
      'Chưa cập nhật được thông tin. Bạn thử lại nhé.',
    );
    expect(screen.getByTestId('edit-profile-name').props.value).toBe('Lan Anh');
    expect(screen.queryByText('Đã lưu họ tên.')).toBeNull();
    expect(mockNavigation.back).not.toHaveBeenCalled();
    expect(isDisabled()).toBe(false);

    await fireEvent.press(saveButton());
    await waitFor(() => expect(mockNavigation.back).toHaveBeenCalledTimes(1));
  });

  it('hủy khi có thay đổi: hỏi xác nhận; "Tiếp tục sửa" giữ nguyên, "Bỏ thay đổi" thì rời', async () => {
    await renderEdit();
    expect(mockNavigation.leaveGuardEnabled).toBe(false);
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    expect(mockNavigation.leaveGuardEnabled).toBe(true);
    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    expect(screen.getByText('Bỏ thay đổi?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Tiếp tục sửa'));
    expect(screen.queryByText('Bỏ thay đổi?')).toBeNull();
    expect(mockNavigation.back).not.toHaveBeenCalled();

    await act(async () => {
      mockNavigation.attemptLeave?.();
    });
    await fireEvent.press(screen.getByText('Bỏ thay đổi'));
    expect(mockNavigation.allowLeave).toHaveBeenCalled();
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
  });

  it('sửa về đúng giá trị cũ thì không còn là thay đổi (không chặn rời màn)', async () => {
    await renderEdit();
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), ' Lan ');
    expect(mockNavigation.leaveGuardEnabled).toBe(false);
    expect(isDisabled()).toBe(true);
  });

  it('không tải được hồ sơ: lỗi cục bộ có Thử lại, không có ô nhập', async () => {
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan' } });
    gateways.account.failNext('AUTH_NETWORK_ERROR');
    await renderWithProviders(<EditProfileScreen />, { personalGateways: gateways });
    expect(await screen.findByTestId('edit-profile-load-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('edit-profile-name')).toBeNull();
    expect(screen.queryByTestId('edit-profile-save')).toBeNull();
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('edit-profile-name')).toBeOnTheScreen());
  });

  it('đổi phiên (tài khoản khác): bỏ bản nháp và dữ liệu cũ, không rò sang phiên mới', async () => {
    function SwitchProbe() {
      const { beginSession } = useSession();
      return (
        <Pressable
          testID="switch-session"
          onPress={() =>
            beginSession({ uid: 'u2', email: 'b@example.com', displayName: null }, 's2')
          }
        />
      );
    }
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan' } });
    await renderWithProviders(
      <>
        <SwitchProbe />
        <EditProfileScreen />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('edit-profile-name')).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Nháp của phiên cũ');
    await fireEvent.press(screen.getByTestId('switch-session'));
    await waitFor(() => expect(gateways.account.getProfileCalls).toBe(2));
    await waitFor(() => expect(screen.getByTestId('edit-profile-name')).toBeOnTheScreen());
  });

  it('sau khi lưu, màn Cá nhân đang mở bên dưới hiện tên mới (tải lại theo phiên)', async () => {
    const gateways = createFakePersonalGateways({ profile: { displayName: 'Lan' } });
    await renderWithProviders(
      <>
        <ProfileScreen />
        <EditProfileScreen />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan/));
    await waitFor(() => expect(screen.getByTestId('edit-profile-name')).toBeOnTheScreen());
    await fireEvent.changeText(screen.getByTestId('edit-profile-name'), 'Lan Anh');
    await fireEvent.press(saveButton());
    await waitFor(() => expect(screen.getByTestId('profile-summary')).toHaveTextContent(/Lan Anh/));
  });
});
