/** Liên kết điều hướng dùng chung cho header và footer. Trang chưa tồn tại thì trỏ tới mục trên trang chủ. */
export const navLinks = [
  { label: 'Trang chủ', href: '/' },
  { label: 'Tính năng', href: '/#tinh-nang' },
  { label: 'Lợi ích', href: '/#loi-ich' },
  { label: 'Hướng dẫn', href: '/#cach-dung' },
] as const;
