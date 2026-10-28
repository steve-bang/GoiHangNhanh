import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { EvidenceFileStore } from '@/features/evidence';
import { useEvidenceFileStore, useOrderStore } from '@/features/orders';
import { findPersistedRecording, hashFile, persistRecording, recordingExists } from '@/platform';
import { useToast } from '@/shared/ui';

import { RECORDER_ENABLED, recoverInterruptedRecordings } from '../domain';

/** Trạng thái tệp cho thấy một lần quay dở dang (hoặc lưu lỗi còn tệp để thử lại). */
const UNFINISHED = ['recording', 'saving_local', 'local_save_failed'] as const;

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
      let interrupted = 0;
      for (const shopId of await files.listShopsWithStates(UNFINISHED)) {
        const result = await recoverInterruptedRecordings(
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
        );
        interrupted += result.interrupted;
      }
      if (interrupted > 0) {
        toast.show(t('screens:record.interruptedNotice'), { tone: 'info', durationMs: 0 });
      }
    })().catch(() => undefined);
  }, [files, orders, t, toast]);

  return null;
}
