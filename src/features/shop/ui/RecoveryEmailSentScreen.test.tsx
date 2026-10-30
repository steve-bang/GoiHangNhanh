import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { Text, useWindowDimensions } from 'react-native';

import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeApi, FAKE_DEMO_EMAIL, FAKE_RESEND_SECONDS } from '@/api/testing';
import type { Gateways } from '../domain/types';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { RecoveryEmailSentScreen } from './RecoveryEmailSentScreen';
import { WithRecoveryState } from './recovery-test-harness';

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
afterEach(() => {
  jest.useRealTimers();
});

/** Chỉ để test đọc trạng thái luồng khôi phục. */
function RecoveryProbe() {
  const { recovery } = useOnboardingFlow();
  return (
    <>
      <Text testID="probe-requested">{recovery.requestedEmail ?? '(không)'}</Text>
      <Text testID="probe-signin-email">{recovery.signInEmail ?? '(không)'}</Text>
    </>
  );
}

/** Dựng màn như người dùng vừa gửi thư ở Quên mật khẩu. */
function renderSent(options: { gateways?: Gateways; email?: string; waitSeconds?: number } = {}) {
  return renderWithProviders(
    <WithRecoveryState
      actions={() => [
        {
          type: 'code_requested',
          email: options.email ?? FAKE_DEMO_EMAIL,
          resendAvailableAt: Date.now() + (options.waitSeconds ?? 60) * 1000,
        },
      ]}
    >
      <RecoveryEmailSentScreen />
      <RecoveryProbe />
    </WithRecoveryState>,
    options.gateways ? { gateways: options.gateways } : {},
  );
}

describe('Kiểm tra hộp thư (UI-A07 /forgot-password/sent): chặn vào', () => {
  it('chưa gửi yêu cầu (liên kết sâu): không hiện màn, về /forgot-password', async () => {
    await renderWithProviders(<RecoveryEmailSentScreen />);
    expect(screen.queryByTestId('screen-UI-A07-sent')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.forgotPassword);
  });
});

describe('Kiểm tra hộp thư: giao diện', () => {
  it('tiêu đề, mô tả TRUNG TÍNH với email đã che (không lộ cả địa chỉ), Thư rác, nút về Đăng nhập', async () => {
    await renderSent({ email: 'lan.anh@example.com' });
    expect(screen.getByTestId('screen-UI-A07-sent')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Kiểm tra hộp thư' })).toBeOnTheScreen();
    const description = screen.getByTestId('recovery-sent-description');
    expect(description).toHaveTextContent(
      'Nếu la•••@example.com đã đăng ký Đơn Chứng, thư đặt lại mật khẩu sẽ tới trong vài phút.',
    );
    expect(
      within(screen.getByTestId('screen-UI-A07-sent')).queryByText(/lan\.anh@example\.com/),
    ).toBeNull();
    expect(screen.getByText('Không thấy thư?')).toBeOnTheScreen();
    expect(screen.getByText(/Thư rác/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Quay lại đăng nhập' })).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Đổi email' })).toBeOnTheScreen();
    // không nói "đã gửi tới email của bạn" như một điều chắc chắn, không nói email có tài khoản
    expect(screen.queryByText(/đã được gửi|chưa có tài khoản|không tồn tại/i)).toBeNull();
  });

  it.each([
    [320, 568],
    [360, 800],
  ])('màn %ix%i: vẫn đủ nút và thẻ gợi ý', async (w, h) => {
    mockWindow.mockReturnValue({ width: w, height: h, scale: 2, fontScale: 1 });
    await renderSent();
    expect(screen.getByTestId('recovery-sent-back-to-sign-in')).toBeOnTheScreen();
    expect(screen.getByTestId('recovery-sent-tip')).toBeOnTheScreen();
  });
});

describe('Kiểm tra hộp thư: gửi lại', () => {
  it('đếm ngược theo mốc đã lưu; hết giờ mới có nút Gửi lại email', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-30T08:00:00Z') });
    await renderSent({ waitSeconds: 60 });
    expect(screen.getByTestId('recovery-sent-countdown')).toHaveTextContent(
      'Gửi lại email sau 01:00',
    );
    expect(screen.queryByTestId('recovery-sent-resend')).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(59_000);
    });
    expect(screen.getByTestId('recovery-sent-countdown')).toHaveTextContent(/00:01$/);
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });
    expect(screen.queryByTestId('recovery-sent-countdown')).toBeNull();
    expect(screen.getByRole('button', { name: 'Gửi lại email' })).toBeOnTheScreen();
  });

  it('Gửi lại: gọi cổng đúng email, báo đã gửi lại, đếm ngược lại từ đầu', async () => {
    const fake = createFakeApi();
    await renderSent({ gateways: fake, waitSeconds: 0 });
    await fireEvent.press(screen.getByTestId('recovery-sent-resend'));
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL]);
    expect(screen.getByTestId('recovery-sent-resent')).toHaveTextContent(
      /Đã gửi lại\. Nếu email đã đăng ký, thư sẽ đến trong vài phút\.$/,
    );
    expect(screen.getByTestId('recovery-sent-countdown')).toHaveTextContent(
      `Gửi lại email sau 00:${String(FAKE_RESEND_SECONDS).padStart(2, '0')}`,
    );
  });

  it('Gửi lại lỗi (hệ thống bận): câu email + Thử lại; không báo đã gửi', async () => {
    const fake = createFakeApi();
    await renderSent({ gateways: fake, waitSeconds: 0 });
    fake.auth.failNext('AUTH_SERVICE_UNAVAILABLE');
    await fireEvent.press(screen.getByTestId('recovery-sent-resend'));
    const banner = screen.getByTestId('form-error');
    expect(
      within(banner).getByText('Chưa gửi được email. Bạn thử lại sau ít phút nhé!'),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId('recovery-sent-resent')).toBeNull();
    await fireEvent.press(within(banner).getByRole('button', { name: 'Thử lại' }));
    expect(fake.auth.recoveryRequests).toEqual([FAKE_DEMO_EMAIL, FAKE_DEMO_EMAIL]);
    expect(screen.getByTestId('recovery-sent-resent')).toBeOnTheScreen();
  });

  it('Gửi lại quá nhiều lần / mất mạng: câu tương ứng', async () => {
    const fake = createFakeApi();
    await renderSent({ gateways: fake, waitSeconds: 0 });
    fake.auth.failNext('AUTH_TOO_MANY_REQUESTS');
    await fireEvent.press(screen.getByTestId('recovery-sent-resend'));
    expect(
      within(screen.getByTestId('form-error')).getByText(
        'Bạn đã gửi nhiều lần. Hãy thử lại sau ít phút.',
      ),
    ).toBeOnTheScreen();
    fake.auth.failNext('AUTH_NETWORK_ERROR');
    await fireEvent.press(screen.getByTestId('recovery-sent-resend'));
    expect(
      within(screen.getByTestId('form-error')).getByText(fullText(errors.AUTH_NETWORK_ERROR)),
    ).toBeOnTheScreen();
  });
});

describe('Kiểm tra hộp thư: điều hướng', () => {
  it('Quay lại đăng nhập: reset /sign-in không kèm tham số; email điền sẵn qua trạng thái luồng; xóa điều kiện vào màn', async () => {
    await renderSent();
    await fireEvent.press(screen.getByTestId('recovery-sent-back-to-sign-in'));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
    expect(screen.getByTestId('probe-signin-email')).toHaveTextContent(FAKE_DEMO_EMAIL);
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
  });

  it('Đổi email và nút Back: quay về Quên mật khẩu (back), giữ trạng thái luồng', async () => {
    await renderSent();
    await fireEvent.press(screen.getByRole('link', { name: 'Đổi email' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Quay lại' }));
    expect(mockNavigation.back).toHaveBeenCalledTimes(2);
    expect(mockNavigation.reset).not.toHaveBeenCalled();
    expect(screen.getByTestId('probe-requested')).toHaveTextContent(FAKE_DEMO_EMAIL);
  });
});
