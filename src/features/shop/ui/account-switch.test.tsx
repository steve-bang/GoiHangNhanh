import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text, useWindowDimensions } from 'react-native';

import { resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakeGateways, FAKE_DEMO_PASSWORD, FAKE_NO_SHOP_EMAIL } from '../data/fake-gateways';
import { CreateShopScreen } from './CreateShopScreen';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';

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

type Step = 'signUp' | 'signIn' | 'createShop';

/** Thay cho router: đổi màn bằng nút, state luồng nằm ở Provider nên giữ nguyên như app thật. */
function Router() {
  const [step, setStep] = useState<Step>('signUp');
  const { state } = useOnboardingFlow();
  return (
    <>
      <Text testID="probe-shop-owner">{state.shopOwnerUid ?? '(không)'}</Text>
      {(['signUp', 'signIn', 'createShop'] as const).map((s) => (
        <Pressable key={s} testID={`go-${s}`} onPress={() => setStep(s)} />
      ))}
      {step === 'signUp' ? <SignUpScreen /> : null}
      {step === 'signIn' ? <SignInScreen /> : null}
      {step === 'createShop' ? <CreateShopScreen /> : null}
    </>
  );
}

const go = (step: Step) => fireEvent.press(screen.getByTestId(`go-${step}`));
const PASSWORD = 'mat-khau-dai-1';

async function signUpA() {
  await fireEvent.changeText(screen.getByTestId('signup-email'), 'a@example.com');
  await fireEvent.changeText(screen.getByTestId('signup-password'), PASSWORD);
  await fireEvent.press(screen.getByTestId('signup-submit'));
}
async function createShopA(name: string) {
  await go('createShop');
  await fireEvent.changeText(screen.getByTestId('shop-name-input'), name);
  await fireEvent.press(screen.getByTestId('create-shop-submit'));
}
async function signIn(email: string, password: string) {
  await go('signIn');
  await fireEvent.changeText(screen.getByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
}

describe('đổi tài khoản giữa luồng: không rò shop (bất biến #8)', () => {
  it('A đăng ký + tạo shop, Back, đăng nhập B chưa có shop: form rỗng, createShop (không updateShop), không bao giờ gửi shopId của A', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<Router />, { gateways: fake });
    await signUpA();
    await createShopA('Shop A');
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(screen.getByTestId('probe-shop-owner')).not.toHaveTextContent('(không)');

    await signIn(FAKE_NO_SHOP_EMAIL, FAKE_DEMO_PASSWORD);
    expect(screen.getByTestId('probe-shop-owner')).toHaveTextContent('(không)');
    await go('createShop');
    expect(screen.getByTestId('shop-name-input').props.value).toBe('');
    expect(screen.getByTestId('create-shop-submit').props.accessibilityState).toMatchObject({
      disabled: true,
    });

    // cùng tên với shop của A: vẫn phải TẠO shop cho B, không đi thẳng Hoàn tất
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop A');
    await fireEvent.press(screen.getByTestId('create-shop-submit'));
    expect(fake.shop.createCalls).toHaveLength(2);
    expect(fake.shop.updateCalls).toHaveLength(0);

    // sửa tên sau khi quay lại: cập nhật shop của B, không phải của A
    await go('signIn');
    await go('createShop');
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop B');
    await fireEvent.press(screen.getByTestId('create-shop-submit'));
    expect(fake.shop.updateCalls).toHaveLength(1);
    expect(fake.shop.updateCalls[0]?.shopId).toBe('fake-shop-2');
    expect(JSON.stringify(fake.shop.updateCalls)).not.toContain('fake-shop-1');
  });

  it('A quay lại đúng A (đăng nhập lại): giữ tên đã nhập và dùng updateShop', async () => {
    const fake = createFakeGateways();
    await renderWithProviders(<Router />, { gateways: fake });
    await signUpA();
    await createShopA('Shop A');
    await signIn('a@example.com', PASSWORD);
    await go('createShop');
    expect(screen.getByTestId('shop-name-input').props.value).toBe('Shop A');
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop A Mới');
    await fireEvent.press(screen.getByTestId('create-shop-submit'));
    expect(fake.shop.createCalls).toHaveLength(1);
    expect(fake.shop.updateCalls).toEqual([
      { shopId: 'fake-shop-1', name: 'Shop A Mới', sellingSources: [] },
    ]);
  });

  it('kết quả tạo shop của A đến muộn khi luồng đã sang B: bị bỏ qua, B không nhận shop của A', async () => {
    const fake = createFakeGateways();
    let resolve: (id: string) => void = () => undefined;
    const gateways = {
      auth: fake.auth,
      session: fake.session,
      shop: {
        ...fake.shop,
        createShop: jest.fn(
          (input: { name: string }) =>
            new Promise<{ id: string; name: string; sellingSources: [] }>((r) => {
              resolve = (id) => r({ id, name: input.name, sellingSources: [] });
            }),
        ),
        updateShop: fake.shop.updateShop.bind(fake.shop),
      },
    };
    await renderWithProviders(<Router />, { gateways });
    await signUpA();
    await go('createShop');
    await fireEvent.changeText(screen.getByTestId('shop-name-input'), 'Shop A');
    await fireEvent.press(screen.getByTestId('create-shop-submit'));
    await signIn(FAKE_NO_SHOP_EMAIL, FAKE_DEMO_PASSWORD);
    await fireEvent.press(screen.getByTestId('go-createShop'));
    await act(async () => resolve('shop-cua-A'));
    expect(screen.getByTestId('probe-shop-owner')).toHaveTextContent('(không)');
    expect(screen.getByTestId('shop-name-input').props.value).toBe('');
  });
});
