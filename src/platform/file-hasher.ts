import { File, FileMode } from 'expo-file-system';

import { Sha256 } from '@/core/crypto/sha256';

import { resolveRecordingUri } from './recording-files';

/** Đọc từng khối này để băm: đủ lớn để ít vòng lặp, đủ nhỏ để không giữ nhiều bộ nhớ. */
export const HASH_CHUNK_BYTES = 1024 * 1024;

export type HashFileResult =
  | { readonly ok: true; readonly sha256: string; readonly sizeBytes: number }
  | { readonly ok: false; readonly reason: 'FILE_MISSING' | 'FILE_UNREADABLE' };

/**
 * SHA-256 của tệp cục bộ (`uri` là đường dẫn đã lưu, tương đối hoặc tuyệt đối), đọc theo khối (không nạp cả video vào bộ nhớ). Tệp không có -> `FILE_MISSING`;
 * lỗi đọc giữa chừng -> `FILE_UNREADABLE`. Không log đường dẫn hay nội dung. Tốc độ băm bằng JS trên
 * Hermes chưa đo trên thiết bị.
 */
export async function hashFile(uri: string): Promise<HashFileResult> {
  let handle: ReturnType<File['open']> | null = null;
  try {
    const file = new File(resolveRecordingUri(uri));
    if (!file.exists) return { ok: false, reason: 'FILE_MISSING' };
    handle = file.open(FileMode.ReadOnly);
    const hash = new Sha256();
    let total = 0;
    for (;;) {
      const chunk = await handle.readBytes(HASH_CHUNK_BYTES);
      if (chunk.length === 0) break;
      hash.update(chunk);
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
