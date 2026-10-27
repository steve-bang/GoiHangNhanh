import { borderWidthScale, elevationScale, opacityScale, palette } from './primitives';
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
    onAction: palette.neutral[0],
    /** Nhóm màn form (mockup 03). Nợ TD-1: hợp nhất với primary/secondary sau khi duyệt trực quan. */
    strong: palette.slate[900],
    subtle: palette.slate[500],
  },
  surface: {
    screen: palette.neutral[50],
    raised: palette.neutral[0],
    muted: palette.neutral[100],
  },
  border: {
    default: palette.neutral[300],
    field: palette.mint[200],
  },
  action: {
    primary: palette.jade[700],
    destructive: palette.red[700],
  },
  brand: { soft: palette.jade[100], deep: palette.jade[950] },
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
} as const;

export const semantic = {
  color,
  status,
  space: spacing,
  radius,
  borderWidth: borderWidthScale,
  opacity: opacityScale,
  elevation: elevationScale,
  type: typography,
} as const;

export type Semantic = typeof semantic;
export type StatusTokenKey = keyof typeof status;
