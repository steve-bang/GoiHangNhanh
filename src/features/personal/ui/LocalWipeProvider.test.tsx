import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

import { createMemoryLocalWipe } from '@/test-utils/memory-local-wipe';
import { resetMockNavigation } from '@/test-utils/mock-navigation';
import { renderWithProviders } from '@/test-utils/render';

import { createFakePersonalGateways } from '../data/fake-personal-gateways';
import { useLocalWipe } from './LocalWipeProvider';

jest.mock(
  '@/platform/navigation',
  () => jest.requireActual('@/test-utils/mock-navigation').navigationMock,
);

beforeEach(() => resetMockNavigation());

/** Ghi lại tiến trình nền nào đang gắn tại thời điểm đặt dấu (bước xóa đầu tiên). */
function spyMarker(localWipe: ReturnType<typeof createMemoryLocalWipe>, mounted: string[]) {
  const seen: string[] = [];
  const setMarker = localWipe.files.setMarker;
  localWipe.files.setMarker = () => {
    seen.push(mounted.join(',') || '(none)');
    return setMarker();
  };
  return seen;
}

/** Đứng thay cho tiến trình nền (Providers.tsx `BackgroundRunners`): ghi lại khi nào được gắn. */
function RunnerProbe({ mounted }: { mounted: string[] }) {
  const { ready } = useLocalWipe();
  return ready ? <MountedRunner mounted={mounted} /> : null;
}
function MountedRunner({ mounted }: { mounted: string[] }) {
  useEffect(() => {
    mounted.push('runner');
    return () => {
      mounted.push('unmount');
    };
  }, [mounted]);
  return <Text testID="runner">runner</Text>;
}

describe('LocalWipeProvider (V1-15)', () => {
  it('không có dấu lúc mở app: dựng màn hình và tiến trình nền ngay, không xóa gì', async () => {
    const localWipe = createMemoryLocalWipe();
    const mounted: string[] = [];
    await renderWithProviders(<RunnerProbe mounted={mounted} />, { localWipe });
    expect(screen.getByTestId('runner')).toBeOnTheScreen();
    expect(mounted).toEqual(['runner']);
    expect(localWipe.state.log).toEqual([]);
    expect(screen.queryByTestId('local-wipe-overlay')).toBeNull();
  });

  it('có dấu (app bị tắt giữa lúc xóa): xóa lại TỪ ĐẦU trước khi dựng màn hình/tiến trình nền, rồi thoát', async () => {
    const localWipe = createMemoryLocalWipe({ pending: true });
    const gateways = createFakePersonalGateways();
    const mounted: string[] = [];
    const seen = spyMarker(localWipe, mounted);
    await renderWithProviders(<RunnerProbe mounted={mounted} />, {
      localWipe,
      personalGateways: gateways,
    });
    await waitFor(() => expect(screen.getByTestId('runner')).toBeOnTheScreen());
    expect(localWipe.state.log).toEqual([
      'setMarker',
      'deleteEvidenceFiles',
      'wipeDatabase',
      'clearMarker',
    ]);
    expect(gateways.account.signOutCalls).toBe(1);
    expect(localWipe.state.marker).toBe(false);
    // Lúc bắt đầu xóa chưa có tiến trình nền nào; chỉ gắn sau khi xóa xong.
    expect(seen).toEqual(['(none)']);
    expect(mounted).toEqual(['runner']);
  });

  it('có dấu và xóa lỗi: giữ dấu, KHÔNG dựng tiến trình nền, có Thử lại', async () => {
    const localWipe = createMemoryLocalWipe({ pending: true, failDatabase: true });
    const mounted: string[] = [];
    await renderWithProviders(<RunnerProbe mounted={mounted} />, { localWipe });
    expect(await screen.findByTestId('local-wipe-failed')).toBeOnTheScreen();
    expect(screen.getByText('Chưa xóa xong dữ liệu trên máy này.')).toBeOnTheScreen();
    expect(localWipe.state.marker).toBe(true);
    expect(mounted).toEqual([]);
    localWipe.state.failDatabase = false;
    await fireEvent.press(screen.getByText('Thử lại'));
    await waitFor(() => expect(screen.getByTestId('runner')).toBeOnTheScreen());
    expect(localWipe.state.marker).toBe(false);
  });

  it('xóa trong phiên: tiến trình nền bị gỡ trong lúc xóa và gắn lại sau', async () => {
    const localWipe = createMemoryLocalWipe();
    const mounted: string[] = [];
    const seen = spyMarker(localWipe, mounted);
    const holder: { wipe: (() => Promise<boolean>) | null } = { wipe: null };
    function Trigger() {
      const { wipeAfterAccountDeletion } = useLocalWipe();
      useEffect(() => {
        holder.wipe = wipeAfterAccountDeletion;
      }, [wipeAfterAccountDeletion]);
      return null;
    }
    await renderWithProviders(
      <>
        <Trigger />
        <RunnerProbe mounted={mounted} />
      </>,
      { localWipe },
    );
    expect(screen.getByTestId('runner')).toBeOnTheScreen();
    const run = holder.wipe;
    if (!run) throw new Error('no wipe');
    let result: boolean | null = null;
    void run().then((value) => {
      result = value;
    });
    await waitFor(() => expect(result).toBe(true));
    await waitFor(() => expect(screen.getByTestId('runner')).toBeOnTheScreen());
    // Tiến trình nền đã gỡ TRƯỚC bước xóa đầu tiên.
    expect(seen).toEqual(['runner,unmount']);
    expect(mounted).toEqual(['runner', 'unmount', 'runner']);
  });
});
