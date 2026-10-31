import { File, FileMode } from 'expo-file-system';

import {
  createTimeSliceYielder,
  updateCooperatively,
  type HashYielder,
} from '@/core/crypto/cooperative-hash';
import { Sha256 } from '@/core/crypto/sha256';

import { resolveRecordingUri } from './recording-files';

/** Đọc từng khối này để băm: đủ lớn để ít vòng lặp, đủ nhỏ để không giữ nhiều bộ nhớ. */
export const HASH_CHUNK_BYTES = 1024 * 1024;

export type HashFileResult =
  | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

/**
 * SHA-256 của tệp cục bộ (`uri` là đường dẫn đã lưu, tương đối hoặc tuyệt đối), đọc theo khối (không nạp
 * cả video vào bộ nhớ). Tệp không có -> `FILE_MISSING`; lỗi đọc giữa chừng -> `FILE_UNREADABLE`. Không
 * log đường dẫn hay nội dung. Băm thuần JS nhưng NHƯỜNG luồng JS định kỳ (V1-13, `createTimeSliceYielder`)
 * để giao diện vẫn nhận chạm khi băm video dài; tốc độ trên Hermes chưa đo trên thiết bị (cổng G-5, R-5).
 * Chỉ đọc tệp (bất biến 4).
 */
export async function hashFile(
  uri: string,
  options: { readonly yielder?: HashYielder } = {},
): Promise<HashFileResult> {
  let handle: ReturnType<File['open']> | null = null;
  try {
    const file = new File(resolveRecordingUri(uri));
    if (!file.exists) return { ok: false, reason: 'FILE_MISSING' };
    handle = file.open(FileMode.ReadOnly);
    const hash = new Sha256();
    const yielder = options.yielder ?? createTimeSliceYielder();
    let total = 0;
    for (;;) {
      const chunk = await handle.readBytes(HASH_CHUNK_BYTES);
      if (chunk.length === 0) break;
      await updateCooperatively(hash, chunk, yielder);
      total += chunk.length;
    }
    return { ok: true, sha256: hash.digestHex(), sizeBytes: total };
  } catch {
    return { ok: false, reason: 'FILE_UNREADABLE' };
  } finally {
    try {
      handle?.close();
    } catch {
      // đã đóng hoặc không đóng được: không ảnh hưởng kết quả
    }
  }
}

/** Dấu rẻ của tệp (không đọc nội dung) để biết tệp có thể đã đổi kể từ lần băm trước (V1-13). */
export interface FileFingerprintReading {
  readonly sizeBytes: number;
  /** Thời điểm sửa đổi của hệ tệp (ms, làm tròn xuống). */
  readonly modifiedAtMs: number;
}

/**
 * Kích thước + thời điểm sửa đổi của tệp (`File.size`, `File.modificationTime` của `expo-file-system`;
 * không có inode). Không có tệp, không đọc được hoặc hệ tệp không báo thời điểm sửa đổi -> `null` (bên
 * gọi phải băm lại). Không log đường dẫn. Độ tin cậy của `modificationTime` trên iOS/Android chưa kiểm
 * chứng trên máy; máy chủ vẫn băm lại độc lập.
 */
export function fileFingerprint(uri: string): FileFingerprintReading | null {
  try {
    const file = new File(resolveRecordingUri(uri));
    if (!file.exists) return null;
    const size = file.size;
    const modified = file.modificationTime;
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) return null;
    if (typeof modified !== 'number' || !Number.isFinite(modified)) return null;
    return { sizeBytes: size, modifiedAtMs: Math.floor(modified) };
  } catch {
    return null;
  }
}
