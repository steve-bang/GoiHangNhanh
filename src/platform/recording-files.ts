import { Directory, File, Paths } from 'expo-file-system';

const EVIDENCE_DIR = 'evidence';

export type PersistResult =
  | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };

/**
 * Chuyển tệp vừa quay khỏi thư mục tạm (hệ điều hành có thể dọn khi thiếu bộ nhớ) vào thư mục tài
 * liệu của app, tên theo ID bằng chứng: `evidence/<id>.<đuôi>`. MOVE (không sao chép): không để hai
 * bản. Bản gốc bất biến sau đó (bất biến 4): chỉ đọc. Đích đã có thì KHÔNG ghi đè (ID bằng chứng là
 * duy nhất), trả lỗi `FAILED`.
 */
export function persistRecording(
  tempUri: string,
  evidenceId: string,
  extension: string,
): PersistResult {
  try {
    const source = new File(tempUri);
    if (!source.exists) return { ok: false, reason: 'FILE_MISSING' };
    const directory = new Directory(Paths.document, EVIDENCE_DIR);
    if (!directory.exists) directory.create({ intermediates: true });
    const target = new File(directory, `${evidenceId}.${extension.replace(/^\./, '')}`);
    if (target.exists) return { ok: false, reason: 'FAILED' };
    source.move(target);
    return { ok: true, uri: target.uri, sizeBytes: target.size ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const full = message.includes('space') || message.includes('enospc');
    return { ok: false, reason: full ? 'STORAGE_FULL' : 'FAILED' };
  }
}

/** Tệp bằng chứng còn tồn tại không (dùng khi khôi phục sau khi app bị kill). */
export function recordingExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}
