import type { ShopId } from '@/core/ids';

/**
 * ShopId TẠM cho dữ liệu lưu cục bộ cho tới khi có phiên Firebase thật (O-15). Mọi bản ghi vẫn mang
 * `shopId` và mọi truy vấn vẫn lọc theo nó (bất biến 8), nhưng giá trị này KHÔNG phân biệt được
 * hai shop dùng chung một máy. Phải thay bằng shop của phiên đăng nhập trước khi có đa shop.
 */
export const LOCAL_SHOP_ID = 'local-shop' as ShopId;
