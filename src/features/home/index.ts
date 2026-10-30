// Public API của feature home (Trang chủ UI-B01). Lớp ghép: số liệu từ upload/orders, tên shop từ
// personal; tách khỏi `orders` để không tạo vòng phụ thuộc `orders -> upload -> orders` (V1-10).
export { HomeScreen } from './ui/HomeScreen';
export * from './domain';
