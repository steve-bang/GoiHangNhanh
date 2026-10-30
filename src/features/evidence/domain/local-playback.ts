import { FILE_STATES, type FileState } from './file-state';

/**
 * Xem lại bằng chứng TRÊN CHÍNH MÁY NÀY (UI-E04, V1-17). Hàm thuần: quyết định có mở tệp cục bộ được
 * không, không đọc/ghi tệp (bất biến 4: chỉ đọc bản gốc). v1 chưa có URL xem từ máy chủ (Q-24a), nên
 * tệp không còn trên máy là "không xem được", KHÔNG hứa xem từ máy chủ.
 *
 * - `capturing`: tệp còn đang ghi hoặc đang lưu (`recording`/`saving_local`): tệp chưa đóng, không mở.
 * - `missing`: không có đường dẫn tệp, hoặc có đường dẫn nhưng tệp không còn (cài lại app, đã dọn).
 * - `available`: tệp đã đóng và còn trên máy.
 */
export type LocalPlayback = 'capturing' | 'missing' | 'available';

const CAPTURING: readonly FileState[] = [FILE_STATES.RECORDING, FILE_STATES.SAVING_LOCAL];

export function localPlaybackOf(
  file: { readonly state: FileState; readonly localPath: string | null },
  exists: (localPath: string) => boolean,
): LocalPlayback {
  if (CAPTURING.includes(file.state)) return 'capturing';
  if (!file.localPath) return 'missing';
  return exists(file.localPath) ? 'available' : 'missing';
}

/**
 * Máy chủ đã xác nhận nhận đủ tệp (`uploaded`/`verified`, chỉ đạt được bằng sự kiện `origin: 'server'`).
 * Dùng để chọn câu khi tệp không còn trên máy: chỉ khi đó mới được nói máy chủ còn bản.
 */
export const isServerConfirmed = (state: FileState): boolean =>
  state === FILE_STATES.UPLOADED || state === FILE_STATES.VERIFIED;

const MB = 1024 * 1024;
const GB = 1024 * MB;

const decimal = (value: number, digits: number): string => value.toFixed(digits).replace('.', ',');

/** Kích thước tệp kiểu Việt Nam (dấu phẩy thập phân): `850 KB`, `182,4 MB`, `1,25 GB`. */
export function formatFileSize(bytes: number): string {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < GB) return `${decimal(bytes / MB, 1)} MB`;
  return `${decimal(bytes / GB, 2)} GB`;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Thời lượng `m:ss` (dưới 1 giờ) hoặc `h:mm:ss`; làm tròn xuống theo giây. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Mã băm rút gọn để đối chiếu bằng mắt: 8 ký tự đầu … 8 ký tự cuối. Ngắn hơn 20 ký tự thì giữ nguyên. */
export function shortHash(hex: string): string {
  return hex.length < 20 ? hex : `${hex.slice(0, 8)}…${hex.slice(-8)}`;
}

/** Rút gọn ID nội bộ (6 ký tự cuối) để người dùng đọc/so khi cần hỗ trợ; không dùng để tra cứu. */
export const shortId = (id: string): string => (id.length <= 6 ? id : id.slice(-6));
