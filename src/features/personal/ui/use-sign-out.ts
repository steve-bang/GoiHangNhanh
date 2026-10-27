import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveErrorMessage, errorText } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useCurrentShopId, useOrderStore } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import { useToast } from '@/shared/ui';

import { evaluateSignOutGuard, type SignOutGuard } from '../domain/sign-out-guard';
import { useSession } from './SessionProvider';

/** Bước của luồng đăng xuất: hộp xác nhận, hoặc cảnh báo chặn (UI-J15 chưa có mã/route: BottomSheet tại chỗ). */
export type SignOutStep = 'closed' | 'confirm' | 'blocked_recording' | 'unsynced';

/**
 * Luồng đăng xuất an toàn (PER-21): xác nhận -> kiểm tra (đang quay, chưa đồng bộ) -> cổng đăng xuất
 * -> về Chào mừng. Chỉ đăng xuất khi người dùng đã xác nhận VÀ điều kiện bảo vệ dữ liệu đáp ứng; lỗi
 * (cổng hoặc đọc kho cục bộ) báo `AUTH_SIGN_OUT_FAILED` và giữ phiên. Không xóa dữ liệu cục bộ (Q-19h).
 * Chống bấm lặp bằng `busy`. Toast thành công chỉ hiện SAU khi cổng xác nhận và đã điều hướng.
 */
export function useSignOut() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const toast = useToast();
  const session = useSession();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const [step, setStep] = useState<SignOutStep>('closed');
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const fail = useCallback(() => {
    toast.show(errorText(resolveErrorMessage(t, 'AUTH_SIGN_OUT_FAILED')), { tone: 'error' });
  }, [toast, t]);

  const start = useCallback(() => {
    if (!busyRef.current) setStep('confirm');
  }, []);
  const dismiss = useCallback(() => {
    if (!busyRef.current) setStep('closed');
  }, []);

  const confirm = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      let guard: SignOutGuard;
      try {
        const [recording, unsynced] = await Promise.all([
          store.hasRecordingInProgress(shopId).catch(() => null),
          store.countUnsynced(shopId).catch(() => null),
        ]);
        guard = evaluateSignOutGuard({ recording, unsynced });
      } catch {
        guard = { kind: 'unknown' };
      }
      if (guard.kind === 'blocked_recording') return setStep('blocked_recording');
      if (guard.kind === 'unsynced') {
        setUnsyncedCount(guard.count);
        return setStep('unsynced');
      }
      if (guard.kind === 'unknown') {
        setStep('closed');
        return fail();
      }
      try {
        await session.signOut();
      } catch {
        setStep('closed');
        return fail();
      }
      setStep('closed');
      navigation.reset(ROUTES.welcome);
      toast.show(t('personal:signOut.success'), { tone: 'success' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [store, shopId, session, navigation, toast, t, fail]);

  const openSyncCenter = useCallback(() => {
    setStep('closed');
    navigation.push(ROUTES.sync);
  }, [navigation]);

  return { step, busy, unsyncedCount, start, dismiss, confirm, openSyncCenter };
}
