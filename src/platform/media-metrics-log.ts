import { Platform } from 'react-native';

import {
  buildMediaMetrics,
  type MediaMetricsPlatform,
  type MediaMetricsReporter,
} from '@/core/diagnostics';
import { logger } from '@/core/logging/logger';

const platform: MediaMetricsPlatform =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'other';

/**
 * Ghi MỘT dòng `media.metrics` (mức `info`, chỉ số/nhãn kỹ thuật; V1-27). Đọc bằng Xcode console hoặc
 * `adb logcat` ở bản staging. Không bao giờ ném lỗi ra luồng ghi hình/tải lên.
 */
export const reportMediaMetrics: MediaMetricsReporter = (input) => {
  try {
    logger.info('media.metrics', { ...buildMediaMetrics({ ...input, platform }) });
  } catch {
    // số đo không được làm hỏng luồng chính
  }
};
