import { useCallback, useEffect, useState } from 'react';

import type { EvidenceId, OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import type { FileState } from '@/features/evidence';
import { useEvidenceFileStore } from '@/features/orders';
import { isMediaSavedLocally, useReturnStore } from '@/features/returns';

import { useDisputeStore } from '../data';

/**
 * Một tệp có thể đưa vào hồ sơ: video/ảnh đóng gói của đơn, hoặc ảnh kiện của chính hồ sơ hoàn (R2a;
 * `group: 'return'`). Ảnh hàng hoàn dùng ID của bản ghi ảnh làm `id` (`dispute_evidence.evidence_id`
 * không có khóa ngoại nên dùng chung được; ID là UUID nên không trùng ID tệp bằng chứng).
 */
export interface DisputeFileItem {
  readonly id: EvidenceId;
  readonly kind: 'video' | 'photo';
  readonly group: string;
  readonly state: FileState;
  readonly createdAtDevice: number;
}

export type DisputeFilesState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | {
      kind: 'ready';
      /**
       * Tệp của đơn gắn với hồ sơ (rỗng nếu hồ sơ hoàn chưa liên kết đơn), cộng ảnh kiện đã lưu trên máy
       * của chính hồ sơ hoàn (nếu là hồ sơ hoàn).
       */
      files: readonly DisputeFileItem[];
      /** Bằng chứng đang bị giữ bởi hồ sơ tranh chấp đang mở của shop. */
      held: ReadonlySet<EvidenceId>;
    };

/**
 * Tệp bằng chứng của một đơn (+ ảnh kiện của hồ sơ hoàn `returnId`) + tập bằng chứng đang bị giữ. `orderId`
 * null = chưa có đơn để lấy tệp. Ảnh hàng hoàn chỉ lấy của đúng hồ sơ đó và đúng shop (bất biến 8).
 */
export function useDisputeFiles(
  shopId: ShopId,
  orderId: OrderId | null,
  returnId: ReturnCaseId | null = null,
): { state: DisputeFilesState; reload: () => void } {
  const evidenceFiles = useEvidenceFileStore();
  const disputes = useDisputeStore();
  const returns = useReturnStore();
  const [state, setState] = useState<DisputeFilesState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [files, photos, held] = await Promise.all([
        orderId ? evidenceFiles.listByOrder(shopId, orderId) : Promise.resolve([]),
        returnId ? returns.listMedia(shopId, returnId) : Promise.resolve([]),
        disputes.listHeldEvidenceIds(shopId),
      ]);
      const items: DisputeFileItem[] = [
        ...files.map((f) => ({
          id: f.id,
          kind: f.kind,
          group: f.group,
          state: f.state,
          createdAtDevice: f.createdAtDevice,
        })),
        ...photos.filter(isMediaSavedLocally).map((m) => ({
          id: m.id as EvidenceId,
          kind: 'photo' as const,
          group: 'return',
          state: m.state,
          createdAtDevice: m.createdAtDevice,
        })),
      ];
      if (!cancelled) setState({ kind: 'ready', files: items, held: new Set(held) });
    })().catch((error: unknown) => {
      logger.warn('disputes.files_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      if (!cancelled) setState({ kind: 'error' });
    });
    return () => {
      cancelled = true;
    };
  }, [evidenceFiles, disputes, returns, shopId, orderId, returnId, attempt]);

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);
  return { state, reload };
}
