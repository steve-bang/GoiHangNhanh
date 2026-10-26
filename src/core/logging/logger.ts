/* eslint-disable no-console -- đây là điểm duy nhất được phép ghi console */

/**
 * Logger tối giản có che trường nhạy cảm. Mọi log trong ứng dụng đi qua đây (rule no-console).
 * Mục tiêu: không để mã đơn, mã vận đơn, thông tin khách, token lọt vào log/crash/analytics
 * (docs/07 - Quyền riêng tư; CLAUDE.md bất biến #8, #10).
 *
 * Đây là lớp bảo vệ thứ hai: người viết log vẫn phải tự không đưa dữ liệu nhạy cảm vào.
 */
export const REDACTED = '[REDACTED]';

/** Khóa (không phân biệt hoa thường, bỏ dấu gạch) luôn bị che. */
const SENSITIVE_KEYS = new Set([
  'ordercode',
  'ordercodenormalized',
  'trackingcode',
  'trackingcodenormalized',
  'returncode',
  'code', // mã quét thô
  'barcode',
  'scannedvalue',
  'customername',
  'customerphone',
  'phone',
  'address',
  'email',
  'displayname',
  'note',
  'productname',
  'name',
  'variant',
  'token',
  'idtoken',
  'accesstoken',
  'refreshtoken',
  'password',
  'authorization',
  'uploadurl',
  'signedurl',
  'sessionuri',
]);

function normalizeKey(key: string): string {
  return key.replace(/[_-]/g, '').toLowerCase();
}

export function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= 4) return REDACTED;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEYS.has(normalizeKey(k)) ? REDACTED : redact(v, depth + 1);
  }
  return out;
}

type Level = 'debug' | 'info' | 'warn' | 'error';

function emit(level: Level, event: string, fields?: Record<string, unknown>): void {
  const payload = fields === undefined ? undefined : redact(fields);
  if (payload === undefined) console[level](`[${level}] ${event}`);
  else console[level](`[${level}] ${event}`, payload);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => emit('debug', event, fields),
  info: (event: string, fields?: Record<string, unknown>) => emit('info', event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => emit('warn', event, fields),
  error: (event: string, fields?: Record<string, unknown>) => emit('error', event, fields),
};
