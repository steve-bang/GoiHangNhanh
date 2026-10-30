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

/** Web: không lọc tại chỗ (không có Crashlytics). */
export function scrubErrorInPlace(): void {}

/** Web: ném lại ngoài vòng render để trình duyệt (và công cụ chụp ảnh) thấy lỗi. */
export function reportFatalRenderError(error: unknown): void {
  setTimeout(() => {
    throw error;
  }, 0);
}
