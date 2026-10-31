import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { NotificationListScreen } from './NotificationListScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

describe('UI-I07 tab Thông báo (V1-10)', () => {
  it('trạng thái rỗng trung thực: v1 không gửi thông báo, chỉ nơi xem lỗi tải lên', async () => {
    await renderWithProviders(<NotificationListScreen />);
    expect(screen.getByTestId('screen-UI-I07')).toBeOnTheScreen();
    expect(screen.getByText('Chưa có thông báo')).toBeOnTheScreen();
    expect(
      screen.getByText('Ứng dụng chưa gửi thông báo. Lỗi tải lên xem ở Trung tâm đồng bộ.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/sắp có/i)).toBeNull();
  });

  it('nút mở Trung tâm đồng bộ; là màn gốc của tab nên không có nút quay lại', async () => {
    await renderWithProviders(<NotificationListScreen />);
    expect(screen.queryByLabelText('Quay lại')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mở Trung tâm đồng bộ' }));
    expect(mockNavigation.push).toHaveBeenLastCalledWith(ROUTES.sync);
  });
});
