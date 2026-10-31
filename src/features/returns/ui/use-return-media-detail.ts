import { useCallback, useEffect, useRef, useState } from 'react';

import type { ReturnCaseId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId } from '@/features/orders';
import { useScreenFocused } from '@/platform';

import { useReturnStore } from '../data';
import type { ReturnDetails, ReturnMedia } from '../domain';

export type ReturnMediaDetailState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error' }
  | { kind: 'ready'; media: ReturnMedia; details: ReturnDetails };

/**
 * Nạp MỘT ảnh/video hàng hoàn theo `mediaId` của hồ sơ `returnId` trong shop hiện tại (V1-17b; bất biến 1,
 * 8). Media phải nằm trong danh sách media của ĐÚNG hồ sơ trên đường dẫn: hồ sơ không có (hoặc của shop
 * khác), media của hồ sơ khác, ID lạ hay thiếu tham số đều là `notFound`. Nạp lại khi màn lấy lại focus
 * (trạng thái tệp đổi khi hàng đợi tải chạy).
 */
export function useReturnMediaDetail(
  returnId: string | undefined,
  mediaId: string | undefined,
): { state: ReturnMediaDetailState; reload: () => void } {
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  const focused = useScreenFocused();
  const [state, setState] = useState<ReturnMediaDetailState>({ kind: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    if (!returnId || !mediaId) {
      setState({ kind: 'notFound' });
      return;
    }
    try {
      const details = await store.getReturn(shopId, returnId as ReturnCaseId);
      const list = details ? await store.listMedia(shopId, details.returnCase.id) : [];
      if (mine !== generation.current) return;
      const media = list.find(
        (m) => m.id === mediaId && m.returnId === returnId && m.shopId === shopId,
      );
      setState(details && media ? { kind: 'ready', media, details } : { kind: 'notFound' });
    } catch (error) {
      logger.warn('returns.media_detail_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      if (mine !== generation.current) return;
      setState((prev) => (prev.kind === 'ready' ? prev : { kind: 'error' }));
    }
  }, [store, shopId, returnId, mediaId]);

  useEffect(() => {
    if (!focused) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/lấy lại focus
    void load();
  }, [focused, load]);

  return { state, reload: () => void load() };
}
