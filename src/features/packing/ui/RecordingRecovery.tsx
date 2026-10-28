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

/** Mỗi kho chỉ có MỘT lượt khôi phục chạy tại một thời điểm (không chồng lượt). */
const recovered = new WeakSet<EvidenceFileStore>();

/**
 * Mốc app khởi động (giờ THIẾT BỊ). Chỉ tệp tạo TRƯỚC mốc này mới là tàn dư của lần chạy trước bị gián
 * đoạn; tệp tạo từ mốc này là của lần chạy hiện tại (đang quay hoặc đang lưu) nên không bao giờ bị đánh
 * `unrecoverable`. Nhờ vậy thử lại khôi phục lúc nào cũng an toàn, kể cả khi người dùng đã quay. Nếu đồng
 * hồ máy bị chỉnh lùi giữa chừng thì tệp mới có thể bị coi là tệp cũ: giới hạn đã biết, cần thử trên máy.
 */
const APP_STARTED_AT = Date.now();

/** Thử lại khi chưa đọc được kho: giãn cách tăng dần, tối đa vài lần rồi chờ lần mở app sau. */
const RETRY_DELAY_MS = 15_000;
const MAX_ATTEMPTS = 5;

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
    if (!RECORDER_ENABLED) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (attempt: number): Promise<void> => {
      if (cancelled || recovered.has(files)) return;
      recovered.add(files);
      try {
        // Chụp danh sách tệp dở của MỌI shop MỘT lần, trước khi xử lý shop nào: băm tệp shop A có thể
        // mất lâu, trong lúc đó người dùng quay ở shop B; xử lý B theo danh sách chụp sau sẽ đè lên lần
        // quay đó.
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
          // Chỉ tệp của lần chạy TRƯỚC là tàn dư; tệp của lần chạy này không bao giờ bị đụng.
          const previousRun = unfinished.filter((f) => f.createdAtDevice < APP_STARTED_AT);
          const result = await recoverInterruptedRecordings(ports, shopId, previousRun);
          interrupted += result.interrupted;
          // Đối chiếu phiên dùng TOÀN BỘ tệp dở để bỏ qua phiên còn tệp đang ghi/lưu của lần chạy này.
          await reconcileSavedSessions(ports, shopId, unfinished);
        }
        if (interrupted > 0) {
          toast.show(t('screens:record.interruptedNotice'), { tone: 'info', durationMs: 0 });
        }
      } catch {
        // Chưa đọc được kho: gỡ đánh dấu và hẹn thử lại bằng đồng hồ riêng (không phụ thuộc deps của
        // effect, vốn hầu như không đổi). Hết lượt thì chờ lần mở app sau.
        recovered.delete(files);
        if (!cancelled && attempt < MAX_ATTEMPTS) {
          timer = setTimeout(() => void run(attempt + 1), RETRY_DELAY_MS * attempt);
        }
      }
    };

    void run(1);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [files, orders, t, toast]);

  return null;
}
