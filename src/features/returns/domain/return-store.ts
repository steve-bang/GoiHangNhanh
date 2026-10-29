import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import type { FileEvent } from '@/features/evidence';

import type { MediaEventResult, NewReturnMedia, ReturnMedia, ReturnMediaPatch } from './media';

import type {
  Discrepancy,
  ExpectedLine,
  LineCondition,
  LinkBasis,
  MissingVideoReason,
  OpenedBefore,
  ReturnDetails,
  ReturnExterior,
  ReturnSummary,
} from './types';

/** Dòng nhận về cần lưu: ID do bên gọi sinh trước; `expected` là bản sao dòng của đơn gốc (nếu có). */
export interface NewReceivedLine {
  readonly id: string;
  readonly name: string;
  readonly variant: string | null;
  readonly receivedQuantity: number | null;
  readonly condition: LineCondition | null;
  readonly note: string;
  readonly expected: ExpectedLine | null;
}

export interface NewDiscrepancy {
  readonly id: string;
  /** ID dòng (trong cùng lần lưu) mà sai lệch thuộc về; `null` = sai lệch chung của hồ sơ. */
  readonly lineId: string | null;
  readonly kind: Discrepancy['kind'];
  readonly note: string;
}

export interface LinkInput {
  readonly linkId: string;
  readonly orderId: OrderId;
  readonly basis: LinkBasis;
}

export interface NewReturnInput {
  readonly id: ReturnCaseId;
  readonly shopId: ShopId;
  readonly atDevice: number;
  readonly eventId: string;
  readonly observedCode: string | null;
  /** Liên kết đơn gốc ngay khi tạo (người dùng đã xác nhận ở B02); `null` = hồ sơ chưa liên kết. */
  readonly link: LinkInput | null;
  /** Dòng dự kiến nạp sẵn từ đơn gốc (số lượng thực nhận để trống). Rỗng nếu chưa liên kết. */
  readonly lines: readonly NewReceivedLine[];
}

/**
 * Cổng lưu hồ sơ hàng hoàn cục bộ (SQLite trên máy, bản bộ nhớ cho test/web). Mọi thao tác nhận
 * `shopId` và chỉ thấy bản ghi của shop đó (bất biến 8). Lỗi ném `AppError`: `RETURN_SAVE_FAILED`
 * khi không lưu/đọc được; `RETURN_ALREADY_CONFIRMED` khi sửa hồ sơ đã xác nhận (chỉ được liên kết
 * đơn gốc sau, có lịch sử); `RETURN_ORDER_CONFLICT` khi liên kết lại hồ sơ đã có đơn gốc.
 * Mọi thay đổi thêm một dòng lịch sử (chỉ thêm, bất biến 7).
 */
export interface ReturnStore {
  /** Tạo hồ sơ (+ liên kết đơn gốc, + dòng dự kiến) trong MỘT giao dịch; cấp số thứ tự/mã của shop. */
  createReturn(input: NewReturnInput): Promise<ReturnDetails>;
  getReturn(shopId: ShopId, id: ReturnCaseId): Promise<ReturnDetails | null>;
  /** Mới cập nhật trước, tối đa `limit` hồ sơ. */
  listReturns(shopId: ShopId, limit: number): Promise<ReturnSummary[]>;
  /**
   * Hồ sơ của shop đã liên kết `orderId` hoặc có mã quan sát khớp `observedCodeKey` (khóa chuẩn hóa
   * `toCodeKey`). Để cảnh báo trùng (`RETURN_CODE_DUPLICATE`), không chọn hộ.
   */
  findReturns(
    shopId: ShopId,
    query: { orderId?: OrderId; observedCodeKey?: string },
  ): Promise<ReturnSummary[]>;
  /**
   * Lưu tình trạng bên ngoài (B03) và ngoại lệ "kiện đã mở trước khi quay" (B04). Hồ sơ `receiving`
   * chuyển `opening`; hồ sơ đã qua bước này giữ trạng thái. Đã xác nhận thì ném `RETURN_ALREADY_CONFIRMED`.
   */
  saveExterior(
    shopId: ShopId,
    id: ReturnCaseId,
    input: {
      exterior: ReturnExterior;
      openedBefore: OpenedBefore | null;
      eventId: string;
      openedEventId: string;
    },
  ): Promise<ReturnDetails>;
  /** Ghi nhận hồ sơ KHÔNG có video mở kiện (và lý do), chuyển sang `checking`. */
  saveOpeningVideoMissing(
    shopId: ShopId,
    id: ReturnCaseId,
    input: { reason: MissingVideoReason; atDevice: number; eventId: string },
  ): Promise<ReturnDetails>;
  /**
   * Thay TOÀN BỘ hàng thực nhận và sai lệch (một giao dịch). Dữ liệu dự kiến trong dòng là bản sao,
   * không đổi theo đơn gốc. Hồ sơ `opening`/`checking` chuyển/giữ `checking`; `receiving` hoặc đã xác
   * nhận thì ném lỗi (`RETURN_SAVE_FAILED` / `RETURN_ALREADY_CONFIRMED`).
   */
  saveLines(
    shopId: ShopId,
    id: ReturnCaseId,
    input: {
      lines: readonly NewReceivedLine[];
      discrepancies: readonly NewDiscrepancy[];
      atDevice: number;
      eventId: string;
    },
  ): Promise<ReturnDetails>;
  /** Xác nhận hồ sơ (kiểm kê xong). Chỉ từ `checking` và có ít nhất một dòng. KHÔNG phải kết luận tranh chấp. */
  confirmReturn(
    shopId: ShopId,
    id: ReturnCaseId,
    input: { finalNote: string; atDevice: number; eventId: string },
  ): Promise<ReturnDetails>;
  /**
   * Liên kết đơn gốc SAU (B02): chỉ khi hồ sơ chưa có đơn gốc (đã có thì ném `RETURN_ORDER_CONFLICT`,
   * không ghi đè quan hệ cũ). Được phép cả khi đã xác nhận. Hồ sơ chưa có dòng nào thì nạp
   * `expectedLines` làm dòng dự kiến; hồ sơ đã có dòng thì giữ nguyên dòng (không đổi âm thầm).
   */
  linkSourceOrder(
    shopId: ShopId,
    id: ReturnCaseId,
    input: LinkInput & {
      atDevice: number;
      eventId: string;
      expectedLines: readonly NewReceivedLine[];
    },
  ): Promise<ReturnDetails>;
  /**
   * Tạo bản ghi ảnh ở `recording` TRƯỚC khi chụp (bất biến 2). Hồ sơ phải tồn tại cùng shop; đã xác nhận
   * thì ném `RETURN_ALREADY_CONFIRMED`. Cùng `id` đã có thì trả bản cũ (thử lại an toàn).
   */
  createMedia(input: NewReturnMedia): Promise<ReturnMedia>;
  /** Áp sự kiện tệp qua máy trạng thái; lỗi nghiệp vụ trả `ok: false`, lỗi lưu ném `RETURN_SAVE_FAILED`. */
  applyMediaEvent(
    shopId: ShopId,
    id: string,
    event: FileEvent,
    atDevice: number,
    patch?: ReturnMediaPatch,
  ): Promise<MediaEventResult>;
  /** Ảnh/video của hồ sơ, cũ nhất trước. Chỉ thêm, không xóa (bản gốc bất biến). */
  listMedia(shopId: ShopId, returnId: ReturnCaseId): Promise<readonly ReturnMedia[]>;
}
