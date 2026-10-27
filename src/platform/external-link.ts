import { Linking } from 'react-native';

import { logger } from '@/core/logging/logger';

/**
 * Mở liên kết ngoài bằng trình duyệt/ứng dụng của hệ điều hành. Không bao giờ ném lỗi (URL hỏng,
 * không có ứng dụng xử lý, tên miền không tồn tại): lỗi chỉ ghi log, không kèm URL.
 */
export async function openExternalLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    logger.warn('external_link_open_failed');
    return false;
  }
}
