import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { ROUTES } from '@/core/navigation';
import { useCurrentShopId, useOrderStore } from '@/features/orders';
import { useAppNavigation } from '@/platform';
import { useToast } from '@/shared/ui';

import { evaluateSwitchShopGuard, type SwitchShopGuard } from '../domain/switch-shop-guard';
import type { ShopSummary } from '../domain/types';
import { usePersonalGateways } from './PersonalGatewaysProvider';
import { useSession } from './SessionProvider';

/** Bước của luồng chuyển shop: hộp xác nhận, hoặc cảnh báo (đang quay: chặn; còn tệp chưa đồng bộ: hỏi lại). */
export type SwitchShopStep = 'closed' | 'confirm' | 'blocked_recording' | 'unsynced';

/**
 * Luồng chuyển cửa hàng (PER-07): chọn -> kiểm tra shop ĐANG DÙNG (đang quay, chưa đồng bộ) -> xác nhận
 * -> cổng -> đổi phiên -> về Tổng quan. Đang quay: chặn. Còn tệp chưa đồng bộ: cảnh báo có lối tới UI-F01 và
 * cho "Vẫn chuyển" (chốt tạm, Q-19o). Không đọc được kho cục bộ: chặn bảo thủ, báo `SHOP_SWITCH_FAILED`.
 * Phiên chỉ đổi SAU KHI cổng xác nhận; lỗi giữ nguyên shop hiện tại. Không xóa dữ liệu cục bộ của shop cũ.
 * Chống bấm lặp bằng `busy`. Toast thành công chỉ hiện sau khi đã đổi phiên.
 */
export function useSwitchShop() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const toast = useToast();
  const session = useSession();
  const { account } = usePersonalGateways();
  const store = useOrderStore();
  const currentShopId = useCurrentShopId();
  const [step, setStep] = useState<SwitchShopStep>('closed');
  const [target, setTarget] = useState<ShopSummary | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const fail = useCallback(
    (code: 'SHOP_SWITCH_FAILED' | 'SHOP_PERMISSION_DENIED' = 'SHOP_SWITCH_FAILED') => {
      toast.show(errorText(resolveErrorMessage(t, code)), { tone: 'error' });
    },
    [toast, t],
  );

  const select = useCallback(
    async (shop: ShopSummary) => {
      if (busyRef.current || shop.status !== 'active') return;
      // Chọn chính shop đang dùng: không có gì để chuyển.
      if (shop.id === session.state.shopId) return;
      busyRef.current = true;
      setBusy(true);
      try {
        let guard: SwitchShopGuard;
        try {
          const [recording, unsynced] = await Promise.all([
            store.hasRecordingInProgress(currentShopId).catch(() => null),
            store.countUnsynced(currentShopId).catch(() => null),
          ]);
          guard = evaluateSwitchShopGuard({ recording, unsynced });
        } catch {
          guard = { kind: 'unknown' };
        }
        setTarget(shop);
        if (guard.kind === 'blocked_recording') return setStep('blocked_recording');
        if (guard.kind === 'unsynced') {
          setUnsyncedCount(guard.count);
          return setStep('unsynced');
        }
        if (guard.kind === 'unknown') {
          setTarget(null);
          return fail();
        }
        setStep('confirm');
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [store, currentShopId, session.state.shopId, fail],
  );

  const dismiss = useCallback(() => {
    if (busyRef.current) return;
    setStep('closed');
    setTarget(null);
  }, []);

  const confirm = useCallback(async () => {
    if (busyRef.current || !target) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const chosen = await account.switchShop(target.id);
      // Cổng đã xác nhận: đổi phiên (xả state/cache theo shop cũ), bỏ mọi màn của shop cũ, rồi mới báo.
      session.changeShop(chosen.id);
      setStep('closed');
      setTarget(null);
      navigation.reset(ROUTES.home);
      toast.show(t('personal:switchShop.switched', { name: chosen.name }), { tone: 'success' });
    } catch {
      setStep('closed');
      setTarget(null);
      fail();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [target, account, session, navigation, toast, t, fail]);

  const openSyncCenter = useCallback(() => {
    setStep('closed');
    setTarget(null);
    navigation.push(ROUTES.sync);
  }, [navigation]);

  return { step, target, busy, unsyncedCount, select, dismiss, confirm, openSyncCenter };
}
