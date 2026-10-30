import { Directory, File, Paths } from 'expo-file-system';

import { logger } from '@/core/logging/logger';

import {
  excludeFromBackup,
  isBackupExclusionSupported,
  type BackupExclusionResult,
} from './backup-exclusion';

const EVIDENCE_DIR = 'evidence';
const EVIDENCE_MARKER = `/${EVIDENCE_DIR}/`;

/**
 * Thư mục bền `evidence/`, tạo nếu thiếu. Vừa tạo mới thì đặt lại cờ loại khỏi sao lưu (V1-12, không chờ,
 * không chặn): cờ gắn với thư mục, thư mục bị xóa và tạo lại thì mất cờ.
 */
function ensureEvidenceDirectory(): Directory {
  const directory = new Directory(Paths.document, EVIDENCE_DIR);
  if (!directory.exists) {
    directory.create({ intermediates: true });
    // Adapter không từ chối promise; `catch` chỉ phòng thủ để không thành lỗi chưa xử lý.
    excludeFromBackup('evidence', directory.uri).catch(() => undefined);
  }
  return directory;
}

/**
 * Loại thư mục bằng chứng (video, ảnh hàng hoàn) khỏi iCloud Backup (V1-12, Q-24d A); gọi khi mở app.
 * Tạo thư mục nếu thiếu để cờ có chỗ gắn (chỉ khi có module: Android/web/Expo Go trả `unsupported`, không
 * đụng hệ tệp). Không ném lỗi.
 */
export async function excludeEvidenceDirFromBackup(): Promise<BackupExclusionResult> {
  if (!isBackupExclusionSupported()) return 'unsupported';
  let uri: string;
  try {
    const directory = new Directory(Paths.document, EVIDENCE_DIR);
    if (!directory.exists) directory.create({ intermediates: true });
    uri = directory.uri;
  } catch {
    logger.warn('backup_exclusion.not_applied', { target: 'evidence', result: 'failed' });
    return 'failed';
  }
  return excludeFromBackup('evidence', uri);
}

export type PersistResult =
  | { readonly ok: true; readonly uri: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'STORAGE_FULL' | 'FAILED' };

/** Đường dẫn đầy đủ (có giao thức) hoặc tuyệt đối; ngược lại là đường dẫn tương đối của app. */
const isAbsolute = (path: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('/');

/**
 * Đường dẫn LƯU TRONG CƠ SỞ DỮ LIỆU của tệp bền: tương đối so với thư mục tài liệu
 * (`evidence/<id>.<đuôi>`). Không lưu URI tuyệt đối vì trên iOS đường dẫn của container có thể đổi
 * khi cập nhật/khôi phục máy, khiến tệp còn nguyên bị coi là mất.
 */
export function storedRecordingPath(fileName: string): string {
  return `${EVIDENCE_DIR}/${fileName}`;
}

/**
 * Đổi đường dẫn đã lưu thành URI dùng được ngay. Dạng tương đối được ghép với thư mục tài liệu hiện
 * tại. Dữ liệu cũ lưu dạng tuyệt đối trong `.../evidence/...` vẫn dùng được: còn tồn tại thì giữ
 * nguyên, không thì thử ghép phần `evidence/...` với thư mục tài liệu hiện tại (container đã đổi).
 * Đường dẫn khác (tệp tạm của camera) trả nguyên.
 */
export function resolveRecordingUri(stored: string): string {
  try {
    if (!isAbsolute(stored)) return new File(Paths.document, stored).uri;
    const at = stored.lastIndexOf(EVIDENCE_MARKER);
    if (at < 0) return stored;
    if (new File(stored).exists) return stored;
    const relative = stored.slice(at + 1);
    return new File(Paths.document, relative).uri;
  } catch {
    return stored;
  }
}

/** Hết dung lượng: ưu tiên mã lỗi của SDK/hệ điều hành, chỉ dùng nội dung thông báo như phương án cuối. */
function isStorageFull(error: unknown): boolean {
  const code = String((error as { code?: unknown } | null)?.code ?? '').toUpperCase();
  if (code.includes('ENOSPC') || code.includes('NO_SPACE') || code.includes('DISK_FULL')) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('enospc') || message.includes('no space');
}

/**
 * Chuyển tệp vừa quay khỏi thư mục tạm (hệ điều hành có thể dọn khi thiếu bộ nhớ) vào thư mục tài
 * liệu của app, tên theo ID bằng chứng: `evidence/<id>.<đuôi>`. MOVE (không sao chép): không để hai
 * bản. Bản gốc bất biến sau đó (bất biến 4): chỉ đọc. Đích đã có thì KHÔNG ghi đè (ID bằng chứng là
 * duy nhất), trả lỗi `FAILED`. `uri` trả về là đường dẫn TƯƠNG ĐỐI để lưu (xem `storedRecordingPath`).
 * Chuyển trong cùng ổ đĩa thường chỉ đổi tên nên ít khi hết dung lượng; việc nhận ra "hết dung lượng"
 * dựa mã lỗi nếu có và là phương án cuối, nên cần kiểm chứng trên thiết bị thật.
 */
export function persistRecording(
  tempUri: string,
  evidenceId: string,
  extension: string,
): PersistResult {
  try {
    const source = new File(tempUri);
    if (!source.exists) return { ok: false, reason: 'FILE_MISSING' };
    const directory = ensureEvidenceDirectory();
    const name = `${evidenceId}.${extension.replace(/^\./, '')}`;
    const target = new File(directory, name);
    if (target.exists) return { ok: false, reason: 'FAILED' };
    source.move(target);
    return { ok: true, uri: storedRecordingPath(name), sizeBytes: target.size ?? 0 };
  } catch (error) {
    return { ok: false, reason: isStorageFull(error) ? 'STORAGE_FULL' : 'FAILED' };
  }
}

export type DeleteRecordingResult =
  { readonly ok: true; readonly deleted: boolean } | { readonly ok: false };

/**
 * Xóa MỘT tệp bền trong thư mục `evidence/` của app (chỉ dùng cho NGOẠI LỆ xóa ảnh hàng hoàn chụp nhầm,
 * Q-26j; không dùng cho video đóng gói hay bằng chứng khác). An toàn: không ném lỗi; tệp không còn thì
 * `ok` (xóa lặp lại được); đường dẫn có `..` hoặc nằm ngoài `evidence/` (ví dụ tệp tạm của camera, do hệ
 * điều hành dọn) thì KHÔNG đụng tới và coi là `ok, deleted: false`. Xóa xong mà tệp còn thì `ok: false`.
 * Chưa kiểm chứng trên thiết bị (quyền ghi, tệp bị khóa).
 */
export function deleteRecording(stored: string): DeleteRecordingResult {
  try {
    if (stored.split(/[\\/]/).includes('..')) return { ok: false };
    const uri = resolveRecordingUri(stored);
    if (!uri.includes(EVIDENCE_MARKER)) return { ok: true, deleted: false };
    const file = new File(uri);
    if (!file.exists) return { ok: true, deleted: false };
    file.delete();
    return file.exists ? { ok: false } : { ok: true, deleted: true };
  } catch {
    return { ok: false };
  }
}

/** Tệp bằng chứng còn tồn tại không (dùng khi khôi phục sau khi app bị kill). */
export function recordingExists(stored: string): boolean {
  try {
    return new File(resolveRecordingUri(stored)).exists;
  } catch {
    return false;
  }
}

/**
 * Đường dẫn đã lưu của tệp bền theo ID bằng chứng nếu có (`evidence/<id>.<đuôi>`), bất kể CSDL còn ghi
 * đường dẫn nào. Dùng khi khôi phục: app bị kill sau khi chuyển tệp nhưng trước khi ghi đường dẫn mới.
 */
export function findPersistedRecording(evidenceId: string): string | null {
  try {
    const directory = new Directory(Paths.document, EVIDENCE_DIR);
    if (!directory.exists) return null;
    const name = directory
      .list()
      .map((entry) => entry.name)
      .find((entryName) => entryName.startsWith(`${evidenceId}.`));
    return name ? storedRecordingPath(name) : null;
  } catch {
    return null;
  }
}

/** Dung lượng trống của ổ lưu trữ (byte); `null` nếu không đọc được (khi đó không chặn quay). */
export function getAvailableDiskBytes(): number | null {
  try {
    const bytes = Paths.availableDiskSpace;
    return typeof bytes === 'number' && Number.isFinite(bytes) ? bytes : null;
  } catch {
    return null;
  }
}

const PROBE_PREFIX = '.probe-';
/** Đúng tên tệp thăm dò (`.probe-<giờ>`); tệp bằng chứng là `<id>.<đuôi>` nên không bao giờ khớp. */
const PROBE_NAME = /^\.probe-\d+$/;

/** Dọn tệp thăm dò SÓT LẠI (app bị kill giữa tạo và xóa). Chỉ xóa tên khớp `PROBE_NAME`; không ném lỗi. */
function removeStaleProbes(directory: Directory): void {
  try {
    for (const entry of directory.list()) {
      if (!PROBE_NAME.test(entry.name)) continue;
      try {
        entry.delete();
      } catch {
        // không xóa được: bỏ qua, lần sau dọn tiếp
      }
    }
  } catch {
    // không liệt kê được: bỏ qua
  }
}

/**
 * Thử ghi vào thư mục bằng chứng (A04 "khả năng ghi tệp cục bộ"): tạo, ghi vài byte rồi xóa MỘT tệp
 * thăm dò riêng (`.probe-<giờ>`). Không bao giờ đụng tệp bằng chứng. `true` = ghi được. Thăm dò sót
 * lại (app bị kill giữa chừng) vô hại và được dọn ở lần thăm dò sau (chỉ tên khớp đúng `.probe-<số>`). Chưa kiểm chứng trên thiết bị.
 */
export function probeEvidenceDirWritable(): boolean {
  let probe: File | null = null;
  try {
    const directory = ensureEvidenceDirectory();
    removeStaleProbes(directory);
    probe = new File(directory, `${PROBE_PREFIX}${Date.now()}`);
    probe.create();
    probe.write(new Uint8Array([0]));
    return true;
  } catch {
    return false;
  } finally {
    try {
      probe?.delete();
    } catch {
      // không xóa được tệp thăm dò: bỏ qua
    }
  }
}
