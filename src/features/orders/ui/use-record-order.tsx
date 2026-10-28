import { useCallback } from 'react';

import type { OrderId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';

import type { PackingSession } from '../domain';
import { useStartPacking } from './use-start-packing';

/**
 * "Quay đóng gói" cho MỘT đơn (chi tiết đơn, UI-E03): đơn đã có phiên đang thực hiện thì mở lại ĐÚNG
 * phiên/kiện đó (không tạo phiên chồng), chưa có thì sang Xác nhận đơn bằng ID đơn. Luôn truyền ID
 * nội bộ (bất biến 1, 2), không truyền mã đơn.
 */
export function useRecordOrder(orderId: OrderId, activeSession: PackingSession | null) {
  const navigation = useAppNavigation();
  const start = useStartPacking({ navigate: 'push' });
  const recordNow = useCallback(() => {
    if (activeSession) start.begin(orderId, activeSession.packageId);
    else navigation.push(ROUTES.orderPreview, { orderId });
  }, [activeSession, navigation, orderId, start]);
  return { start, recordNow };
}
