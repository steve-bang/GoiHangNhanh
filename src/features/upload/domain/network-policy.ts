import { booleanSetting } from '@/features/orders';

/**
 * "Chỉ tải khi có Wi‑Fi" (Q-24c = B, V1-09): cài đặt THEO MÁY, mặc định TẮT = luôn tải, kể cả 4G/5G.
 * Chỉ áp dụng cho tệp ảnh/video bằng chứng; thông tin đơn/bản neo hồ sơ (vài KB) vẫn đồng bộ.
 */
export const UPLOAD_WIFI_ONLY = booleanSetting('upload.wifi_only', false);

/** Hình dạng trạng thái mạng cần cho chính sách (khớp `Connectivity` của `platform/connectivity`). */
export interface NetworkSnapshot {
  readonly online: boolean;
  readonly type: 'wifi' | 'cellular' | 'other' | 'none';
}

/**
 * Hàng đợi tải lên có được dùng mạng hiện tại không:
 * - `offline`: máy báo chắc chắn mất mạng (V1-02).
 * - `waiting_wifi`: đã bật "Chỉ tải khi có Wi‑Fi" mà mạng hiện tại KHÔNG phải Wi‑Fi. Gồm cả `other`
 *   (Ethernet, VPN, Bluetooth, loại chưa rõ): không biết có tốn cước di động không, nên chọn an toàn với
 *   lựa chọn của người dùng (họ tắt công tắc được). `wifiOnly = null` (chưa đọc xong cài đặt) cũng chờ,
 *   để lượt đầu khi mở app không lỡ dùng 4G/5G của người đã bật.
 * - `allowed`: còn lại.
 * Đây là LÝ DO hiển thị/điều kiện chạy, không phải trạng thái tệp (bất biến 3).
 */
export type UploadNetworkGate = 'allowed' | 'offline' | 'waiting_wifi';

export function uploadNetworkGate(
  network: NetworkSnapshot,
  wifiOnly: boolean | null,
): UploadNetworkGate {
  if (!network.online) return 'offline';
  if (wifiOnly === false) return 'allowed';
  return network.type === 'wifi' ? 'allowed' : 'waiting_wifi';
}
