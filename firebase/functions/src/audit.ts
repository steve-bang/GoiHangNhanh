import { createHash } from 'node:crypto';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

/**
 * Trigger kiểm toán (bất biến 7; Q-23k; V1-04): mỗi lần TẠO hoặc SỬA tài liệu mà client ghi được thì
 * máy chủ ghi đúng một sự kiện vào `shops/{shopId}/auditEvents` (Rules: client không ghi/sửa/xóa).
 *
 * - Idempotent: id sự kiện cố định theo (đường dẫn, updateTime của bản sau), ghi bằng `create()`; giao
 *   lặp (at-least-once) hoặc thử lại không nhân đôi.
 * - Chỉ ghi TÊN trường đổi; giá trị trước/sau chỉ của trường không nhạy cảm (danh sách cho phép theo
 *   loại). Không ghi mã đơn, mã vận đơn, ghi chú, ảnh chụp đơn, tên/variant sản phẩm, nhãn kiện, chuỗi
 *   lỗi tự do (conventions: log/PII). Không log nội dung tài liệu.
 * - Xóa: bỏ qua. Client không xóa được (Rules `allow delete: if false`); chỉ máy chủ xóa khi purge theo
 *   yêu cầu xóa tài khoản (V1-14), có nhật ký riêng `accountDeletions`. Ghi sự kiện lúc purge sẽ làm
 *   sống lại `auditEvents` của shop vừa bị xóa.
 */

/** Loại thực thể theo collection; khóa là đường dẫn mẫu của trigger (`index.ts`). */
export const AUDITED_ENTITIES = {
  order: 'shops/{shopId}/orders/{orderId}',
  order_line: 'shops/{shopId}/orders/{orderId}/lines/{lineId}',
  package: 'shops/{shopId}/orders/{orderId}/packages/{packageId}',
  session: 'shops/{shopId}/sessions/{sessionId}',
  evidence: 'shops/{shopId}/evidence/{evidenceId}',
  return: 'shops/{shopId}/returns/{returnId}',
} as const;

export type AuditedEntity = keyof typeof AUDITED_ENTITIES;

/** Trường được ghi giá trị trước/sau (không nhạy cảm: trạng thái, enum, số, ID nội bộ, mốc giờ). */
const SAFE_FIELDS: Readonly<Record<AuditedEntity, readonly string[]>> = {
  order: ['shopId', 'source', 'status', 'dataSource', 'rev', 'createdBy', 'updatedBy'],
  order_line: ['shopId', 'orderId', 'quantity', 'position', 'dataSource', 'createdBy'],
  package: ['shopId', 'orderId', 'index', 'createdBy'],
  session: [
    'shopId',
    'kind',
    'orderId',
    'packageId',
    'status',
    'startedAtDevice',
    'startedAtServer',
    'endedAtDevice',
    'createdBy',
    'appVersion',
  ],
  evidence: [
    'shopId',
    'sessionId',
    'orderId',
    'packageId',
    'ownerKind',
    'returnId',
    'kind',
    'origin',
    'clientFileState',
    'retryCount',
    'sizeBytes',
    'durationMs',
    'mimeType',
    'capturedAtDevice',
    'createdBy',
    'appVersion',
    'server', // chỉ `server.state` (xem projectSafe)
  ],
  return: ['shopId', 'dataSource', 'createdAtDevice', 'createdBy', 'appVersion'],
};

/** Bản tài liệu tối thiểu cần cho kiểm toán (khớp DocumentSnapshot của Admin SDK). */
export interface AuditSnapshot {
  readonly exists: boolean;
  data(): Record<string, unknown> | undefined;
  readonly updateTime?: { readonly seconds: number; readonly nanoseconds: number } | undefined;
}

export interface AuditWriteInput {
  readonly entity: AuditedEntity;
  readonly shopId: string;
  /** ID của chính tài liệu (tham số cuối của đường dẫn). */
  readonly entityId: string;
  /** Đường dẫn tương đối trong shop, ví dụ `orders/o1/lines/l1` (chỉ gồm ID nội bộ). */
  readonly entityPath: string;
  readonly before: AuditSnapshot | undefined;
  readonly after: AuditSnapshot | undefined;
  /** Danh tính từ sự kiện có auth context (chỉ có trên môi trường thật). */
  readonly authType?: string | undefined;
  readonly authId?: string | undefined;
}

export type AuditOutcome = 'recorded' | 'duplicate' | 'skipped_delete' | 'skipped_no_change';

/** So sánh giá trị Firestore (Timestamp/GeoPoint/DocumentReference có `isEqual`, mảng, map). */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const eq = (a as { isEqual?: (other: unknown) => boolean }).isEqual;
  if (typeof eq === 'function') {
    try {
      return eq.call(a, b);
    } catch {
      return false;
    }
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => valuesEqual(item, b[i]));
  }
  if (Buffer.isBuffer(a) || Buffer.isBuffer(b)) {
    return Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b);
  }
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every(
    (k) =>
      Object.prototype.hasOwnProperty.call(b, k) &&
      valuesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Tên trường cấp một khác nhau giữa hai bản (thêm, bớt, đổi), đã sắp xếp. */
export function changedFields(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): string[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  return [...keys].filter((k) => !valuesEqual(b[k], a[k])).sort();
}

/** Giá trị an toàn của các trường cho trước; `server` chỉ giữ `state`. Trường vắng mặt -> `null`. */
function projectSafe(
  entity: AuditedEntity,
  data: Record<string, unknown> | undefined,
  fields: readonly string[],
): Record<string, unknown> {
  const allowed = SAFE_FIELDS[entity];
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (!allowed.includes(field)) continue;
    const value = data?.[field];
    if (field === 'server') {
      const state = (value as { state?: unknown } | undefined)?.state;
      out.server = { state: typeof state === 'string' ? state : null };
    } else {
      out[field] = value === undefined ? null : value;
    }
  }
  return out;
}

/** Id sự kiện cố định: SHA-256 của (đường dẫn trong shop, updateTime) để chạy lại không nhân đôi. */
export function auditEventId(
  entityPath: string,
  updateTime: { readonly seconds: number; readonly nanoseconds: number } | undefined,
): string {
  const stamp = updateTime ? `${updateTime.seconds}.${updateTime.nanoseconds}` : 'no-update-time';
  return `write-${createHash('sha256').update(`${entityPath}|${stamp}`).digest('hex')}`;
}

/**
 * Ghi một sự kiện kiểm toán cho một lần ghi tài liệu. Hàm thuần theo `db` (test trên Firestore
 * Emulator); `index.ts` chỉ nối trigger.
 */
export async function recordAuditForWrite(
  db: Firestore,
  input: AuditWriteInput,
): Promise<AuditOutcome> {
  const { entity, shopId, entityId, entityPath, before, after } = input;
  const afterData = after?.exists ? after.data() : undefined;
  const beforeData = before?.exists ? before.data() : undefined;
  if (!afterData) return 'skipped_delete';
  const created = beforeData === undefined;
  const fields = changedFields(beforeData, afterData);
  if (!created && fields.length === 0) return 'skipped_no_change';

  // Người thực hiện: chỉ lấy từ trường Rules ép bằng `request.auth.uid` (createdBy khi tạo; updatedBy
  // khi sửa đơn). Các lần sửa khác (phiên, bằng chứng, máy chủ) không có trường này -> null; danh tính
  // thô của sự kiện (nếu có) ghi riêng ở `auth`.
  const claimed = created ? afterData.createdBy : entity === 'order' ? afterData.updatedBy : null;
  const event: Record<string, unknown> = {
    type: `${entity}.${created ? 'created' : 'updated'}`,
    entity,
    entityId,
    entityPath,
    changedFields: fields,
    before: created ? null : projectSafe(entity, beforeData, fields),
    after: projectSafe(entity, afterData, created ? Object.keys(afterData) : fields),
    actorUid: typeof claimed === 'string' ? claimed : null,
    actor: 'system:auditTrigger',
    at: FieldValue.serverTimestamp(),
  };
  if (input.authType !== undefined || input.authId !== undefined) {
    event.auth = { type: input.authType ?? null, id: input.authId ?? null };
  }
  const ref = db.doc(`shops/${shopId}/auditEvents/${auditEventId(entityPath, after?.updateTime)}`);
  try {
    await ref.create(event);
    return 'recorded';
  } catch (error) {
    // 6 = ALREADY_EXISTS: lần giao trước đã ghi.
    if ((error as { code?: unknown } | null)?.code === 6) return 'duplicate';
    throw error;
  }
}

/** Dựng `entityPath` (trong shop) và `entityId` từ tham số trigger theo loại thực thể. */
export function entityLocation(
  entity: AuditedEntity,
  params: Readonly<Record<string, string>>,
): { entityPath: string; entityId: string } {
  const p = (key: string) => params[key] ?? '';
  switch (entity) {
    case 'order':
      return { entityPath: `orders/${p('orderId')}`, entityId: p('orderId') };
    case 'order_line':
      return {
        entityPath: `orders/${p('orderId')}/lines/${p('lineId')}`,
        entityId: p('lineId'),
      };
    case 'package':
      return {
        entityPath: `orders/${p('orderId')}/packages/${p('packageId')}`,
        entityId: p('packageId'),
      };
    case 'session':
      return { entityPath: `sessions/${p('sessionId')}`, entityId: p('sessionId') };
    case 'evidence':
      return { entityPath: `evidence/${p('evidenceId')}`, entityId: p('evidenceId') };
    case 'return':
      return { entityPath: `returns/${p('returnId')}`, entityId: p('returnId') };
  }
}
