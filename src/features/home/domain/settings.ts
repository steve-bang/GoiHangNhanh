import { booleanSetting } from '@/features/orders';

/**
 * Người dùng đã đóng thẻ "Dữ liệu nằm trên máy này" ở Trang chủ (Q-24a, V1-10). Cài đặt THEO MÁY
 * (`device_settings`, V1-09): dữ liệu nằm theo máy nên lời nhắc cũng theo máy. Mặc định chưa đóng.
 */
export const HOME_DEVICE_DATA_NOTICE_DISMISSED = booleanSetting(
  'home.device_data_notice_dismissed',
  false,
);
