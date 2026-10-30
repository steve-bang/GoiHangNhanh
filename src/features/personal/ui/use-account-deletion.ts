import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { ROUTES } from '@/core/navigation';
import { useDisputeStore } from '@/features/disputes';
import { useCurrentUid, useOrderStore } from '@/features/orders';
import { useAppNavigation, useScreenFocused } from '@/platform';
import { useToast } from '@/shared/ui';

import {
  canSubmitDelete,
  evaluateDeleteConditions,
  evaluateDeleteGate,
  type DeleteCondition,
  type DeleteConditionFacts,
} from '../domain/delete-account-conditions';
import { useLocalWipe } from './LocalWipeProvider';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { readDeviceFacts } from './read-device-facts';
import { useSession } from './SessionProvider';

export interface DeleteConsent {
  readonly agreed: boolean;
  readonly unsyncedAcknowledged: boolean;
}

/**
 * Đọc mọi điều kiện THẬT trên máy (V1-15): đang quay, tệp chưa tải (cả máy: xóa tài khoản xóa cả máy),
 * tranh chấp mở (mọi shop), dữ liệu của tài khoản khác (chưa biết tài khoản = không đọc được = chặn), số
 * cửa hàng là chủ. Mỗi nguồn lỗi -> `null` ("Chưa kiểm tra được"), không bao giờ suy ra "đạt".
 */
export function useDeleteFactsReader(): (options?: {
  readonly withOwnership?: boolean;
}) => Promise<DeleteConditionFacts> {
  const store = useOrderStore();
  const disputes = useDisputeStore();
  const wipe = useLocalWipe();
  const uid = useCurrentUid();
  const { account } = usePersonalGateways();
  return useCallback(
    async ({ withOwnership = true } = {}) => {
      const [device, openDisputes, foreignRecords, ownedShops] = await Promise.all([
        readDeviceFacts(store),
        disputes.countOpenOnDevice().catch(() => null),
        uid ? wipe.countForeignRecords(uid).catch(() => null) : Promise.resolve(null),
        withOwnership
          ? account
              .listShops()
              .then((shops) => shops.filter((shop) => shop.role === 'owner').length)
              .catch(() => null)
          : Promise.resolve(0),
      ]);
      return { ...device, openDisputes, foreignRecords, ownedShops };
    },
    [store, disputes, wipe, uid, account],
  );
}

/** Điều kiện theo khóa phiên, đọc lại mỗi khi màn lấy lại focus (số tệp không bị cũ). */
export function useDeleteConditions(options: { readonly withOwnership?: boolean } = {}) {
  const { withOwnership = true } = options;
  const session = useSession();
  const focused = useScreenFocused();
  const read = useDeleteFactsReader();
  const [checked, setChecked] = useState<{
    key: string;
    facts: DeleteConditionFacts;
  } | null>(null);
  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    const key = session.key;
    void read({ withOwnership }).then((facts) => {
      if (!cancelled) setChecked({ key, facts });
    });
    return () => {
      cancelled = true;
    };
  }, [read, session.key, focused, withOwnership]);
  const conditions: readonly DeleteCondition[] | null =
    checked && checked.key === session.key ? evaluateDeleteConditions(checked.facts) : null;
  return { conditions, gate: conditions ? evaluateDeleteGate(conditions) : null };
}

/**
 * Gửi yêu cầu xóa: đọc LẠI điều kiện ngay trước khi gọi máy chủ (không dựa vào kết quả cũ trên màn), gọi
 * `deleteAccount` (xác thực lại bằng mật khẩu), và CHỈ khi máy chủ xác nhận mới xóa dữ liệu trên máy rồi
 * về Chào mừng. Lỗi bất kỳ trước khi máy chủ xác nhận: không xóa gì, trả mã lỗi cho màn hiện.
 */
export function useDeleteAccountAction(options: { readonly withOwnership?: boolean } = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigation = useAppNavigation();
  const { account } = usePersonalGateways();
  const wipe = useLocalWipe();
  const read = useDeleteFactsReader();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | 'conditions_changed' | null>(null);
  const busyRef = useRef(false);

  const submit = useCallback(
    async (password: string, consent: DeleteConsent): Promise<void> => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        const facts = await read(options);
        if (!canSubmitDelete(evaluateDeleteGate(evaluateDeleteConditions(facts)), consent)) {
          setError('conditions_changed');
          return;
        }
        try {
          await account.deleteAccount(password);
        } catch (caught) {
          setError(isAppError(caught) ? caught.code : 'AUTH_SERVICE_UNAVAILABLE');
          return;
        }
        // Máy chủ đã xác nhận: từ đây không còn đường lui; lỗi xóa trên máy hiện ở lớp phủ (có Thử lại).
        if (await wipe.wipeAfterAccountDeletion()) {
          navigation.reset(ROUTES.welcome);
          toast.show(t('personal:deleteAccount.done'), { tone: 'success', placement: 'top' });
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    // `options` chỉ là cờ hằng của màn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [read, account, wipe, navigation, toast, t],
  );

  return { busy, error, submit, clearError: () => setError(null) };
}
