import { useEffect } from 'react';

import {
  useCurrentShopId,
  useEvidenceFileStore,
  useOrderStore,
  LOCAL_SHOP_ID,
} from '@/features/orders';
import { findPersistedRecording, hashFile, persistRecording, recordingExists } from '@/platform';

import { RECORDER_ENABLED, recoverInterruptedRecordings } from '../domain';

/**
 * Phục hồi các lần quay bị gián đoạn (app bị đóng/kill giữa chừng) MỘT lần khi mở app/đổi shop, chỉ khi
 * bộ ghi thật đã bật. Không hiển thị gì. Tệp không cứu được bị đánh dấu `unrecoverable` và phiên
 * `interrupted` (ghi nhận thiếu bằng chứng, không dựng video giả; bất biến 6).
 */
export function RecordingRecovery() {
  const files = useEvidenceFileStore();
  const orders = useOrderStore();
  const shopId = useCurrentShopId();

  useEffect(() => {
    if (!RECORDER_ENABLED || shopId === LOCAL_SHOP_ID) return;
    void recoverInterruptedRecordings(
      {
        files,
        orders,
        persist: persistRecording,
        hash: hashFile,
        now: Date.now,
        exists: recordingExists,
        findPersisted: findPersistedRecording,
      },
      shopId,
    ).catch(() => undefined);
  }, [files, orders, shopId]);

  return null;
}
