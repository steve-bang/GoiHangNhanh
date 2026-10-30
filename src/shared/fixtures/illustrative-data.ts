/**
 * DỮ LIỆU MINH HỌA cho khung giao diện - KHÔNG phải dữ liệu thật và không giả làm dữ liệu từ sàn.
 * Gom ở MỘT tệp để dễ tìm và xóa khi có dữ liệu thật; khi nối Firestore, thay từng chỗ import
 * `ILLUSTRATIVE_*` bằng hook ở lớp data của feature. Trung tâm đồng bộ đã dùng tệp thật (V1-08); phần
 * còn lại của Trang chủ thay ở V1-10.
 */
export const ILLUSTRATIVE_SHOP_NAME = 'Shop minh họa';

/** Số liệu "hôm nay" của Trang chủ (minh họa; nhãn theo docs/09 mục 3, không phải "Đã đồng bộ"). */
export const ILLUSTRATIVE_TODAY_STATS = { packed: 12, uploaded: 11, error: 1 } as const;
