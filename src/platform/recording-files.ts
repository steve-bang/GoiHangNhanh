import { Directory, File, Paths } from 'expo-file-system';

const EVIDENCE_DIR = 'evidence';
const EVIDENCE_MARKER = `/${EVIDENCE_DIR}/`;

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
    const directory = new Directory(Paths.document, EVIDENCE_DIR);
    if (!directory.exists) directory.create({ intermediates: true });
    const name = `${evidenceId}.${extension.replace(/^\./, '')}`;
    const target = new File(directory, name);
    if (target.exists) return { ok: false, reason: 'FAILED' };
    source.move(target);
    return { ok: true, uri: storedRecordingPath(name), sizeBytes: target.size ?? 0 };
  } catch (error) {
    return { ok: false, reason: isStorageFull(error) ? 'STORAGE_FULL' : 'FAILED' };
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

/**
 * Thử ghi vào thư mục bằng chứng (A04 "khả năng ghi tệp cục bộ"): tạo, ghi vài byte rồi xóa MỘT tệp
 * thăm dò riêng (`.probe-<giờ>`). Không bao giờ đụng tệp bằng chứng. `true` = ghi được. Thăm dò sót
 * lại (app bị kill giữa chừng) vô hại và bị dọn ở lần sau. Chưa kiểm chứng trên thiết bị.
 */
export function probeEvidenceDirWritable(): boolean {
  let probe: File | null = null;
  try {
    const directory = new Directory(Paths.document, EVIDENCE_DIR);
    if (!directory.exists) directory.create({ intermediates: true });
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
