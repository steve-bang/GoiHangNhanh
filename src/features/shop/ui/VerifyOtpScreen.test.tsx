import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { colors } from '@/core/theme';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import {
  createFakeApi,
  FAKE_DEMO_EMAIL,
  FAKE_VALID_CODE,
  createUnavailableApi,
} from '@/api/testing';
import type { Gateways } from '../domain/types';
import { WithRecoveryState } from './recovery-test-harness';
import { VerifyOtpScreen } from './VerifyOtpScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
// Chế độ mã 6 số (O-22 hướng B, để sau v1): giữ kiểm thử giao diện đã có. v1 chạy `email_link`
// (decisions.md Q-29 / V1-03); chặn liên kết sâu ở chế độ đó có test cuối tệp.
let mockRecoveryMode: 'email_link' | 'otp' = 'otp';
// Thuộc tính đọc lúc dùng (getter), không chép giá trị lúc nạp module (biến lúc đó chưa gán).
jest.mock('@/core/config/feature-flags', () =>
  Object.defineProperty(
    { ...jest.requireActual<object>('@/core/config/feature-flags') },
    'PASSWORD_RECOVERY_MODE',
    { get: () => mockRecoveryMode, enumerable: true },
  ),
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);
const errors = resources.vi.errors;
const fullText = (m: string | { title: string; hint: string }) =>
  typeof m === 'string' ? m : `${m.title} ${m.hint}`;

const EMAIL = 'dasomething@example.com';
beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});
afterEach(() => {
  jest.useRealTimers();
});

/** Dựng màn sau khi đã "xin mã" (như người dùng vừa qua màn Quên mật khẩu). */
function renderOtp(options: { gateways?: Gateways; email?: string; waitSeconds?: number } = {}) {
  return renderWithProviders(
    <WithRecoveryState
      actions={() => [
        {
          type: 'code_requested',
          email: options.email ?? EMAIL,
          resendAvailableAt: Date.now() + (options.waitSeconds ?? 30) * 1000,
        },
      ]}
    >
      <VerifyOtpScreen />
    </WithRecoveryState>,
    options.gateways ? { gateways: options.gateways } : {},
  );
}
const input = () => screen.getByTestId('otp-input');
/** Các ô số là hình vẽ (ẩn khỏi trình đọc màn hình), nên phải tìm cả phần tử ẩn. */
const cell = (i: number) =>
  screen.getByTestId(`otp-input-cell-${i}`, { includeHiddenElements: true });
const submit = () => screen.getByTestId('otp-submit');

/**
 * Giống một ô nhập thật: hệ điều hành cắt chuỗi theo `maxLength` (nếu có) TRƯỚC khi gọi
 * `onChangeText`. `fireEvent.changeText` bỏ qua bước này nên phải mô phỏng tay, nếu không test
 * không bắt được lỗi cắt chuỗi dán.
 */
async function typeAsNative(text: string) {
  const max = input().props.maxLength as number | undefined;
  await fireEvent.changeText(input(), max === undefined ? text : text.slice(0, max));
}

describe('UI-A08 Nhập mã: chặn vào khi chưa xin mã', () => {
  it('chưa có email đã gửi mã: không hiện màn, chuyển về /forgot-password', async () => {
    await renderWithProviders(<VerifyOtpScreen />);
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.forgotPassword);
  });
});

describe('UI-A08 Nhập mã: giao diện', () => {
  it('có header, hình, tiêu đề, mô tả trung tính với email đã che, 6 ô, đếm ngược, nút và thẻ Mẹo bảo mật', async () => {
    await renderOtp();
    expect(screen.getByTestId('screen-UI-A08')).toBeOnTheScreen();
    expect(screen.getByText('Nhập mã OTP')).toBeOnTheScreen();
    expect(
      screen.getByTestId('otp-illustration', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Xác minh tài khoản của bạn')).toBeOnTheScreen();
    expect(screen.getByTestId('otp-description')).toHaveTextContent(
      'Nếu email này đã đăng ký, mã 6 chữ số đã được gửi đến da•••@example.com.',
    );
    // không lộ email đầy đủ
    expect(screen.queryByText(new RegExp(EMAIL))).toBeNull();
    expect(screen.getByText('Không phải email của bạn?')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Thay đổi thông tin' })).toBeOnTheScreen();
    for (let i = 0; i < 6; i++) expect(cell(i)).toBeOnTheScreen();
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 00:30');
    expect(screen.getByText('Mẹo bảo mật')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'Không chia sẻ mã xác minh với bất kỳ ai, kể cả người tự xưng là nhân viên hỗ trợ.',
      ),
    ).toBeOnTheScreen();
  });

  it('một ô nhập thật: bàn phím số, mã tự điền, nhãn truy cập; KHÔNG có maxLength (sẽ cắt chuỗi dán trước khi lọc)', async () => {
    await renderOtp();
    expect(input().props.keyboardType).toBe('number-pad');
    expect(input().props.maxLength).toBeUndefined();
    expect(input().props.textContentType).toBe('oneTimeCode');
    expect(input().props.autoComplete).toBe('one-time-code');
    expect(input().props.accessibilityLabel).toBe('Mã xác minh 6 chữ số');
  });

  it.each([
    [375, 667],
    [320, 568],
  ])('màn thấp %ix%i: đủ 6 ô, nút, đếm ngược và thẻ Mẹo', async (w, h) => {
    mockWindow.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
    await renderOtp();
    for (let i = 0; i < 6; i++) expect(cell(i)).toBeOnTheScreen();
    expect(submit()).toBeOnTheScreen();
    expect(screen.getByTestId('otp-countdown')).toBeOnTheScreen();
    expect(screen.getByTestId('otp-tip')).toBeOnTheScreen();
  });
});

describe('UI-A08 Nhập mã: nhập liệu', () => {
  it('chỉ nhận chữ số, tối đa 6; các ô hiện đúng số đã nhập', async () => {
    await renderOtp();
    await fireEvent.changeText(input(), '1a2-b3');
    expect(input().props.value).toBe('123');
    expect(within(cell(0)).getByText('1', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(within(cell(2)).getByText('3', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true });
  });

  it.each(['123 456', '123-456', ' 123 456 ', '123456', '1 2 3 4 5 6', '123456789'])(
    'dán %j đi qua đúng đường xử lý của ô thật: đủ 6 ô, tự xác minh với đúng 123456',
    async (pasted) => {
      const fake = createFakeApi();
      await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
      await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
      await typeAsNative(pasted);
      expect(input().props.value).toBe('123456');
      for (let i = 0; i < 6; i++) {
        expect(
          within(cell(i)).getByText(String(i + 1), { includeHiddenElements: true }),
        ).toBeOnTheScreen();
      }
      expect(fake.auth.verifyCalls).toEqual([{ email: FAKE_DEMO_EMAIL, code: '123456' }]);
      expect(mockNavigation.replace).toHaveBeenLastCalledWith(ROUTES.newPassword);
    },
  );

  it('gõ/dán thêm khi đã đủ 6 số mà mã không đổi: không xác minh lại cùng một mã', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    await typeAsNative('111111');
    expect(fake.auth.verifyCalls).toHaveLength(1);
    await typeAsNative('1111117');
    await typeAsNative('111 111');
    expect(fake.auth.verifyCalls).toHaveLength(1);
    expect(input().props.value).toBe('111111');
  });

  it('nút Xác minh khóa tới khi đủ 6 số; chưa đủ thì không gọi cổng', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake });
    await fireEvent.changeText(input(), '12345');
    await fireEvent.press(submit());
    expect(fake.auth.verifyCalls).toHaveLength(0);
  });

  it('rời ô khi mới nhập dở: báo thiếu số, đúng chữ', async () => {
    await renderOtp();
    await fireEvent.changeText(input(), '123');
    await fireEvent(input(), 'blur');
    expect(
      within(screen.getByTestId('otp-error')).getByText('Bạn nhập đủ 6 chữ số để tiếp tục nhé.'),
    ).toBeOnTheScreen();
    await fireEvent.changeText(input(), '1234');
    expect(screen.queryByTestId('otp-error')).toBeNull();
  });
});

describe('UI-A08 Nhập mã: xác minh', () => {
  it('tự xác minh khi đủ 6 số (nhập hoặc dán): sang /new-password bằng replace, không báo "thành công"', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    await fireEvent.changeText(
      input(),
      `${FAKE_VALID_CODE.slice(0, 3)} ${FAKE_VALID_CODE.slice(3)}`,
    );
    expect(fake.auth.verifyCalls).toEqual([{ email: FAKE_DEMO_EMAIL, code: FAKE_VALID_CODE }]);
    expect(mockNavigation.replace).toHaveBeenLastCalledWith(ROUTES.newPassword);
    expect(screen.queryByText(/thành công/i)).toBeNull();
    // vé không đi qua tham số điều hướng
    expect(JSON.stringify(mockNavigation.replace.mock.calls)).not.toContain('ticket');
  });

  it('đã rời màn trong lúc chờ cổng: mã đúng cũng KHÔNG chuyển sang /new-password và không giữ vé', async () => {
    let resolve: (v: { ticket: string }) => void = () => undefined;
    const verifyRecoveryCode = jest.fn(
      () =>
        new Promise<{ ticket: string }>((r) => {
          resolve = r;
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, verifyRecoveryCode },
      shop: createFakeApi().shop,
    };
    await renderOtp({ gateways });
    await fireEvent.changeText(input(), '123456');
    // người dùng bấm Back (về Quên mật khẩu) khi cổng còn chờ
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    mockNavigation.screenActive = false;
    await act(async () => resolve({ ticket: 't' }));
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
    expect(mockNavigation.reset).not.toHaveBeenCalled();
  });

  it('nút Xác minh gọi cổng khi đủ 6 số (sau khi tự xác minh lỗi rồi bấm lại)', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    await fireEvent.changeText(input(), '000000');
    expect(screen.getByTestId('otp-error')).toBeOnTheScreen();
    expect(submit().props.accessibilityState).toMatchObject({ disabled: false });
    await fireEvent.press(submit());
    expect(fake.auth.verifyCalls).toHaveLength(2);
  });

  it('đang xử lý: nút có vòng xoay/khóa; không gọi cổng lần hai', async () => {
    let resolve: (v: { ticket: string }) => void = () => undefined;
    const verifyRecoveryCode = jest.fn(
      () =>
        new Promise<{ ticket: string }>((r) => {
          resolve = r;
        }),
    );
    const gateways: Gateways = {
      session: createFakeApi().session,
      auth: { ...createUnavailableApi().auth, verifyRecoveryCode },
      shop: createFakeApi().shop,
    };
    await renderOtp({ gateways });
    await fireEvent.changeText(input(), '123456');
    expect(submit().props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    await fireEvent.press(submit());
    expect(verifyRecoveryCode).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ticket: 't' }));
    expect(mockNavigation.replace).toHaveBeenLastCalledWith(ROUTES.newPassword);
  });

  it('mã sai: lỗi dưới các ô + ô đỏ, giữ các số đã nhập; sửa thì lỗi tự mất', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    await fireEvent.changeText(input(), '111111');
    const error = screen.getByTestId('otp-error');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(
      within(error).getByText('Mã xác minh chưa chính xác. Bạn kiểm tra lại nhé!'),
    ).toBeOnTheScreen();
    expect(input().props.value).toBe('111111');
    const first = cell(0);
    expect(StyleSheet.flatten(first.props.style)).toMatchObject({ borderColor: colors.danger });
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    await fireEvent.changeText(input(), '11111');
    expect(screen.queryByTestId('otp-error')).toBeNull();
    expect(StyleSheet.flatten(cell(0).props.style)).not.toMatchObject({
      borderColor: colors.danger,
    });
  });

  it('mã hết hạn: banner kèm nút Gửi lại mã; bấm thì xin mã mới, xóa các số, hiện thông báo nhẹ', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    fake.auth.failNext('AUTH_OTP_EXPIRED');
    await fireEvent.changeText(input(), '123456');
    const banner = screen.getByTestId('form-error');
    expect(within(banner).getByText(fullText(errors.AUTH_OTP_EXPIRED))).toBeOnTheScreen();
    await fireEvent.press(within(banner).getByRole('button', { name: 'Gửi lại mã' }));
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL]);
    expect(input().props.value).toBe('');
    expect(screen.queryByTestId('form-error')).toBeNull();
    expect(
      within(screen.getByTestId('otp-resent')).getByText(
        'Mã mới đã được gửi. Bạn kiểm tra lại email nhé!',
      ),
    ).toBeOnTheScreen();
  });

  it('quá số lần: banner không có nút; mất mạng: banner + Thử lại gửi lại ĐÚNG mã', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    await fake.auth.requestPasswordRecovery(FAKE_DEMO_EMAIL);
    fake.auth.failNext('AUTH_TOO_MANY_REQUESTS');
    await fireEvent.changeText(input(), '123456');
    expect(
      within(screen.getByTestId('form-error')).getByText(
        'Bạn đã thử quá nhiều lần. Hãy thử lại sau ít phút.',
      ),
    ).toBeOnTheScreen();
    expect(within(screen.getByTestId('form-error')).queryByRole('button')).toBeNull();

    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.changeText(input(), '12345');
    await fireEvent.changeText(input(), FAKE_VALID_CODE);
    const banner = screen.getByTestId('form-error');
    await fireEvent.press(within(banner).getByRole('button', { name: 'Thử lại' }));
    expect(mockNavigation.replace).toHaveBeenLastCalledWith(ROUTES.newPassword);
  });

  it('bản "chưa kết nối": báo lỗi, không sang bước sau', async () => {
    await renderOtp({ gateways: createUnavailableApi() });
    await fireEvent.changeText(input(), '123456');
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
  });
});

describe('UI-A08 Nhập mã: đếm ngược và gửi lại', () => {
  it('đếm theo mốc thời gian; hết giờ thì thành "Gửi lại mã"; bấm thì đếm lại từ 00:30', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, email: FAKE_DEMO_EMAIL });
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 00:30');
    await act(async () => {
      jest.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 00:20');
    // timer bị trễ/treo 25 giây rồi mới chạy: vẫn đúng theo mốc, không cộng dồn
    await act(async () => {
      jest.setSystemTime(1_000_000 + 25_000);
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 00:04');
    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('otp-countdown')).toBeNull();
    const resend = screen.getByRole('link', { name: 'Gửi lại mã' });
    await fireEvent.press(resend);
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL]);
    expect(screen.getByTestId('otp-countdown')).toHaveTextContent('Gửi lại mã sau 00:30');
    expect(screen.getByTestId('otp-resent')).toBeOnTheScreen();
  });

  it('gửi lại lỗi (quá nhiều lần): banner, không báo "đã gửi"', async () => {
    const fake = createFakeApi();
    await renderOtp({ gateways: fake, waitSeconds: 0 });
    fake.auth.failNext('AUTH_TOO_MANY_REQUESTS');
    await fireEvent.press(screen.getByRole('link', { name: 'Gửi lại mã' }));
    expect(screen.getByTestId('form-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('otp-resent')).toBeNull();
  });
});

describe('UI-A08 Nhập mã: điều hướng', () => {
  it('Thay đổi thông tin và nút Back quay về bước trước', async () => {
    await renderOtp();
    await fireEvent.press(screen.getByRole('link', { name: 'Thay đổi thông tin' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(2);
  });
});

describe('UI-A08 Nhập mã: chế độ thư đặt lại (v1, D-14)', () => {
  beforeEach(() => {
    mockRecoveryMode = 'email_link';
  });
  afterEach(() => {
    mockRecoveryMode = 'otp';
  });

  it('liên kết sâu /verify-otp: không hiện màn, về Đăng nhập (kể cả khi đã gửi yêu cầu)', async () => {
    await renderOtp();
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.signIn);
    expect(mockNavigation.replace).toHaveBeenCalledTimes(1);
  });
});
