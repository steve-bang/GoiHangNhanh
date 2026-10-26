# Cloud Functions (chưa có mã)

Thư mục dành cho Cloud Functions (TypeScript). Chỉ tạo mã cùng tính năng cần nó, kèm test hợp
đồng (xem `docs/engineering/testing.md`). Danh sách chức năng dự kiến và lý do:
`docs/engineering/architecture.md`, mục "Bước chạy phía máy chủ".

Khi thêm mã: tạo `package.json` riêng cho `functions/`, thêm khối `"functions"` vào
`firebase/firebase.json`, và thêm Functions emulator vào script `test:rules`/CI nếu cần.
