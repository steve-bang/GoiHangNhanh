import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { ReturnCaseId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import { useCurrentShopId } from '@/features/orders';
import { hashFile, newReturnRecordId, persistRecording, type CameraPhotoHandle } from '@/platform';

import { useReturnStore } from '../data';
import { capturePhoto, type PhotoOutcome, type ReturnMedia } from '../domain';

/**
 * Ảnh của MỘT hồ sơ hàng hoàn (cũ nhất trước). `media === null` là đang nạp (chưa biết có ảnh hay chưa:
 * không được nói "chưa có ảnh"). Lỗi đọc giữ `media` cũ (nếu có), không bịa danh sách rỗng.
 */
export function useReturnMedia(returnId: ReturnCaseId | undefined): {
  media: readonly ReturnMedia[] | null;
  reload: () => Promise<void>;
} {
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  const [media, setMedia] = useState<readonly ReturnMedia[] | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!returnId) return;
    try {
      const list = await store.listMedia(shopId, returnId);
      if (alive.current) setMedia(list);
    } catch (error) {
      logger.warn('returns.media_load_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }, [store, shopId, returnId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp lại khi đổi hồ sơ/shop
    void reload();
  }, [reload]);

  return { media, reload };
}

/** Chụp một ảnh qua camera đang mở (`handleRef`) và lưu theo `capturePhoto`; không bao giờ ném lỗi. */
export function useCaptureReturnPhoto(returnId: ReturnCaseId) {
  const store = useReturnStore();
  const shopId = useCurrentShopId();
  return useMemo(
    () =>
      async (handleRef: RefObject<CameraPhotoHandle | null>): Promise<PhotoOutcome> => {
        const outcome = await capturePhoto(
          {
            store,
            capture: async () => {
              const handle = handleRef.current;
              if (!handle) return { ok: false, reason: 'CAPTURE_FAILED' };
              const shot = await handle.capture();
              return shot.ok ? shot : { ok: false, reason: 'CAPTURE_FAILED' };
            },
            persist: persistRecording,
            hash: hashFile,
            now: () => Date.now(),
            newId: newReturnRecordId,
          },
          { shopId, returnId },
        );
        if (outcome.kind === 'failed') {
          logger.warn('returns.photo_failed', { reason: outcome.reason });
        }
        return outcome;
      },
    [store, shopId, returnId],
  );
}
