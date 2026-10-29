import type { ReturnDetails } from './types';

/**
 * Những hạn chế về bằng chứng của hồ sơ, để hiển thị trung thực (docs/05 B07). KHÔNG bao giờ có mục
 * "đầy đủ bằng chứng": đó là kiểm tra theo chính sách, chưa có ở R1 (CLAUDE.md #11).
 */
export type EvidenceLimit =
  | 'no_opening_video'
  | 'interrupted_opening_video'
  | 'opened_before_recording'
  | 'no_exterior_photo'
  | 'not_linked';

/**
 * Hồ sơ có HẠN CHẾ về bằng chứng liên quan tới quá trình mở kiện (thiếu video mở kiện, hoặc kiện đã mở
 * trước khi quay). Dùng cho nhãn "Hạn chế bằng chứng" ở danh sách và màn xem; mọi nơi sau này dùng hồ sơ
 * này (tạo tranh chấp, xuất hồ sơ) phải mang nhãn đó theo, không được ẩn (docs/05 B07, B08).
 */
export function hasOpeningEvidenceLimit(
  returnCase: Pick<ReturnDetails['returnCase'], 'openingVideo' | 'openedBefore'>,
): boolean {
  const video = returnCase.openingVideo;
  return (
    video?.kind === 'missing' ||
    (video?.kind === 'recorded' && video.interrupted) ||
    returnCase.openedBefore !== null
  );
}

/**
 * `photoCount`: số ảnh kiện đã lưu bền trên máy; `null` = chưa biết (đang nạp) thì KHÔNG nêu hạn chế ảnh
 * (không nói "chưa có ảnh" khi chưa kiểm tra). Ảnh là tùy chọn: chỉ nêu khi hồ sơ đã ghi tình trạng bên
 * ngoài mà chưa có ảnh nào.
 */
export function evidenceLimits(details: ReturnDetails, photoCount: number | null): EvidenceLimit[] {
  const { returnCase } = details;
  const limits: EvidenceLimit[] = [];
  if (returnCase.openingVideo?.kind === 'missing') limits.push('no_opening_video');
  if (returnCase.openingVideo?.kind === 'recorded' && returnCase.openingVideo.interrupted) {
    limits.push('interrupted_opening_video');
  }
  if (returnCase.openedBefore !== null) limits.push('opened_before_recording');
  if (returnCase.exterior !== null && photoCount === 0) limits.push('no_exterior_photo');
  if (returnCase.sourceOrderId === null) limits.push('not_linked');
  return limits;
}
