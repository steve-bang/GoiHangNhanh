import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';

/**
 * Hồ sơ hàng hoàn (docs/02, docs/05): quá trình tiếp nhận, mở và kiểm tra MỘT kiện trả về. `id` là
 * định danh; `code` (RH-00001) chỉ để người dùng gọi tên hồ sơ; mã đơn/mã vận đơn không phải ID
 * (bất biến 1). Thời gian là thời gian THIẾT BỊ (hậu tố `Device`).
 *
 * Trạng thái hồ sơ (nghiệp vụ) TÁCH khỏi trạng thái bằng chứng/tệp (bất biến 3): hồ sơ có thể đã xác
 * nhận trong khi video mở kiện chưa có hoặc chưa tải lên.
 */
export type ReturnStatus = 'receiving' | 'opening' | 'checking' | 'confirmed';

/** Dấu hiệu quan sát được bên ngoài kiện (B03). Chỉ là quan sát, không phải kết luận nguyên nhân. */
export type ExteriorSign =
  'intact' | 'dented' | 'torn' | 'wet' | 'seal_abnormal' | 'label_unreadable' | 'other' | 'unknown';

export interface ReturnExterior {
  readonly signs: readonly ExteriorSign[];
  readonly note: string;
  readonly recordedAtDevice: number;
}

/** Ngoại lệ B04: kiện đã mở trước khi quay. Hồ sơ bị đánh dấu thiếu bằng chứng quá trình mở. */
export interface OpenedBefore {
  readonly reason: string;
  readonly markedAtDevice: number;
}

/** Vì sao hồ sơ chưa có video mở kiện. Không bao giờ tạo video thay thế (bất biến 6). */
export type MissingVideoReason =
  'recorder_unavailable' | 'opened_before_recording' | 'device_problem' | 'user_skipped';

/**
 * Trạng thái video mở kiện của hồ sơ; `null` = chưa đến bước này.
 * - `missing`: không có video, kèm lý do do người dùng chọn (không bao giờ tạo video thay thế, bất biến 6).
 * - `recorded` (R2b, Q-28): đã quay và lưu bền trên máy; `mediaId` là ID bản ghi `return_media` (gắn trước
 *   khi quay). Chỉ nói video ở TRÊN MÁY; trạng thái tải lên/xác minh lấy từ trạng thái tệp (bất biến 3), không
 *   nằm ở đây. `interrupted`: app bị đóng giữa lúc quay/lưu và chỉ cứu được phần đã ghi, nên KHÔNG được nhận
 *   là đầy đủ (A05); vẫn tính là hạn chế bằng chứng.
 */
export type OpeningVideo =
  | {
      readonly kind: 'missing';
      readonly reason: MissingVideoReason;
      readonly atDevice: number;
    }
  | {
      readonly kind: 'recorded';
      readonly mediaId: string;
      readonly atDevice: number;
      readonly interrupted: boolean;
    }
  | null;

/** Căn cứ một lần liên kết đơn gốc (docs/05 B02): luôn do người dùng xác nhận, không tự ghép. */
export type LinkBasis = 'code_match_confirmed' | 'chosen_from_candidates' | 'linked_later';

export interface ReturnLinkEvent {
  readonly id: string;
  readonly returnId: ReturnCaseId;
  readonly orderId: OrderId;
  readonly basis: LinkBasis;
  readonly atDevice: number;
  readonly by?: string;
}

export type LineCondition = 'normal' | 'damaged' | 'missing_accessory' | 'unknown';

/** Dòng dự kiến lấy từ đơn gốc tại lúc tiếp nhận: bản SAO, đơn sửa sau không làm đổi (docs/02). */
export interface ExpectedLine {
  readonly orderLineId: string;
  readonly name: string;
  readonly variant: string | null;
  readonly quantity: number;
}

/**
 * Hàng thực nhận (B06): bản ghi riêng, không ghi đè dữ liệu đóng gói. `receivedQuantity` `null` =
 * chưa nhập (không mặc định bằng số dự kiến). `expected` `null` = dòng ngoài dự kiến hoặc hồ sơ
 * chưa liên kết đơn ("Chưa có dữ liệu đối chiếu", KHÔNG phải số lượng dự kiến 0).
 */
export interface ReceivedLine {
  readonly id: string;
  readonly returnId: ReturnCaseId;
  readonly position: number;
  readonly name: string;
  readonly variant: string | null;
  readonly receivedQuantity: number | null;
  readonly condition: LineCondition | null;
  readonly note: string;
  readonly expected: ExpectedLine | null;
}

export type DiscrepancyKind =
  | 'missing'
  | 'excess'
  | 'wrong_item'
  | 'variant_differs'
  | 'damaged'
  | 'missing_accessory'
  | 'unknown'
  | 'other';

/** Sai lệch do NGƯỜI DÙNG ghi nhận (không tự kết luận nguyên nhân hay bên chịu trách nhiệm). */
export interface Discrepancy {
  readonly id: string;
  readonly returnId: ReturnCaseId;
  readonly lineId: string | null;
  readonly kind: DiscrepancyKind;
  readonly note: string;
  readonly atDevice: number;
  readonly by?: string;
}

export type ReturnEventKind =
  | 'created'
  | 'exterior_saved'
  | 'opened_before_marked'
  | 'opening_video_missing'
  | 'opening_video_recorded'
  | 'linked'
  | 'lines_saved'
  | 'confirmed'
  /** Xóa ảnh chụp nhầm (Q-26j): chỉ thời điểm + uid, KHÔNG ghi nội dung, đường dẫn hay mã băm. */
  | 'photo_deleted';

/** Lịch sử chỉ thêm (bất biến 7): không sửa, không xóa. */
export interface ReturnEvent {
  readonly id: string;
  readonly returnId: ReturnCaseId;
  readonly kind: ReturnEventKind;
  readonly atDevice: number;
  readonly by?: string;
}

export interface ReturnCase {
  readonly id: ReturnCaseId;
  readonly shopId: ShopId;
  /** Số thứ tự trong shop (tăng dần); hiển thị là `code`. */
  readonly seq: number;
  readonly code: string;
  readonly status: ReturnStatus;
  /** Đơn gốc đang liên kết; `null` = chưa liên kết (hồ sơ độc lập, không tự ghép). */
  readonly sourceOrderId: OrderId | null;
  /** Mã người dùng quét/nhập khi tìm đơn gốc (quan sát được, KHÔNG phải ID, không tự liên kết). */
  readonly observedCode: string | null;
  readonly exterior: ReturnExterior | null;
  readonly openedBefore: OpenedBefore | null;
  readonly openingVideo: OpeningVideo;
  readonly finalNote: string;
  readonly confirmedAtDevice: number | null;
  readonly createdAtDevice: number;
  readonly updatedAtDevice: number;
  readonly createdBy?: string;
}

export interface ReturnDetails {
  readonly returnCase: ReturnCase;
  readonly links: readonly ReturnLinkEvent[];
  readonly lines: readonly ReceivedLine[];
  readonly discrepancies: readonly Discrepancy[];
  readonly events: readonly ReturnEvent[];
}

/** Một dòng của danh sách (UI-D01): hồ sơ + số sai lệch đã ghi nhận. */
export interface ReturnSummary {
  readonly returnCase: ReturnCase;
  readonly discrepancyCount: number;
}
