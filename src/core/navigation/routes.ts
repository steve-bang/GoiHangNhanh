/**
 * Bảng route <-> mã màn hình giao diện `UI-xx` (docs/09 mục 4). Đây là NGUỒN DUY NHẤT cho đường
 * dẫn: màn hình điều hướng bằng `ROUTES.<tên>`, không rải chuỗi đường dẫn. Một test (routes.test.ts)
 * đối chiếu bảng này với các tệp thật trong `src/app` để hai nơi không lệch nhau.
 *
 * `tabBar`: thanh tab dưới có hiện không. Chỉ nhóm tab (Tổng quan, Đơn hàng, Hàng hoàn, Đồng bộ)
 * hiện thanh tab; màn quay (UI-C03, UI-D04) bắt buộc ẩn (docs/09 mục 2).
 *
 * Mã `UI-` là mã danh mục giao diện, KHÁC mã đặc tả quy trình A01-A08/B01-B08 (xem CLAUDE.md).
 */
export const UI_CODES = [
  'UI-A01',
  'UI-A02',
  'UI-A03',
  'UI-A04',
  'UI-A05',
  'UI-A06',
  'UI-A07',
  'UI-A08',
  'UI-A09',
  'UI-B01',
  'UI-B02',
  'UI-B03',
  'UI-B04',
  'UI-B05',
  'UI-C01',
  'UI-C02',
  'UI-C03',
  'UI-C04',
  'UI-C05',
  'UI-C06',
  'UI-D01',
  'UI-D02',
  'UI-D03',
  'UI-D04',
  'UI-D05',
  'UI-D06',
  'UI-D07',
  'UI-E01',
  'UI-E02',
  'UI-E03',
  'UI-E04',
  'UI-E05',
  'UI-F01',
  'UI-F02',
  'UI-F03',
  'UI-G01',
  'UI-G02',
  'UI-G03',
  'UI-G04',
  'UI-G05',
  'UI-H01',
  'UI-H02',
  'UI-H03',
  'UI-H04',
  'UI-I01',
  'UI-I02',
  'UI-I03',
  'UI-I04',
  'UI-I05',
  'UI-I06',
] as const;

export type UiCode = (typeof UI_CODES)[number];

export interface RouteDef {
  /** Đường dẫn expo-router (nhóm thư mục như `(tabs)` không xuất hiện trong URL). */
  readonly path: string;
  readonly code: UiCode;
  readonly tabBar: boolean;
}

const route = (path: string, code: UiCode, tabBar = false): RouteDef => ({ path, code, tabBar });

export const ROUTES = {
  // Nhóm A - khởi động và thiết lập. UI-A01 (Splash) tự chuyển theo phiên (Chào mừng / Tạo shop / Tổng quan).
  splash: route('/', 'UI-A01'),
  welcome: route('/welcome', 'UI-A02'),
  signIn: route('/sign-in', 'UI-A03'),
  // Biến thể đăng ký của UI-A03: dùng chung mã UI-A03 với /sign-in (một màn, hai chế độ).
  signUp: route('/sign-up', 'UI-A03'),
  createShop: route('/create-shop', 'UI-A04'),
  permissions: route('/permissions', 'UI-A05'),
  setupDone: route('/setup-done', 'UI-A06'),
  // Quên mật khẩu -> Nhập mã xác minh -> Mật khẩu mới (docs/09; chỉ vào được theo thứ tự này)
  forgotPassword: route('/forgot-password', 'UI-A07'),
  verifyOtp: route('/verify-otp', 'UI-A08'),
  newPassword: route('/new-password', 'UI-A09'),
  // Nhóm B + C01 - tab Tổng quan
  home: route('/home', 'UI-B01', true),
  scan: route('/home/scan', 'UI-B02', true),
  search: route('/home/search', 'UI-B03', true),
  quickOrder: route('/home/quick-order', 'UI-B04', true),
  batch: route('/home/batch', 'UI-B05', true),
  orderPreview: route('/home/order-preview', 'UI-C01', true),
  // Nhóm C - luồng quay (ngoài nhóm tab => ẩn thanh tab)
  packPrecheck: route('/pack-precheck', 'UI-C02'),
  packRecord: route('/record-pack', 'UI-C03'),
  packConfirm: route('/pack-confirm', 'UI-C04'),
  packSaved: route('/pack-saved', 'UI-C05'),
  packDone: route('/pack-done', 'UI-C06'),
  // Nhóm D - tab Hàng hoàn (riêng UI-D04 là màn quay, ẩn thanh tab)
  returns: route('/returns', 'UI-D01', true),
  returnFindOrder: route('/returns/find-order', 'UI-D02', true),
  returnExterior: route('/returns/package-exterior', 'UI-D03', true),
  returnRecord: route('/record-return', 'UI-D04'),
  returnItems: route('/returns/items-check', 'UI-D05', true),
  returnReview: route('/returns/review', 'UI-D06', true),
  returnDone: route('/returns/done', 'UI-D07', true),
  // Nhóm E - tab Đơn hàng
  orders: route('/orders', 'UI-E01', true),
  orderDetail: route('/orders/[orderId]', 'UI-E02', true),
  orderEvidence: route('/orders/[orderId]/evidence', 'UI-E03', true),
  evidenceDetail: route('/orders/[orderId]/evidence/[evidenceId]', 'UI-E04', true),
  orderHistory: route('/orders/[orderId]/history', 'UI-E05', true),
  // Nhóm F - tab Đồng bộ
  sync: route('/sync', 'UI-F01', true),
  syncError: route('/sync/[jobId]', 'UI-F02', true),
  storage: route('/sync/storage', 'UI-F03', true),
  // Nhóm G - tranh chấp: không phải tab (O-14), vào từ hồ sơ đơn/hàng hoàn/việc cần xử lý
  disputes: route('/disputes', 'UI-G01'),
  disputeNew: route('/disputes/new', 'UI-G02'),
  disputeSelectEvidence: route('/disputes/select-evidence', 'UI-G03'),
  disputeExport: route('/disputes/export', 'UI-G04'),
  disputeDetail: route('/disputes/[disputeId]', 'UI-G05'),
  // Nhóm H, I - mở từ menu tài khoản
  plan: route('/account/plan', 'UI-H01'),
  plans: route('/account/plans', 'UI-H02'),
  checkout: route('/account/checkout', 'UI-H03'),
  planLimit: route('/account/limit', 'UI-H04'),
  profile: route('/account', 'UI-I01'),
  shopSettings: route('/account/shop-settings', 'UI-I02'),
  members: route('/account/members', 'UI-I03'),
  notifications: route('/account/notifications', 'UI-I04'),
  security: route('/account/security', 'UI-I05'),
  help: route('/account/help', 'UI-I06'),
} as const;

export type RouteName = keyof typeof ROUTES;
