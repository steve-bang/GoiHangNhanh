import type { CrashReporter } from './crash-reporter';

export type { CrashReporter } from './crash-reporter';

/** Bản web (chỉ để xuất ảnh giao diện): không có Crashlytics, mọi hàm là no-op. */
const NOOP_REPORTER: CrashReporter = {
  available: false,
  setEnabled: async () => undefined,
  recordLog: () => undefined,
  recordError: () => undefined,
};

export function getCrashReporter(): CrashReporter {
  return NOOP_REPORTER;
}
