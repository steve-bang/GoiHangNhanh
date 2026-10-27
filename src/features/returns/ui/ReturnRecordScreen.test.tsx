import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { ReturnRecordScreen } from './ReturnRecordScreen';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

describe('UI-D04 Quay video mở kiện (dùng chung khung quay)', () => {
  it('chưa ghi video thật: huy hiệu "Xem trước", không "Đang quay", không chấm đỏ, không đồng hồ', async () => {
    await renderWithProviders(<ReturnRecordScreen />);
    expect(await screen.findByText('Xem trước')).toBeOnTheScreen();
    expect(screen.queryByText('Đang quay')).toBeNull();
    expect(screen.queryByTestId('recording-dot')).toBeNull();
    expect(screen.queryByText('00:00')).toBeNull();
    expect(screen.getByText('Hồ sơ hoàn')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Dừng quay' })).toBeOnTheScreen();
  });
});
