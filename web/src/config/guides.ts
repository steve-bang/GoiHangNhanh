/**
 * Danh sách hướng dẫn: MỘT nơi cho trang chỉ mục và liên kết Trước/Sau.
 * Nhãn nút trong ngoặc kép lấy từ chuỗi giao diện thật (src/core/i18n/locales/vi). Đổi chuỗi app thì rà lại ở đây
 * (release-checklist C-1, C-6).
 */
export interface Guide {
  slug: string;
  title: string;
  summary: string;
}

export const guides: readonly Guide[] = [
  {
    slug: 'bat-dau',
    title: 'Bắt đầu: tạo tài khoản và cửa hàng',
    summary: 'Đăng ký bằng email, tạo cửa hàng, cho phép camera và quên mật khẩu.',
  },
  {
    slug: 'quay-video-dong-hang',
    title: 'Quay video đóng hàng',
    summary: 'Quét hoặc nhập mã đơn, kiểm tra thông tin, quay và lưu bằng chứng.',
  },
  {
    slug: 'trang-thai-tai-len',
    title: 'Hiểu trạng thái tải lên',
    summary: 'Chờ tải lên, Đã tải lên, Đã xác minh nghĩa là gì và khi nào cần xử lý.',
  },
  {
    slug: 'nhan-hang-hoan',
    title: 'Nhận và ghi nhận hàng hoàn',
    summary: 'Tìm đơn gốc, ghi tình trạng kiện, chụp ảnh, quay mở kiện và kiểm hàng.',
  },
  {
    slug: 'tranh-chap',
    title: 'Tạo hồ sơ tranh chấp',
    summary: 'Gom bằng chứng của đơn hoặc hàng hoàn vào một hồ sơ và chia sẻ bản tóm tắt.',
  },
  {
    slug: 'xoa-tai-khoan',
    title: 'Xóa tài khoản và dữ liệu',
    summary: 'Điều kiện, những gì bị xóa trên máy và trên máy chủ, thời hạn 30 ngày.',
  },
] as const;

export const guidePath = (slug: string) => `/huong-dan/${slug}/`;
