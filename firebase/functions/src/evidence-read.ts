import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { ID_PATTERN } from './ids';
import { UploadError } from './uploads';

/** Ký URL đọc bản gốc. Tách ra để test không cần Storage thật. */
export interface ReadUrlSigner {
  /** URL ký (v4) CHỈ ĐỌC (GET) cho đúng một đối tượng, hết hạn tại `expiresAtMs`. */
  signRead(storagePath: string, expiresAtMs: number): Promise<string>;
}

export interface ReadUrlInput {
  readonly shopId: string;
  readonly evidenceId: string;
}

export interface ReadUrlResult {
  readonly url: string;
  readonly expiresAtMs: number;
}

/** Thời hạn URL xem lại (ngắn: URL là bí mật mang theo quyền đọc). */
export const READ_URL_TTL_MS = 15 * 60_000;

/** Chỉ bản gốc máy chủ đã nhận và chưa báo lệch băm mới được xem lại từ máy chủ. */
const READABLE_SERVER_STATES: readonly unknown[] = ['uploaded', 'verified'];

export function parseReadUrlInput(data: unknown): ReadUrlInput {
  const { shopId, evidenceId } = (data ?? {}) as { shopId?: unknown; evidenceId?: unknown };
  if (typeof shopId !== 'string' || !ID_PATTERN.test(shopId)) {
    throw new UploadError('invalid-argument', 'Mã shop không hợp lệ.');
  }
  if (typeof evidenceId !== 'string' || !ID_PATTERN.test(evidenceId)) {
    throw new UploadError('invalid-argument', 'Mã bằng chứng không hợp lệ.');
  }
  return { shopId, evidenceId };
}

/**
 * Cấp URL ký chỉ đọc để xem lại bản gốc bằng chứng khi tệp trên máy không còn (ADR-006: client không có
 * quyền Storage trực tiếp, không có URL công khai vĩnh viễn; bất biến 8).
 *
 * - Mọi thành viên ĐANG HOẠT ĐỘNG của shop (xem lại chỉ đọc). Không phân biệt "không phải thành viên"
 *   với "shop không tồn tại" để không lộ ID shop khác.
 * - Chỉ khi máy chủ đã nhận bản gốc (`uploaded`/`verified`); `hash_mismatch` và chưa có trạng thái bị từ chối.
 * - Đường dẫn do MÁY CHỦ dựng từ shopId + evidenceId; client không chọn được đối tượng.
 * - Mỗi lần cấp có một sự kiện kiểm toán; URL và đường dẫn không được ghi vào kiểm toán hay log.
 */
export async function getEvidenceReadUrlForUser(
  db: Firestore,
  signer: ReadUrlSigner,
  uid: string,
  input: ReadUrlInput,
  nowMs: number = Date.now(),
): Promise<ReadUrlResult> {
  const { shopId, evidenceId } = input;
  const member = await db.doc(`shops/${shopId}/members/${uid}`).get();
  if (!member.exists || member.data()?.status !== 'active') {
    throw new UploadError('permission-denied', 'Không có quyền xem bằng chứng của shop này.');
  }
  const evidence = await db.doc(`shops/${shopId}/evidence/${evidenceId}`).get();
  if (!evidence.exists) throw new UploadError('not-found', 'Chưa có bằng chứng này.');
  const data = evidence.data() ?? {};
  const serverState = (data.server as { state?: unknown } | undefined)?.state;
  if (!READABLE_SERVER_STATES.includes(serverState)) {
    throw new UploadError(
      'failed-precondition',
      'Máy chủ chưa nhận bằng chứng này.',
      'not_server_confirmed',
    );
  }
  const expiresAtMs = nowMs + READ_URL_TTL_MS;
  const url = await signer.signRead(`shops/${shopId}/evidence/${evidenceId}/original`, expiresAtMs);
  await db.collection(`shops/${shopId}/auditEvents`).add({
    type: 'evidence.read_url_issued',
    actorUid: uid,
    at: FieldValue.serverTimestamp(),
    evidenceId,
    ownerKind: data.ownerKind === 'return' ? 'return' : 'packing',
  });
  return { url, expiresAtMs };
}
