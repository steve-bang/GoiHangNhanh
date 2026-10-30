import { act, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { RemoteDocuments } from '@/api/contract';
import type { EvidenceId, OrderId, PackageId, SessionId } from '@/core/ids';
import {
  LOCAL_SHOP_ID,
  OrderSyncRunner,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  useCurrentShopId,
} from '@/features/orders';
import { createFakePersonalGateways, useSession } from '@/features/personal';
import { UploadRunner, type UploadGateway } from '@/features/upload';
import { renderWithProviders } from '@/test-utils/render';

// Fixture của test tích hợp (không phải API công khai của feature).
/* eslint-disable no-restricted-imports -- chỉ để dựng dữ liệu mẫu cho test */
import { makeOrder } from '@/features/orders/data/order-store.contract';
import { buildPackingSession } from '@/features/orders/domain/start-session';
/* eslint-enable no-restricted-imports */

// PR1 (release-hardening-plan.md): sau `signOut` thật thì OrderSyncRunner/UploadRunner phải dừng với
// shop cũ; đăng nhập tài khoản khác chỉ chạy với shop của tài khoản đó; không lộ bản ghi của người khác
// (bất biến 8, QA-11). `SessionProvider` + `SessionShopProvider` thật, cổng Auth/Firestore giả.

const mockAppActive = new Set<() => void>();
jest.mock('@/platform/app-state', () => ({
  subscribeAppActive: (cb: () => void) => {
    mockAppActive.add(cb);
    return () => mockAppActive.delete(cb);
  },
}));
// Trạng thái mạng: mock mặc định của jest.setup.ts (có mạng).

const SHOP_A = 'shop-a';
const SHOP_B = 'shop-b';
const SHOP_X = 'shop-x';
const INTERVAL_MS = 60_000;

const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
const foreground = async () => {
  await act(async () => void Array.from(mockAppActive).forEach((cb) => cb()));
  await flush();
};

function setup() {
  // `authUid` mô phỏng `auth.currentUser?.uid`: đặt khi đăng nhập, về null khi signOut thành công.
  const state = { authUid: null as string | null, signOutError: null as Error | null };
  const orderStore = createMemoryOrderStore({ creatorUid: () => state.authUid });
  const files = createMemoryEvidenceFileStore();
  const published: string[] = [];
  const uploaded: string[] = [];
  const docs: RemoteDocuments = {
    values: { serverTimestamp: () => 'TS', timestamp: (ms) => ms },
    currentUid: () => state.authUid,
    createMissing: async (writes) => void published.push(...writes.map((w) => w.path)),
    updateFields: async () => undefined,
    getFields: async () => null,
    getManyFields: async () => new Map(),
    callFunction: async () => {
      throw new Error('unused');
    },
  };
  const gateway: UploadGateway = {
    upload: async (request) => {
      uploaded.push(request.evidenceId);
      return { kind: 'received' };
    },
    fetchServerStates: async () => new Map(),
  };
  const hasher = { sha256: async () => ({ ok: true as const, sha256: 'ab'.repeat(32) }) };

  const personal = createFakePersonalGateways();
  personal.account.signOut = async () => {
    if (state.signOutError) throw state.signOutError;
    state.authUid = null;
  };

  const seedOrder = async (shopId: string, uid: string, code: string) => {
    const previous = state.authUid;
    state.authUid = uid;
    const details = makeOrder(code, { shopId: shopId as never, lines: [{ name: 'Áo' }] });
    await orderStore.saveNewOrder(details);
    const pkg = details.packages[0];
    if (!pkg) throw new Error('fixture');
    const built = buildPackingSession(details, pkg.id, {
      sessionId: `s-${code}` as SessionId,
      nowDevice: 10,
    });
    if (!built.ok) throw new Error('fixture');
    await orderStore.saveSession(built.session);
    // Phiên đã quay xong (có tệp): mới được đăng lên máy chủ, và tệp chỉ tải sau khi phiên đã đăng.
    await orderStore.updateSessionStatus(shopId as never, built.session.id, 'recording');
    await orderStore.updateSessionStatus(shopId as never, built.session.id, 'ended');
    state.authUid = previous;
  };
  /** Tệp của phiên đơn `code` (đã seed): hàng đợi chỉ tải khi phiên đó đã đăng lên máy chủ (V1-02). */
  const seedFile = async (shopId: string, id: string, code: string) => {
    const evidenceId = id as EvidenceId;
    await files.create({
      id: evidenceId,
      shopId: shopId as never,
      orderId: 'o' as OrderId,
      packageId: 'p' as PackageId,
      sessionId: `s-${code}` as SessionId,
      group: 'pack',
      kind: 'video',
      createdAtDevice: 1,
    });
    const device = (type: string) => ({ type, origin: 'device' }) as never;
    await files.applyEvent(shopId as never, evidenceId, device('STOP_RECORDING'), 2);
    await files.applyEvent(shopId as never, evidenceId, device('LOCAL_FILE_READABLE'), 3, {
      localPath: 'file:///v.mp4',
      sizeBytes: 5,
      sha256Client: 'ab'.repeat(32),
    });
  };

  function Probe() {
    const { state: session, signOut, beginSession } = useSession();
    const shopId = useCurrentShopId();
    const login = (uid: string, shopId: string) => {
      state.authUid = uid;
      beginSession({ uid, email: `${uid}@x.vn`, displayName: null }, shopId);
    };
    return (
      <>
        <Text testID="status">{session.status}</Text>
        <Text testID="current-shop">{shopId}</Text>
        <Text testID="current-uid">{String(session.user?.uid ?? null)}</Text>
        <Text testID="login-a" onPress={() => login('uid-a', SHOP_A)} />
        <Text testID="login-b" onPress={() => login('uid-b', SHOP_B)} />
        <Text testID="login-b-x" onPress={() => login('uid-b', SHOP_X)} />
        <Text testID="out" onPress={() => void signOut().catch(() => undefined)} />
      </>
    );
  }

  const mount = () =>
    renderWithProviders(
      <>
        <Probe />
        <OrderSyncRunner docs={docs} />
        <UploadRunner docs={docs} gateway={gateway} hasher={hasher} />
      </>,
      { orderStore, evidenceFileStore: files, personalGateways: personal },
    );
  const press = (testID: string) =>
    act(async () => {
      screen.getByTestId(testID).props.onPress();
    });
  const pendingFor = (shopId: string, uid: string) =>
    orderStore.listOrdersPendingRemote(shopId as never, 10, uid);
  const publishedIn = (shopId: string) => published.filter((p) => p.startsWith(`shops/${shopId}/`));

  return {
    state,
    published,
    uploaded,
    files,
    seedOrder,
    seedFile,
    mount,
    press,
    pendingFor,
    publishedIn,
  };
}

let setIntervalSpy: jest.SpyInstance;
let clearIntervalSpy: jest.SpyInstance;
beforeEach(() => {
  mockAppActive.clear();
  setIntervalSpy = jest.spyOn(global, 'setInterval');
  clearIntervalSpy = jest.spyOn(global, 'clearInterval');
});
afterEach(() => jest.restoreAllMocks());

/** Mọi bộ hẹn giờ 60 giây của runner đã được hủy (không còn lượt định kỳ nào chạy với shop cũ). */
function allRunnerTimersCleared(): boolean {
  const ids = setIntervalSpy.mock.calls
    .map((args, i) => ({ delay: args[1] as number, id: setIntervalSpy.mock.results[i]?.value }))
    .filter((t) => t.delay === INTERVAL_MS)
    .map((t) => t.id);
  const cleared = clearIntervalSpy.mock.calls.map((args) => args[0]);
  return ids.length > 0 && ids.every((id) => cleared.includes(id));
}

describe('runner đồng bộ/tải lên theo phiên (PR1)', () => {
  it('A đăng xuất rồi B đăng nhập: runner dừng với shop A, sau đó chỉ chạy với shop B', async () => {
    const t = setup();
    await t.seedOrder(SHOP_A, 'uid-a', 'A-1');
    await t.seedFile(SHOP_A, 'ev-a-1', 'A-1');
    await t.seedOrder(SHOP_B, 'uid-b', 'B-1');
    await t.seedFile(SHOP_B, 'ev-b-1', 'B-1');
    await t.mount();
    await flush();
    // Chưa đăng nhập: shop tạm, không runner nào chạy.
    expect(screen.getByTestId('current-shop')).toHaveTextContent(LOCAL_SHOP_ID);
    expect(t.published).toEqual([]);

    await t.press('login-a');
    await flush();
    // Lượt tải đầu có thể chạy trước khi phiên kịp đăng (V1-02: chờ phiên, không tốn lượt); lượt sau tải.
    await foreground();
    expect(t.publishedIn(SHOP_A).length).toBeGreaterThan(0);
    expect(t.publishedIn(SHOP_B)).toEqual([]);
    expect(t.uploaded).toEqual(['ev-a-1']);
    expect(mockAppActive.size).toBe(2); // OrderSyncRunner + UploadRunner đang lắng nghe

    // Việc mới của A xuất hiện NGAY TRƯỚC khi đăng xuất, rồi đăng xuất thật thành công.
    await t.seedOrder(SHOP_A, 'uid-a', 'A-2');
    await t.seedFile(SHOP_A, 'ev-a-2', 'A-2');
    const before = { published: t.published.length, uploaded: t.uploaded.length };
    await t.press('out');
    await flush();
    expect(screen.getByTestId('status')).toHaveTextContent('signed_out');
    expect(screen.getByTestId('current-shop')).toHaveTextContent(LOCAL_SHOP_ID);
    expect(screen.getByTestId('current-uid')).toHaveTextContent('null');
    expect(t.state.authUid).toBeNull();
    // Runner đã hủy hẹn giờ và đăng ký foreground; kích hoạt "foreground" cũng không chạy gì.
    expect(allRunnerTimersCleared()).toBe(true);
    expect(mockAppActive.size).toBe(0);
    await foreground();
    expect(t.published).toHaveLength(before.published);
    expect(t.uploaded).toHaveLength(before.uploaded);
    expect(await t.pendingFor(SHOP_A, 'uid-a')).toHaveLength(1); // A-2 vẫn chờ chính A

    // B đăng nhập: chỉ chạy với shop B; dữ liệu của A không bị đăng/tải.
    await t.press('login-b');
    await flush();
    await foreground();
    expect(t.publishedIn(SHOP_B).length).toBeGreaterThan(0);
    expect(t.published.filter((p) => p.startsWith(`shops/${SHOP_A}/`))).toHaveLength(
      before.published,
    );
    expect(t.uploaded).toEqual(['ev-a-1', 'ev-b-1']);
    expect(await t.pendingFor(SHOP_A, 'uid-a')).toHaveLength(1);
  });

  it('signOut lỗi: phiên giữ nguyên và runner vẫn chạy với shop A', async () => {
    const t = setup();
    await t.mount();
    await t.press('login-a');
    await flush();
    t.state.signOutError = new Error('network');
    await t.press('out');
    await flush();
    expect(screen.getByTestId('status')).toHaveTextContent('signed_in');
    expect(screen.getByTestId('current-shop')).toHaveTextContent(SHOP_A);
    expect(mockAppActive.size).toBe(2);

    await t.seedOrder(SHOP_A, 'uid-a', 'A-3');
    await t.seedFile(SHOP_A, 'ev-a-3', 'A-3');
    await foreground();
    await foreground(); // lượt đầu đăng phiên, lượt sau tải tệp của phiên đã đăng
    expect(t.publishedIn(SHOP_A).length).toBeGreaterThan(0);
    expect(t.uploaded).toEqual(['ev-a-3']);
    expect(await t.pendingFor(SHOP_A, 'uid-a')).toEqual([]);
  });

  it('cùng một shop, đổi tài khoản: B không thấy và không đăng đơn created_by = A', async () => {
    const t = setup();
    // A tạo đơn ở shop X nhưng chưa đăng được, rồi A đăng xuất khỏi máy.
    await t.seedOrder(SHOP_X, 'uid-a', 'X-A');
    await t.seedOrder(SHOP_X, 'uid-b', 'X-B');
    await t.mount();
    await t.press('login-b-x');
    await flush();

    // Kho cục bộ trả cho B chỉ bản ghi của B; bản của A ở lại cho chính A.
    expect(await t.pendingFor(SHOP_X, 'uid-b')).toEqual([]); // X-B đã đăng
    const pendingA = await t.pendingFor(SHOP_X, 'uid-a');
    expect(pendingA).toHaveLength(1);
    expect(pendingA[0]?.order.orderCode).toBe('X-A');
    // Chỉ một đơn (của B) được ghi lên máy chủ.
    const orderDocs = t.published.filter((p) => /^shops\/shop-x\/orders\/[^/]+$/.test(p));
    expect(orderDocs).toHaveLength(1);
    expect(t.published.join('\n')).not.toContain(pendingA[0]?.order.id ?? 'khong-co');
  });
});
