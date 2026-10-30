import { booleanSetting } from '@/features/orders';

/**
 * "Gửi báo lỗi ứng dụng" (V1-16, R-8 A): cài đặt THEO MÁY (`device_settings`), mặc định BẬT, tắt được ở
 * Quyền riêng tư và bảo mật (UI-I05). Báo lỗi chỉ mang mã lỗi, tên thao tác và vị trí lỗi trong mã đã lọc
 * (`core/logging/crash-safe.ts`), không gắn tài khoản. Không đồng bộ lên máy chủ.
 */
export const CRASH_REPORTS_ENABLED = booleanSetting('privacy.crash_reports', true);
