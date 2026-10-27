import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways, FAKE_DEMO_EMAIL, FAKE_VALID_CODE } from '../data/fake-gateways';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { NewPasswordScreen } from './NewPasswordScreen';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { VerifyOtpScreen } from './VerifyOtpScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const mockWindow = jest.mocked(useWindowDimensions);

beforeEach(() => {
  mockWindow.mockReturnValue({ width: 390, height: 844, scale: 3, fontScale: 1 });
  resetMockNavigation();
});

type Where = 'none' | 'forgot' | 'verify' | 'newPassword';

/**
 * Mô phỏng ngăn xếp điều hướng: Quên mật khẩu nằm dưới, Nhập mã/Mật khẩu mới nằm trên (như thật).
 * `forgotShown` điều khiển việc màn Quên mật khẩu còn trong ngăn xếp; `top` là màn phía trên.
 */
function StackHarness() {
  const [forgotShown, setForgotShown] = useState(false);
  const [top, setTop] = useState<Where>('none');
  const { recovery } = useOnboardingFlow();
  return (
    <>
      <Pressable testID="open-forgot" onPress={() => setForgotShown(true)} />
      <Pressable testID="close-forgot" onPress={() => setForgotShown(false)} />
      <Pressable testID="open-verify" onPress={() => setTop('verify')} />
      <Pressable testID="open-new-password" onPress={() => setTop('newPassword')} />
      <Pressable testID="close-top" onPress={() => setTop('none')} />
      <Text testID="probe-requested">{recovery.requestedEmail ?? '(không)'}</Text>
      <Text testID="probe-ticket">{recovery.ticket ?? '(không)'}</Text>
      {forgotShown ? <ForgotPasswordScreen /> : null}
      {top === 'verify' ? <VerifyOtpScreen /> : null}
      {top === 'newPassword' ? <NewPasswordScreen /> : null}
    </>
  );
}

const press = (id: string) => fireEvent.press(screen.getByTestId(id));

/** Đi hết luồng thật: xin mã, nhập mã đúng, có vé. Màn Quên mật khẩu còn trong ngăn xếp. */
async function goThroughRecovery() {
  await press('open-forgot');
  await fireEvent.changeText(screen.getByTestId('forgot-email'), FAKE_DEMO_EMAIL);
  await press('forgot-submit');
  await press('open-verify');
  await fireEvent.changeText(screen.getByTestId('otp-input'), FAKE_VALID_CODE);
  await press('close-top'); // Nhập mã bị thay bằng Mật khẩu mới (replace)
  expect(screen.getByTestId('probe-ticket')).toHaveTextContent('fake-ticket-1');
}

describe('luồng khôi phục: không vào lại các màn sau khi đã rời luồng (docs/09 mục 5.6)', () => {
  it('đang trong luồng (Quên mật khẩu còn trong ngăn xếp): Nhập mã và Mật khẩu mới vào được', async () => {
    await renderWithProviders(<StackHarness />, { gateways: createFakeGateways() });
    await goThroughRecovery();
    await press('open-new-password');
    expect(screen.getByTestId('screen-UI-A09')).toBeOnTheScreen();
    // chỉ có lần Nhập mã -> Mật khẩu mới; không có lần bị đẩy ngược về bước trước
    expect(mockNavigation.replace.mock.calls).toEqual([[ROUTES.newPassword]]);
  });

  it('Back ra khỏi Quên mật khẩu rồi vào thẳng /verify-otp: bị đẩy về /forgot-password', async () => {
    await renderWithProviders(<StackHarness />, { gateways: createFakeGateways() });
    await press('open-forgot');
    await fireEvent.changeText(screen.getByTestId('forgot-email'), FAKE_DEMO_EMAIL);
    await press('forgot-submit');
    expect(screen.getByTestId('probe-requested')).toHaveTextContent(FAKE_DEMO_EMAIL);
    await press('close-forgot'); // người dùng rời luồng
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
    await press('open-verify'); // đường dẫn trực tiếp
    expect(screen.queryByTestId('screen-UI-A08')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.forgotPassword);
  });

  it('Back ra khỏi Quên mật khẩu sau khi đã có vé rồi vào thẳng /new-password: bị đẩy về /forgot-password', async () => {
    await renderWithProviders(<StackHarness />, { gateways: createFakeGateways() });
    await goThroughRecovery();
    await press('close-forgot');
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
    await press('open-new-password');
    expect(screen.queryByTestId('screen-UI-A09')).toBeNull();
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.forgotPassword);
  });

  it('"Quay lại đăng nhập" cũng xóa điều kiện vào các màn sau', async () => {
    await renderWithProviders(<StackHarness />, { gateways: createFakeGateways() });
    await goThroughRecovery();
    await fireEvent.press(screen.getByRole('link', { name: 'Quay lại đăng nhập' }));
    expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.signIn);
    expect(screen.getByTestId('probe-ticket')).toHaveTextContent('(không)');
    expect(screen.getByTestId('probe-requested')).toHaveTextContent('(không)');
  });
});
