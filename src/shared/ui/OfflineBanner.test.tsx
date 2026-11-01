import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner (UI-F04)', () => {
  it('ẩn khi có mạng', async () => {
    await renderWithProviders(<OfflineBanner visible={false} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('nói đúng: sẽ tự tải lên khi có mạng, không nói đã sao lưu', async () => {
    await renderWithProviders(<OfflineBanner visible />);
    expect(screen.getByRole('alert')).toBeOnTheScreen();
    expect(screen.getByText(/tự tải lên khi có mạng/)).toBeOnTheScreen();
    expect(screen.queryByText(/sao lưu/i)).toBeNull();
  });
});
