import { ORDER_SOURCES, type OrderSource } from './order-source';

/**
 * Nguồn bán theo TỪ VỰNG MÁY CHỦ: `firebase/firestore.rules` `isShopSource` và
 * `firebase/functions/src/shop.ts` `SELLING_SOURCES`. Khác app đúng một giá trị: "Khác / chưa xác
 * định" là `other` trong app (SQLite, route, i18n) nhưng `other_unknown` trên máy chủ (Q-29 /
 * fix-other-source). Giữ cùng thứ tự chuẩn với `ORDER_SOURCES`.
 */
export const REMOTE_ORDER_SOURCES = ['shopee', 'tiktok_shop', 'lazada', 'other_unknown'] as const;

export type RemoteOrderSource = (typeof REMOTE_ORDER_SOURCES)[number];

const APP_OTHER = 'other' satisfies OrderSource;
const REMOTE_OTHER = 'other_unknown' satisfies RemoteOrderSource;

/**
 * Nơi DUY NHẤT đổi app -> máy chủ. Dùng ở mọi chỗ ghi nguồn bán lên Firestore/Function (đơn, ảnh chụp
 * đơn của phiên, tạo/sửa shop). Không gọi trên giá trị đã là từ vựng máy chủ.
 */
export function toRemoteSource(source: OrderSource): RemoteOrderSource {
  return source === APP_OTHER ? REMOTE_OTHER : source;
}

/**
 * Nơi DUY NHẤT đổi máy chủ -> app. Giá trị lạ (không thuộc từ vựng máy chủ) trả `null` để bên gọi tự
 * quyết (bỏ qua hoặc báo lỗi); KHÔNG đoán thành "Khác" để tránh đổi nghĩa dữ liệu âm thầm.
 */
export function fromRemoteSource(value: unknown): OrderSource | null {
  if (value === REMOTE_OTHER) return APP_OTHER;
  if (value === APP_OTHER) return null;
  return ORDER_SOURCES.find((source) => source === value) ?? null;
}

/** Danh sách nguồn bán app -> máy chủ, giữ thứ tự. */
export function toRemoteSources(sources: readonly OrderSource[]): RemoteOrderSource[] {
  return sources.map(toRemoteSource);
}

/** Danh sách nguồn bán máy chủ -> app; bỏ giá trị lạ (xem `fromRemoteSource`). */
export function fromRemoteSources(values: readonly unknown[]): OrderSource[] {
  return values.flatMap((value) => {
    const source = fromRemoteSource(value);
    return source === null ? [] : [source];
  });
}
