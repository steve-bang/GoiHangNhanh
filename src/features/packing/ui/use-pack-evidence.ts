import { useEffect, useState } from 'react';

import type { EvidenceFile } from '@/features/evidence';
import { useCurrentShopId, useEvidenceFileStore, type PackingSession } from '@/features/orders';
import { useScreenFocused } from '@/platform';

import { hasPendingEvidence } from '../domain';

/** Giãn cách đọc lại khi còn tệp đang đổi trạng thái (đang lưu, chờ/đang tải lên). */
export const PACK_EVIDENCE_POLL_MS = 3000;

/**
 * Tệp bằng chứng THẬT của MỌI lần ghi trong một phiên (mới nhất cuối). `loading` khi đang đọc; `[]` khi
 * chưa có tệp nào hoặc không đọc được (không bao giờ dựng "đã lưu" khi không có tệp; bất biến 3). Đọc lại
 * mỗi khi màn lấy lại focus và định kỳ (`PACK_EVIDENCE_POLL_MS`) chừng nào còn tệp có thể đổi trạng thái,
 * để nhãn theo kịp việc lưu/tải lên thay vì đứng yên ở lần đọc đầu. Lần đọc lại lỗi thì giữ kết quả cũ (của cùng phiên); đổi phiên thì về `loading`.
 */
export function usePackEvidence(
  session: PackingSession | null | 'loading',
): 'loading' | readonly EvidenceFile[] {
  const files = useEvidenceFileStore();
  const shopId = useCurrentShopId();
  const focused = useScreenFocused();
  // Kết quả gắn với phiên đã đọc: đổi `sessionId` thì kết quả phiên cũ không được lộ ra (về `loading`).
  const [loaded, setLoaded] = useState<{
    sessionId: string;
    files: readonly EvidenceFile[];
  } | null>(null);
  const [tick, setTick] = useState(0);
  const sessionId = session && session !== 'loading' ? session.id : null;

  useEffect(() => {
    if (!sessionId || !focused) return undefined;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    files
      .listBySession(shopId, sessionId)
      .then((found) => {
        if (!alive) return;
        setLoaded({ sessionId, files: found });
        if (hasPendingEvidence(found)) {
          timer = setTimeout(() => alive && setTick((value) => value + 1), PACK_EVIDENCE_POLL_MS);
        }
      })
      .catch(
        () =>
          alive &&
          setLoaded((previous) =>
            previous?.sessionId === sessionId ? previous : { sessionId, files: [] },
          ),
      );
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [files, shopId, sessionId, focused, tick]);
  if (!sessionId || loaded?.sessionId !== sessionId) return 'loading';
  return loaded.files;
}
