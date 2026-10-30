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
/** Khung kiểu V8/Hermes: `at fn (vị trí)` hoặc `at vị trí`. */
const V8_FRAME = /^\s*at\s+(?:(\S.*?)\s+\((.+)\)|(\S+))\s*$/;
/** Khung kiểu JSC: `fn@vị trí` (fn có thể rỗng). */
const JSC_FRAME = /^\s*([^\s@]*)@(\S+)\s*$/;
/** Vị trí đặc biệt không có tệp. */
const SPECIAL_LOCATIONS: ReadonlySet<string> = new Set(['native', '<anonymous>', '[native code]']);
/** `đường/dẫn/tệp(?truy vấn):dòng:cột` (Hermes có thể thêm tiền tố `address at `). */
const LOCATION = /^(?:address at\s+)?(.+?)(?:\?[^:]*)?:(\d{1,9}):(\d{1,9})$/;
/** Tên tệp được giữ: chỉ tệp mã/bundle (mã đơn, email không bao giờ có đuôi này). */
const FILE_NAME = /^[A-Za-z0-9_.-]{1,80}\.(?:jsbundle|bundle|hbc|js|cjs|mjs|jsx|ts|tsx)$/;
/** Tên hàm: định danh JS (có thể có `.` và `<anonymous>`), không chuỗi số dài (mã đơn, số điện thoại). */
const FUNCTION_NAME = /^[A-Za-z_$<][\w$.<>]{0,79}$/;
const DIGIT_RUN = /\d{4,}/;
const UNKNOWN_FUNCTION = '<unknown>';
const UNKNOWN_FILE = '<file>';

function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : undefined;
  return typeof name === 'string' && ERROR_NAME_PATTERN.test(name) ? name : 'Error';
}

function safeFunctionName(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.length === 0) return undefined;
  const name = raw.replace(/^new\s+/, '').replace(/^async\s+/, '');
  return FUNCTION_NAME.test(name) && !DIGIT_RUN.test(name) ? name : UNKNOWN_FUNCTION;
}

/** Vị trí đã lọc (`main.jsbundle:1:234`, `native`), `undefined` nếu không phải vị trí (dòng không phải khung). */
function safeLocation(raw: string): string | undefined {
  const location = raw.trim();
  if (SPECIAL_LOCATIONS.has(location)) return location;
  const match = LOCATION.exec(location);
  if (!match) return undefined;
  const [, path = '', line, column] = match;
  const base = path.split(/[\\/]/).pop() ?? '';
  return `${FILE_NAME.test(base) ? base : UNKNOWN_FILE}:${line}:${column}`;
}

/**
 * Khung stack đã lọc; `undefined` khi không có khung nào dùng được. Một dòng chỉ là khung khi KẾT THÚC
 * bằng vị trí (`:dòng:cột`, `native`, `<anonymous>`): dòng thông điệp (kể cả dòng 2+ của thông điệp nhiều
 * dòng, dạng `at …` hay `x@y`) bị bỏ. Trong khung, tên hàm và tên tệp vẫn qua bộ lọc (định danh JS, tệp
 * mã/bundle, chỉ tên cuối); không khớp thì thay bằng `<unknown>`/`<file>`. Mọi khung xuất ra dạng V8.
 */
export function sanitizeStack(stack: unknown): string | undefined {
  if (typeof stack !== 'string') return undefined;
  const frames: string[] = [];
  for (const raw of stack.split('\n')) {
    if (frames.length >= MAX_STACK_FRAMES) break;
    const v8 = V8_FRAME.exec(raw);
    const jsc = v8 ? null : JSC_FRAME.exec(raw);
    const rawLocation = v8 ? (v8[2] ?? v8[3]) : jsc?.[2];
    if (rawLocation === undefined) continue;
    const location = safeLocation(rawLocation);
    if (location === undefined) continue;
    const fn = safeFunctionName(v8 ? v8[1] : jsc?.[1]);
    frames.push(fn === undefined ? `    at ${location}` : `    at ${fn} (${location})`);
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
