import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  createLocalDataWiper,
  createLocalDeviceData,
  type LocalDeviceData,
  type LocalWipeSteps,
} from '@/features/orders';
import { LOCAL_WIPE_FILE_STEPS, openLocalDatabase } from '@/platform';
import { ErrorState, Text, useTheme } from '@/shared/ui';

import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';

/**
 * - `ready`: bình thường; tiến trình nền (tải lên, đồng bộ, khôi phục) được chạy.
 * - `resuming`: lúc mở app thấy dấu xóa dở (app bị tắt giữa chừng): xóa lại TRƯỚC khi dựng màn hình
 *   và tiến trình nền nào.
 * - `wiping`: đang xóa ngay sau khi máy chủ xác nhận xóa tài khoản (màn vẫn gắn, lớp phủ chặn thao tác).
 * - `failed`: xóa chưa xong; dấu vẫn còn, lớp phủ có Thử lại (không cho dùng app với dữ liệu nửa vời).
 */
export type LocalWipePhase = 'ready' | 'resuming' | 'wiping' | 'failed';

export interface LocalWipeContextValue {
  readonly phase: LocalWipePhase;
  /** Tiến trình nền chỉ được gắn khi `true` (Providers.tsx). */
  readonly ready: boolean;
  /** Bản ghi trên máy không chắc là của `uid` (điều kiện chặn xóa tài khoản). */
  countForeignRecords(uid: string): Promise<number>;
  /**
   * CHỈ gọi sau khi máy chủ đã xác nhận xóa tài khoản: dừng tiến trình nền, xóa dữ liệu trên máy theo thứ
   * tự bền, thoát phiên. `true` = đã xóa xong và phiên đã kết thúc (bên gọi về Chào mừng); `false` = chưa
   * xong (lớp phủ đang hiện Thử lại; dấu còn nên lần mở app sau cũng xóa tiếp).
   */
  wipeAfterAccountDeletion(): Promise<boolean>;
}

const LocalWipeContext = createContext<LocalWipeContextValue | null>(null);

/** Bước hệ tệp mặc định (adapter `platform/`). Test thay bằng bản giả. */
export type LocalWipeFileSteps = Pick<
  LocalWipeSteps,
  'hasMarker' | 'setMarker' | 'deleteEvidenceFiles' | 'clearMarker'
>;

const DEVICE_FILES: LocalWipeFileSteps = LOCAL_WIPE_FILE_STEPS;

/**
 * Xóa dữ liệu trên máy sau khi xóa tài khoản (V1-15). Đặt NGAY dưới `SessionProvider` trong `Providers.tsx`
 * (trên `SessionHydrator`, kho và tiến trình nền: lúc mở app thấy dấu thì chưa nạp lại phiên của tài khoản
 * đã xóa). Đọc dấu ĐỒNG BỘ lúc dựng: có dấu thì chưa dựng màn hình nào cho tới khi
 * xóa xong (chạy lại từ đầu, idempotent). Lớp phủ không đổi điều hướng; câu chữ đi qua i18n.
 */
export function LocalWipeProvider({
  children,
  device,
  files = DEVICE_FILES,
}: {
  children: ReactNode;
  /** Mặc định: CSDL dùng chung của app. Test truyền bản giả/`node:sqlite`. */
  device?: LocalDeviceData;
  files?: LocalWipeFileSteps;
}) {
  const { account } = usePersonalGateways();
  const session = useSession();
  const [data] = useState(() => device ?? createLocalDeviceData(openLocalDatabase));
  const wiper = useMemo(
    () =>
      createLocalDataWiper({
        ...files,
        wipeDatabase: () => data.wipeDatabase(),
        signOutLocal: () => account.signOut(),
      }),
    [files, data, account],
  );
  const [phase, setPhase] = useState<LocalWipePhase>(() =>
    wiper.hasPending() ? 'resuming' : 'ready',
  );
  // Mở app đã thấy dấu: chưa dựng màn hình nào tới khi xóa xong (state, không phải ref: quyết định render).
  const [launchResume, setLaunchResume] = useState(phase === 'resuming');
  const { endSessionAfterAccountDeletion } = session;
  // Chờ tới khi React ĐÃ commit pha mới (tiến trình nền đã bị gỡ, cleanup đã chạy) rồi mới xóa: effect
  // của cha chạy sau cleanup của con bị gỡ trong cùng lần commit.
  const phaseRef = useRef(phase);
  const commitWaiter = useRef<{ phase: LocalWipePhase; resolve: () => void } | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
    const waiter = commitWaiter.current;
    if (waiter && waiter.phase === phase) {
      commitWaiter.current = null;
      waiter.resolve();
    }
  }, [phase]);
  const enterPhase = useCallback((next: LocalWipePhase): Promise<void> => {
    if (phaseRef.current === next) return Promise.resolve();
    return new Promise<void>((resolve) => {
      commitWaiter.current = { phase: next, resolve };
      setPhase(next);
    });
  }, []);

  const runWipe = useCallback(
    async (next: 'resuming' | 'wiping'): Promise<boolean> => {
      await enterPhase(next);
      try {
        await wiper.run();
      } catch {
        setPhase('failed');
        return false;
      }
      endSessionAfterAccountDeletion();
      setLaunchResume(false);
      setPhase('ready');
      return true;
    },
    [wiper, endSessionAfterAccountDeletion, enterPhase],
  );

  useEffect(() => {
    if (!launchResume) return undefined;
    // Chạy ngoài lần commit (không đặt state đồng bộ trong effect); gắn lại (StrictMode) thì hủy lần cũ.
    const timer = setTimeout(() => void runWipe('resuming'), 0);
    return () => clearTimeout(timer);
    // Chỉ một lần khi gắn: dấu đọc lúc dựng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<LocalWipeContextValue>(
    () => ({
      phase,
      ready: phase === 'ready',
      countForeignRecords: (uid) => data.countForeignRecords(uid),
      wipeAfterAccountDeletion: () => runWipe('wiping'),
    }),
    [phase, data, runWipe],
  );
  const retry = () => void runWipe(launchResume ? 'resuming' : 'wiping');
  // Lúc mở app có dấu: chưa dựng màn hình nào (Splash sẽ khôi phục phiên SAU khi đã thoát).
  const holdChildren = launchResume && phase !== 'ready';

  return (
    <LocalWipeContext.Provider value={value}>
      {holdChildren ? null : children}
      {phase === 'ready' ? null : <LocalWipeOverlay failed={phase === 'failed'} onRetry={retry} />}
    </LocalWipeContext.Provider>
  );
}

export function useLocalWipe(): LocalWipeContextValue {
  const value = useContext(LocalWipeContext);
  if (!value) throw new Error('useLocalWipe phải nằm trong LocalWipeProvider');
  return value;
}

/** Lớp phủ toàn màn trong lúc xóa: chặn mọi thao tác, không đổi điều hướng. */
function LocalWipeOverlay({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View
      testID="local-wipe-overlay"
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: tokens.color.surface.screen,
          alignItems: 'center',
          justifyContent: 'center',
          padding: tokens.space.xl,
          gap: tokens.space.md,
        },
      ]}
    >
      {failed ? (
        <ErrorState
          testID="local-wipe-failed"
          title={t('personal:deleteAccount.wipe.failedTitle')}
          message={t('personal:deleteAccount.wipe.failedHint')}
          onRetry={onRetry}
        />
      ) : (
        <>
          <ActivityIndicator color={tokens.color.brand.primary} />
          <Text accessibilityRole="header" bold style={{ textAlign: 'center' }}>
            {t('personal:deleteAccount.wipe.inProgress')}
          </Text>
          <Text color="textMuted" style={{ textAlign: 'center' }}>
            {t('personal:deleteAccount.wipe.inProgressHint')}
          </Text>
        </>
      )}
    </View>
  );
}
