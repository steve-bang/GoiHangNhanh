import { useCallback, useEffect, useRef, useState } from 'react';

import type { EvidenceId, OrderId } from '@/core/ids';
import type { EvidenceFile } from '@/features/evidence';
import { useScreenFocused } from '@/platform';

import { useCurrentShopId, useEvidenceFileStore, useOrderStore } from '../data';
import type { OrderDetails, PackingSession } from '../domain';

export type EvidenceDetailState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      file: EvidenceFile;
      orderCode: string;
      /** Số thứ tự kiện; `null` nếu kiện không còn trong dữ liệu đơn (không đoán). */
      packageIndex: number | null;
      session: PackingSession | null;
    };

/**
 * Nạp MỘT tệp bằng chứng theo `evidenceId` (bất biến 1: tra theo ID nội bộ, không theo mã đơn) trong shop
 * hiện tại (bất biến 8). Tệp không có, thuộc shop khác, hoặc gắn với ĐƠN KHÁC đơn trên đường dẫn đều là
 * `notFound`: không hiển thị tệp dưới đơn mà nó không thuộc. Kiện/phiên đọc theo ID lưu trong bản ghi
 * tệp (bất biến 2). Nạp lại khi màn lấy lại focus (trạng thái tệp đổi khi hàng đợi tải chạy).
 */
export function useEvidenceDetail(
  orderId: OrderId | undefined,
  evidenceId: EvidenceId | undefined,
): { state: EvidenceDetailState; reload: () => void } {
  const store = useOrderStore();
  const evidenceFiles = useEvidenceFileStore();
  const shopId = useCurrentShopId();
  const focused = useScreenFocused();
  const [state, setState] = useState<EvidenceDetailState>({ kind: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    if (!orderId || !evidenceId) {
      setState({ kind: 'notFound' });
      return;
    }
    try {
      const file = await evidenceFiles.get(shopId, evidenceId);
      const details: OrderDetails | null =
        file && file.orderId === orderId ? await store.getOrder(shopId, orderId) : null;
      if (!file || !details) {
        if (mine === generation.current) setState({ kind: 'notFound' });
        return;
      }
      const sessions = await store.listSessionsOfOrder(shopId, orderId);
      if (mine !== generation.current) return;
      setState({
        kind: 'ready',
        file,
        orderCode: details.order.orderCode,
        packageIndex: details.packages.find((p) => p.id === file.packageId)?.index ?? null,
        session: sessions.find((s) => s.id === file.sessionId) ?? null,
      });
    } catch {
      if (mine !== generation.current) return;
      setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'error' }));
    }
  }, [orderId, evidenceId, shopId, store, evidenceFiles]);

  useEffect(() => {
    if (!focused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/lấy lại focus
    void load();
  }, [focused, load]);

  return { state, reload: () => void load() };
}
