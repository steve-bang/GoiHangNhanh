import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

import { isEventTooOld, maxBytesFor } from './limits';

/** Đọc đối tượng Storage theo luồng. Tách ra để test không cần Storage Emulator. */
export interface EvidenceObjectReader {
  /** Luồng nội dung đối tượng; ném lỗi nếu không đọc được. */
  open(storagePath: string): Readable;
}

export type VerifyOutcome =
  | 'verified'
  | 'hash_mismatch'
  | 'already_final' // máy chủ đã chốt `verified`/`hash_mismatch`: chạy lại không đổi gì
  | 'original_overwritten' // đối tượng bị thay bằng generation khác SAU khi đã chốt: cách ly + kiểm toán
  | 'superseded' // chưa chốt, nhưng đã có generation MỚI hơn đang được xét: để finalize của generation đó tự chốt
  | 'ignored_path' // không phải bản gốc bằng chứng
  | 'no_evidence_document'; // tệp mồ côi: chưa có tài liệu khai báo

export interface VerifyResult {
  readonly outcome: VerifyOutcome;
  /** Lý do khi `hash_mismatch` (không chứa nội dung tệp). */
  readonly reason?:
    'sha256_differs' | 'size_differs' | 'invalid_declaration' | 'size_exceeds_limit';
}

const ORIGINAL_PATH = /^shops\/([^/]+)\/evidence\/([^/]+)\/original$/;

/** Tách shopId/evidenceId từ đường dẫn bản gốc; `null` nếu không phải (bản dẫn xuất, xuất hồ sơ...). */
export function parseEvidencePath(
  storagePath: string,
): { shopId: string; evidenceId: string } | null {
  const match = ORIGINAL_PATH.exec(storagePath);
  return match && match[1] && match[2] ? { shopId: match[1], evidenceId: match[2] } : null;
}

/** SHA-256 và số byte tính theo luồng (không nạp cả video vào bộ nhớ). */
export async function hashStream(stream: Readable): Promise<{ sha256: string; sizeBytes: number }> {
  const hash = createHash('sha256');
  let sizeBytes = 0;
  for await (const chunk of stream) {
    const buffer = chunk as Buffer;
    hash.update(buffer);
    sizeBytes += buffer.length;
  }
  return { sha256: hash.digest('hex'), sizeBytes };
}

const FINAL_STATES = ['verified', 'hash_mismatch'];

/** Generation GCS là số nguyên 64 bit dạng chuỗi: so bằng BigInt, không so chuỗi. */
function compareGeneration(a: string, b: string): number {
  try {
    const x = BigInt(a);
    const y = BigInt(b);
    return x === y ? 0 : x > y ? 1 : -1;
  } catch {
    // Không phải số: không so thứ tự được, coi khác nhau là "mới hơn" (cách ly thay vì bỏ qua).
    return a === b ? 0 : 1;
  }
}

/**
 * Xác minh bản gốc bằng chứng sau khi tệp được tải lên Storage (docs/06; CLAUDE.md bất biến 3).
 *
 * - Máy chủ TỰ tính lại SHA-256 và kích thước; KHÔNG tin `sha256Client`, chỉ so với nó.
 * - Hai bước ghi `server.*`: `uploaded` (đã nhận đủ) rồi `verified` hoặc `hash_mismatch`. Không
 *   khớp thì KHÔNG BAO GIỜ `verified`, bản gốc giữ nguyên (cách ly, không xóa), có kiểm toán.
 * - Idempotent: trạng thái chốt thì chạy lại không đổi gì và không nhân đôi kiểm toán (id sự kiện
 *   cố định theo bằng chứng).
 * - Bản gốc bất biến (bất biến 4): `server.generation` ghi lúc nhận. Nếu finalize đến với generation
 *   LỚN HƠN generation đã chốt (so BigInt; đối tượng bị ghi đè dù URL ký đã ràng buộc tạo-một-lần),
 *   KHÔNG trả `already_final` im lặng: chuyển `hash_mismatch` (nhãn "Đã xác minh" không còn đúng), ghi
 *   kiểm toán `evidence.original_overwritten`, và chuyển `verifiedAt`/`sha256Server`/`sizeBytesServer`
 *   của bản cũ sang `server.previous` (không để cạnh `hash_mismatch` như thể còn đúng). Generation
 *   NHỎ HƠN hoặc BẰNG (finalize cũ giao lặp/đến muộn) là `already_final`, không đổi gì.
 * - Hai finalize chồng nhau khi chưa chốt: chỉ generation đang được ghi ở `server.generation` được
 *   chốt; bản đã băm mà generation lệch thì KHÔNG chốt (`superseded`).
 * - Không ghi nội dung tệp, đường dẫn hay mã băm vào log; mã băm chỉ nằm trong tài liệu bằng chứng.
 * - Trần dung lượng (Q-24c): nếu kích thước đối tượng (từ sự kiện finalize) vượt trần của loại khai
 *   báo thì chốt `hash_mismatch` lý do `size_exceeds_limit` mà KHÔNG băm (không tốn CPU cho tệp quá cỡ;
 *   Rules đã giữ kích thước khai báo trong trần nên tệp quá cỡ chắc chắn lệch khai báo).
 * - Không đụng `retention` (cờ giữ do Function khác quản lý, O-06).
 */
export async function verifyEvidenceObject(
  db: Firestore,
  reader: EvidenceObjectReader,
  storagePath: string,
  /** Generation của đối tượng trong sự kiện finalize (chuỗi/số); thiếu thì bỏ qua kiểm tra ghi đè. */
  generation?: string | number,
  /** Kích thước đối tượng theo sự kiện finalize; thiếu thì chỉ dựa vào số byte đo khi băm. */
  objectSizeBytes?: number,
): Promise<VerifyResult> {
  const generationText = generation === undefined ? undefined : String(generation);
  const parsed = parseEvidencePath(storagePath);
  if (!parsed) return { outcome: 'ignored_path' };
  const { shopId, evidenceId } = parsed;
  const evidenceRef = db.doc(`shops/${shopId}/evidence/${evidenceId}`);

  // Bước 1: ghi nhận "đã nhận" (một lần), nếu chưa có trạng thái máy chủ.
  const declared = await db.runTransaction(async (tx) => {
    const snap = await tx.get(evidenceRef);
    if (!snap.exists) return null;
    const data = snap.data() ?? {};
    const state = (data.server as { state?: string } | undefined)?.state;
    const server = (data.server as { generation?: string } | undefined) ?? {};
    if (state && FINAL_STATES.includes(state)) {
      if (
        generationText !== undefined &&
        server.generation !== undefined &&
        compareGeneration(generationText, server.generation) > 0
      ) {
        // Đối tượng bị thay sau khi chốt: cách ly + kiểm toán (id cố định theo generation: chạy lại không nhân đôi).
        const old = data.server as Record<string, unknown>;
        const previous: Record<string, unknown> = { state, generation: server.generation };
        for (const key of ['verifiedAt', 'sha256Server', 'sizeBytesServer']) {
          if (old[key] !== undefined) previous[key] = old[key];
        }
        tx.update(evidenceRef, {
          'server.state': 'hash_mismatch',
          'server.generation': generationText,
          'server.overwrittenFromGeneration': server.generation,
          'server.previous': previous,
          'server.verifiedAt': FieldValue.delete(),
          'server.sha256Server': FieldValue.delete(),
          'server.sizeBytesServer': FieldValue.delete(),
        });
        tx.set(
          db.doc(
            `shops/${shopId}/auditEvents/evidence-${evidenceId}-overwritten-${generationText}`,
          ),
          {
            type: 'evidence.original_overwritten',
            actorUid: null,
            actor: 'system:verifyEvidence',
            at: FieldValue.serverTimestamp(),
            evidenceId,
            previousState: state,
          },
        );
        return { final: true as const, overwritten: true as const };
      }
      return { final: true as const, overwritten: false as const };
    }
    if (!state) {
      tx.update(evidenceRef, {
        server: {
          state: 'uploaded',
          receivedAt: FieldValue.serverTimestamp(),
          storagePath,
          ...(generationText !== undefined ? { generation: generationText } : {}),
        },
      });
    } else if (
      generationText !== undefined &&
      server.generation !== undefined &&
      compareGeneration(generationText, server.generation) < 0
    ) {
      // Finalize cũ đến muộn khi đã có generation mới hơn đang được xét: không hạ generation, không băm.
      return { final: true as const, overwritten: false as const, superseded: true as const };
    } else if (generationText !== undefined && server.generation !== generationText) {
      // Chưa chốt mà đối tượng đã đổi: băm bản mới nhất, ghi nhận generation đang được xét.
      tx.update(evidenceRef, { 'server.generation': generationText });
    }
    return {
      final: false as const,
      sha256Client: data.sha256Client as unknown,
      sizeBytes: data.sizeBytes as unknown,
      kind: data.kind as unknown,
    };
  });
  if (!declared) return { outcome: 'no_evidence_document' };
  if (declared.final) {
    if ('superseded' in declared) return { outcome: 'superseded' };
    return { outcome: declared.overwritten ? 'original_overwritten' : 'already_final' };
  }

  // Bước 2: tính lại từ bản gốc trong Storage. Lỗi đọc thì ném: trạng thái giữ `uploaded`, thử lại sau.
  // Tệp vượt trần của loại khai báo: không băm, chốt luôn `hash_mismatch`.
  const oversized = objectSizeBytes !== undefined && objectSizeBytes > maxBytesFor(declared.kind);
  const measured = oversized ? null : await hashStream(reader.open(storagePath));

  const declaredHash =
    typeof declared.sha256Client === 'string' ? declared.sha256Client.toLowerCase() : null;
  const declaredSize = typeof declared.sizeBytes === 'number' ? declared.sizeBytes : null;
  let reason: VerifyResult['reason'];
  if (measured === null) reason = 'size_exceeds_limit';
  else if (declaredHash === null || declaredSize === null) reason = 'invalid_declaration';
  else if (measured.sha256 !== declaredHash) reason = 'sha256_differs';
  else if (measured.sizeBytes !== declaredSize) reason = 'size_differs';
  const verified = reason === undefined;

  // Bước 3: chốt kết quả + kiểm toán trong một giao dịch, chống chạy song song.
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(evidenceRef);
    const current =
      (snap.data()?.server as
        { state?: string; receivedAt?: unknown; generation?: string } | undefined) ?? {};
    if (current.state && FINAL_STATES.includes(current.state)) return { outcome: 'already_final' };
    if (
      generationText !== undefined &&
      current.generation !== undefined &&
      compareGeneration(generationText, current.generation) !== 0
    ) {
      // Bản vừa băm không còn là generation đang được xét (finalize khác chạy chồng): không gắn
      // `verified` cho generation chưa từng được băm; finalize của generation đó tự chốt.
      return { outcome: 'superseded' };
    }
    tx.update(evidenceRef, {
      server: {
        state: verified ? 'verified' : 'hash_mismatch',
        receivedAt: current.receivedAt ?? FieldValue.serverTimestamp(),
        storagePath,
        ...((current.generation ?? generationText) !== undefined
          ? { generation: current.generation ?? generationText }
          : {}),
        ...(measured
          ? { sha256Server: measured.sha256, sizeBytesServer: measured.sizeBytes }
          : objectSizeBytes !== undefined
            ? { sizeBytesServer: objectSizeBytes }
            : {}),
        ...(verified ? { verifiedAt: FieldValue.serverTimestamp() } : {}),
      },
    });
    tx.set(db.doc(`shops/${shopId}/auditEvents/evidence-${evidenceId}-final`), {
      type: verified ? 'evidence.verified' : 'evidence.hash_mismatch',
      actorUid: null,
      actor: 'system:verifyEvidence',
      at: FieldValue.serverTimestamp(),
      evidenceId,
      ...(reason ? { reason } : {}),
    });
    return verified
      ? { outcome: 'verified' }
      : { outcome: 'hash_mismatch', ...(reason ? { reason } : {}) };
  }) as Promise<VerifyResult>;
}

/** Thông tin đối tượng trong sự kiện finalize của Storage cần cho việc xác minh. */
export interface FinalizedObject {
  readonly name: string;
  readonly generation?: string | number;
  readonly size?: number | string;
}

export type FinalizeOutcome =
  VerifyResult | { readonly outcome: 'abandoned_too_old' } | { readonly outcome: 'object_missing' };

/** Lỗi bền của Storage: đối tượng (generation đã ghim) không còn. Thử lại cũng không đổi. */
function isObjectMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 404 || code === '404';
}

/**
 * Xử lý sự kiện finalize với chính sách thử lại CÓ TRẦN (Function chạy `retry: true`):
 * - Sự kiện quá `MAX_EVENT_AGE_MS`: ghi kiểm toán `evidence.verify_abandoned` rồi kết thúc (không ném).
 * - Đối tượng không còn (404): lỗi bền, ghi kiểm toán `evidence.verify_failed` rồi kết thúc.
 * - Lỗi khác (đọc tạm, Firestore): ném để Cloud Functions thử lại.
 * Cả hai trường hợp dừng đều KHÔNG đổi trạng thái máy chủ (không bao giờ `verified`); id kiểm toán cố
 * định theo bằng chứng + generation nên giao lặp không nhân đôi. Không ghi đường dẫn/mã băm vào log.
 */
export async function handleEvidenceFinalized(
  db: Firestore,
  reader: EvidenceObjectReader,
  object: FinalizedObject,
  eventTime: string | undefined,
  nowMs: number = Date.now(),
): Promise<FinalizeOutcome> {
  const parsed = parseEvidencePath(object.name);
  if (!parsed) return { outcome: 'ignored_path' };
  const generation = object.generation === undefined ? 'unknown' : String(object.generation);
  const recordStop = async (type: string, reason: string) => {
    const ref = db.doc(
      `shops/${parsed.shopId}/auditEvents/evidence-${parsed.evidenceId}-${reason}-${generation}`,
    );
    try {
      await ref.create({
        type,
        actorUid: null,
        actor: 'system:verifyEvidence',
        at: FieldValue.serverTimestamp(),
        evidenceId: parsed.evidenceId,
        reason,
      });
    } catch (error) {
      // Đã ghi ở lần giao trước (ALREADY_EXISTS): không nhân đôi.
      if ((error as { code?: unknown } | null)?.code !== 6) throw error;
    }
  };
  if (isEventTooOld(eventTime, nowMs)) {
    await recordStop('evidence.verify_abandoned', 'event_too_old');
    return { outcome: 'abandoned_too_old' };
  }
  const size = object.size === undefined ? undefined : Number(object.size);
  try {
    return await verifyEvidenceObject(
      db,
      reader,
      object.name,
      object.generation,
      size !== undefined && Number.isFinite(size) ? size : undefined,
    );
  } catch (error) {
    if (!isObjectMissing(error)) throw error;
    await recordStop('evidence.verify_failed', 'object_missing');
    return { outcome: 'object_missing' };
  }
}
