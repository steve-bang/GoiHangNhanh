import { getCrashReporter } from '@/platform';

import { crashReportingAllowed } from './crash-reporting-policy';

/**
 * Cài handler lỗi JS đã lọc NGAY khi nạp module (V1-16, sửa sau review PR #62), không đợi effect của
 * `CrashReportingBridge`: từ lần mở thứ hai SDK đã thu thập từ đầu tiến trình, nên lỗi lúc nạp module,
 * `initI18n()` hay render đầu phải đi qua bộ lọc. Chưa đọc công tắc thì adapter `enabled = false`: không
 * ghi gì từ JS; sập native (nếu SDK đang bật theo lựa chọn đã lưu) mang thông điệp đã lọc.
 */
export function installCrashReportingEarly(
  allowed: boolean = crashReportingAllowed(),
  install: () => unknown = getCrashReporter,
): boolean {
  if (!allowed) return false;
  install();
  return true;
}

installCrashReportingEarly();
