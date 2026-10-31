import { toRemoteSource } from '@/core/orders/remote-source';

import { toCodeKey } from './codes';
import type { Order, OrderDetails, OrderPackage, PackingSession } from './types';

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
 * Tài liệu Firestore của một đơn: đơn + dòng + kiện, đúng hình dạng `firebase/firestore.rules` yêu cầu
 * (khóa chỉ gồm tập cho phép, `status: 'new'`, `rev: 1`, thời gian máy chủ). CHỈ dùng để TẠO: đơn chỉ
 * được đăng khi đã có phiên, lúc đó đơn không còn sửa được (Q-23a). Mã đơn chuẩn hóa chỉ để tìm kiếm,
 * định danh luôn là ID. Giá trị rỗng (mã vận đơn, variant) thì bỏ khóa, không ghi `null`.
 */
export function orderWrites(details: OrderDetails, uid: string, v: RemoteValues): RemoteWrite[] {
  const { order, lines, packages } = details;
  const base = `shops/${order.shopId}/orders/${order.id}`;
  const stamp = { createdAt: v.serverTimestamp(), createdBy: uid };
  return [
    {
      path: base,
      data: {
        shopId: order.shopId,
        orderCode: order.orderCode,
        orderCodeNormalized: toCodeKey(order.orderCode),
        // Từ vựng máy chủ (`other` -> `other_unknown`): Rules `isShopSource` chỉ nhận giá trị máy chủ.
        source: toRemoteSource(order.source),
        ...(order.trackingCode !== null
          ? {
              trackingCode: order.trackingCode,
              trackingCodeNormalized: toCodeKey(order.trackingCode),
            }
          : {}),
        status: 'new',
        dataSource: 'user_entered',
        rev: 1,
        ...stamp,
      },
    },
    ...lines.map((line) => ({
      path: `${base}/lines/${line.id}`,
      data: {
        shopId: order.shopId,
        orderId: order.id,
        name: line.name,
        ...(line.variant !== null ? { variant: line.variant } : {}),
        quantity: line.quantity,
        position: line.position,
        dataSource: 'user_entered',
        ...stamp,
      },
    })),
    ...packages.map((pkg) => packageWrite(order, pkg, uid, v)),
  ];
}

/** Tài liệu kiện (Rules: `createdBy == auth.uid`, nên chỉ người tạo kiện mới đăng được). */
export function packageWrite(
  order: Pick<Order, 'id' | 'shopId'>,
  pkg: Pick<OrderPackage, 'id' | 'index'>,
  uid: string,
  v: RemoteValues,
): RemoteWrite {
  return {
    path: `shops/${order.shopId}/orders/${order.id}/packages/${pkg.id}`,
    data: {
      shopId: order.shopId,
      orderId: order.id,
      index: pkg.index,
      createdAt: v.serverTimestamp(),
      createdBy: uid,
    },
  };
}

/**
 * Tài liệu phiên khi TẠO: Rules chỉ cho tạo với `status: 'recording'` (phiên tạo trước khi quay, ảnh
 * chụp đơn bất biến). Trạng thái hiện tại khác `recording` thì đăng thêm bằng `sessionStatusUpdate`.
 *
 * Hai mốc thời gian KHÁC NHAU (bất biến 11): `startedAtDevice` là giờ THIẾT BỊ lúc bắt đầu quay (đáng
 * dùng làm mốc quay); `startedAtServer` (Rules ép `== request.time`) là giờ máy chủ NHẬN bản đăng,
 * có thể muộn hàng giờ nếu máy ngoại tuyến, nên KHÔNG dùng làm mốc quay (ADR-019, Q-23g).
 */
export function sessionWrite(
  session: PackingSession,
  uid: string,
  v: RemoteValues,
  appVersion?: string,
): RemoteWrite {
  const { snapshot } = session;
  return {
    path: `shops/${session.shopId}/sessions/${session.id}`,
    data: {
      shopId: session.shopId,
      kind: 'packing',
      orderId: session.orderId,
      packageId: session.packageId,
      orderSnapshot: {
        orderCode: snapshot.orderCode,
        source: toRemoteSource(snapshot.source),
        trackingCode: snapshot.trackingCode,
        lines: snapshot.lines.map((l) => ({
          name: l.name,
          variant: l.variant,
          quantity: l.quantity,
        })),
        packageIndex: snapshot.packageIndex,
        packageCount: snapshot.packageCount,
        takenAtDevice: snapshot.takenAtDevice,
      },
      status: 'recording',
      startedAtDevice: v.timestamp(session.startedAtDevice),
      startedAtServer: v.serverTimestamp(),
      createdBy: uid,
      ...(appVersion ? { appVersion } : {}),
    },
  };
}

/** Trạng thái phiên Rules cho phép đặt khi cập nhật. */
export const REMOTE_SESSION_STATUSES = [
  'recording',
  'ended',
  'interrupted',
  'confirmed',
  'needs_attention',
] as const;

export const isRemoteSessionStatus = (status: string): boolean =>
  (REMOTE_SESSION_STATUSES as readonly string[]).includes(status);
