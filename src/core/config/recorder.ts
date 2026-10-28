/**
 * Đã bật bộ ghi video thật chưa. Mặc định `false` (cờ `EXPO_PUBLIC_RECORDER_ENABLED=1` mới bật): màn
 * quay (UI-C03) chỉ là bản thử GIAO DIỆN, camera chỉ xem trước, KHÔNG ghi tệp, nên luôn hiện dải
 * "chưa ghi video" để không nói dối "Đang quay" (bất biến 3, 11; docs/04 A05). Bộ ghi thật
 * (`recording-controller.ts` + `platform/camera-recorder.tsx`) chưa kiểm chứng trên thiết bị; chỉ bật khi
 * đã thử trên máy thật (ADR-020). Đặt ở `core` để cả `orders` (bắt đầu quay) và `packing` đọc cùng một
 * cờ mà không phụ thuộc lẫn nhau. Metro thay giá trị lúc đóng gói nên truy cập trực tiếp
 * `process.env.EXPO_PUBLIC_*`.
 */
export const RECORDER_ENABLED = process.env.EXPO_PUBLIC_RECORDER_ENABLED === '1';
