import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import {
  findPersistedRecording,
  hashFile,
  newReturnRecordId,
  persistRecording,
  recordingExists,
} from '@/platform';
import { useToast } from '@/shared/ui';

import { useReturnStore } from '../data';
import { recoverInterruptedMedia } from '../domain';
import type { ReturnStore } from '../domain';

/** Mỗi kho chỉ có MỘT lượt khôi phục chạy tại một thời điểm (không chồng lượt). */
const recovered = new WeakSet<ReturnStore>();

/**
 * Mốc app khởi động (giờ THIẾT BỊ). Chỉ media tạo TRƯỚC mốc này mới là tàn dư của lần chạy trước bị gián
 * đoạn; media của lần chạy này (đang chụp/quay/lưu) không bao giờ bị đụng, nên thử lại luôn an toàn. Đồng
 * hồ máy bị chỉnh lùi giữa chừng có thể làm media mới bị coi là cũ: giới hạn đã biết (như `RecordingRecovery`).
 */
const APP_STARTED_AT = Date.now();

/** Thử lại khi chưa đọc được kho: giãn cách tăng dần, tối đa vài lần rồi chờ lần mở app sau. */
const RETRY_DELAY_MS = 15_000;
const MAX_ATTEMPTS = 5;

/**
 * Khôi phục ảnh/video hàng hoàn dở dang (app bị đóng/kill giữa lúc chụp, quay hay lưu) MỘT lần khi mở app
 * (Q-28; trả nợ hạn chế R2a "ảnh kẹt ở recording/saving_local"). Chạy cho MỌI shop có media dở dang trên
 * máy (thao tác chỉ ở thiết bị). Có media bị gián đoạn hoặc mất thì báo một thông báo ngắn, không kết luận
 * còn hay mất. Không bao giờ xóa tệp. Chưa kiểm chứng trên thiết bị.
 */
export function ReturnMediaRecovery() {
  const { t } = useTranslation();
  const toast = useToast();
  const store = useReturnStore();

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (attempt: number): Promise<void> => {
      if (cancelled || recovered.has(store)) return;
      recovered.add(store);
      try {
        const result = await recoverInterruptedMedia(
          {
            store,
            persist: persistRecording,
            hash: hashFile,
            exists: recordingExists,
            findPersisted: findPersistedRecording,
            now: Date.now,
            newId: newReturnRecordId,
          },
          APP_STARTED_AT,
        );
        if (result.interrupted > 0 && !cancelled) {
          toast.show(t('returns:recovery.notice'), { tone: 'info', durationMs: 0 });
        }
      } catch {
        // Chưa đọc được kho: gỡ đánh dấu và hẹn thử lại bằng đồng hồ riêng; hết lượt thì chờ lần mở app sau.
        recovered.delete(store);
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
  }, [store, t, toast]);

  return null;
}
