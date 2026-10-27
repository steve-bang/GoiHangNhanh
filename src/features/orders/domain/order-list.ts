import type { OrderId, PackageId, SessionId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';

import { toCodeKey } from './codes';
import type { Order, PackingSession } from './types';

/** Số thẻ mỗi trang của danh sách đơn. */
export const ORDER_LIST_PAGE_SIZE = 20;

/** Khoảng thời gian TẠO ĐƠN (thời gian thiết bị). "Tùy chọn" chưa làm (decisions.md Q-18). */
export type PeriodFilter = 'today' | 'last7days' | 'last30days';
export type DeclarationFilter = 'declared' | 'undeclared';

/**
 * Chip trạng thái của danh sách. P1 chỉ có hai chip: các chip trạng thái bằng chứng khác (6 nhãn
 * docs/09 mục 3) thêm vào đây khi đã có nguồn bằng chứng thật; không hiện chip lọc ra rỗng.
 */
export const STATUS_CHIPS = ['all', 'no_video'] as const;
export type StatusChip = (typeof STATUS_CHIPS)[number];

/** Bộ lọc người dùng đang chọn trên màn danh sách (giữ nguyên khi vào chi tiết rồi quay lại). */
export interface OrderListFilters {
  /** Từ khóa người dùng gõ (chưa chuẩn hóa). */
  readonly search: string;
  readonly status: StatusChip;
  readonly period: PeriodFilter | null;
  readonly source: OrderSource | null;
  readonly declaration: DeclarationFilter | null;
}

export const EMPTY_FILTERS: OrderListFilters = {
  search: '',
  status: 'all',
  period: null,
  source: null,
  declaration: null,
};

/** Số bộ lọc nâng cao đang bật (chỉ để hiện số trên nút Bộ lọc; không tính từ khóa và chip). */
export function countAdvancedFilters(filters: OrderListFilters): number {
  return [filters.period, filters.source, filters.declaration].filter((v) => v !== null).length;
}

/** Có bộ lọc/từ khóa nào đang bật không (để phân biệt "Không có kết quả" với "Chưa có đơn nào"). */
export function hasActiveFilters(filters: OrderListFilters): boolean {
  return (
    toCodeKey(filters.search) !== '' ||
    filters.status !== 'all' ||
    countAdvancedFilters(filters) > 0
  );
}

/**
 * Truy vấn gửi cho kho. Không có trường nào tức là không lọc theo trường đó. `searchKey` đã qua
 * `toCodeKey` (cùng cách chuẩn hóa với lúc lưu `order_code_key`/`tracking_code_key`).
 */
export interface OrderListQuery {
  readonly searchKey?: string;
  readonly source?: OrderSource;
  /** Chỉ đơn tạo từ mốc này (ms, thời gian thiết bị) trở đi. */
  readonly createdSinceDevice?: number;
  readonly declaration?: DeclarationFilter;
  /**
   * Chỉ đơn chưa có video. Hôm nay chưa có bảng bằng chứng nên MỌI đơn đều "chưa có video" (phiên
   * `created` không phải bằng chứng; bất biến 3). Khi có bằng chứng thật, kho phải thêm điều kiện
   * thật cho cờ này và hợp đồng kho phải có test tương ứng.
   */
  readonly withoutVideo?: true;
}

/** Đầu ngày (giờ máy) của ngày `daysAgo` ngày trước `nowDevice`. */
function startOfDay(nowDevice: number, daysAgo: number): number {
  const d = new Date(nowDevice);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.getTime();
}

/**
 * Mốc bắt đầu của khoảng thời gian, tính theo NGÀY LỊCH giờ máy và gồm cả hôm nay: "Hôm nay" từ 0h
 * hôm nay; "7 ngày qua" từ 0h của 6 ngày trước; "30 ngày qua" từ 0h của 29 ngày trước.
 */
export function periodStart(period: PeriodFilter, nowDevice: number): number {
  switch (period) {
    case 'today':
      return startOfDay(nowDevice, 0);
    case 'last7days':
      return startOfDay(nowDevice, 6);
    case 'last30days':
      return startOfDay(nowDevice, 29);
  }
}

/** Bộ lọc người dùng -> truy vấn kho. Từ khóa chỉ gồm khoảng trắng thì coi như không tìm. */
export function toListQuery(filters: OrderListFilters, nowDevice: number): OrderListQuery {
  const searchKey = toCodeKey(filters.search);
  return {
    ...(searchKey !== '' ? { searchKey } : {}),
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.period ? { createdSinceDevice: periodStart(filters.period, nowDevice) } : {}),
    ...(filters.declaration ? { declaration: filters.declaration } : {}),
    ...(filters.status === 'no_video' ? { withoutVideo: true as const } : {}),
  };
}

/** Phiên đang thực hiện của đơn (để thẻ "Quay ngay" mở lại thay vì tạo phiên chồng). */
export interface ActiveSessionRef {
  readonly id: SessionId;
  readonly packageId: PackageId;
}

/** Dữ liệu một thẻ trong danh sách đơn. Mã đơn/mã vận đơn chỉ là thuộc tính; `order.id` mới là định danh. */
export interface OrderListItem {
  readonly order: Order;
  /** Dòng sản phẩm đầu tiên theo thứ tự nhập (null nếu chưa khai báo). Variant không gộp vào tên. */
  readonly firstLine: {
    readonly name: string;
    readonly variant: string | null;
    readonly quantity: number;
  } | null;
  readonly lineCount: number;
  readonly activeSession: ActiveSessionRef | null;
  /** MAX(thời điểm tạo đơn, mốc phiên mới nhất): khóa sắp xếp mặc định (thời gian thiết bị). */
  readonly lastActivityDevice: number;
}

/** Con trỏ keyset: vị trí của thẻ cuối trang trước. Không dùng offset nên đơn mới chèn vào không làm trùng thẻ. */
export interface OrderListCursor {
  readonly lastActivityDevice: number;
  readonly orderId: OrderId;
}

export interface OrderListPage {
  readonly items: readonly OrderListItem[];
  /** null khi đã hết. */
  readonly nextCursor: OrderListCursor | null;
}

export interface OrderListPageRequest {
  readonly limit: number;
  readonly after?: OrderListCursor;
}

/** Mốc hoạt động gần nhất của đơn từ thời điểm tạo và các phiên của nó. */
export function lastActivityOf(
  order: Pick<Order, 'createdAtDevice'>,
  sessions: readonly Pick<PackingSession, 'startedAtDevice'>[],
): number {
  return sessions.reduce((max, s) => Math.max(max, s.startedAtDevice), order.createdAtDevice);
}

/** Thứ tự danh sách: hoạt động gần nhất trước, `id` giảm dần làm khóa phụ ổn định. */
export function compareListItems(
  a: Pick<OrderListItem, 'lastActivityDevice'> & { order: Pick<Order, 'id'> },
  b: Pick<OrderListItem, 'lastActivityDevice'> & { order: Pick<Order, 'id'> },
): number {
  if (a.lastActivityDevice !== b.lastActivityDevice) {
    return b.lastActivityDevice - a.lastActivityDevice;
  }
  return a.order.id < b.order.id ? 1 : a.order.id > b.order.id ? -1 : 0;
}

/** Thẻ nằm SAU con trỏ theo thứ tự danh sách. */
export function isAfterCursor(
  item: Pick<OrderListItem, 'lastActivityDevice'> & { order: Pick<Order, 'id'> },
  cursor: OrderListCursor,
): boolean {
  return (
    item.lastActivityDevice < cursor.lastActivityDevice ||
    (item.lastActivityDevice === cursor.lastActivityDevice && item.order.id < cursor.orderId)
  );
}

/**
 * Đơn có khớp truy vấn không (dùng cho kho bộ nhớ; kho SQLite viết lại bằng SQL và hợp đồng kho
 * chạy cùng một bộ test cho cả hai). Tìm theo chuỗi con của khóa mã đơn hoặc khóa mã vận đơn.
 */
export function matchesListQuery(order: Order, lineCount: number, query: OrderListQuery): boolean {
  if (query.searchKey !== undefined && query.searchKey !== '') {
    const inCode = toCodeKey(order.orderCode).includes(query.searchKey);
    const inTracking =
      order.trackingCode !== null && toCodeKey(order.trackingCode).includes(query.searchKey);
    if (!inCode && !inTracking) return false;
  }
  if (query.source !== undefined && order.source !== query.source) return false;
  if (query.createdSinceDevice !== undefined && order.createdAtDevice < query.createdSinceDevice) {
    return false;
  }
  if (query.declaration === 'declared' && lineCount === 0) return false;
  if (query.declaration === 'undeclared' && lineCount > 0) return false;
  return true;
}
