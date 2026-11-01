import { FILE_STATES, type FileState } from './file-state';

/**
 * Chọn NGUỒN xem lại bằng chứng (UI-E04, V1-17, mở rộng bởi xem từ máy chủ). Hàm thuần: không đọc/ghi
 * tệp (bất biến 4: chỉ đọc bản gốc, không tải ngược về ghi đè hay tạo lại tệp trên máy).
 *
 * - `capturing`: tệp còn đang ghi hoặc đang lưu (`recording`/`saving_local`): tệp chưa đóng, không mở.
 * - `local`: tệp đã đóng và còn trên máy: ưu tiên (nhanh, không tốn dữ liệu), không gọi máy chủ.
 * - `cloud`: tệp không còn trên máy nhưng máy chủ ĐÃ xác nhận có bản (`uploaded`/`verified`): xem qua
 *   URL ký ngắn hạn từ Function `getEvidenceReadUrl`.
 * - `missing`: tệp không còn trên máy và máy chủ chưa xác nhận có bản: bằng chứng không xem được.
 */
export type LocalPlayback = 'capturing' | 'local' | 'cloud' | 'missing';

const CAPTURING: readonly FileState[] = [FILE_STATES.RECORDING, FILE_STATES.SAVING_LOCAL];

export function localPlaybackOf(
  file: { readonly state: FileState; readonly localPath: string | null },
  exists: (localPath: string) => boolean,
): LocalPlayback {
  if (CAPTURING.includes(file.state)) return 'capturing';
  if (file.localPath && exists(file.localPath)) return 'local';
  return isServerConfirmed(file.state) ? 'cloud' : 'missing';
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
