import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { resolveErrorMessage, errorText } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useCurrentUid, useOrderStore } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import { useToast } from '@/shared/ui';

import { evaluateSignOutGuard, type SignOutGuard } from '../domain/sign-out-guard';
import { readDeviceFacts } from './read-device-facts';
import { useSession } from './SessionProvider';

/** Bước của luồng đăng xuất: hộp xác nhận, hoặc cảnh báo chặn (UI-J15 chưa có mã/route: hộp thoại tại chỗ). */
export type SignOutStep = 'closed' | 'confirm' | 'blocked_recording' | 'unsynced';

export interface SignOutOptions {
  /**
   * Đăng xuất xong thì về Đăng nhập với email điền sẵn thay vì Chào mừng (nút "Đăng nhập lại" của Đổi
   * mật khẩu khi máy chủ đòi đăng nhập lại, V1-05). Vẫn đi qua đủ các chặn của luồng an toàn.
   */
  readonly signInAgainEmail?: string;
  /**
   * Không chặn vì tệp chưa đồng bộ (vẫn chặn khi đang quay). CHỈ cho màn "Đang hoàn tất xóa tài khoản"
   * (V1-15): cửa hàng đã bị khóa nên tệp không bao giờ tải lên được nữa; chặn thì người dùng kẹt. Đăng
   * xuất không xóa gì (Q-20h): tệp vẫn nằm trên máy.
   */
  readonly allowUnsynced?: boolean;
}

/**
 * Luồng đăng xuất an toàn (PER-21): xác nhận -> kiểm tra (đang quay, chưa đồng bộ) -> cổng đăng xuất
 * -> về Chào mừng. Chỉ đăng xuất khi người dùng đã xác nhận VÀ điều kiện bảo vệ dữ liệu đáp ứng; lỗi
 * (cổng hoặc đọc kho cục bộ) báo `AUTH_SIGN_OUT_FAILED` và giữ phiên. Không xóa dữ liệu cục bộ (Q-20h).
 * Kiểm tra theo TOÀN THIẾT BỊ (mọi shop trên máy), vì đăng xuất rời cả tài khoản (Q-20o, bổ sung), và chỉ
 * tính tệp do chính tài khoản đang đăng nhập tạo (V1-07, Q-24g: tệp của tài khoản khác không chặn).
 * Chống bấm lặp bằng `busy`. Toast thành công chỉ hiện SAU khi cổng xác nhận và đã điều hướng.
 */
export function useSignOut(options: SignOutOptions = {}) {
  const { signInAgainEmail, allowUnsynced = false } = options;
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const toast = useToast();
  const session = useSession();
  const store = useOrderStore();
  const uid = useCurrentUid();
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
        // Chỉ tệp của CHÍNH tài khoản này chặn đăng xuất (V1-07); chưa biết tài khoản thì đếm cả máy.
        guard = evaluateSignOutGuard(await readDeviceFacts(store, uid));
      } catch {
        guard = { kind: 'unknown' };
      }
      if (guard.kind === 'blocked_recording') return setStep('blocked_recording');
      if (guard.kind === 'unsynced' && !allowUnsynced) {
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
      if (signInAgainEmail !== undefined) {
        session.setSignInEmailHint(signInAgainEmail);
        navigation.reset(ROUTES.signIn);
      } else {
        navigation.reset(ROUTES.welcome);
      }
      // Đặt ở đầu màn: đáy Chào mừng có liên kết Điều khoản/Chính sách mà thông báo ở đáy sẽ che mất.
      toast.show(t('personal:signOut.success'), { tone: 'success', placement: 'top' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [store, uid, session, navigation, toast, t, fail, signInAgainEmail, allowUnsynced]);

  const openSyncCenter = useCallback(() => {
    setStep('closed');
    navigation.push(ROUTES.sync);
  }, [navigation]);

  return { step, busy, unsyncedCount, start, dismiss, confirm, openSyncCenter };
}
