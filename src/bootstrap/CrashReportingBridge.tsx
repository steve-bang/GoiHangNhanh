import { useEffect } from 'react';

import { setLogSink } from '@/core/logging/logger';
import { useDeviceSettings } from '@/features/orders';
import { CRASH_REPORTS_ENABLED } from '@/features/personal';
import { getCrashReporter, type CrashReporter } from '@/platform';

import { crashReportingAllowed } from './crash-reporting-policy';

export { crashReportingAllowed };

/**
 * Nối công tắc "Gửi báo lỗi ứng dụng" (`device_settings`, V1-16) với Crashlytics và logger. Đọc cài đặt
 * xong mới bật (`firebase.json`: thu thập tự động TẮT tới lúc đó); bật thì logger chuyển bản ghi
 * warn/error ĐÃ LỌC sang adapter, tắt thì gỡ sink và tắt thu thập. Không vẽ gì.
 */
export function CrashReportingBridge({
  allowed = crashReportingAllowed(),
  reporter,
}: {
  allowed?: boolean;
  /** Test truyền adapter giả; mặc định adapter dùng chung (chỉ tạo khi `allowed`). */
  reporter?: CrashReporter;
}) {
  const settings = useDeviceSettings();
  useEffect(() => {
    if (!allowed) return undefined;
    const target = reporter ?? getCrashReporter();
    if (!target.available) return undefined;
    let alive = true;
    let applied: boolean | undefined;
    const apply = (enabled: boolean) => {
      if (!alive || applied === enabled) return;
      applied = enabled;
      setLogSink(enabled ? target.recordLog : null);
      void target.setEnabled(enabled);
    };
    const unsubscribe = settings.subscribe(CRASH_REPORTS_ENABLED.key, () => {
      const snapshot = settings.peek(CRASH_REPORTS_ENABLED);
      if (snapshot.loaded) apply(snapshot.value);
    });
    void settings.load(CRASH_REPORTS_ENABLED).then(apply);
    return () => {
      alive = false;
      unsubscribe();
      setLogSink(null);
    };
  }, [allowed, reporter, settings]);
  return null;
}
