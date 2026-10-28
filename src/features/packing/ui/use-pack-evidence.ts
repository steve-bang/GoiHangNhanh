import { useEffect, useState } from 'react';

import type { EvidenceFile } from '@/features/evidence';
import { useCurrentShopId, useEvidenceFileStore } from '@/features/orders';

import type { PackingSession } from '@/features/orders';

/**
 * Tệp bằng chứng THẬT của một phiên (mới nhất cuối). `loading` khi đang đọc; `[]` khi chưa có tệp
 * nào hoặc không đọc được (không bao giờ dựng "đã lưu" khi không có tệp; bất biến 3).
 */
export function usePackEvidence(
  session: PackingSession | null | 'loading',
): 'loading' | readonly EvidenceFile[] {
  const files = useEvidenceFileStore();
  const shopId = useCurrentShopId();
  const [result, setResult] = useState<'loading' | readonly EvidenceFile[]>('loading');
  const sessionId = session && session !== 'loading' ? session.id : null;
  useEffect(() => {
    if (!sessionId) return undefined;
    let alive = true;
    files
      .listBySession(shopId, sessionId)
      .then((found) => alive && setResult(found))
      .catch(() => alive && setResult([]));
    return () => {
      alive = false;
    };
  }, [files, shopId, sessionId]);
  return sessionId ? result : 'loading';
}
