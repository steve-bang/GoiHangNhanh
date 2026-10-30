import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { mockScanner, resetMockScanner } from '@/test-utils/mock-barcode-scanner';
import { mockNavigation, resetMockNavigation } from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { createMemoryOrderStore } from '../data';
import { OrderPreviewScreen } from './OrderPreviewScreen';

let mockEnabled = true;
jest.mock('@/core/config/recorder', () => ({
  get RECORDER_ENABLED() {
    return mockEnabled;
  },
}));
jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
jest.mock(
  '@/platform/barcode-scanner',
  () => jest.requireActual('@/test-utils/mock-barcode-scanner').barcodeScannerMock,
);

beforeEach(() => {
  mockEnabled = true;
  resetMockNavigation();
  resetMockScanner();
});

async function open(existing?: 'created' | 'recording') {
  const store = createMemoryOrderStore();
  const details = await seedOrder(store, sampleOrder());
  if (existing) {
    const session = sampleSession(details, Date.now());
    await store.saveSession(session);
    if (existing !== 'created')
      await store.updateSessionStatus(session.shopId, session.id, existing);
  }
  mockNavigation.params = { orderId: details.order.id };
  await renderWithProviders(<OrderPreviewScreen />, { orderStore: store });
  await screen.findByTestId('preview-order-code');
  await fireEvent.press(screen.getByTestId('preview-start'));
  await waitFor(() => expect(mockNavigation.replace).toHaveBeenCalled());
  return mockNavigation.replace.mock.calls[0] as [string, { sessionId: string }];
}

describe('Bắt đầu quay đi qua kiểm tra sẵn sàng (UI-C02)', () => {
  it('bộ ghi bật: phiên MỚI đi tới UI-C02 bằng sessionId (không phải thẳng màn quay)', async () => {
    const call = await open();
    expect(call[0]).toBe(ROUTES.packPrecheck);
    expect(call[1].sessionId).toEqual(expect.any(String));
  });

  it('bộ ghi bật: phiên created đang có được mở lại qua kiểm tra, không tạo phiên chồng', async () => {
    const call = await open('created');
    expect(call[0]).toBe(ROUTES.packPrecheck);
  });

  it('bộ ghi bật: phiên đã qua created mở thẳng màn quay (màn đó nói đúng tình trạng)', async () => {
    const call = await open('recording');
    expect(call[0]).toBe(ROUTES.packRecord);
  });

  it('bộ ghi tắt: thẳng sang màn quay như trước', async () => {
    mockEnabled = false;
    const call = await open();
    expect(call[0]).toBe(ROUTES.packRecord);
  });
});

describe('Bắt đầu quay ở bản Firebase khi phiên chưa biết cửa hàng (V1-06)', () => {
  it('không tạo phiên, không mở kiểm tra/màn quay (chặn TRƯỚC khi quay, bất biến 2)', async () => {
    const store = createMemoryOrderStore();
    const details = await seedOrder(store, sampleOrder());
    const saveSession = jest.spyOn(store, 'saveSession');
    mockNavigation.params = { orderId: details.order.id };
    await renderWithProviders(<OrderPreviewScreen />, {
      orderStore: store,
      requireKnownShop: true,
    });
    await screen.findByTestId('preview-order-code');
    await fireEvent.press(screen.getByTestId('preview-start'));
    expect(
      await screen.findByText('Chưa xử lý được đơn trên máy. Bạn thử lại nhé.'),
    ).toBeOnTheScreen();
    expect(saveSession).not.toHaveBeenCalled();
    expect(mockNavigation.replace).not.toHaveBeenCalled();
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});

describe('Hộp giải thích quyền camera theo cờ ghi video (V1-18)', () => {
  async function openPermission(): Promise<void> {
    mockScanner.permission = 'askable';
    const store = createMemoryOrderStore();
    const details = await seedOrder(store, sampleOrder());
    mockNavigation.params = { orderId: details.order.id };
    await renderWithProviders(<OrderPreviewScreen />, { orderStore: store });
    await screen.findByTestId('preview-order-code');
    await fireEvent.press(screen.getByTestId('preview-start'));
    await screen.findByTestId('start-permission-modal');
  }

  it('bộ ghi bật: nói quay video đóng gói, không ghi âm; không nói "chưa ghi video"', async () => {
    await openPermission();
    expect(
      screen.getByText('Ứng dụng dùng camera để quay video đóng gói. Ứng dụng không ghi âm.'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/chưa ghi video/)).toBeNull();
  });

  it('bộ ghi tắt: nói bản này chưa ghi video', async () => {
    mockEnabled = false;
    await openPermission();
    expect(
      screen.getByText('Ứng dụng cần camera để xem trước khi quay. Phiên bản này chưa ghi video.'),
    ).toBeOnTheScreen();
  });
});
