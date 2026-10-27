/**
 * Thời gian đã trôi qua dạng `mm:ss` (hoặc `h:mm:ss` từ 1 giờ). Tính từ MỐC (`startedAtDevice`)
 * mỗi lần vẽ, không cộng dồn từng nhịp, nên không trôi khi app bị treo/nền. Mốc ở tương lai (đồng hồ
 * máy bị chỉnh lùi) tính là 0.
 */
export function formatElapsed(startedAtDevice: number, nowDevice: number): string {
  const total = Math.max(0, Math.floor((nowDevice - startedAtDevice) / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const two = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}
