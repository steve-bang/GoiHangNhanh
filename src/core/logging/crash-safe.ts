import { ERROR_CODES } from '@/core/errors/codes';
import { isAppError } from '@/core/errors/app-error';

/**
 * Lọc dữ liệu TRƯỚC khi ra khỏi máy qua báo lỗi ứng dụng (V1-16, Crashlytics). Khác `redact` của logger
 * (che theo tên khóa, giữ phần còn lại), đây là **danh sách cho phép**: chỉ tên sự kiện, vài khóa kỹ
 * thuật và giá trị thuộc kiểu an toàn đi qua; mọi thứ khác bị bỏ hẳn. Mục tiêu: không bao giờ gửi
 * email, uid, shopId, mã đơn, mã vận đơn, tên/số điện thoại, đường dẫn tệp hay URL (CLAUDE.md bất biến
 * 8, 10; docs/store/privacy-declarations.md D12–D14). Không gửi câu tự do: chỉ mã lỗi + tên module.
 */

/** Một dòng đã lọc, sẵn sàng gửi kèm báo lỗi. */
export interface CrashSafeRecord {
  readonly level: 'warn' | 'error';
  readonly event: string;
  readonly fields: Readonly<Record<string, string | number | boolean>>;
}

export const INVALID_EVENT = 'invalid_event';

/** Tên sự kiện của logger: `nhom.ten_su_kien`, chữ thường, không số (mã đơn thường có số). */
const EVENT_PATTERN = /^[a-z_]+(\.[a-z_]+){0,5}$/;
const MAX_EVENT_LENGTH = 64;

/** Khóa trường được gửi. Thêm khóa mới phải chắc giá trị chỉ là mã/nhãn kỹ thuật. */
export const CRASH_SAFE_FIELD_KEYS: ReadonlySet<string> = new Set([
  'reason',
  'step',
  'target',
  'result',
  'kind',
  'status',
  'stage',
  'attempt',
]);

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(ERROR_CODES));
/** Nhãn kỹ thuật chữ thường KHÔNG có số (`sqlite`, `unknown`, `not_applied`). */
const LABEL_PATTERN = /^[a-z][a-z_.-]{0,31}$/;
/** Tên lớp lỗi JS (`Error`, `TypeError`, `SQLiteError`, `AppError`). */
const ERROR_NAME_PATTERN = /^(?:[A-Z][A-Za-z]{0,40})?Error$/;
const MAX_SMALL_INT = 999;

export function crashSafeEvent(event: string): string {
  return event.length <= MAX_EVENT_LENGTH && EVENT_PATTERN.test(event) ? event : INVALID_EVENT;
}

function safeValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= MAX_SMALL_INT ? value : undefined;
  }
  if (typeof value !== 'string') return undefined;
  if (KNOWN_ERROR_CODES.has(value)) return value;
  if (ERROR_NAME_PATTERN.test(value)) return value;
  if (LABEL_PATTERN.test(value)) return value;
  return undefined;
}

/** Chỉ giữ khóa trong `CRASH_SAFE_FIELD_KEYS` có giá trị an toàn; không lồng nhau. */
export function crashSafeFields(
  fields: unknown,
): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {};
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) return out;
  for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
    if (!CRASH_SAFE_FIELD_KEYS.has(key)) continue;
    const safe = safeValue(value);
    if (safe !== undefined) out[key] = safe;
  }
  return out;
}

/** Dòng nhật ký gửi kèm báo lỗi (breadcrumb): `warn orders.list_failed reason=SEARCH_UNAVAILABLE`. */
export function formatCrashLine(record: CrashSafeRecord): string {
  const parts = Object.entries(record.fields).map(([k, v]) => `${k}=${String(v)}`);
  return [record.level, record.event, ...parts].join(' ');
}

export interface CrashSafeError {
  readonly name: string;
  readonly message: string;
  readonly stack: string;
}

const MAX_STACK_FRAMES = 30;
/** Dòng khung kiểu V8/Hermes (`at fn (file:1:2)`) hoặc JSC (`fn@file:1:2`). */
const FRAME_PATTERN = /^\s*at\s|^[^\s@]*@/;
/** Đường dẫn/URL bất kỳ -> tên tệp cuối (`/var/.../main.jsbundle:1:2` -> `main.jsbundle:1:2`). */
const PATH_PATTERN = /(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^\s()@/]*\/)+([^\s()/]*)/gi;
const QUERY_PATTERN = /\?[^\s():]*/g;
/** Chuỗi có dấu nháy trong dòng khung (một số engine in giá trị) bị bỏ. */
const QUOTED_PATTERN = /(["'`]).*?\1/g;
const FRAME_ALLOWED = /^[\w\s$.<>@():[\]/-]*$/;

function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : undefined;
  return typeof name === 'string' && ERROR_NAME_PATTERN.test(name) ? name : 'Error';
}

/** Khung stack đã lọc; `undefined` khi không có khung nào dùng được. */
export function sanitizeStack(stack: unknown): string | undefined {
  if (typeof stack !== 'string') return undefined;
  const frames: string[] = [];
  for (const raw of stack.split('\n')) {
    if (frames.length >= MAX_STACK_FRAMES) break;
    if (!FRAME_PATTERN.test(raw)) continue;
    const line = raw
      .replace(QUOTED_PATTERN, '')
      .replace(QUERY_PATTERN, '')
      .replace(PATH_PATTERN, '$1')
      .trim();
    if (line.length === 0 || line.length > 200 || !FRAME_ALLOWED.test(line)) continue;
    frames.push(line.startsWith('at ') || line.includes('@') ? `    ${line}` : `    at ${line}`);
  }
  return frames.length > 0 ? frames.join('\n') : undefined;
}

/**
 * Lỗi đã lọc để gửi: tên lớp lỗi, thông điệp = mã `AppError` (hoặc tên lớp lỗi, KHÔNG dùng
 * `error.message` vì có thể chứa dữ liệu), stack chỉ còn khung với tên tệp.
 */
export function sanitizeErrorForCrash(error: unknown): CrashSafeError {
  const name = safeErrorName(error);
  const message = isAppError(error) && KNOWN_ERROR_CODES.has(error.code) ? error.code : name;
  const frames = sanitizeStack(error instanceof Error ? error.stack : undefined);
  return {
    name,
    message,
    stack: frames === undefined ? `${name}: ${message}` : `${name}: ${message}\n${frames}`,
  };
}

/** Tạo đối tượng `Error` thật từ bản đã lọc (thư viện báo lỗi cần `instanceof Error`). */
export function toCrashError(safe: CrashSafeError): Error {
  const error = new Error(safe.message);
  error.name = safe.name;
  error.stack = safe.stack;
  return error;
}
