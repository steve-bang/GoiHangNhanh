import {
  borderWidthScale,
  elevationScale,
  iconSizeScale,
  opacityScale,
  palette,
} from './primitives';
import { radius, spacing, typography } from './typography';

/**
 * Tầng 2 - vai trò trong giao diện (docs/design-token-spec.md mục 4.3-4.4). Mọi giá trị là THAM
 * CHIẾU tới `primitives`, không viết lại hex. Component trong app đọc qua `useTheme().tokens`.
 * Đặt tên theo vai trò, không theo màn hình.
 */
const color = {
  text: {
    primary: palette.neutral[900],
    secondary: palette.neutral[600],
    /** Chữ cấp ba (gợi ý trong ô nhập, ghi chú phụ). Không dùng cho thông tin cần hành động. */
    tertiary: palette.neutral[500],
    /** Chữ trên điều khiển bị vô hiệu hóa (WCAG miễn trừ độ tương phản; luôn kèm trạng thái `disabled`). */
    disabled: palette.neutral[400],
    onAction: palette.neutral[0],
    /** Chữ phụ trên nền thương hiệu đậm (thẻ hero): mờ hơn `onAction` nhưng vẫn >= 4.5:1. */
    onBrandMuted: palette.alpha.white75,
    /** Nhóm màn form (mockup 03). Nợ TD-1: hợp nhất với primary/secondary sau khi duyệt trực quan. */
    strong: palette.slate[900],
    subtle: palette.slate[500],
  },
  surface: {
    screen: palette.neutral[50],
    raised: palette.neutral[0],
    muted: palette.neutral[100],
    /** Lớp nổi trên nội dung (bottom sheet, hộp thoại). Hôm nay trắng như `raised`; tách tên để chế độ tối đặt sáng hơn. */
    elevated: palette.neutral[0],
  },
  border: {
    default: palette.neutral[300],
    field: palette.mint[200],
    /** Đường kẻ phân nhóm nhẹ trong thẻ/danh sách. */
    subtle: palette.neutral[200],
    /** Ranh giới điều khiển cần thấy rõ (hộp kiểm, nút chọn): >= 3:1 trên nền trắng. */
    strong: palette.neutral[400],
  },
  action: {
    primary: palette.jade[700],
    /** Trạng thái đang nhấn của nút chính (đậm hơn `primary`, vẫn đạt 4.5:1 với chữ trắng). */
    primaryPressed: palette.jade[800],
    destructive: palette.red[700],
    /** Nền điều khiển bị vô hiệu hóa (khi không dùng độ mờ); chữ tương ứng là `text.disabled`. */
    disabled: palette.neutral[200],
  },
  brand: { soft: palette.jade[100], deep: palette.jade[950] },
  /** Tông xanh dương dùng làm điểm nhấn (ô icon cửa hàng, đám mây); không phải màu trạng thái. */
  accent: { blue: { fg: palette.blue[700], bg: palette.blue[50] } },
  feedback: {
    success: { fg: palette.green[700], bg: palette.green[100] },
    warning: { fg: palette.amber[700], bg: palette.amber[50] },
    danger: { fg: palette.red[700], bg: palette.red[50] },
    /** Chưa có `fg` riêng cho info (nợ TD-2). */
    info: { bg: palette.teal[50] },
  },
  overlay: { scrim: palette.alpha.black50 },
  /** Cố định, không đổi theo sáng/tối: nằm trên khung hình camera. */
  camera: {
    background: palette.camera[900],
    onCamera: palette.neutral[0],
    onCameraMuted: palette.alpha.white75,
    control: palette.alpha.black55,
    scanAccent: palette.scan[400],
    /** Chấm "đang ghi hình": NGOẠI LỆ được chấp thuận của quy tắc "đỏ chỉ cho lỗi/phá hủy" (docs/09 mục 3, D-18). Luôn đi kèm chữ + đồng hồ. */
    recordingIndicator: palette.red[700],
  },
} as const;

/**
 * Màu theo TRẠNG THÁI NGHIỆP VỤ của bằng chứng (docs/09 mục 3). Mỗi nhãn có bộ riêng, dù một số
 * hôm nay trùng giá trị (uploaded/verified): đổi một trạng thái không kéo theo trạng thái khác.
 * `border` bằng `fg` như giao diện hiện tại.
 */
const status = {
  savedOnDevice: { fg: palette.neutral[600], bg: palette.neutral[0], border: palette.neutral[600] },
  waitingUpload: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  uploading: { fg: palette.jade[700], bg: palette.jade[100], border: palette.jade[700] },
  uploaded: { fg: palette.green[700], bg: palette.green[100], border: palette.green[700] },
  verified: { fg: palette.green[700], bg: palette.green[100], border: palette.green[700] },
  error: { fg: palette.red[700], bg: palette.red[50], border: palette.red[700] },
  /**
   * Trạng thái vận hành của phiên quay và đồng bộ (không phải 6 nhãn bằng chứng của docs/09 mục 3).
   * Mỗi trạng thái có bộ riêng dù có giá trị trùng nhau hôm nay. Màu không bao giờ là tín hiệu duy nhất:
   * luôn đi kèm chữ + biểu tượng.
   * - `recording`: NGOẠI LỆ "đỏ" như `camera.recordingIndicator` (D-18), luôn kèm chữ "Đang ghi" + đồng hồ.
   * - `interrupted`: phiên quay bị cắt (cuộc gọi, hết bộ nhớ, app bị đóng): cam, vì có nguy cơ thiếu hình.
   * - `retrying`: đang thử tải lại sau lỗi tạm: xanh dương (thông tin), không phải lỗi.
   * - `offline`: không có mạng: cam, vì dữ liệu vẫn nằm an toàn trên máy (không phải lỗi mất dữ liệu).
   * - `syncPending` / `synced`: hàng đợi đồng bộ còn việc / đã đối soát xong với máy chủ.
   */
  recording: { fg: palette.red[700], bg: palette.red[50], border: palette.red[700] },
  interrupted: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  retrying: { fg: palette.blue[700], bg: palette.blue[50], border: palette.blue[700] },
  offline: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  syncPending: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  synced: { fg: palette.green[700], bg: palette.green[100], border: palette.green[700] },
} as const;

export const semantic = {
  color,
  status,
  space: spacing,
  radius,
  icon: iconSizeScale,
  borderWidth: borderWidthScale,
  opacity: opacityScale,
  elevation: elevationScale,
  type: typography,
} as const;

export type Semantic = typeof semantic;
export type StatusTokenKey = keyof typeof status;
