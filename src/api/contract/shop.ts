import type { OrderSource } from '@/core/orders/order-source';

export interface CreateShopInput {
  /** Đã bỏ khoảng trắng đầu/cuối, 1-50 ký tự. */
  readonly name: string;
  /** Có thể rỗng (nguồn bán bỏ qua được). Không trùng, theo thứ tự chuẩn. */
  readonly sellingSources: readonly OrderSource[];
}

export interface UpdateShopInput extends CreateShopInput {
  /** Shop đã được `createShop` xác nhận trong cùng luồng thiết lập. */
  readonly shopId: string;
}

export interface CreatedShop {
  readonly id: string;
  readonly name: string;
  readonly sellingSources: readonly OrderSource[];
}

/**
 * Cổng tạo shop (port). Bản thật là Cloud Function callable `createShop` (ghi `members` + nhật ký
 * kiểm toán, architecture.md): chỉ resolve khi máy chủ xác nhận. Màn Tạo shop gọi `createShop` MỘT
 * lần mỗi luồng thiết lập; người dùng quay lại sửa thì gọi `updateShop` với `shopId` đã có. Bản
 * thật phải idempotent theo tài khoản (một tài khoản không bao giờ có hai shop từ luồng này), kể cả
 * khi app gọi lặp do mất mạng giữa chừng (decisions.md Q-13).
 */
export interface ShopApi {
  createShop(input: CreateShopInput): Promise<CreatedShop>;
  updateShop(input: UpdateShopInput): Promise<CreatedShop>;
  /**
   * Đọc thông tin shop mà tài khoản hiện tại là thành viên (Rules cho thành viên đọc). `null` = không
   * có shop này hoặc không phải thành viên đang hoạt động (không phân biệt hai trường hợp).
   */
  getShop(shopId: string): Promise<ShopDetails | null>;
}

export interface ShopDetails {
  readonly id: string;
  readonly name: string;
  readonly role: 'owner' | 'member';
  /** Được sửa thông tin shop (chủ hoặc quản lý). Chốt thật là Security Rules/Function. */
  readonly canEdit: boolean;
}
