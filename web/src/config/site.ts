/**
 * Cấu hình site: MỘT nơi duy nhất cho tên thương hiệu, URL và liên kết cửa hàng.
 * Không viết cứng "Đơn Chứng" hay URL ở nơi khác (trừ nội dung bài viết tự do, nên dùng `site.name`).
 *
 * Mọi giá trị đánh dấu GIỮ CHỖ cần người dùng chốt trước khi lên production.
 */
export const site = {
  /** Tên làm việc; có thể đổi sau khi kiểm tra nhãn hiệu. */
  name: 'Đơn Chứng',
  /** Câu mô tả ngắn dùng cho meta mặc định và Organization. */
  tagline: 'Quản lý bằng chứng đóng hàng cho người bán online',
  /**
   * GIỮ CHỖ — CẦN ĐIỀN TRƯỚC KHI PHÁT HÀNH: tên miền chưa chốt (release-checklist D-4).
   * `.invalid` là tên miền dành riêng (RFC 2606), không bao giờ phân giải; app (`isPlaceholderLink`)
   * nhận diện nó là giữ chỗ và khóa liên kết. Giá trị này phải khớp `src/core/config/public-links.ts`.
   */
  url: 'https://don-chung.invalid',
  lang: 'vi',
  locale: 'vi_VN',
  /**
   * Cho phép công cụ tìm kiếm lập chỉ mục. `false` = mọi trang có `noindex`
   * và robots.txt chặn toàn bộ. Chỉ bật khi đã chốt tên miền, nội dung và hosting.
   */
  indexable: false,
  /** Ảnh chia sẻ mặc định (1200x630) trong public/. */
  ogImage: '/og-default.png',
  logo: '/logo-512.png',
  /**
   * Liên kết cửa hàng ứng dụng. `null` = chưa phát hành: nút hiện "Sắp có" và không có liên kết.
   * GIỮ CHỖ: điền URL thật khi ứng dụng lên App Store / Google Play.
   */
  stores: {
    appStore: { label: 'App Store', url: null as string | null },
    googlePlay: { label: 'Google Play', url: null as string | null },
  },
  /**
   * Thông tin pháp lý và liên hệ dùng ở trang Quyền riêng tư, Điều khoản, Hỗ trợ, Xóa tài khoản.
   * GIỮ CHỖ — CẦN ĐIỀN TRƯỚC KHI PHÁT HÀNH (release-checklist D-4, C-2). `null` = chưa có giá trị thật:
   * trang hiện câu "sẽ công bố" thay vì một địa chỉ giả. `npm run check:seo` báo lỗi nếu bật
   * `indexable` mà còn giá trị `null`. Không điền email/địa chỉ đoán.
   */
  legal: {
    /** Email nhận hỗ trợ và yêu cầu xóa tài khoản. Phải khớp `SUPPORT_EMAIL` của app. */
    supportEmail: null as string | null,
    /** Tên cá nhân/tổ chức chịu trách nhiệm vận hành ứng dụng (bên kiểm soát dữ liệu). */
    operatorName: null as string | null,
    /** Địa chỉ liên hệ của bên vận hành. */
    operatorAddress: null as string | null,
    /** Ngày hiệu lực hiển thị trên các trang pháp lý (YYYY-MM-DD). Cập nhật khi đăng bản đã rà pháp lý. */
    effectiveDate: '2026-10-30',
    /** Số ngày làm việc để trả lời yêu cầu xóa qua email. Đề xuất, chờ duyệt ở checklist C-2. */
    emailRequestDays: 7,
    /** Số ngày trước khi xóa hẳn dữ liệu cửa hàng trên máy chủ (R-4; khớp Function purgeDeletedShops). */
    purgeAfterDays: 30,
  },
  /**
   * Đường dẫn các trang pháp lý/hỗ trợ (URL tiếng Việt không dấu, ổn định: app và store trỏ tới).
   * Đổi đường dẫn = đổi URL đã khai báo với store: không đổi khi đã phát hành.
   */
  legalPages: {
    privacy: '/chinh-sach-quyen-rieng-tu/',
    terms: '/dieu-khoan/',
    support: '/ho-tro/',
    accountDeletionRequest: '/xoa-tai-khoan/',
  },
} as const;

/**
 * URL tuyệt đối công khai cho app (V1-18 `src/core/config/public-links.ts`) và khai báo store.
 * Test tooling của app so từng giá trị với hàm này.
 */
export function publicLinks() {
  const abs = (path: string) => new URL(path, site.url).toString();
  return {
    privacy: abs(site.legalPages.privacy),
    terms: abs(site.legalPages.terms),
    support: abs(site.legalPages.support),
    accountDeletionRequest: abs(site.legalPages.accountDeletionRequest),
    supportEmail: site.legal.supportEmail,
  };
}

export type Site = typeof site;
