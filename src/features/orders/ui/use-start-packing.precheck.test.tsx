import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { ROUTES } from '@/core/navigation';
import { resetMockScanner } from '@/test-utils/mock-barcode-scanner';
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
