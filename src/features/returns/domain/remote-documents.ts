import type { ReturnCase } from './types';

/**
 * Giá trị đặc biệt của Firestore do lớp gọi cấp (SDK native trên máy, SDK web trong test Rules), để
 * module này thuần và dùng chung được cho cả hai.
 */
export interface RemoteValues {
  serverTimestamp(): unknown;
  timestamp(ms: number): unknown;
}

export interface RemoteWrite {
  /** Đường dẫn tài liệu từ gốc Firestore. */
  readonly path: string;
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Bản "neo" của hồ sơ hàng hoàn (`shops/{shopId}/returns/{returnId}`, Q-28), đúng hình dạng
 * `firebase/firestore.rules` yêu cầu. CHỈ định danh để gắn bằng chứng (ảnh/video) lên máy chủ: KHÔNG
 * chứa đơn gốc, tình trạng, dòng, sai lệch hay vị trí (đồng bộ nội dung hồ sơ là Q-26c, chưa làm), nên
 * hồ sơ chưa liên kết đơn gốc đăng được như hồ sơ đã liên kết. `code` chỉ là nhãn hiển thị, KHÔNG phải ID
 * (bất biến 1). Chỉ để TẠO: bản neo bất biến, máy chủ giữ giờ nhận (`createdAt`) tách với giờ thiết bị.
 */
export function returnAnchorWrite(
  returnCase: Pick<ReturnCase, 'id' | 'shopId' | 'code' | 'createdAtDevice'>,
  uid: string,
  v: RemoteValues,
  appVersion?: string,
): RemoteWrite {
  return {
    path: `shops/${returnCase.shopId}/returns/${returnCase.id}`,
    data: {
      shopId: returnCase.shopId,
      code: returnCase.code,
      dataSource: 'user_entered',
      createdAtDevice: v.timestamp(returnCase.createdAtDevice),
      createdAt: v.serverTimestamp(),
      createdBy: uid,
      ...(appVersion ? { appVersion } : {}),
    },
  };
}
