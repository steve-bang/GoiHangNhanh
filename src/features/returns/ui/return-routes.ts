import { ROUTES, type RouteDef } from '@/core/navigation';

import type { ReturnStatus } from '../domain';

/**
 * Màn tiếp tục của một hồ sơ theo trạng thái (mở hồ sơ dở dang từ danh sách; hồ sơ đã xác nhận mở
 * màn xem/hoàn tất). Luôn đi bằng ID hồ sơ (bất biến 1), không bằng mã.
 */
export function resumeRoute(status: ReturnStatus): RouteDef {
  switch (status) {
    case 'receiving':
      return ROUTES.returnExterior;
    case 'opening':
      return ROUTES.returnRecord;
    case 'checking':
      return ROUTES.returnItems;
    case 'confirmed':
      return ROUTES.returnDone;
  }
}
