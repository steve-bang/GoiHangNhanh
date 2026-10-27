import { setStringAsync } from 'expo-clipboard';

import { logger } from '@/core/logging/logger';

/** Chép chữ vào bộ nhớ tạm. Trả `false` khi lỗi (nơi gọi báo cho người dùng); không log nội dung. */
export async function copyText(text: string): Promise<boolean> {
  try {
    return await setStringAsync(text);
  } catch (error) {
    logger.warn('clipboard.copy_failed', {
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}
