import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId, PackageId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { newSessionId, openAppSettings, useAppNavigation, useScannerPermission } from '@/platform';
import { CameraPermissionSheet } from '@/shared/ui';

import { useCurrentShopId, useOrderStore } from '../data';
import { buildPackingSession, findActiveSession } from '../domain';

interface Pending {
  orderId: OrderId;
  packageId: PackageId;
}

/**
 * Bắt đầu quay (đặc tả A04 rút gọn): (1) chưa có quyền camera -> hộp thoại xin quyền dùng chung;
 * (2) có quyền -> tạo phiên + giữ kiện + ảnh chụp đơn và LƯU TRƯỚC khi mở camera, rồi `replace` sang
 * màn quay bằng `sessionId` (không truyền mã đơn; bất biến 2). Kiện đã có phiên đang thực hiện thì
 * mở lại phiên đó thay vì tạo phiên mới (an toàn hơn phiên chồng; hộp hỏi "tạo phiên mới" cần đặc tả
 * cách kết thúc phiên cũ, làm cùng recorder). Dùng chung cho "Kiểm tra camera và
 * bắt đầu" (UI-C01) và "Bỏ qua, quay ngay" (UI-B04).
 *
 * CHƯA làm (chưa ghi video thật): kiểm tra dung lượng (`INSUFFICIENT_STORAGE`) và micro
 * (`MIC_PERMISSION_DENIED`).
 */
export function useStartPacking(): {
  begin: (orderId: OrderId, packageId: PackageId) => void;
  busy: boolean;
  error: ErrorCode | null;
  /** Hộp thoại xin quyền; đặt trong cây JSX của màn. */
  permissionSheet: ReactNode;
} {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const permission = useScannerPermission();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (target: Pending) => {
      if (running.current) return; // chống bấm đúp: một lần bấm = một phiên
      running.current = true;
      setBusy(true);
      setError(null);
      try {
        const details = await store.getOrder(shopId, target.orderId);
        if (!details) {
          setError('ORDER_SAVE_FAILED');
          return;
        }
        // Kiện đã có phiên đang thực hiện: MỞ LẠI phiên đó, không tạo phiên chồng (docs/04 A03:
        // "Kiện này đã có phiên đang thực hiện"; decisions.md Q-17).
        const active = findActiveSession(
          await store.listSessionsOfOrder(shopId, target.orderId),
          target.packageId,
        );
        if (active) {
          setPending(null);
          navigation.replace(ROUTES.packRecord, { sessionId: active.id });
          return;
        }
        const built = buildPackingSession(details, target.packageId, {
          sessionId: newSessionId(),
          nowDevice: Date.now(),
        });
        if (!built.ok) {
          setError('LOCAL_SAVE_UNAVAILABLE');
          return;
        }
        await store.saveSession(built.session);
        setPending(null);
        navigation.replace(ROUTES.packRecord, { sessionId: built.session.id });
      } catch (caught) {
        setError(isAppError(caught) ? caught.code : 'LOCAL_SAVE_UNAVAILABLE');
      } finally {
        running.current = false;
        setBusy(false);
      }
    },
    [navigation, shopId, store],
  );

  // Đã chọn "bắt đầu" mà quyền vừa được cấp (từ hộp thoại hoặc từ Cài đặt) thì tiếp tục.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- phản ứng với quyền camera đổi từ hệ điều hành
    if (pending && permission.status === 'granted') void run(pending);
  }, [pending, permission.status, run]);

  const begin = useCallback((orderId: OrderId, packageId: PackageId) => {
    setError(null);
    setPending({ orderId, packageId });
  }, []);

  const sheetStatus =
    permission.status === 'blocked'
      ? 'blocked'
      : permission.status === 'askable'
        ? 'askable'
        : null;
  const permissionSheet = (
    <CameraPermissionSheet
      visible={pending !== null && sheetStatus !== null}
      status={sheetStatus ?? 'askable'}
      reason={t('screens:preview.permissionReason')}
      onClose={() => setPending(null)}
      onRequest={() => void permission.request()}
      onOpenSettings={() => void openAppSettings()}
      testID="start-permission-modal"
      allowTestID="start-permission-allow"
    />
  );

  return { begin, busy, error, permissionSheet };
}
