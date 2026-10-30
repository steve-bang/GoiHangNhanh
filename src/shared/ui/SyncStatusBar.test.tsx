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

  it('câu nhắc nói đúng giới hạn v1: chỉ tải khi ứng dụng đang mở, không hứa tải nền (V1-18)', async () => {
    await renderWithProviders(
      <SyncStatusBar
        counts={{ uploading: 1, waiting_upload: 0, error: 0 }}
        onPress={() => undefined}
      />,
    );
    expect(
      screen.getByText(
        'Ứng dụng chỉ tải lên khi đang mở. Đóng ứng dụng thì việc tải tạm dừng, mở lại sẽ tiếp tục.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/nền/)).toBeNull();
  });
});
