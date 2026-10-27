import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/test-utils/render';

import { SyncStatusBar } from './SyncStatusBar';

describe('SyncStatusBar', () => {
  it('không hiển thị khi không có tệp lỗi/chờ', async () => {
    await renderWithProviders(
      <SyncStatusBar
        counts={{ uploading: 0, waiting_upload: 0, error: 0 }}
        onPress={() => undefined}
      />,
    );
    expect(screen.queryByText('Bằng chứng cần theo dõi')).toBeNull();
  });

  it('hiện từng nhóm bằng nhãn chuẩn, bỏ nhóm bằng 0', async () => {
    await renderWithProviders(
      <SyncStatusBar
        counts={{ uploading: 0, waiting_upload: 2, error: 1 }}
        onPress={() => undefined}
      />,
    );
    expect(screen.getByText('Lỗi – cần xử lý')).toBeOnTheScreen();
    expect(screen.getByText('Chờ tải lên')).toBeOnTheScreen();
    expect(screen.queryByText('Đang tải lên')).toBeNull();
  });
});
