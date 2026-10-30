import { useEffect, useId } from 'react';
import type * as ExpoKeepAwake from 'expo-keep-awake';

import { logger } from '@/core/logging/logger';

type KeepAwakeApi = Pick<typeof ExpoKeepAwake, 'activateKeepAwakeAsync' | 'deactivateKeepAwake'>;

/**
 * Nạp `expo-keep-awake` LƯỜI (như `expo-battery` ở `device-condition.ts`): bản build thiếu mô-đun native
 * không lỗi lúc khởi động; nạp lỗi thì coi như không có (màn hình tắt theo cài đặt máy, quay vẫn chạy).
 */
function loadKeepAwake(): KeepAwakeApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-keep-awake') as KeepAwakeApi;
  } catch {
    return null;
  }
}

const TAG_PREFIX = 'doncung-record-';

function activate(tag: string): void {
  const api = loadKeepAwake();
  if (!api) return;
  try {
    api
      .activateKeepAwakeAsync(tag)
      .catch(() => logger.warn('platform.keep_awake_failed', { step: 'on' }));
  } catch {
    logger.warn('platform.keep_awake_failed', { step: 'on' });
  }
}

function deactivate(tag: string): void {
  const api = loadKeepAwake();
  if (!api) return;
  try {
    Promise.resolve(api.deactivateKeepAwake(tag)).catch(() =>
      logger.warn('platform.keep_awake_failed', { step: 'off' }),
    );
  } catch {
    logger.warn('platform.keep_awake_failed', { step: 'off' });
  }
}

/**
 * Giữ màn hình sáng khi `active` (màn quay đặt trên giá đỡ, V1-11). Mỗi màn một tag riêng: bật đúng một lần
 * khi `active` thành `true`, tắt khi về `false` hoặc khi màn bị gỡ; giá trị không đổi giữa các lần vẽ thì
 * không gọi lại. iOS: `isIdleTimerDisabled`; Android: `FLAG_KEEP_SCREEN_ON` của cửa sổ (không cần quyền
 * `WAKE_LOCK`, không giữ CPU khi màn tắt hay app ở nền). Lỗi không ném, chỉ log bước (không PII). Chưa
 * kiểm chứng trên thiết bị.
 */
export function useKeepScreenAwake(active: boolean): void {
  const tag = `${TAG_PREFIX}${useId()}`;
  useEffect(() => {
    if (!active) return undefined;
    activate(tag);
    return () => deactivate(tag);
  }, [active, tag]);
}
