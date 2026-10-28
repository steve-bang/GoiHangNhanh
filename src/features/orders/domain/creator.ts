/**
 * Gắn (hoặc bỏ) uid người tạo lên một bản ghi: luôn bỏ giá trị người gọi truyền vào rồi mới đặt uid
 * thật của phiên đăng nhập, để không ai tự khai `createdBy` qua `saveNewOrder`/`saveSession`. `uid`
 * rỗng (chưa biết ai đăng nhập) thì bản ghi không có `createdBy` và sẽ không bao giờ được đăng.
 */
export function stampCreator<T extends { readonly createdBy?: string }>(
  item: T,
  uid: string | null,
): T {
  const { createdBy: ignored, ...rest } = item;
  void ignored;
  return (uid ? { ...rest, createdBy: uid } : rest) as T;
}

/** Cấp uid của phiên đăng nhập hiện tại cho kho (đọc MỖI LẦN lưu, không giữ giá trị cũ). */
export type CreatorUidProvider = () => string | null;
