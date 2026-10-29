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
  /** GIỮ CHỖ: tên miền chưa chốt. `.example` là tên miền dành riêng, không phải site thật. */
  url: 'https://doncung.example',
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
  /** Chưa có địa chỉ liên hệ thật; không đặt email giả. */
  contactEmail: null as string | null,
} as const;

export type Site = typeof site;
