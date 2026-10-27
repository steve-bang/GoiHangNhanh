import { screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { SessionHydrator } from './SessionHydrator';
import { useSession } from './SessionProvider';

function Probe() {
  const { state, key } = useSession();
  return (
    <>
      <Text testID="status">{state.status}</Text>
      <Text testID="key">{key}</Text>
    </>
  );
}

describe('SessionHydrator', () => {
  it('nạp danh tính và shop từ cổng khi phiên trong bộ nhớ còn trống', async () => {
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: createFakePersonalGateways() },
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('signed_in'));
    expect(screen.getByTestId('key')).toHaveTextContent('fake-user-1:local-shop');
  });

  it('cổng lỗi: giữ nguyên chưa đăng nhập, không suy đoán phiên', async () => {
    const gateways = createFakePersonalGateways();
    gateways.account.failNext('AUTH_SERVICE_UNAVAILABLE');
    await renderWithProviders(
      <>
        <SessionHydrator />
        <Probe />
      </>,
      { personalGateways: gateways },
    );
    await waitFor(() => expect(gateways.account.getProfileCalls).toBe(1));
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
  });
});
