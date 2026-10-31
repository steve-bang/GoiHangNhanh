/**
 * Trạng thái phiên và các bước chuyển hợp lệ (docs/02 mục phiên; docs/04 A03-A05; tập giá trị khớp
 * `firestore.rules` > `sessions` > update). Thuần TypeScript, dùng chung cho mọi cài đặt kho.
 *
 *   created -> recording -> ended | interrupted | needs_attention -> confirmed
 *
 * - `created`: đã tạo phiên, chưa ghi tệp. Chỉ đi tiếp được sang `recording`.
 * - `interrupted` -> `recording`: người dùng chọn tiếp tục sau khi mất focus (docs/04 mục 206);
 *   quay bổ sung SAU khi phiên đã kết thúc là một phiên MỚI, không mở lại phiên cũ.
 * - `confirmed` là điểm cuối: không lùi, không đổi (bất biến 7: thay đổi sau xác nhận phải có lịch sử).
 * - Lùi (ví dụ `confirmed` -> `recording`, `ended` -> `recording`, `recording` -> `created`) và mọi
 *   trạng thái lạ đều bị từ chối.
 */
export const SESSION_STATUSES = [
  'created',
  'recording',
  'ended',
  'interrupted',
  'confirmed',
  'needs_attention',
] as const;

export type SessionStatus = (typeof SESSION_STATUSES)[number];

const TRANSITIONS: Readonly<Record<SessionStatus, readonly SessionStatus[]>> = {
  created: ['recording'],
  recording: ['ended', 'interrupted', 'needs_attention'],
  ended: ['confirmed', 'needs_attention'],
  interrupted: ['recording', 'ended', 'confirmed', 'needs_attention'],
  needs_attention: ['ended', 'confirmed'],
  confirmed: [],
};

export const isSessionStatus = (value: string): value is SessionStatus =>
  (SESSION_STATUSES as readonly string[]).includes(value);

/**
 * Đổi `from` -> `to` có hợp lệ không. Đặt lại đúng trạng thái hiện tại (`from === to`) là hợp lệ và
 * không đổi gì, để thử lại sau khi mất phản hồi là an toàn. Trạng thái lạ ở một trong hai phía: không.
 */
export function canChangeSessionStatus(from: string, to: string): boolean {
  if (!isSessionStatus(from) || !isSessionStatus(to)) return false;
  return from === to || TRANSITIONS[from].includes(to);
}

/**
 * Phiên đã dừng ghi bình thường (tệp video đã lưu trên máy): dùng để đếm "Đơn đã đóng gói" ở Trang chủ
 * (V1-10). `interrupted`/`needs_attention` là ghi lỗi, không tính.
 */
export const PACKED_SESSION_STATUSES: readonly SessionStatus[] = ['ended', 'confirmed'];
