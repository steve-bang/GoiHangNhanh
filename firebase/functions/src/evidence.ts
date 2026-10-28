import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';

import { FieldValue, type Firestore } from 'firebase-admin/firestore';

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
  | 'ignored_path' // không phải bản gốc bằng chứng
  | 'no_evidence_document'; // tệp mồ côi: chưa có tài liệu khai báo

export interface VerifyResult {
  readonly outcome: VerifyOutcome;
  /** Lý do khi `hash_mismatch` (không chứa nội dung tệp). */
  readonly reason?: 'sha256_differs' | 'size_differs' | 'invalid_declaration';
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

/**
 * Xác minh bản gốc bằng chứng sau khi tệp được tải lên Storage (docs/06; CLAUDE.md bất biến 3).
 *
 * - Máy chủ TỰ tính lại SHA-256 và kích thước; KHÔNG tin `sha256Client`, chỉ so với nó.
 * - Hai bước ghi `server.*`: `uploaded` (đã nhận đủ) rồi `verified` hoặc `hash_mismatch`. Không
 *   khớp thì KHÔNG BAO GIỜ `verified`, bản gốc giữ nguyên (cách ly, không xóa), có kiểm toán.
 * - Idempotent: trạng thái chốt thì chạy lại không đổi gì và không nhân đôi kiểm toán (id sự kiện
 *   cố định theo bằng chứng).
 * - Bản gốc bất biến (bất biến 4): `server.generation` ghi lúc nhận. Nếu finalize đến với generation
 *   KHÁC khi đã chốt (đối tượng bị ghi đè dù URL ký đã ràng buộc tạo-một-lần), KHÔNG trả
 *   `already_final` im lặng: chuyển `hash_mismatch` (nhãn "Đã xác minh" không còn đúng), giữ
 *   `sha256Server` của bản đã băm, ghi kiểm toán `evidence.original_overwritten`.
 * - Không ghi nội dung tệp, đường dẫn hay mã băm vào log; mã băm chỉ nằm trong tài liệu bằng chứng.
 * - Không đụng `retention` (cờ giữ do Function khác quản lý, O-06).
 */
export async function verifyEvidenceObject(
  db: Firestore,
  reader: EvidenceObjectReader,
  storagePath: string,
  /** Generation của đối tượng trong sự kiện finalize (chuỗi/số); thiếu thì bỏ qua kiểm tra ghi đè. */
  generation?: string | number,
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
        server.generation !== generationText
      ) {
        // Đối tượng bị thay sau khi chốt: cách ly + kiểm toán (id cố định theo generation: chạy lại không nhân đôi).
        tx.update(evidenceRef, {
          'server.state': 'hash_mismatch',
          'server.generation': generationText,
          'server.overwrittenFromGeneration': server.generation,
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
    } else if (generationText !== undefined && server.generation !== generationText) {
      // Chưa chốt mà đối tượng đã đổi: băm bản mới nhất, ghi nhận generation đang được xét.
      tx.update(evidenceRef, { 'server.generation': generationText });
    }
    return {
      final: false as const,
      sha256Client: data.sha256Client as unknown,
      sizeBytes: data.sizeBytes as unknown,
    };
  });
  if (!declared) return { outcome: 'no_evidence_document' };
  if (declared.final) {
    return { outcome: declared.overwritten ? 'original_overwritten' : 'already_final' };
  }

  // Bước 2: tính lại từ bản gốc trong Storage. Lỗi đọc thì ném: trạng thái giữ `uploaded`, thử lại sau.
  const measured = await hashStream(reader.open(storagePath));

  const declaredHash =
    typeof declared.sha256Client === 'string' ? declared.sha256Client.toLowerCase() : null;
  const declaredSize = typeof declared.sizeBytes === 'number' ? declared.sizeBytes : null;
  let reason: VerifyResult['reason'];
  if (declaredHash === null || declaredSize === null) reason = 'invalid_declaration';
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
    tx.update(evidenceRef, {
      server: {
        state: verified ? 'verified' : 'hash_mismatch',
        receivedAt: current.receivedAt ?? FieldValue.serverTimestamp(),
        storagePath,
        ...((current.generation ?? generationText) !== undefined
          ? { generation: current.generation ?? generationText }
          : {}),
        sha256Server: measured.sha256,
        sizeBytesServer: measured.sizeBytes,
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
