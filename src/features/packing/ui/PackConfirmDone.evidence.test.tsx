import { useState } from 'react';
import { Text } from 'react-native';
import { act, screen } from '@testing-library/react-native';

import type { EvidenceId } from '@/core/ids';
import type { FileState } from '@/features/evidence';
import {
  LOCAL_SHOP_ID,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
} from '@/features/orders';
import {
  mockNavigation,
  resetMockNavigation,
  setMockScreenFocused,
} from '@/test-utils/mock-navigation';
import { sampleOrder, sampleSession, seedOrder } from '@/test-utils/order-fixtures';
import { renderWithProviders } from '@/test-utils/render';

import { PackConfirmScreen } from './PackConfirmScreen';
import { PackDoneScreen } from './PackDoneScreen';
import { PACK_EVIDENCE_POLL_MS, usePackEvidence } from './use-pack-evidence';

jest.mock('../domain/recorder', () => ({ RECORDER_ENABLED: true }));
jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

const d = (type: string) => ({ type, origin: 'device' }) as never;
const READY = { localPath: 'evidence/x.mp4', sizeBytes: 5, sha256Client: 'ab'.repeat(32) };

type Files = ReturnType<typeof createMemoryEvidenceFileStore>;
let counter = 0;

/** Tạo một tệp của phiên rồi đưa tới `state` bằng các sự kiện hợp lệ. */
async function addFile(files: Files, session: ReturnType<typeof sampleSession>, state: FileState) {
  counter += 1;
  const id = `ev-${counter}` as EvidenceId;
  await files.create({
    id,
    shopId: LOCAL_SHOP_ID,
    orderId: session.orderId,
    packageId: session.packageId,
    sessionId: session.id,
    group: 'pack',
    kind: 'video',
    createdAtDevice: counter,
  });
  const apply = (type: string, patch?: object) =>
    files.applyEvent(LOCAL_SHOP_ID, id, d(type), 10, patch);
  if (state === 'local_save_failed') await apply('LOCAL_WRITE_FAILED');
  if (state === 'unrecoverable') await apply('MARK_UNRECOVERABLE');
  if (state === 'saving_local') await apply('STOP_RECORDING');
  const afterQueued: FileState[] = [
    'queued',
    'uploading',
    'upload_failed',
    'needs_attention',
    'hash_mismatch',
  ];
  if (afterQueued.includes(state)) {
    await apply('STOP_RECORDING');
    await apply('LOCAL_FILE_READABLE', READY);
    if (state !== 'queued') await apply('UPLOAD_STARTED');
    if (state === 'upload_failed') await apply('UPLOAD_FAILED');
    if (state === 'needs_attention') await apply('NEEDS_ATTENTION');
    if (state === 'hash_mismatch') {
      for (const type of ['SERVER_RECEIVED', 'SERVER_HASH_MISMATCH']) {
        await files.applyEvent(LOCAL_SHOP_ID, id, { type, origin: 'server' } as never, 11);
      }
    }
  }
  return id;
}

async function open(ui: React.ReactElement, states: FileState[]) {
  const orders = createMemoryOrderStore();
  const files = createMemoryEvidenceFileStore();
  const details = await seedOrder(orders, sampleOrder());
  const session = sampleSession(details, Date.now());
  await orders.saveSession(session);
  for (const state of states) await addFile(files, session, state);
  mockNavigation.params = { sessionId: session.id };
  const view = await renderWithProviders(ui, { orderStore: orders, evidenceFileStore: files });
  return { files, session, view };
}

describe('UI-C04/UI-C06: lỗi tải lên khác lỗi lưu trên máy', () => {
  it('tải lên lỗi: nói video VẪN lưu trên máy, không bảo quay lại, vẫn đếm là 1 video', async () => {
    await open(<PackConfirmScreen />, ['upload_failed']);
    expect(await screen.findByText(/Video vẫn lưu trên máy\. Tải lên chưa được/)).toBeOnTheScreen();
    expect(screen.queryByText(/Chưa lưu được video/)).toBeNull();
    expect(screen.queryByText(/quay lại đơn/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưu bằng chứng' })).toBeEnabled();
  });

  it('cần xử lý / mã băm không khớp: nói đúng và vẫn khẳng định bản trên máy còn', async () => {
    const attention = await open(<PackConfirmScreen />, ['needs_attention']);
    expect(await screen.findByText(/Việc tải lên cần bạn xử lý/)).toBeOnTheScreen();
    await attention.view.unmount();
    await open(<PackConfirmScreen />, ['hash_mismatch']);
    expect(await screen.findByText(/Video gốc vẫn được giữ trên máy/)).toBeOnTheScreen();
  });

  it('một tệp lỗi lưu + một tệp tốt: không bị tệp cuối che; nói một phần chưa lưu', async () => {
    await open(<PackConfirmScreen />, ['local_save_failed', 'queued']);
    expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    expect(screen.getByText(/Một số video chưa lưu được trên máy/)).toBeOnTheScreen();
  });

  it('tệp lỗi lưu nằm SAU tệp tốt cũng được báo (xét mọi tệp, không chỉ tệp cuối)', async () => {
    await open(<PackConfirmScreen />, ['queued', 'unrecoverable']);
    expect(await screen.findByText(/Một số video chưa lưu được trên máy/)).toBeOnTheScreen();
  });

  it('chỉ có tệp lỗi lưu: "Chưa lưu được video", không nhãn đã lưu', async () => {
    await open(<PackConfirmScreen />, ['local_save_failed']);
    expect(await screen.findByText(/Chưa lưu được video của phiên này/)).toBeOnTheScreen();
    expect(screen.queryByText('Đã lưu trên máy')).toBeNull();
  });

  it('đang lưu: nói đang lưu, nút Lưu bằng chứng bị khóa', async () => {
    await open(<PackConfirmScreen />, ['saving_local']);
    expect(await screen.findByText('Đang lưu video trên máy…')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lưu bằng chứng' })).toBeDisabled();
  });

  it('Hoàn tất: tải lên lỗi vẫn là "đã lưu trên thiết bị" kèm lời nói đúng; Số video đếm video đã lưu', async () => {
    await open(<PackDoneScreen />, ['upload_failed', 'local_save_failed']);
    expect(await screen.findByText(/Video vẫn lưu trên máy\. Tải lên chưa được/)).toBeOnTheScreen();
    expect(screen.getByText('Số video: 1')).toBeOnTheScreen();
    expect(screen.getByText(/Phiên chưa trọn vẹn/)).toBeOnTheScreen();
    expect(screen.queryByText(/Phiên đóng gói đã hoàn tất/)).toBeNull();
  });

  it('Hoàn tất: mọi tệp lỗi lưu thì KHÔNG nói hoàn tất, Số video không hiện', async () => {
    await open(<PackDoneScreen />, ['unrecoverable']);
    expect(await screen.findByText(/Chưa lưu được video của phiên này/)).toBeOnTheScreen();
    expect(screen.queryByText(/Số video/)).toBeNull();
    expect(screen.queryByText(/đã hoàn tất/i)).toBeNull();
  });
});

describe('usePackEvidence: đọc lại khi thay đổi / lấy lại focus', () => {
  it('tệp đang lưu chuyển sang hàng đợi: màn tự cập nhật nhãn mà không cần mở lại', async () => {
    jest.useFakeTimers();
    try {
      const t = await open(<PackConfirmScreen />, ['saving_local']);
      expect(await screen.findByText('Đang lưu video trên máy…')).toBeOnTheScreen();
      const [file] = await t.files.listBySession(LOCAL_SHOP_ID, t.session.id);
      await t.files.applyEvent(
        LOCAL_SHOP_ID,
        file?.id as EvidenceId,
        d('LOCAL_FILE_READABLE'),
        20,
        READY,
      );
      await act(async () => {
        jest.advanceTimersByTime(PACK_EVIDENCE_POLL_MS + 10);
      });
      expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rời màn rồi quay lại (lấy focus): đọc lại trạng thái mới', async () => {
    const t = await open(<PackConfirmScreen />, ['queued']);
    expect(await screen.findByText('Đã lưu trên máy')).toBeOnTheScreen();
    await act(async () => setMockScreenFocused(false));
    const [file] = await t.files.listBySession(LOCAL_SHOP_ID, t.session.id);
    await t.files.applyEvent(LOCAL_SHOP_ID, file?.id as EvidenceId, d('UPLOAD_STARTED'), 20);
    await act(async () => setMockScreenFocused(true));
    expect(
      await screen.findByText('Video đã lưu trên thiết bị. Đang tải lên máy chủ.'),
    ).toBeOnTheScreen();
  });

  it('tệp upload_failed/needs_attention: KHÔNG poll mãi (chỉ đọc một lần cho tới khi lấy lại focus)', async () => {
    jest.useFakeTimers();
    try {
      const t = await open(<PackConfirmScreen />, ['upload_failed', 'needs_attention']);
      const spy = jest.spyOn(t.files, 'listBySession');
      await act(async () => {
        jest.advanceTimersByTime(PACK_EVIDENCE_POLL_MS * 5);
      });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('đổi sessionId: kết quả phiên cũ không còn hiện, về loading rồi mới ra tệp của phiên mới', async () => {
    const orders = createMemoryOrderStore();
    const files = createMemoryEvidenceFileStore();
    const details = await seedOrder(orders, sampleOrder());
    const first = sampleSession(details, 1);
    const second = { ...sampleSession(details, 2), id: 'sess-2' as never };
    await orders.saveSession(first);
    await addFile(files, first, 'queued');
    let release: () => void = () => undefined;
    const real = files.listBySession.bind(files);
    let switchTo: (s: typeof first) => void = () => undefined;
    function Probe() {
      const [session, setSession] = useState(first);
      switchTo = setSession;
      const result = usePackEvidence(session);
      return <Text testID="probe">{result === 'loading' ? 'loading' : `n=${result.length}`}</Text>;
    }
    await renderWithProviders(<Probe />, { orderStore: orders, evidenceFileStore: files });
    expect(await screen.findByText('n=1')).toBeOnTheScreen();
    files.listBySession = (shop, id) =>
      id === second.id
        ? new Promise((resolve) => {
            release = () => resolve([]);
          })
        : real(shop, id);
    await act(async () => switchTo(second));
    expect(screen.getByTestId('probe').props.children).toBe('loading');
    await act(async () => release());
    expect(await screen.findByText('n=0')).toBeOnTheScreen();
  });
});
