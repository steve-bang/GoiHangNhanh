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

| Feature    | Phạm vi (docs)                                          | Trạng thái         |
| ---------- | ------------------------------------------------------- | ------------------ |
| `shop`     | Đăng nhập, shop, thành viên, vai trò (07; O-03, O-15)   | chưa có mã         |
| `orders`   | Đơn, dòng sản phẩm, kiện, tìm/quét (A01-A03)            | chưa có mã         |
| `packing`  | Phiên đóng gói, ghi hình, phục hồi phiên (A04-A06, A08) | chưa có mã         |
| `returns`  | Hồ sơ hàng hoàn, sai lệch (B01-B08)                     | chưa có mã         |
| `evidence` | Vòng đời tệp bằng chứng, nhãn trạng thái (02, 06)       | máy trạng thái tệp |
| `upload`   | Hàng đợi tải lên bền vững, đối soát (A07, 06)           | chưa có mã         |
| `disputes` | Tranh chấp, xuất hồ sơ (G)                              | chưa có mã         |
