## Tóm tắt

<!-- 1–3 câu: PR này thay đổi gì và vì sao. Tập trung vào lý do nghiệp vụ, không chép lại diff. -->

## Loại thay đổi

- [ ] Tài liệu nghiệp vụ (`docs/`, `CLAUDE.md`)
- [ ] Tính năng / hành vi ứng dụng
- [ ] Sửa lỗi
- [ ] Firebase (Security Rules, Cloud Functions, cấu hình)
- [ ] Cấu hình agent / công cụ / CI
- [ ] Khác:

## Tài liệu liên quan

<!-- Điền mã để reviewer đối chiếu. Xóa dòng không áp dụng. -->
- Màn hình / quy trình: <!-- ví dụ A05, B03 -->
- Quyết định: <!-- ví dụ D-07; câu hỏi mở O-xx nếu PR phụ thuộc -->
- Kịch bản QA ảnh hưởng: <!-- ví dụ QA-02, QA-04 -->

## Thay đổi chính

<!-- Liệt kê ngắn các thay đổi quan trọng theo file/module. -->
-

## Nguyên tắc nghiệp vụ

Đánh dấu những mục PR này **chạm tới** và đã tuân thủ; ghi `N/A` nếu không liên quan. Mô tả ngắn chỗ nào cần reviewer chú ý.

- [ ] Liên kết phiên–kiện–đơn–bằng chứng dùng ID nội bộ, không suy ra từ mã đơn đang hiển thị
- [ ] Bản gốc không bị ghi đè/xóa; bản dẫn xuất liên kết bản gốc
- [ ] Trạng thái tệp tách khỏi trạng thái phiên/đơn; không hiện "đã sao lưu/đã xác minh" trước khi máy chủ xác nhận
- [ ] Không tự liên kết, không tự chọn kết quả đầu, không tự kết luận nguyên nhân/bên chịu trách nhiệm
- [ ] Không tạo dữ liệu giả; thiếu bằng chứng được ghi nhận đúng là thiếu
- [ ] Thay đổi quan trọng có lưu lịch sử; nhật ký kiểm toán không sửa/xóa được bởi người dùng thường
- [ ] Cô lập dữ liệu theo shop; bằng chứng đang giữ do tranh chấp không bị xóa tự động
- [ ] Nội dung hiển thị không hứa quá mức (không "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại, không hứa tải nền luôn hoàn tất)
- [ ] Mã lỗi, thông báo, tên trạng thái khớp `docs/04`–`05`

## Kiểm thử

<!-- Ghi lệnh đã chạy và kết quả thật. Không đánh dấu nếu chưa chạy. -->
- [ ] Lint / typecheck: <!-- lệnh + kết quả -->
- [ ] Unit test: <!-- lệnh + kết quả -->
- [ ] Test Security Rules bằng Firebase Emulator (nếu đổi Rules)
- [ ] Đã thử trên thiết bị thật iOS: <!-- máy, phiên bản, kịch bản -->
- [ ] Đã thử trên thiết bị thật Android: <!-- máy, phiên bản, kịch bản -->

**Chưa kiểm chứng được:** <!-- nêu rõ phần nào chưa test và vì sao; để "Không có" nếu đã đủ -->

## Tác động tới tài liệu

- [ ] Đã cập nhật `docs/` tương ứng (hoặc không cần)
- [ ] Đã cập nhật `CLAUDE.md` (lệnh build/test, quyết định mới) nếu cần
- [ ] PR đổi hành vi nghiệp vụ → đã được người dùng chốt (nêu D-xx hoặc liên kết trao đổi)

## Rủi ro & hướng xử lý

<!-- Ảnh hưởng tới dữ liệu đã có (migration, tương thích bản app cũ), cách quay lại nếu lỗi, điểm cần reviewer xem kỹ. Ghi "Thấp" nếu chỉ là tài liệu. -->

## Ảnh chụp / video màn hình

<!-- Nếu có thay đổi giao diện: trước và sau, kèm trạng thái lỗi/offline. Không đính kèm dữ liệu khách hàng thật (địa chỉ, SĐT, mã vận đơn thật). -->
