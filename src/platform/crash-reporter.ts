import type * as CrashlyticsModule from '@react-native-firebase/crashlytics';

import {
  formatCrashLine,
  sanitizeErrorForCrash,
  sanitizeStack,
  toCrashError,
  type CrashSafeRecord,
} from '@/core/logging/crash-safe';

/**
 * Báo lỗi ứng dụng (V1-16, Firebase Crashlytics), adapter DUY NHẤT được gọi SDK. API cố ý hẹp: không có
 * `setUserId`, `setAttribute(s)` hay gửi chuỗi tùy ý; mọi thứ đi ra đều qua bộ lọc `crash-safe.ts`.
 *
 * - Nạp SDK LƯỜI trong `try`: test, Expo Go, bản thiếu mô-đun native hoặc thiếu tệp cấu hình Firebase
 *   -> `available: false`, mọi hàm là no-op, không ném.
 * - Tắt (`setEnabled(false)`): JS ngừng ghi ngay, `setCrashlyticsCollectionEnabled(false)` (SDK nhớ qua
 *   các lần mở app) và xóa báo cáo chưa gửi. Bật lại: lỗi JS ghi ngay; thu thập sập native chắc chắn từ
 *   lần mở app sau (SDK iOS áp dụng giá trị mới ở lần chạy sau).
 * - Thay handler lỗi JS toàn cục của RNFirebase (nó gửi nguyên `error.message`): lỗi được lọc rồi mới
 *   ghi và mới chuyển cho handler mặc định của React Native (bản release: app dừng, Crashlytics bắt sập
 *   native với thông điệp ĐÃ LỌC).
 *
 * Chưa kiểm chứng trên thiết bị (chưa build native).
 */
export interface CrashReporter {
  readonly available: boolean;
  setEnabled(enabled: boolean): Promise<void>;
  /** Bản ghi đã lọc của logger: luôn thành dòng nhật ký kèm báo lỗi; mức `error` ghi thêm lỗi không fatal. */
  recordLog(record: CrashSafeRecord): void;
  /** Ghi một lỗi (không fatal) sau khi lọc: chỉ tên lớp lỗi, mã `AppError`, khung stack. */
  recordError(error: unknown): void;
}

type CrashlyticsApi = Pick<
  typeof CrashlyticsModule,
  | 'getCrashlytics'
  | 'log'
  | 'recordError'
  | 'setCrashlyticsCollectionEnabled'
  | 'deleteUnsentReports'
>;
type Crashlytics = ReturnType<CrashlyticsApi['getCrashlytics']>;

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
export interface ErrorUtilsLike {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
}

const NOOP_REPORTER: CrashReporter = {
  available: false,
  setEnabled: async () => undefined,
  recordLog: () => undefined,
  recordError: () => undefined,
};

function loadCrashlytics(): CrashlyticsApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-firebase/crashlytics') as CrashlyticsApi;
  } catch {
    return null;
  }
}

function globalErrorUtils(): ErrorUtilsLike | undefined {
  const candidate = (globalThis as { ErrorUtils?: Partial<ErrorUtilsLike> }).ErrorUtils;
  return candidate &&
    typeof candidate.getGlobalHandler === 'function' &&
    typeof candidate.setGlobalHandler === 'function'
    ? (candidate as ErrorUtilsLike)
    : undefined;
}

const UNCAUGHT_NAME = 'uncaught_js';
const LOGGED_NAME = 'LoggedError';

/** Tạo adapter (test truyền SDK giả và `ErrorUtils` giả). */
export function createCrashReporter(
  load: () => CrashlyticsApi | null = loadCrashlytics,
  errorUtils: ErrorUtilsLike | undefined = globalErrorUtils(),
): CrashReporter {
  const api = load();
  if (!api) return NOOP_REPORTER;
  // Handler mặc định của React Native phải lấy TRƯỚC `getCrashlytics()` (hàm này cài handler của RNFirebase).
  const previous = errorUtils?.getGlobalHandler();
  let instance: Crashlytics;
  try {
    instance = api.getCrashlytics();
  } catch {
    return NOOP_REPORTER;
  }
  let enabled = false;

  const record = (error: Error, name: string) => {
    if (!enabled) return;
    try {
      api.recordError(instance, error, name);
    } catch {
      // Báo lỗi không bao giờ làm hỏng luồng chính.
    }
  };

  if (errorUtils && previous) {
    errorUtils.setGlobalHandler((error, isFatal) => {
      const safe = toCrashError(sanitizeErrorForCrash(error));
      // Lỗi fatal: bản release dừng app, Crashlytics bắt sập native (thông điệp đã lọc); không ghi
      // thêm bản không fatal để tránh trùng.
      if (!isFatal) record(safe, UNCAUGHT_NAME);
      previous(safe, isFatal);
    });
  }

  return {
    available: true,
    setEnabled: async (next) => {
      enabled = next;
      try {
        await api.setCrashlyticsCollectionEnabled(instance, next);
        if (!next) await api.deleteUnsentReports(instance);
      } catch {
        // JS đã ngừng ghi; lỗi SDK bỏ qua (không log để không vòng lại chính nó).
      }
    },
    recordLog: (entry) => {
      if (!enabled) return;
      const line = formatCrashLine(entry);
      try {
        api.log(instance, line);
      } catch {
        return;
      }
      if (entry.level !== 'error') return;
      // Thông điệp là dòng đã lọc (mã sự kiện + trường cho phép), stack là khung đã lọc của nơi gọi log.
      const header = `${LOGGED_NAME}: ${line}`;
      const frames = sanitizeStack(new Error().stack);
      record(
        toCrashError({
          name: LOGGED_NAME,
          message: line,
          stack: frames === undefined ? header : `${header}\n${frames}`,
        }),
        entry.event,
      );
    },
    recordError: (error) => record(toCrashError(sanitizeErrorForCrash(error)), UNCAUGHT_NAME),
  };
}

let shared: CrashReporter | undefined;

/** Adapter dùng chung cả app (tạo lần đầu khi gọi). */
export function getCrashReporter(): CrashReporter {
  shared ??= createCrashReporter();
  return shared;
}
