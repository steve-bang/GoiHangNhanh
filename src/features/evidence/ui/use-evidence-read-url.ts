import { useCallback, useEffect, useRef, useState } from 'react';

import type { EvidenceId, ShopId } from '@/core/ids';
import { getConnectivity } from '@/platform';

import { EvidenceReadUrlError, useEvidenceReadUrlApi } from '../data/read-url';

export type EvidenceReadUrlState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; url: string }
  /** `offline` = thiết bị mất mạng; `network` = không tới được máy chủ; `unavailable` = máy chủ không cho xem; `playback` = đã xin URL mới mà vẫn phát lỗi. */
  | { kind: 'error'; reason: 'offline' | 'network' | 'unavailable' | 'playback' };

/**
 * Xin URL xem từ máy chủ cho MỘT bằng chứng khi tệp trên máy không còn (`enabled` = playback `cloud`).
 *
 * - Chỉ gọi khi `enabled`; tệp còn trên máy thì không bao giờ gọi (ưu tiên máy, đỡ tốn dữ liệu).
 * - URL chỉ nằm trong state: không lưu SQLite/đĩa, không log.
 * - `reportPlayError()`: URL hết hạn hoặc phát lỗi -> tự xin URL mới ĐÚNG MỘT lần cho mỗi lần lỗi liên tiếp;
 *   URL vừa xin lại mà lỗi ngay (trong `HEALTHY_AFTER_MS`) thì hiện lỗi kèm nút Thử lại (`retry()` đặt lại
 *   bộ đếm). URL đã dùng được từ `HEALTHY_AFTER_MS` trở lên rồi mới lỗi (hết hạn 15 phút) tính là lần lỗi mới,
 *   nên màn mở rất lâu vẫn tự gia hạn các lần hết hạn sau, mà không vòng lặp vô hạn.
 * - Mất mạng: báo `offline` ngay, không gọi (nút Thử lại gọi lại khi có mạng).
 */
/** URL sống ít nhất chừng này rồi mới lỗi = đã dùng được (hết hạn), không phải URL hỏng ngay từ đầu. */
const HEALTHY_AFTER_MS = 30_000;

export function useEvidenceReadUrl(
  shopId: ShopId,
  evidenceId: EvidenceId,
  enabled: boolean,
): {
  state: EvidenceReadUrlState;
  retry: () => void;
  reportPlayError: () => void;
} {
  const api = useEvidenceReadUrlApi();
  const [state, setState] = useState<EvidenceReadUrlState>({ kind: 'idle' });
  const generation = useRef(0);
  const autoRenewed = useRef(false);
  const readyAt = useRef(0);

  const load = useCallback(async () => {
    generation.current += 1;
    const mine = generation.current;
    if (!api) {
      setState({ kind: 'error', reason: 'unavailable' });
      return;
    }
    if (!getConnectivity().online) {
      setState({ kind: 'error', reason: 'offline' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const { url } = await api.get(shopId, evidenceId);
      if (mine === generation.current) {
        readyAt.current = Date.now();
        setState({ kind: 'ready', url });
      }
    } catch (error) {
      if (mine !== generation.current) return;
      const reason =
        error instanceof EvidenceReadUrlError && error.reason === 'network'
          ? 'network'
          : 'unavailable';
      setState({ kind: 'error', reason });
    }
  }, [api, shopId, evidenceId]);

  useEffect(() => {
    if (!enabled) {
      generation.current += 1;
      // Bật lại sau này không được hiện URL cũ dù chỉ một lượt render.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- xóa URL khi rời trạng thái xem từ máy chủ
      setState({ kind: 'idle' });
      return;
    }
    autoRenewed.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- xin URL khi vào trạng thái xem từ máy chủ
    void load();
    return () => {
      generation.current += 1;
    };
  }, [enabled, load]);

  const retry = useCallback(() => {
    autoRenewed.current = false;
    void load();
  }, [load]);

  const reportPlayError = useCallback(() => {
    if (autoRenewed.current && Date.now() - readyAt.current >= HEALTHY_AFTER_MS) {
      autoRenewed.current = false;
    }
    if (autoRenewed.current) {
      generation.current += 1;
      setState({ kind: 'error', reason: 'playback' });
      return;
    }
    autoRenewed.current = true;
    void load();
  }, [load]);

  return { state: enabled ? state : { kind: 'idle' }, retry, reportPlayError };
}
