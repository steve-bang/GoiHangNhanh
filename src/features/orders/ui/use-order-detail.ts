import { useCallback, useEffect, useRef, useState } from 'react';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId } from '@/core/ids';
import { useScreenFocused } from '@/platform';

import { loadEvidenceItems, useCurrentShopId, useOrderStore } from '../data';
import {
  summarizePackEvidence,
  type OrderDetails,
  type OrderEvidenceItem,
  type OrderEvidenceSummary,
  type PackingSession,
} from '../domain';

export type OrderDetailState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error'; code: ErrorCode }
  | {
      kind: 'ready';
      details: OrderDetails;
      sessions: readonly PackingSession[];
      evidence: OrderEvidenceSummary;
      items: readonly OrderEvidenceItem[];
    };

/**
 * Nạp chi tiết đơn chỉ-đọc theo ID nội bộ và shop hiện tại. ID không có HOẶC thuộc shop khác đều là
 * `notFound` (kho coi bản ghi shop khác như không tồn tại; không lộ dữ liệu). Nạp lại khi màn lấy lại
 * focus (ví dụ quay về sau khi bắt đầu một phiên). Lỗi nạp lại khi đã có dữ liệu thì giữ dữ liệu cũ.
 */
export function useOrderDetail(orderId: OrderId | undefined): {
  state: OrderDetailState;
  reload: () => void;
} {
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const focused = useScreenFocused();
  const [state, setState] = useState<OrderDetailState>({ kind: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    if (!orderId) {
      setState({ kind: 'notFound' });
      return;
    }
    try {
      const details = await store.getOrder(shopId, orderId);
      if (!details) {
        if (mine === generation.current) setState({ kind: 'notFound' });
        return;
      }
      const sessions = await store.listSessionsOfOrder(shopId, orderId);
      const items = await loadEvidenceItems(shopId, orderId);
      if (mine !== generation.current) return;
      setState({
        kind: 'ready',
        details,
        sessions,
        evidence: summarizePackEvidence(items),
        items,
      });
    } catch (caught) {
      if (mine !== generation.current) return;
      const code: ErrorCode = isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED';
      setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', code }));
    }
  }, [orderId, shopId, store]);

  useEffect(() => {
    if (!focused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/lấy lại focus
    void load();
  }, [focused, load]);

  // Chi tiết đang giữ thuộc shop khác (vừa đổi shop) thì không hiện: coi như đang nạp lại (bất biến 8).
  const visible: OrderDetailState =
    state.kind === 'ready' && state.details.order.shopId !== shopId ? { kind: 'loading' } : state;

  return {
    state: visible,
    reload: () => {
      setState({ kind: 'loading' });
      void load();
    },
  };
}
