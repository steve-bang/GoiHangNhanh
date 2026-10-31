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
    primary: palette.stone[900],
    secondary: palette.stone[500],
    /** Chữ cấp ba (gợi ý trong ô nhập, ghi chú phụ). Hôm nay cùng giá trị `secondary` (đã sát ngưỡng 4.5:1 nên không nhạt thêm). */
    tertiary: palette.stone[500],
    /** Chữ trên điều khiển bị vô hiệu hóa (WCAG miễn trừ độ tương phản; luôn kèm trạng thái `disabled`). */
    disabled: palette.stone[400],
    onAction: palette.neutral[0],
    /** Chữ phụ trên nền thương hiệu đậm (thẻ hero): mờ hơn `onAction` nhưng vẫn >= 4.5:1. */
    onBrandMuted: palette.alpha.white75,
    /** Nhóm màn form (mockup 03). Nợ TD-1: hợp nhất với primary/secondary sau khi duyệt trực quan. */
    strong: palette.stone[900],
    subtle: palette.stone[500],
  },
  surface: {
    screen: palette.stone[25],
    raised: palette.neutral[0],
    /** Khối nhấn rất nhẹ (ô chưa chọn, khối gợi ý, ô icon trung tính): `surface.secondary` của Bright Orange. */
    muted: palette.stone[50],
    /** Lớp nổi trên nội dung (bottom sheet, hộp thoại). Hôm nay trắng như `raised`; tách tên để chế độ tối đặt sáng hơn. */
    elevated: palette.neutral[0],
  },
  border: {
    default: palette.stone[200],
    /** Viền ô nhập (nhóm form); đậm hơn `default` để ô nhập thấy rõ trên nền màn. */
    field: palette.stone[300],
    /** Đường kẻ phân nhóm nhẹ trong thẻ/danh sách. */
    subtle: palette.stone[200],
    /** Ranh giới điều khiển cần thấy rõ (hộp kiểm, nút chọn): >= 3:1 trên nền trắng. */
    strong: palette.stone[400],
  },
  action: {
    /**
     * Nền nút chính và màu liên kết: cam `orange.700` (chữ trắng trên nó 4.57:1). Màu nhận diện sáng
     * hơn `brand.primary` dành cho biểu tượng và đồ họa, nơi 3:1 là đủ.
     */
    primary: palette.orange[700],
    /** Trạng thái đang nhấn của nút chính (đậm hơn `primary`; trắng trên nó 6.5:1). */
    primaryPressed: palette.orange[800],
    /** Chữ liên kết/nút văn bản trên nền màn, nền trắng và nền cam nhạt (>= 4.5:1 trên cả ba). */
    link: palette.orange[800],
    destructive: palette.ember[700],
    /** Nền điều khiển bị vô hiệu hóa (khi không dùng độ mờ); chữ tương ứng là `text.disabled`. */
    disabled: palette.stone[200],
  },
  /**
   * Bright Orange. `primary` là màu nhận diện (biểu tượng, nút Quét, thanh tiến độ, tab đang chọn: đồ
   * họa, >= 3:1 trên trắng). Không dùng `primary`/`hover` làm nền chữ trắng cỡ thường (3.66:1).
   * `soft`/`softStrong` chỉ để nhấn vùng nhỏ (chip đang chọn, ô icon), không tô cả thẻ hay màn.
   */
  brand: {
    primary: palette.orange[600],
    hover: palette.orange[500],
    pressed: palette.orange[700],
    soft: palette.orange[50],
    softStrong: palette.orange[100],
    /** Chữ/biểu tượng cam trên `soft`/`softStrong`. */
    onSoft: palette.orange[800],
    deep: palette.orange[900],
  },
  /** Tông xanh dương dùng làm điểm nhấn (ô icon cửa hàng, đám mây); không phải màu trạng thái. */
  accent: { blue: { fg: palette.blue[700], bg: palette.blue[50] } },
  /**
   * Hình minh họa trang trí (Chào mừng, Đăng nhập, Thiết lập xong): hộp carton giữ màu bìa thật để
   * đọc ra là "hộp hàng". Không dùng cho chữ, viền điều khiển hay trạng thái.
   */
  illustration: { carton: palette.kraft[300], cartonShade: palette.kraft[500] },
  feedback: {
    success: { fg: palette.leaf[700], bg: palette.leaf[100] },
    warning: { fg: palette.amber[700], bg: palette.amber[50] },
    danger: { fg: palette.ember[700], bg: palette.ember[100] },
    info: { fg: palette.sky[700], bg: palette.sky[50] },
  },
  overlay: { scrim: palette.alpha.black50 },
  /** Cố định, không đổi theo sáng/tối: nằm trên khung hình camera. */
  camera: {
    background: palette.camera[900],
    onCamera: palette.neutral[0],
    onCameraMuted: palette.alpha.white75,
    control: palette.alpha.black55,
    /** Khung và chữ quét trên nền camera tối: cam sáng (6:1 trên nền camera), cùng nhận diện với nút Quét. */
    scanAccent: palette.orange[500],
    /** Chấm "đang ghi hình": NGOẠI LỆ được chấp thuận của quy tắc "đỏ chỉ cho lỗi/phá hủy" (docs/09 mục 3, D-18). Luôn đi kèm chữ + đồng hồ. */
    recordingIndicator: palette.ember[700],
  },
} as const;

/**
 * Màu theo TRẠNG THÁI NGHIỆP VỤ của bằng chứng (docs/09 mục 3). Mỗi nhãn có bộ riêng, dù một số
 * hôm nay trùng giá trị (uploaded/verified): đổi một trạng thái không kéo theo trạng thái khác.
 * `border` bằng `fg` như giao diện hiện tại.
 */
const status = {
  savedOnDevice: { fg: palette.stone[500], bg: palette.neutral[0], border: palette.stone[500] },
  waitingUpload: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  /** Đang tải: xanh dương (thông tin). Cam là màu thương hiệu nên KHÔNG dùng cho trạng thái nghiệp vụ. */
  uploading: { fg: palette.sky[700], bg: palette.sky[100], border: palette.sky[700] },
  uploaded: { fg: palette.leaf[700], bg: palette.leaf[100], border: palette.leaf[700] },
  verified: { fg: palette.leaf[700], bg: palette.leaf[100], border: palette.leaf[700] },
  error: { fg: palette.ember[700], bg: palette.ember[100], border: palette.ember[700] },
  /**
   * Trạng thái vận hành của phiên quay và đồng bộ (không phải 6 nhãn bằng chứng của docs/09 mục 3).
   * Mỗi trạng thái có bộ riêng dù có giá trị trùng nhau hôm nay. Màu không bao giờ là tín hiệu duy nhất:
   * luôn đi kèm chữ + biểu tượng.
   * - `recording`: NGOẠI LỆ "đỏ" như `camera.recordingIndicator` (D-18), luôn kèm chữ "Đang ghi" + đồng hồ.
   * - `interrupted`: phiên quay bị cắt (cuộc gọi, hết bộ nhớ, app bị đóng): vàng cam, vì có nguy cơ thiếu hình.
   * - `retrying`: đang thử tải lại sau lỗi tạm: xanh dương (thông tin), không phải lỗi.
   * - `offline`: không có mạng: vàng cam, vì dữ liệu vẫn nằm an toàn trên máy (không phải lỗi mất dữ liệu).
   * - `syncPending` / `synced`: hàng đợi đồng bộ còn việc / đã đối soát xong với máy chủ.
   */
  recording: { fg: palette.ember[700], bg: palette.ember[100], border: palette.ember[700] },
  interrupted: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  retrying: { fg: palette.sky[700], bg: palette.sky[100], border: palette.sky[700] },
  offline: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  syncPending: { fg: palette.amber[700], bg: palette.amber[50], border: palette.amber[700] },
  synced: { fg: palette.leaf[700], bg: palette.leaf[100], border: palette.leaf[700] },
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
