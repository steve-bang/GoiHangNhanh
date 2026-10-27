# features/

Mỗi thư mục là một feature (bounded context). Cấu trúc trong feature:

```
<feature>/
  domain/   TypeScript thuần: kiểu, quy tắc, máy trạng thái, hàm thuần. Có unit test.
  data/     Repository/adapter: Firestore, Storage, lưu cục bộ, hàng đợi. Chỉ lớp này gọi SDK.
  ui/       Màn hình, component, hook cho giao diện. Chuỗi UI qua i18n.
  index.ts  Public API duy nhất cho feature khác import.
```

Quy tắc phụ thuộc và lý do: `docs/engineering/architecture.md` mục 2 và
`docs/engineering/conventions.md` mục 3. ESLint thực thi các quy tắc này.

| Feature    | Phạm vi (docs)                                          | Trạng thái                                                 |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `shop`     | Đăng nhập, shop, thành viên, vai trò (07; O-03, O-15)   | màn Chào mừng thật; còn lại màn khung + menu tài khoản     |
| `orders`   | Đơn, dòng sản phẩm, kiện, tìm/quét (A01-A03)            | màn khung (Tổng quan, quét, tạo đơn, xem nhanh, danh sách) |
| `packing`  | Phiên đóng gói, ghi hình, phục hồi phiên (A04-A06, A08) | màn khung (quay, xác nhận, hoàn tất)                       |
| `returns`  | Hồ sơ hàng hoàn, sai lệch (B01-B08)                     | màn khung                                                  |
| `evidence` | Vòng đời tệp bằng chứng, nhãn trạng thái (02, 06)       | máy trạng thái tệp + màn khung                             |
| `upload`   | Hàng đợi tải lên bền vững, đối soát (A07, 06)           | màn khung (Trung tâm đồng bộ)                              |
| `disputes` | Tranh chấp, xuất hồ sơ (G)                              | màn khung                                                  |

Màn hình khung hiện có dùng dữ liệu minh họa (`src/shared/fixtures`), chưa có `domain/` hay `data/`.
Bảng route ↔ mã `UI-xx` và cách thêm màn: `docs/engineering/layout.md`.
