import { fireEvent, screen } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { createMemoryOrderStore } from '@/features/orders';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackConfirmScreen } from './PackConfirmScreen';
import { PackDoneScreen } from './PackDoneScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

// Chưa có recorder thật (RECORDER_ENABLED=false): vào thẳng UI-C04/UI-C06 (liên kết sâu) hay từ phiên
// thật đều KHÔNG được nói "đã lưu" (bất biến 3, 11).
describe.each([
  ['UI-C04 Xác nhận video', PackConfirmScreen, 'screen-UI-C04'],
  ['UI-C06 Hoàn tất đóng gói', PackDoneScreen, 'screen-UI-C06'],
] as const)('%s khi chưa ghi video thật', (_name, Screen, testID) => {
  async function open() {
    const store = createMemoryOrderStore();
    const details = await seedOrder(store, sampleOrder());
    const session = sampleSession(details);
    await store.saveSession(session);
    mockNavigation.params = { sessionId: session.id };
    await renderWithProviders(<Screen />, { orderStore: store });
  }

  it('chỉ báo chưa có video nào được lưu; không có badge "Đã lưu trên máy" hay câu "đã lưu"', async () => {
    await open();
    expect(await screen.findByTestId(testID)).toBeOnTheScreen();
    expect(screen.getByText('Bản thử giao diện: chưa có video nào được lưu.')).toBeOnTheScreen();
    expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
    expect(screen.queryByText(/đã lưu trên thiết bị/i)).toBeNull();
    expect(screen.queryByText(/đã hoàn tất/i)).toBeNull();
    expect(screen.queryByText(/Số video/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Lưu bằng chứng' })).toBeNull();
  });

  it('không hiện mã đơn thật như thể đã có bằng chứng, và có đường về Trang chủ', async () => {
    await open();
    await screen.findByTestId(testID);
    expect(screen.queryByText(/DH1234567890/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Về Trang chủ' }));
    expect(mockNavigation.replace).toHaveBeenCalledWith(ROUTES.home);
  });

  it('mở bằng tham số "code" cũ cũng không nói đã lưu', async () => {
    mockNavigation.params = { code: 'DEMO-0001' };
    await renderWithProviders(<Screen />);
    expect(await screen.findByTestId(testID)).toBeOnTheScreen();
    expect(screen.queryByText(/DEMO-0001/)).toBeNull();
    expect(screen.queryByText(/đã lưu trên thiết bị/i)).toBeNull();
  });
});
