/**
 * Đã có bộ ghi video thật chưa. `false`: màn quay (UI-C03) chỉ là bản thử GIAO DIỆN, camera chỉ xem
 * trước, KHÔNG ghi tệp, nên màn luôn hiện dải "chưa ghi video" để không nói dối "Đang quay" (bất biến
 * 3, 11; docs/04 A05: không hiện Đang quay trước khi ghi được tệp). Khi nối recorder thật (tệp bền,
 * máy trạng thái tệp, phục hồi khi app bị kill, quyền micro O-09): bật cờ này, bỏ dải, bật ghi.
 */
export const RECORDER_ENABLED = false;
