import type { ReturnDetails } from './types';

/**
 * Những hạn chế về bằng chứng của hồ sơ, để hiển thị trung thực (docs/05 B07). KHÔNG bao giờ có mục
 * "đầy đủ bằng chứng": đó là kiểm tra theo chính sách, chưa có ở R1 (CLAUDE.md #11).
 */
export type EvidenceLimit =
  'no_opening_video' | 'opened_before_recording' | 'no_exterior_photo' | 'not_linked';

export function evidenceLimits(details: ReturnDetails): EvidenceLimit[] {
  const { returnCase } = details;
  const limits: EvidenceLimit[] = [];
  if (returnCase.openingVideo !== null) limits.push('no_opening_video');
  if (returnCase.openedBefore !== null) limits.push('opened_before_recording');
  // R1 chưa chụp ảnh kiện ngoài (chưa có luồng chụp trên thiết bị): luôn nói rõ.
  if (returnCase.exterior !== null) limits.push('no_exterior_photo');
  if (returnCase.sourceOrderId === null) limits.push('not_linked');
  return limits;
}
