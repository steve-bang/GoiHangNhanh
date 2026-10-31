import type { Readable } from 'node:stream';

import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { verifyEvidenceObject, type VerifyResult } from './evidence';

/**
 * Gỡ bằng chứng kẹt ở `uploaded` (hoặc chưa có trạng thái máy chủ dù đối tượng đã có) khi trigger
 * finalize đã bỏ cuộc (review PR #44, V1-04). Hai bước tách nhau:
 * 1. `createUploadSession` (callable, cấu hình thường) chỉ ĐẶT YÊU CẦU trong transaction ở
 *    `shops/{shopId}/evidenceReverify/{evidenceId}` rồi trả ngay: có yêu cầu < `REVERIFY_LEASE_MS` hoặc
 *    đã chốt thì bỏ qua, nên app gọi lặp/đồng thời không sinh nhiều lần băm.
 * 2. Trigger `reverifyEvidence` (540 giây, 1 GiB) chạy khi tài liệu yêu cầu được ghi: băm lại bằng
 *    ĐÚNG `verifyEvidenceObject` (idempotent; chỉ máy chủ ghi `verified`/`hash_mismatch`).
 * Tài liệu yêu cầu nằm NGOÀI `evidence/{id}` để không làm nhiễu trigger kiểm toán của bằng chứng và
 * không gọi thêm Function ở mỗi lần ghi bằng chứng; chỉ chứa giờ, uid người yêu cầu, số lần (không
 * PII). Rules không mở đường dẫn này (mặc định từ chối client); purge shop (V1-14) xóa theo shop.
 */

/** Chỉ yêu cầu khi đã nhận xong ít nhất chừng này (trigger finalize chạy tối đa 9 phút). */
export const REVERIFY_AFTER_MS = 15 * 60_000;
/** Một yêu cầu giữ chỗ trong chừng này: gọi lại trong thời gian đó không tạo yêu cầu mới. */
export const REVERIFY_LEASE_MS = 30 * 60_000;

const FINAL_STATES = ['verified', 'hash_mismatch'];

export const reverifyRequestPath = (shopId: string, evidenceId: string) =>
  `shops/${shopId}/evidenceReverify/${evidenceId}`;

export type ReverifyRequestOutcome = 'requested' | 'leased' | 'final' | 'too_recent';

const millisOf = (value: unknown): number | undefined =>
  typeof (value as { toMillis?: unknown } | null)?.toMillis === 'function'
    ? (value as { toMillis: () => number }).toMillis()
    : undefined;

/**
 * Đặt yêu cầu xác minh lại (bước 1). Không băm, không đọc Storage. Bằng chứng đã có `receivedAt` mà
 * chưa đủ `REVERIFY_AFTER_MS` thì chưa yêu cầu (trigger finalize có thể đang băm).
 */
export async function requestReverify(
  db: Firestore,
  shopId: string,
  evidenceId: string,
  uid: string,
  nowMs: number,
): Promise<ReverifyRequestOutcome> {
  const evidenceRef = db.doc(`shops/${shopId}/evidence/${evidenceId}`);
  const requestRef = db.doc(reverifyRequestPath(shopId, evidenceId));
  return db.runTransaction(async (tx) => {
    const [evidence, request] = await Promise.all([tx.get(evidenceRef), tx.get(requestRef)]);
    const server = (evidence.data()?.server ?? {}) as { state?: unknown; receivedAt?: unknown };
    if (typeof server.state === 'string' && FINAL_STATES.includes(server.state)) return 'final';
    const receivedAt = millisOf(server.receivedAt);
    if (receivedAt !== undefined && nowMs - receivedAt < REVERIFY_AFTER_MS) return 'too_recent';
    const requestedAt = millisOf(request.data()?.requestedAt);
    if (requestedAt !== undefined && nowMs - requestedAt < REVERIFY_LEASE_MS) return 'leased';
    tx.set(
      requestRef,
      {
        requestedAt: Timestamp.fromMillis(nowMs),
        requestedBy: uid,
        count: FieldValue.increment(1),
      },
      { merge: true },
    );
    return 'requested';
  });
}

/** Đọc Storage cho bước 2. Tách ra để test không cần Storage thật. */
export interface EvidenceReverifier {
  /** Thông tin đối tượng hiện tại; `null` nếu không có. */
  objectInfo(storagePath: string): Promise<{
    readonly generation?: string;
    readonly sizeBytes?: number;
    /** Giờ Storage ghi đối tượng (ms). */
    readonly updatedAtMs?: number;
  } | null>;
  /** Luồng đọc GHIM đúng generation (đối tượng bị thay giữa chừng thì lỗi). */
  open(storagePath: string, generation: string | undefined): Readable;
}

export type ReverifyOutcome =
  VerifyResult | { readonly outcome: 'object_missing' } | { readonly outcome: 'object_too_recent' };

/**
 * Bước 2 (trigger): băm lại bản gốc hiện tại bằng `verifyEvidenceObject`. Đối tượng không còn hoặc
 * mới ghi (< `REVERIFY_AFTER_MS`, để trigger finalize tự xử lý) thì không làm gì. Lỗi đọc thì ném;
 * trigger chạy không thử lại, yêu cầu hết hạn sau `REVERIFY_LEASE_MS` và app gọi lại được.
 */
export async function handleReverifyRequest(
  db: Firestore,
  reverifier: EvidenceReverifier,
  shopId: string,
  evidenceId: string,
  nowMs: number,
): Promise<ReverifyOutcome> {
  const storagePath = `shops/${shopId}/evidence/${evidenceId}/original`;
  const info = await reverifier.objectInfo(storagePath);
  if (!info) return { outcome: 'object_missing' };
  if (info.updatedAtMs !== undefined && nowMs - info.updatedAtMs < REVERIFY_AFTER_MS) {
    return { outcome: 'object_too_recent' };
  }
  return verifyEvidenceObject(
    db,
    { open: (path) => reverifier.open(path, info.generation) },
    storagePath,
    info.generation,
    info.sizeBytes,
  );
}

/** Tài liệu yêu cầu vừa được đặt mới (giờ yêu cầu đổi) thì chạy bước 2; ghi khác bỏ qua. */
export function isNewReverifyRequest(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): boolean {
  const next = millisOf(after?.requestedAt);
  return next !== undefined && next !== millisOf(before?.requestedAt);
}
