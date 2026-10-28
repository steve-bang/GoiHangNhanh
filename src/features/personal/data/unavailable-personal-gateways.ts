import { AppError } from '@/core/errors/app-error';

import type { PersonalGateways } from '../domain/types';

/**
 * Cổng "chưa kết nối": dùng ở chế độ Firebase/không kết nối: phần hợp đồng API chưa có thì chưa nối được (decisions.md Q-20t). Mọi lời gọi trả lỗi nghiệp
 * vụ `AUTH_SERVICE_UNAVAILABLE`; KHÔNG BAO GIỜ báo đã đổi tên/mật khẩu/đăng xuất khi chưa có máy chủ
 * xác nhận (CLAUDE.md #3, #11).
 */
const unavailable = () => Promise.reject(new AppError('AUTH_SERVICE_UNAVAILABLE'));

export function createUnavailablePersonalGateways(): PersonalGateways {
  return {
    account: {
      getProfile: unavailable,
      getShopSummary: unavailable,
      listShops: unavailable,
      updateShopName: unavailable,
      switchShop: unavailable,
      updateProfile: unavailable,
      changePassword: unavailable,
      signOut: unavailable,
    },
    settings: {
      getNotificationPreferences: unavailable,
      updateNotificationPreferences: unavailable,
    },
  };
}
