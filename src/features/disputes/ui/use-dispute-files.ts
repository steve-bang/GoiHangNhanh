import { useCallback, useEffect, useState } from 'react';

import type { EvidenceId, OrderId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import type { EvidenceFile } from '@/features/evidence';
import { useEvidenceFileStore } from '@/features/orders';

import { useDisputeStore } from '../data';

export type DisputeFilesState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      /** Tệp của đơn gắn với hồ sơ (rỗng nếu hồ sơ hoàn chưa liên kết đơn). */
      files: readonly EvidenceFile[];
      /** Bằng chứng đang bị giữ bởi hồ sơ tranh chấp đang mở của shop. */
      held: ReadonlySet<EvidenceId>;
    };

/** Tệp bằng chứng của một đơn + tập bằng chứng đang bị giữ. `orderId` null = chưa có đơn để lấy tệp. */
export function useDisputeFiles(
  shopId: ShopId,
  orderId: OrderId | null,
): { state: DisputeFilesState; reload: () => void } {
  const evidenceFiles = useEvidenceFileStore();
  const disputes = useDisputeStore();
  const [state, setState] = useState<DisputeFilesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [files, held] = await Promise.all([
        orderId ? evidenceFiles.listByOrder(shopId, orderId) : Promise.resolve([]),
        disputes.listHeldEvidenceIds(shopId),
      ]);
      if (!cancelled) setState({ kind: 'ready', files, held: new Set(held) });
    })().catch((error: unknown) => {
      logger.warn('disputes.files_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      if (!cancelled) setState({ kind: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [evidenceFiles, disputes, shopId, orderId, attempt]);

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}
