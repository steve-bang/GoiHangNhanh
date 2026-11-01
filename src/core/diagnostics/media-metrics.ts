/**
 * Số đo xử lý video (V1-27) để cổng thiết bị G-3/G-4/G-5/G-14 đọc được từ log của bản `staging`, không
 * cần build riêng. TypeScript thuần. Bản ghi CHỈ có số và nhãn kỹ thuật cố định: không ID, đường dẫn,
 * mã đơn, shopId, `error.message` (CLAUDE.md bất biến 8, 10; docs/07). Không gửi Crashlytics (mức `info`
 * không tới sink báo lỗi) và không có màn chẩn đoán.
 */

export type MediaMetricsKind = 'record_save' | 'recovery_save' | 'upload';
export type MediaMetricsPlatform = 'ios' | 'android' | 'other';

/** Đầu vào thô; mọi thời lượng là mili giây, thiếu = không đo được. */
export interface MediaMetricsInput {
  readonly kind: MediaMetricsKind;
  readonly platform: MediaMetricsPlatform;
  readonly sizeBytes?: number | null;
  /** Thời gian thực của lần quay (từ lúc mở camera đến lúc camera trả tệp). */
  readonly wallMs?: number | null;
  readonly hashMs?: number | null;
  readonly persistMs?: number | null;
  readonly uploadMs?: number | null;
  /** Số lần băm JS trong bước này (0 khi tin dấu tệp đã lưu). */
  readonly hashCount?: number | null;
}

export interface MediaMetrics {
  readonly kind: MediaMetricsKind;
  readonly platform: MediaMetricsPlatform;
  readonly sizeBytes: number | null;
  readonly wallMs: number | null;
  /** Byte mỗi phút quay (thập phân, cùng đơn vị `ESTIMATED_BYTES_PER_MINUTE`). */
  readonly bytesPerMinute: number | null;
  readonly hashMs: number | null;
  /** MB/giây (1 MB = 1.000.000 byte) của lần băm. */
  readonly hashMBps: number | null;
  readonly persistMs: number | null;
  readonly uploadMs: number | null;
  readonly uploadMBps: number | null;
  readonly hashCount: number | null;
}

/** Danh sách khóa duy nhất được phép xuất hiện trong bản ghi (test khẳng định không có khóa nhạy cảm). */
export const MEDIA_METRICS_KEYS = [
  'kind',
  'platform',
  'sizeBytes',
  'wallMs',
  'bytesPerMinute',
  'hashMs',
  'hashMBps',
  'persistMs',
  'uploadMs',
  'uploadMBps',
  'hashCount',
] as const;

const MS_PER_MINUTE = 60_000;
const BYTES_PER_MB = 1_000_000;

/** Số hữu hạn không âm (làm tròn nguyên), ngược lại `null`. */
function whole(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

/** Chia an toàn: mẫu số 0/thiếu hoặc kết quả không hữu hạn -> `null` (không bao giờ `Infinity`/`NaN`). */
function rate(numerator: number | null, perMs: number | null, unitMs: number): number | null {
  if (numerator === null || perMs === null || perMs <= 0) return null;
  const value = (numerator * unitMs) / perMs;
  return Number.isFinite(value) ? value : null;
}

const round2 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 100) / 100;

export function buildMediaMetrics(input: MediaMetricsInput): MediaMetrics {
  const sizeBytes = whole(input.sizeBytes);
  const wallMs = whole(input.wallMs);
  const hashMs = whole(input.hashMs);
  const uploadMs = whole(input.uploadMs);
  const bytesPerMinute = rate(sizeBytes, wallMs, MS_PER_MINUTE);
  const hashMBps = rate(sizeBytes === null ? null : sizeBytes / BYTES_PER_MB, hashMs, 1000);
  const uploadMBps = rate(sizeBytes === null ? null : sizeBytes / BYTES_PER_MB, uploadMs, 1000);
  return {
    kind: input.kind,
    platform: input.platform,
    sizeBytes,
    wallMs,
    bytesPerMinute: bytesPerMinute === null ? null : Math.round(bytesPerMinute),
    hashMs,
    hashMBps: round2(hashMBps),
    persistMs: whole(input.persistMs),
    uploadMs,
    uploadMBps: round2(uploadMBps),
    hashCount: whole(input.hashCount),
  };
}

/** Nơi nhận bản ghi số đo (domain gọi qua cổng này; adapter `platform/media-metrics-log.ts` ghi log). */
export type MediaMetricsReporter = (input: Omit<MediaMetricsInput, 'platform'>) => void;
