import { uploaderRelation, type UploaderRelation } from '@/features/evidence';

import type { ReturnMedia } from './media';
import type { ReturnCase } from './types';

/**
 * Ai tải được media hàng hoàn này so với tài khoản đang đăng nhập (V1-07, Q-24g). Media chỉ tải sau khi
 * bản neo của hồ sơ đã lên máy chủ, mà bản neo chỉ người tạo hồ sơ đăng được: ảnh của chính mình trong hồ
 * sơ CHƯA đăng do người khác tạo là `case_owner` (chờ người đó đăng nhập lại); hồ sơ không rõ người tạo
 * và chưa đăng thì `unknown` (không ai đăng được). Cùng điều kiện với `OrderStore.countUnsyncedByOwner`.
 */
export function returnMediaUploader(
  media: Pick<ReturnMedia, 'createdBy'>,
  returnCase: Pick<ReturnCase, 'createdBy' | 'anchorPublishedAtDevice'>,
  currentUid: string | null,
): UploaderRelation {
  const relation = uploaderRelation(media.createdBy, currentUid);
  if (relation !== 'current' || !currentUid) return relation;
  if (returnCase.anchorPublishedAtDevice !== undefined) return 'current';
  if (!returnCase.createdBy) return 'unknown';
  return returnCase.createdBy === currentUid ? 'current' : 'case_owner';
}
