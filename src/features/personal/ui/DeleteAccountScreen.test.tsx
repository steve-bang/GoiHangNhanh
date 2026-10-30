import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';

import type { DisputeId, OrderId, ShopId } from '@/core/ids';
import { resources } from '@/core/i18n/resources';
import { ROUTES } from '@/core/navigation';
import { createMemoryDisputeStore, type DisputeStore } from '@/features/disputes';
import { createMemoryOrderStore, type OrderStore } from '@/features/orders';
import { createMemoryLocalWipe } from '@/test-utils/memory-local-wipe';
import {
  mockNavigation,
  resetMockNavigation,
  setMockScreenFocused,
} from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import {
  createFakePersonalGateways,
  FAKE_ACCOUNT_PASSWORD,
  FAKE_DELETE_OFFLINE_PASSWORD,
  FAKE_DELETE_UNCONFIRMED_PASSWORD,
} from '../data/fake-personal-gateways';
import { createUnavailablePersonalGateways } from '../data/unavailable-personal-gateways';
import { DeleteAccountScreen } from './DeleteAccountScreen';
import { useSession } from './SessionProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);
const mockSupportEmail = jest.fn<string | null, []>(() => null);
jest.mock('@/core/config/support-contact', () => ({
  getSupportEmail: () => mockSupportEmail(),
}));

beforeEach(() => {
  resetMockNavigation();
  mockSupportEmail.mockReturnValue(null);
});

const withStore = (overrides: Partial<OrderStore>): OrderStore => ({
  ...createMemoryOrderStore(),
  ...overrides,
});

async function openDisputeStore(count: number): Promise<DisputeStore> {
  const store = createMemoryDisputeStore();
  for (let i = 0; i < count; i += 1) {
    await store.createDispute({
      id: `d-${i}` as DisputeId,
      shopId: 'shop-x' as ShopId,
      subject: { kind: 'order', orderId: 'o1' as OrderId, label: 'DH001' },
      issueType: 'missing_item',
      note: '',
      createdAtDevice: 1,
    });
  }
  return store;
}

function SessionProbe() {
  const { beginSession } = useSession();
  return (
    <Pressable
      testID="begin-session"
      onPress={() => beginSession({ uid: 'u1', email: 'a@example.com', displayName: null }, 's1')}
    />
  );
}

async function setup(
  options: {
    gateways?: ReturnType<typeof createFakePersonalGateways>;
    store?: OrderStore;
    disputeStore?: DisputeStore;
    localWipe?: ReturnType<typeof createMemoryLocalWipe>;
    signedIn?: boolean;
  } = {},
) {
  const gateways = options.gateways ?? createFakePersonalGateways({ shop: { role: 'member' } });
  const localWipe = options.localWipe ?? createMemoryLocalWipe();
  await renderWithProviders(
    <>
      <SessionProbe />
      <DeleteAccountScreen />
    </>,
    {
      personalGateways: gateways,
      orderStore: options.store ?? createMemoryOrderStore(),
      disputeStore: options.disputeStore ?? createMemoryDisputeStore(),
      localWipe,
    },
  );
  // Có tài khoản đang đăng nhập (điều kiện "dữ liệu tài khoản khác" cần biết uid).
  if (options.signedIn !== false) await fireEvent.press(screen.getByTestId('begin-session'));
  return { gateways, localWipe };
}

const statusOf = (id: string) => screen.findByTestId(`delete-condition-${id}-status`);
const pressAgree = () =>
  fireEvent.press(screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' }));

async function goToPassword() {
  await waitFor(async () => expect(await statusOf('foreign')).toHaveTextContent('Đạt'));
  await pressAgree();
  await fireEvent.press(screen.getByTestId('delete-submit'));
  expect(screen.getByTestId('delete-password-step')).toBeOnTheScreen();
}

describe('Xóa tài khoản (UI-I05 route con, khung 20; luồng thật V1-15)', () => {
  it('hiện tiêu đề, câu dẫn, năm điều kiện, khối dữ liệu (câu chung 30 ngày nguyên văn), hộp kiểm và nút', async () => {
    await setup();
    expect(screen.getByTestId('screen-UI-I05-delete-account')).toBeOnTheScreen();
    expect(screen.getByText('Xóa tài khoản?')).toBeOnTheScreen();
    for (const id of ['recording', 'disputes', 'foreign', 'unsynced', 'ownership']) {
      expect(screen.getByTestId(`delete-condition-${id}`)).toBeOnTheScreen();
    }
    expect(screen.getByTestId('delete-data-server')).toHaveTextContent(
      /dữ liệu cửa hàng trên máy chủ bị xóa hẳn sau 30 ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở\./,
    );
    expect(screen.getByRole('checkbox', { name: 'Tôi hiểu và đồng ý' })).toBeOnTheScreen();
    expect(screen.getByTestId('delete-keep')).toHaveTextContent('Giữ tài khoản của tôi');
  });

  it('sạch: mọi mục "Đạt"; nút chỉ bật sau "Tôi hiểu và đồng ý"', async () => {
    await setup();
    await waitFor(async () => expect(await statusOf('foreign')).toHaveTextContent('Đạt'));
    for (const id of ['recording', 'disputes', 'unsynced', 'ownership']) {
      expect(await statusOf(id)).toHaveTextContent('Đạt');
    }
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeEnabled();
    expect(screen.queryByTestId('delete-blocked-hint')).toBeNull();
  });

  it('đang kiểm tra: chưa hiện "Đạt" và nút khóa', async () => {
    await setup({
      store: withStore({ hasRecordingOnDevice: () => new Promise(() => undefined) }),
    });
    expect(screen.getByTestId('delete-condition-recording')).toHaveTextContent(/Đang kiểm tra/);
    expect(screen.queryByText('Đạt')).toBeNull();
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  it('đang quay: chặn', async () => {
    await setup({ store: withStore({ hasRecordingOnDevice: async () => true }) });
    expect(await statusOf('recording')).toHaveTextContent('Cần xử lý');
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
    expect(screen.getByTestId('delete-blocked-hint')).toBeOnTheScreen();
  });

  it('còn hồ sơ tranh chấp mở trên máy (mọi shop): chặn, nói đóng hồ sơ không xóa bằng chứng (bất biến 9)', async () => {
    await setup({ disputeStore: await openDisputeStore(2) });
    expect(await statusOf('disputes')).toHaveTextContent('Cần xử lý');
    expect(screen.getByTestId('delete-condition-disputes')).toHaveTextContent(
      /Còn 2 hồ sơ tranh chấp đang mở\..*Đóng hồ sơ không xóa bằng chứng\./,
    );
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  it('máy còn dữ liệu của tài khoản khác: chặn (không xóa nhầm), chỉ cách qua web/hỗ trợ', async () => {
    await setup({ localWipe: createMemoryLocalWipe({ foreignRecords: 3 }) });
    expect(await statusOf('foreign')).toHaveTextContent('Cần xử lý');
    expect(screen.getByTestId('delete-condition-foreign')).toHaveTextContent(/qua trang web/);
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  it('chưa biết tài khoản đang đăng nhập: mục tài khoản khác "Chưa kiểm tra được", chặn', async () => {
    await setup({ signedIn: false });
    expect(await statusOf('foreign')).toHaveTextContent('Chưa kiểm tra được');
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  it('còn tệp chưa tải: "Lưu ý" + cảnh báo mất tệp + tích riêng mới bật nút; có lối tới đồng bộ (R-2 A)', async () => {
    await setup({ store: withStore({ countUnsyncedOnDevice: async () => 3 }) });
    expect(await statusOf('unsynced')).toHaveTextContent('Lưu ý');
    expect(
      screen.getByText('3 tệp chưa tải lên sẽ bị xóa khỏi máy này và không thể khôi phục.'),
    ).toBeOnTheScreen();
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Tôi hiểu 3 tệp này sẽ mất' }));
    expect(screen.getByTestId('delete-submit')).toBeEnabled();
    await fireEvent.press(screen.getByTestId('delete-sync-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.sync);
  });

  it('là chủ cửa hàng: "Lưu ý", không chặn', async () => {
    await setup({ gateways: createFakePersonalGateways() });
    expect(await statusOf('ownership')).toHaveTextContent('Lưu ý');
    expect(screen.getByTestId('delete-condition-ownership')).toHaveTextContent(
      /Bạn là chủ 1 cửa hàng\./,
    );
    await waitFor(async () => expect(await statusOf('foreign')).toHaveTextContent('Đạt'));
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeEnabled();
  });

  it('đọc kho lỗi: "Chưa kiểm tra được", không dấu tích, nút khóa', async () => {
    await setup({
      gateways: createUnavailablePersonalGateways() as never,
      store: withStore({
        hasRecordingOnDevice: async () => {
          throw new Error('x');
        },
        countUnsyncedOnDevice: async () => {
          throw new Error('x');
        },
      }),
      disputeStore: {
        ...createMemoryDisputeStore(),
        countOpenOnDevice: async () => {
          throw new Error('x');
        },
      },
    });
    for (const id of ['recording', 'unsynced', 'ownership', 'disputes']) {
      expect(await statusOf(id)).toHaveTextContent('Chưa kiểm tra được');
    }
    expect(screen.queryByText('Đạt')).not.toBeNull(); // chỉ mục tài khoản khác đọc được
    await pressAgree();
    expect(screen.getByTestId('delete-submit')).toBeDisabled();
  });

  describe('nhập mật khẩu và gọi máy chủ', () => {
    it('sai mật khẩu: báo tại ô, KHÔNG xóa gì trên máy', async () => {
      const { gateways, localWipe } = await setup();
      await goToPassword();
      await fireEvent.changeText(screen.getByTestId('delete-password'), 'sai-mat-khau');
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(await screen.findByText('Mật khẩu hiện tại chưa đúng.')).toBeOnTheScreen();
      expect(gateways.account.deleteAccountCalls).toBe(1);
      expect(localWipe.state.log).toEqual([]);
      expect(mockNavigation.reset).not.toHaveBeenCalled();
    });

    it('mất mạng: báo lỗi + "Chưa có gì bị xóa", không xóa gì trên máy', async () => {
      const { localWipe } = await setup();
      await goToPassword();
      await fireEvent.changeText(
        screen.getByTestId('delete-password'),
        FAKE_DELETE_OFFLINE_PASSWORD,
      );
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(await screen.findByTestId('delete-error')).toHaveTextContent(/Mất kết nối mạng\./);
      expect(screen.getByTestId('delete-nothing-deleted')).toHaveTextContent(
        'Chưa có gì bị xóa. Tài khoản và dữ liệu vẫn còn nguyên.',
      );
      expect(localWipe.state.log).toEqual([]);
    });

    it('đã gửi mà không rõ kết quả (internal/deadline-exceeded): câu "chưa rõ", KHÔNG nói chưa xóa gì, không xóa trên máy', async () => {
      const { localWipe } = await setup();
      await goToPassword();
      await fireEvent.changeText(
        screen.getByTestId('delete-password'),
        FAKE_DELETE_UNCONFIRMED_PASSWORD,
      );
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(await screen.findByTestId('delete-error')).toHaveTextContent(
        /Chưa rõ tài khoản đã xóa xong chưa\./,
      );
      expect(screen.queryByTestId('delete-nothing-deleted')).toBeNull();
      expect(localWipe.state.log).toEqual([]);
      expect(mockNavigation.reset).not.toHaveBeenCalled();
    });

    it('thử lại sau "chưa rõ": tài khoản đã không còn -> xóa trên máy như thường, về Chào mừng', async () => {
      const { gateways, localWipe } = await setup();
      await goToPassword();
      await fireEvent.changeText(
        screen.getByTestId('delete-password'),
        FAKE_DELETE_UNCONFIRMED_PASSWORD,
      );
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      await screen.findByTestId('delete-error');
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
      expect(gateways.account.deleteAccountCalls).toBe(2);
      expect(localWipe.state.log).toEqual([
        'setMarker',
        'deleteEvidenceFiles',
        'wipeDatabase',
        'clearMarker',
      ]);
    });

    it('tài khoản đã không còn nhưng đọc lại thấy dữ liệu tài khoản khác: KHÔNG xóa trên máy, thoát phiên và báo', async () => {
      const gateways = createFakePersonalGateways({ shop: { role: 'member' } });
      gateways.account.deleted = true; // máy chủ đã xóa ở lần trước, app không nhận được xác nhận
      const localWipe = createMemoryLocalWipe();
      const reads: number[] = [];
      localWipe.device.countForeignRecords = async () => {
        reads.push(reads.length);
        // Lần đọc của màn và lần đọc trước khi gửi: 0; lần đọc lại sau khi biết đã xóa: 2.
        return reads.length >= 3 ? 2 : 0;
      };
      await setup({ gateways, localWipe });
      await goToPassword();
      await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
      expect(reads.length).toBeGreaterThanOrEqual(3);
      expect(localWipe.state.log).toEqual([]);
      expect(gateways.account.signOutCalls).toBe(1);
      expect(
        await screen.findByText(
          'Tài khoản đã được xóa. Dữ liệu trên máy này được giữ lại; bạn liên hệ hỗ trợ nếu muốn xóa.',
        ),
      ).toBeOnTheScreen();
    });

    it('ô trống: nhắc nhập mật khẩu, không gọi máy chủ', async () => {
      const { gateways } = await setup();
      await goToPassword();
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(screen.getByText('Hãy nhập mật khẩu.')).toBeOnTheScreen();
      expect(gateways.account.deleteAccountCalls).toBe(0);
    });

    it('tình trạng máy đổi trước khi gửi (vừa có tranh chấp mở): không gọi máy chủ', async () => {
      const disputes = createMemoryDisputeStore();
      const { gateways } = await setup({ disputeStore: disputes });
      await goToPassword();
      await disputes.createDispute({
        id: 'd-late' as DisputeId,
        shopId: 'shop-x' as ShopId,
        subject: { kind: 'order', orderId: 'o1' as OrderId, label: 'DH001' },
        issueType: 'missing_item',
        note: '',
        createdAtDevice: 1,
      });
      await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(await screen.findByTestId('delete-error')).toHaveTextContent(/vừa thay đổi/);
      expect(gateways.account.deleteAccountCalls).toBe(0);
    });

    it('máy chủ xác nhận: xóa trên máy theo thứ tự bền, kết thúc phiên, về Chào mừng + thông báo', async () => {
      const { gateways, localWipe } = await setup();
      await goToPassword();
      await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      await waitFor(() => expect(mockNavigation.reset).toHaveBeenCalledWith(ROUTES.welcome));
      expect(gateways.account.deleteAccountCalls).toBe(1);
      expect(localWipe.state.log).toEqual([
        'setMarker',
        'deleteEvidenceFiles',
        'wipeDatabase',
        'clearMarker',
      ]);
      // Thoát Auth trên máy nằm giữa xóa CSDL và gỡ dấu (cổng giả ghi số lần).
      expect(gateways.account.signOutCalls).toBe(1);
      expect(localWipe.state.marker).toBe(false);
      expect(
        await screen.findByText('Đã xóa tài khoản và dữ liệu trên máy này.'),
      ).toBeOnTheScreen();
    });

    it('máy chủ xác nhận nhưng xóa CSDL lỗi: lớp phủ "Chưa xóa xong" có Thử lại, dấu còn, chưa về Chào mừng', async () => {
      const localWipe = createMemoryLocalWipe({ failDatabase: true });
      await setup({ localWipe });
      await goToPassword();
      await fireEvent.changeText(screen.getByTestId('delete-password'), FAKE_ACCOUNT_PASSWORD);
      await fireEvent.press(screen.getByTestId('delete-confirm'));
      expect(await screen.findByTestId('local-wipe-failed')).toBeOnTheScreen();
      expect(localWipe.state.marker).toBe(true);
      expect(mockNavigation.reset).not.toHaveBeenCalled();
      localWipe.state.failDatabase = false;
      await fireEvent.press(screen.getByText('Thử lại'));
      await waitFor(() => expect(screen.queryByTestId('local-wipe-overlay')).toBeNull());
      expect(localWipe.state.marker).toBe(false);
    });

    it('Quay lại từ bước mật khẩu về danh sách điều kiện, không gọi gì', async () => {
      const { gateways } = await setup();
      await goToPassword();
      await fireEvent.press(screen.getByTestId('delete-password-back'));
      expect(screen.getByTestId('delete-conditions')).toBeOnTheScreen();
      expect(gateways.account.deleteAccountCalls).toBe(0);
    });
  });

  it('quay về từ trung tâm đồng bộ: đọc lại, số tệp cập nhật', async () => {
    let unsynced = 3;
    await setup({ store: withStore({ countUnsyncedOnDevice: async () => unsynced }) });
    expect(await statusOf('unsynced')).toHaveTextContent('Lưu ý');
    await act(async () => setMockScreenFocused(false));
    unsynced = 0;
    await act(async () => setMockScreenFocused(true));
    await waitFor(async () => expect(await statusOf('unsynced')).toHaveTextContent('Đạt'));
    expect(screen.queryByTestId('delete-unsynced-warning')).toBeNull();
  });

  it('có địa chỉ hỗ trợ thật: hiện lối Liên hệ hỗ trợ; trang web giữ chỗ thì ẩn (V1-18)', async () => {
    mockSupportEmail.mockReturnValue('ho-tro@example.test');
    await setup();
    expect(screen.getByTestId('delete-support')).toBeOnTheScreen();
    expect(screen.queryByTestId('delete-web-link')).toBeNull();
    await fireEvent.press(screen.getByTestId('delete-support-link'));
    expect(mockNavigation.push).toHaveBeenCalledWith(ROUTES.helpContact);
  });

  it('"Giữ tài khoản của tôi" quay lại, không gọi gì', async () => {
    const { gateways } = await setup();
    await fireEvent.press(screen.getByTestId('delete-keep'));
    expect(mockNavigation.back).toHaveBeenCalledTimes(1);
    expect(gateways.account.deleteAccountCalls).toBe(0);
  });

  it('chuỗi trung thực: câu 30 ngày đúng nguyên văn decisions; không hứa quá mức', () => {
    const copy = resources.vi.personal.deleteAccount;
    expect(copy.dataServer).toContain(
      'dữ liệu cửa hàng trên máy chủ bị xóa hẳn sau 30 ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở',
    );
    const text = JSON.stringify(copy);
    expect(text).not.toMatch(
      /vui lòng|bảo vệ|an toàn|ngay lập tức|tuyệt đối|dự kiến|trong vòng 30 ngày/i,
    );
  });
});
