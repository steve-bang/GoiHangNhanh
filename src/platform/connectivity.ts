/**
 * Trạng thái mạng cho banner ngoại tuyến (UI-F04).
 *
 * KHUNG TẠM: chưa nối thư viện theo dõi mạng nên luôn trả `false`. Hiện thực thật (NetInfo hoặc
 * tương đương) thuộc tính năng đồng bộ và cần chọn thư viện riêng; component chỉ phụ thuộc hàm này.
 */
export function useIsOffline(): boolean {
  return false;
}
