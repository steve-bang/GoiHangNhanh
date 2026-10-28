import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { EvidenceFile, EvidenceFileStore } from '@/features/evidence';
import { useEvidenceFileStore, useOrderStore } from '@/features/orders';
import { findPersistedRecording, hashFile, persistRecording, recordingExists } from '@/platform';
import { useToast } from '@/shared/ui';

import {
  RECORDER_ENABLED,
  SAVED_PENDING_STATES,
  UNFINISHED_STATES,
  reconcileSavedSessions,
  recoverInterruptedRecordings,
} from '../domain';

/** Mỗi kho chỉ khôi phục MỘT lần trong một lần chạy app: khôi phục lại có thể đè lên lần quay đang diễn ra. */
const recovered = new WeakSet<EvidenceFileStore>();

/**
 * Phục hồi các lần quay bị gián đoạn (app bị đóng/kill giữa chừng) MỘT lần khi mở app, chỉ khi bộ ghi
 * thật đã bật. Khôi phục MỌI shop có tệp dở dang trên máy (kể cả shop cục bộ tạm và shop khác shop đang
 * dùng), vì thao tác chỉ ở thiết bị và nếu bỏ sót thì phiên treo ở "đang quay" mãi, chặn đăng xuất/chuyển
 * cửa hàng. Có lần quay bị gián đoạn thì báo cho người dùng một thông báo ngắn, không kết luận video còn
 * hay mất (A05: phiên gián đoạn có thông báo riêng). Tệp không cứu được bị đánh dấu `unrecoverable`, phiên
 * `interrupted` (ghi nhận thiếu bằng chứng, không dựng video giả; bất biến 6). Câu chữ chờ BA chốt
 * (decisions.md, ADR-020 R-9).
 */
export function RecordingRecovery() {
  const { t } = useTranslation();
  const toast = useToast();
  const files = useEvidenceFileStore();
  const orders = useOrderStore();

  useEffect(() => {
    if (!RECORDER_ENABLED || recovered.has(files)) return;
    recovered.add(files);
    void (async () => {
      // Chụp danh sách tệp dở của MỌI shop MỘT lần, trước khi xử lý shop nào: băm tệp shop A có thể mất
      // lâu, trong lúc đó người dùng quay ở shop B; xử lý B theo danh sách chụp sau sẽ đè lên lần quay đó.
      const shops = await files.listShopsWithStates([
        ...UNFINISHED_STATES,
        ...SAVED_PENDING_STATES,
      ]);
      const snapshot = new Map<(typeof shops)[number], readonly EvidenceFile[]>();
      for (const shopId of shops) {
        snapshot.set(shopId, await files.listByStates(shopId, UNFINISHED_STATES));
      }
      const ports = {
        files,
        orders,
        persist: persistRecording,
        hash: hashFile,
        now: Date.now,
        exists: recordingExists,
        findPersisted: findPersistedRecording,
      };
      let interrupted = 0;
      for (const [shopId, unfinished] of snapshot) {
        const result = await recoverInterruptedRecordings(ports, shopId, unfinished);
        interrupted += result.interrupted;
        await reconcileSavedSessions(ports, shopId, unfinished);
      }
      if (interrupted > 0) {
        toast.show(t('screens:record.interruptedNotice'), { tone: 'info', durationMs: 0 });
      }
    })().catch(() => recovered.delete(files)); // chưa đọc được kho: cho phép thử lại
  }, [files, orders, t, toast]);

  return null;
}
