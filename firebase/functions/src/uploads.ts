import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { ID_PATTERN } from './ids';
import { isDeclaredSizeAllowed } from './limits';
import { requestReverify } from './reverify';

/** Ký URL tải lên và kiểm tra đối tượng Storage. Tách ra để test không cần Storage thật. */
export interface UploadUrlSigner {
  objectExists(storagePath: string): Promise<boolean>;
  /** URL ký (v4) để KHỞI TẠO phiên tải có thể tiếp tục, giới hạn Content-Type và thời hạn. */
  signResumableStart(
    storagePath: string,
    contentType: string,
    expiresAtMs: number,
    /** Header phải nằm trong chữ ký VÀ được client gửi nguyên (Storage từ chối nếu thiếu/khác). */
    extensionHeaders: Readonly<Record<string, string>>,
  ): Promise<string>;
}

/**
 * Chỉ tạo đối tượng khi CHƯA có (generation 0): hai phiên tải song song hoặc URL cũ dùng lại sau khi
 * bản gốc đã xuất hiện đều bị Storage từ chối (412), nên không ghi đè được bản đã xác minh (bất biến 4).
 */
export const CREATE_ONLY_HEADERS: Readonly<Record<string, string>> = {
  'x-goog-if-generation-match': '0',
};

export interface UploadSessionInput {
  readonly shopId: string;
  readonly evidenceId: string;
}

export type UploadSessionResult =
  | {
      readonly status: 'ready';
      readonly storagePath: string;
      readonly url: string;
      readonly method: 'POST';
      readonly headers: Readonly<Record<string, string>>;
      readonly expiresAtMs: number;
    }
  /** Máy chủ đã có bản gốc của bằng chứng này: không cấp URL (bản gốc tạo đúng một lần). */
  | { readonly status: 'already_received'; readonly storagePath: string };

/**
 * Lý do có cấu trúc (`details.reason`, V1-07b) để app phân loại mà không đọc câu chữ: bằng chứng/phiên/
 * bản neo do tài khoản khác tạo (thử lại không đổi được) hoặc phiên/bản neo chưa có trên máy chủ.
 */
export type UploadErrorReason =
  'not_evidence_declarer' | 'not_session_creator' | 'session_missing' | 'return_missing';

export class UploadError extends Error {
  constructor(
    readonly code: 'invalid-argument' | 'permission-denied' | 'not-found' | 'failed-precondition',
    message: string,
    readonly reason?: UploadErrorReason,
  ) {
    super(message);
  }
}

/** Thời hạn URL khởi tạo phiên tải. Phiên tải đã khởi tạo tiếp tục theo cơ chế của Storage. */
export const UPLOAD_URL_TTL_MS = 15 * 60_000;

/** Loại tệp bằng chứng được nhận (docs/06; ảnh/video chụp trong app). */
export const ALLOWED_CONTENT_TYPES: readonly string[] = [
  'video/mp4',
  'video/quicktime',
  'image/jpeg',
  'image/png',
];

/** Vai trò được tạo bằng chứng; khớp `canManageOrders` ở firestore.rules (khung tạm, chờ O-07). */
const UPLOAD_ROLES = ['owner', 'manager', 'packer'];

export function parseUploadSessionInput(data: unknown): UploadSessionInput {
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
 * Cấp URL ký để tải bản gốc bằng chứng lên Storage (ADR-006: client không có quyền Storage trực tiếp).
 *
 * - Chỉ thành viên đang hoạt động có vai trò tạo bằng chứng của đúng shop. Không phân biệt "không
 *   phải thành viên" với "shop không tồn tại" để không lộ ID shop khác.
 * - Tài liệu bằng chứng phải có sẵn (client khai báo trước, Rules đã kiểm phiên/đơn/kiện khớp).
 * - Đường dẫn do MÁY CHỦ dựng từ shopId + evidenceId, client không chọn được; Content-Type lấy từ
 *   khai báo và nằm trong danh sách cho phép.
 * - Bản gốc tạo đúng một lần (bất biến 4): đã có đối tượng hoặc trạng thái máy chủ thì KHÔNG cấp URL.
 *   Kiểm tra này chỉ là lớp đầu; lớp chắc là header `x-goog-if-generation-match: 0` trong chữ ký URL
 *   (URL còn hạn 15 phút và các lần xin song song không vượt được kiểm tra lúc xin). Lớp thứ ba nằm
 *   ở `verifyEvidenceObject` (so generation khi finalize).
 * - Chủ sở hữu (Q-28): bằng chứng đóng gói (không có `ownerKind`) hoặc hàng hoàn (`ownerKind: 'return'`).
 *   Đường dẫn, băm và tạo-một-lần GIỐNG NHAU cho cả hai (chỉ cần shopId + evidenceId); với hàng hoàn
 *   còn kiểm hồ sơ `returns/{returnId}` đã đăng cùng shop (Rules đã kiểm lúc khai báo, đây là lớp thứ hai).
 * - Chỉ người đã khai báo (`createdBy`) mới xin được URL (Q-24g: không tải hộ tệp do tài khoản khác
 *   tạo); với bằng chứng đóng gói người đó còn phải là người tạo phiên (V1-07b; hàng hoàn: từng media là
 *   đơn vị sở hữu, bản neo chỉ cần tồn tại); lỗi kèm `reason` (`details.reason` cho client). Kích thước khai báo phải trong trần theo loại (Q-24c: ảnh 25 MB, video 2 GB; `limits.ts`).
 * - Bản gốc đã có mà máy chủ chưa chốt (`uploaded` quá 15 phút hoặc chưa có trạng thái): chỉ ĐẶT YÊU CẦU
 *   xác minh lại (`reverify.ts`, giữ chỗ 30 phút, không băm ở đây) rồi trả `already_received` ngay;
 *   trigger `reverifyEvidence` băm lại. Gọi lặp/đồng thời không sinh thêm lần băm.
 * - Mỗi lần cấp có một sự kiện kiểm toán (kèm chủ sở hữu); URL không được ghi vào kiểm toán hay log.
 */
export async function createUploadSessionForUser(
  db: Firestore,
  signer: UploadUrlSigner,
  uid: string,
  input: UploadSessionInput,
  nowMs: number = Date.now(),
): Promise<UploadSessionResult> {
  const { shopId, evidenceId } = input;
  const member = await db.doc(`shops/${shopId}/members/${uid}`).get();
  const roles = (member.data()?.roles as string[] | undefined) ?? [];
  if (
    !member.exists ||
    member.data()?.status !== 'active' ||
    !roles.some((role) => UPLOAD_ROLES.includes(role))
  ) {
    throw new UploadError('permission-denied', 'Không có quyền tải bằng chứng lên shop này.');
  }
  const evidence = await db.doc(`shops/${shopId}/evidence/${evidenceId}`).get();
  if (!evidence.exists) throw new UploadError('not-found', 'Chưa có bằng chứng này.');
  const data = evidence.data() ?? {};
  const storagePath = `shops/${shopId}/evidence/${evidenceId}/original`;
  if (data.createdBy !== uid) {
    throw new UploadError(
      'permission-denied',
      'Bằng chứng này do tài khoản khác khai báo.',
      'not_evidence_declarer',
    );
  }

  const serverState = (data.server as { state?: unknown } | undefined)?.state;
  if (serverState === 'verified' || serverState === 'hash_mismatch') {
    return { status: 'already_received', storagePath };
  }
  if (serverState || (await signer.objectExists(storagePath))) {
    try {
      await requestReverify(db, shopId, evidenceId, uid, nowMs);
    } catch {
      // Không đặt được yêu cầu (lỗi tạm): phản hồi vẫn đúng, lần gọi sau thử lại.
    }
    return { status: 'already_received', storagePath };
  }
  const ownerKind = data.ownerKind === 'return' ? 'return' : 'packing';
  const returnId = ownerKind === 'return' ? (data.returnId as unknown) : undefined;
  // Đóng gói: người khai báo phải là người tạo PHIÊN (V1-07b). Hàng hoàn: đơn vị sở hữu là từng media,
  // đã ép bằng `evidence.createdBy == uid` ở trên; bản neo chỉ cần còn trong shop (review PR #64: B chụp
  // thêm ảnh vào hồ sơ của A vẫn tải được ảnh của B). Kiểm SAU nhánh `already_received`: bằng chứng đã có
  // bản gốc vẫn được chính người khai báo nhờ xác minh lại, nhưng không ai xin được URL mới cho phiên của
  // người khác.
  if (ownerKind === 'return') {
    const anchor =
      typeof returnId === 'string' && ID_PATTERN.test(returnId)
        ? await db.doc(`shops/${shopId}/returns/${returnId}`).get()
        : null;
    if (!anchor?.exists) {
      throw new UploadError(
        'failed-precondition',
        'Chưa có hồ sơ hàng hoàn của bằng chứng này.',
        'return_missing',
      );
    }
  } else {
    const sessionId = data.sessionId as unknown;
    const session =
      typeof sessionId === 'string' && ID_PATTERN.test(sessionId)
        ? await db.doc(`shops/${shopId}/sessions/${sessionId}`).get()
        : null;
    if (!session?.exists) {
      throw new UploadError(
        'failed-precondition',
        'Chưa có phiên ghi nhận của bằng chứng này.',
        'session_missing',
      );
    }
    if (session.data()?.createdBy !== uid) {
      throw new UploadError(
        'permission-denied',
        'Phiên ghi nhận này do tài khoản khác tạo.',
        'not_session_creator',
      );
    }
  }
  const contentType = data.mimeType;
  if (typeof contentType !== 'string' || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new UploadError('failed-precondition', 'Loại tệp không được nhận.');
  }
  if (!isDeclaredSizeAllowed(data.kind, data.sizeBytes)) {
    throw new UploadError('failed-precondition', 'Kích thước tệp vượt giới hạn.');
  }
  const expiresAtMs = nowMs + UPLOAD_URL_TTL_MS;
  const url = await signer.signResumableStart(
    storagePath,
    contentType,
    expiresAtMs,
    CREATE_ONLY_HEADERS,
  );
  await db.collection(`shops/${shopId}/auditEvents`).add({
    type: 'evidence.upload_session_created',
    actorUid: uid,
    at: FieldValue.serverTimestamp(),
    evidenceId,
    ownerKind,
    ...(typeof returnId === 'string' ? { returnId } : {}),
  });
  return {
    status: 'ready',
    storagePath,
    url,
    method: 'POST',
    headers: {
      'x-goog-resumable': 'start',
      'Content-Type': contentType,
      ...CREATE_ONLY_HEADERS,
    },
    expiresAtMs,
  };
}
