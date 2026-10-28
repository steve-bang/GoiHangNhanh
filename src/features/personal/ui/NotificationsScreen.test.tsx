import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import { AppError } from '@/core/errors/app-error';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import {
  createFakePersonalGateways,
  FAKE_NOTIFICATION_DEFAULTS,
} from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import type { NotificationPreferences, PersonalGateways } from '../domain/types';
import { NotificationsScreen } from './NotificationsScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

const KEYS = ['uploadProblems', 'syncCompleted', 'storageNearlyFull', 'planExpiring'] as const;

async function setup(gateways: PersonalGateways = createFakePersonalGateways()) {
  await renderWithProviders(<NotificationsScreen />, { personalGateways: gateways });
  await waitFor(() => expect(screen.getByTestId('notification-options')).toBeOnTheScreen());
  return gateways;
}

const sw = (key: string) => screen.getByTestId(`notification-switch-${key}`);

/** Cổng cài đặt mà bài test tự quyết lúc nào lưu xong (kiểm tra thứ tự "chỉ báo sau khi cổng xác nhận"). */
function deferredGateways(initial: NotificationPreferences = FAKE_NOTIFICATION_DEFAULTS) {
  const calls: NotificationPreferences[] = [];
  let resolve!: (value: NotificationPreferences) => void;
  let reject!: (error: unknown) => void;
  const gateways: PersonalGateways = {
    ...createFakePersonalGateways(),
    settings: {
      getNotificationPreferences: async () => initial,
      updateNotificationPreferences: (next) => {
        calls.push(next);
        return new Promise<NotificationPreferences>((res, rej) => {
          resolve = res;
          reject = rej;
        });
      },
    },
  };
  return {
    gateways,
    calls,
    resolve: (v: NotificationPreferences) => resolve(v),
    reject: (e: unknown) => reject(e),
  };
}

describe('NotificationsScreen (UI-I04, khung 13)', () => {
  it('đúng bốn loại theo docs/09, nhãn + mô tả, mặc định theo cổng; không loại ngoài đặc tả', async () => {
    await setup();
    expect(screen.getByTestId('screen-UI-I04')).toBeOnTheScreen();
    expect(screen.getAllByRole('switch')).toHaveLength(4);
    for (const key of KEYS) {
      expect(sw(key)).toBeOnTheScreen();
      expect(sw(key).props.accessibilityLabel).toBeTruthy();
      expect(sw(key).props.accessibilityHint).toBeTruthy();
      expect(sw(key).props.accessibilityState).toMatchObject({
        checked: FAKE_NOTIFICATION_DEFAULTS[key],
      });
    }
    // Board vẽ thêm "Tài khoản", "Cập nhật sản phẩm" (không có trong docs/09) và "mỗi video tải thành công" bị cấm.
    expect(screen.queryByText('Cập nhật sản phẩm')).toBeNull();
    expect(screen.queryByText('Tài khoản')).toBeNull();
    expect(screen.queryByText(/mỗi video|từng video/i)).toBeNull();
  });

  it('nói thẳng thông báo đẩy sắp có, không hứa "bạn sẽ nhận"; không thẻ quyền hệ điều hành giả', async () => {
    await setup();
    const note = screen.getByTestId('notification-push-note');
    expect(note).toHaveTextContent(/sắp có/i);
    expect(note).toHaveTextContent(/chưa gửi thông báo nào/);
    expect(screen.getByTestId('screen-UI-I04')).not.toHaveTextContent(
      /bạn sẽ nhận|sẽ nhận được|đã bật thông báo|bảo vệ|an toàn/i,
    );
    expect(screen.queryByText('Quyền thông báo bị từ chối')).toBeNull();
    expect(screen.queryByText('Mở Cài đặt')).toBeNull();
  });

  it('bật công tắc: gọi cổng đúng một lần với đủ bốn giá trị, rồi báo "Đã lưu" sau khi cổng xác nhận', async () => {
    const d = deferredGateways();
    await setup(d.gateways);
    await fireEvent.press(sw('syncCompleted'));
    expect(d.calls).toEqual([{ ...FAKE_NOTIFICATION_DEFAULTS, syncCompleted: true }]);
    // Chưa xác nhận: hiện giá trị mới nhưng CHƯA báo đã lưu.
    expect(sw('syncCompleted').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByText('Đã lưu lựa chọn.')).toBeNull();
    await act(async () => d.resolve({ ...FAKE_NOTIFICATION_DEFAULTS, syncCompleted: true }));
    await waitFor(() => expect(screen.getByText('Đã lưu lựa chọn.')).toBeOnTheScreen());
    expect(sw('syncCompleted').props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    });
    // Lần bật tiếp theo dựa trên bản đã được xác nhận.
    await fireEvent.press(sw('uploadProblems'));
    expect(d.calls[1]).toEqual({
      ...FAKE_NOTIFICATION_DEFAULTS,
      syncCompleted: true,
      uploadProblems: false,
    });
  });

  it('đang lưu: mọi công tắc khóa, bấm lặp không gọi cổng lần hai', async () => {
    const d = deferredGateways();
    await setup(d.gateways);
    await fireEvent.press(sw('syncCompleted'));
    expect(sw('syncCompleted').props.accessibilityState).toMatchObject({ disabled: true });
    expect(sw('planExpiring').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(sw('syncCompleted'));
    await fireEvent.press(sw('planExpiring'));
    expect(d.calls).toHaveLength(1);
    await act(async () => d.resolve({ ...FAKE_NOTIFICATION_DEFAULTS, syncCompleted: true }));
  });

  it('lưu lỗi: công tắc hoàn về giá trị cũ, báo đúng câu theo mã lỗi, KHÔNG báo đã lưu, thử lại được', async () => {
    const gateways = createFakePersonalGateways();
    await setup(gateways);
    gateways.settings.failNext('SETTINGS_SAVE_FAILED');
    // failNext chỉ tiêu thụ ở lần gọi kế (get hoặc update): gọi update.
    await fireEvent.press(sw('uploadProblems'));
    await waitFor(() => expect(screen.getByTestId('notification-save-error')).toBeOnTheScreen());
    expect(screen.getByTestId('notification-save-error')).toHaveTextContent(
      /Chưa lưu được cài đặt\. Bạn thử lại nhé\.$/,
    );
    expect(sw('uploadProblems').props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    });
    expect(screen.queryByText('Đã lưu lựa chọn.')).toBeNull();
    // Thử lại: thành công, lỗi biến mất.
    await fireEvent.press(sw('uploadProblems'));
    await waitFor(() => expect(screen.getByText('Đã lưu lựa chọn.')).toBeOnTheScreen());
    expect(screen.queryByTestId('notification-save-error')).toBeNull();
    expect(sw('uploadProblems').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('cổng chưa kết nối: lỗi tải kèm Thử lại, không hiện công tắc nào (không giả đã lưu được)', async () => {
    await renderWithProviders(<NotificationsScreen />, {
      personalGateways: createUnavailablePersonalGateways() as never,
    });
    await waitFor(() => expect(screen.getByTestId('notification-load-error')).toBeOnTheScreen());
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /thử lại/i })).toBeOnTheScreen();
  });

  it('đang tải: khung chờ, chưa có công tắc', async () => {
    const gateways: PersonalGateways = {
      ...createFakePersonalGateways(),
      settings: {
        getNotificationPreferences: () => new Promise(() => undefined),
        updateNotificationPreferences: async (next) => next,
      },
    };
    await renderWithProviders(<NotificationsScreen />, { personalGateways: gateways });
    expect(screen.getByTestId('notification-loading')).toBeOnTheScreen();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });

  it('nút quay lại về màn trước', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalled();
  });

  describe('cô lập theo phiên (đổi tài khoản/cửa hàng)', () => {
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

    it('đổi phiên: tải lại tùy chọn của phiên mới; kết quả lưu muộn của phiên cũ bị bỏ (không toast, không rò)', async () => {
      const d = deferredGateways();
      const reads: number[] = [];
      const gateways: PersonalGateways = {
        ...d.gateways,
        settings: {
          ...d.gateways.settings,
          getNotificationPreferences: async () => {
            reads.push(reads.length);
            return FAKE_NOTIFICATION_DEFAULTS;
          },
        },
      };
      await renderWithProviders(
        <>
          <SwitchProbe />
          <NotificationsScreen />
        </>,
        { personalGateways: gateways },
      );
      await waitFor(() => expect(screen.getByTestId('notification-options')).toBeOnTheScreen());
      await fireEvent.press(sw('syncCompleted'));
      expect(sw('syncCompleted').props.accessibilityState).toMatchObject({ checked: true });
      await fireEvent.press(screen.getByTestId('switch-session'));
      await waitFor(() => expect(reads).toHaveLength(2));
      // Phiên mới: giá trị chờ của phiên cũ không còn, công tắc không bị khóa.
      await waitFor(() =>
        expect(sw('syncCompleted').props.accessibilityState).toMatchObject({
          checked: false,
          disabled: false,
        }),
      );
      await act(async () => d.resolve({ ...FAKE_NOTIFICATION_DEFAULTS, syncCompleted: true }));
      expect(screen.queryByText('Đã lưu lựa chọn.')).toBeNull();
      expect(sw('syncCompleted').props.accessibilityState).toMatchObject({ checked: false });
    });

    it('lỗi muộn của phiên cũ không hiện ở phiên mới', async () => {
      const d = deferredGateways();
      await renderWithProviders(
        <>
          <SwitchProbe />
          <NotificationsScreen />
        </>,
        { personalGateways: d.gateways },
      );
      await waitFor(() => expect(screen.getByTestId('notification-options')).toBeOnTheScreen());
      await fireEvent.press(sw('syncCompleted'));
      await fireEvent.press(screen.getByTestId('switch-session'));
      await act(async () => d.reject(new AppError('SETTINGS_SAVE_FAILED')));
      expect(screen.queryByTestId('notification-save-error')).toBeNull();
    });

    it('cổng giả đặt lại tùy chọn khi đăng xuất (tài khoản sau không thấy lựa chọn của tài khoản trước)', async () => {
      const gateways = createFakePersonalGateways();
      await gateways.settings.updateNotificationPreferences({
        ...FAKE_NOTIFICATION_DEFAULTS,
        syncCompleted: true,
      });
      await gateways.account.signOut();
      expect(await gateways.settings.getNotificationPreferences()).toEqual(
        FAKE_NOTIFICATION_DEFAULTS,
      );
    });
  });
});
