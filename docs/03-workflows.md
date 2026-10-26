# 03 — Quy trình nghiệp vụ & ngoại lệ

## Vòng đời đơn hàng

1. **Tiếp nhận đơn** — tạo hoặc tìm đơn, nhận diện mã đơn/mã vận đơn.
2. **Đóng gói** — ghi nhận sản phẩm, số lượng, tình trạng, quá trình niêm phong.
3. **Bàn giao vận chuyển** — liên kết kiện với mã vận đơn, ghi nhận bàn giao.
4. **Theo dõi** — đánh dấu đơn thiếu bằng chứng.
5. **Tiếp nhận hàng hoàn** — tìm đơn gốc, ghi nhận kiện hoàn, quay mở kiện.
6. **Kiểm tra và đối chiếu** — so sánh hàng gửi đi với hàng nhận lại, ghi sai lệch.
7. **Xử lý tranh chấp** — tập hợp bằng chứng, thời hạn, hồ sơ, kết quả.

Mỗi giai đoạn cần: điều kiện bắt đầu, dữ liệu thu thập, thao tác, kết quả mong đợi, trạng thái, xử lý ngoại lệ. Thiết kế theo nguyên tắc **exception-first**.

## Quy trình A — Đóng gói có ghi hình

| Bước | Nội dung | Điều kiện hoàn tất |
|---|---|---|
| 1. Tìm hoặc tạo đơn | Quét mã, nhập tay hoặc tìm đơn có sẵn. Chưa có → tạo đơn mới, nhập sản phẩm/số lượng/ghi chú free text | Xác định được đơn hoặc tạo đơn thành công |
| 2. Xác nhận hàng và kiện | Hiển thị sản phẩm, số lượng, ghi chú, mã kiện; cho bổ sung trước khi quay. Không có dữ liệu sản phẩm → cho xác nhận đã kiểm tra nội dung thực tế | Phiên đóng gói được tạo, gắn đúng kiện |
| 3. Kiểm tra sẵn sàng | Quyền camera/micro, dung lượng, khả năng lưu cục bộ. Thiếu dung lượng → cảnh báo **trước** khi đóng gói | Đủ điều kiện ghi tệp |
| 4. Quay video đầy đủ | Bắt đầu trước khi thao tác; thể hiện hàng hóa, số lượng, đưa hàng vào kiện, niêm phong | Tệp được ghi |
| 5. Hoàn tất phiên | Dừng quay, xem trạng thái đã lưu trên thiết bị, xác nhận phiên; ghi nhận thời điểm bắt đầu/kết thúc, người thực hiện | Tệp lưu cục bộ và đọc được |
| 6. Tải lên nền, chuyển đơn | Video vào hàng đợi; nhân viên làm tiếp; app hiển thị số video chờ, tiến độ, lỗi, xác minh | — |

Không bắt buộc có mạng để bắt đầu quay nếu thiết bị lưu cục bộ được, nhưng phải nói rõ video chưa được sao lưu. Phiên lỗi/gián đoạn được lưu thành bản ghi chưa hoàn tất, không tự đánh dấu thành công.

Thay đổi thông tin đơn trước khi quay: cho phép tự do. Sau khi bắt đầu quay: phải lưu lịch sử.

Shop nhỏ không cần thiết lập danh mục sản phẩm. Ví dụ nhập free text:

```
Áo thun đen size L x 2
Quần jean xanh size 30 x 1
```

## Quy trình B — Đóng hàng theo lô

Chế độ theo lô là **lớp điều phối thao tác**, không phải mô hình dữ liệu riêng.

1. Vào chế độ đóng hàng liên tục.
2. Quét/nhập mã → xác nhận đơn và kiện → quay → lưu → hoàn tất phiên.
3. App quay lại trạng thái sẵn sàng nhận mã kế tiếp; video trước tiếp tục tải nền.
4. Danh sách công việc hiển thị đơn đã hoàn tất, chưa có bằng chứng, đang tải, lỗi.

Quy tắc:

- Mỗi đơn có trạng thái riêng; **không** được gắn video đơn trước vào đơn sau.
- Quét lại mã đã có phiên → hỏi xem phiên cũ hay tạo phiên mới; không ghi đè.
- **Một video liên tục cho nhiều kiện** là chế độ nâng cao, không mặc định: phải có cơ chế đánh dấu ranh giới/đoạn video cho từng kiện; kiện chỉ được coi là có bằng chứng riêng khi xác định được đoạn tương ứng.

## Quy trình C — Tiếp nhận hàng hoàn

Người bán không kiểm soát quá trình vận chuyển trước khi kiện quay về, nên app ghi nhận chính xác tình trạng khi tiếp nhận thay vì mặc định lỗi do khách hay vận chuyển.

Bốn nguyên tắc: ghi tình trạng bên ngoài trước khi mở; bắt đầu quay trước khi phá niêm phong; quay toàn bộ quá trình mở và kiểm tra, kể cả khi thấy bất thường; không tự kết luận nguyên nhân sai lệch.

1. Chọn **Nhận hàng hoàn**; quét mã vận đơn hoặc nhập mã đơn gốc.
2. Chưa xác định đơn gốc → tạo hồ sơ hoàn độc lập, đánh dấu chưa liên kết. Không ép chọn đơn "gần giống".
3. Ghi tình trạng bên ngoài kiện, chụp ảnh nhãn và các mặt kiện.
4. Bắt đầu quay trước khi mở; quay liên tục quá trình mở, lấy hàng, kiểm tra.
5. Đối chiếu hàng nhận về với thông tin và bằng chứng lúc gửi; ghi sai lệch, ảnh, ghi chú.
6. Hoàn tất hồ sơ; liên kết đơn gốc khi đủ căn cứ (có thể liên kết sau, có lịch sử).
7. Có khiếu nại → tạo vụ tranh chấp; bằng chứng liên quan được bảo toàn khỏi xóa tự động.

Hồ sơ có thể tạm dừng và tiếp tục sau. Nếu quay bị gián đoạn phải ghi khoảng gián đoạn; không ghép các đoạn thành video có vẻ liên tục mà không lưu lịch sử.

## Quy trình D — Xử lý tranh chấp

Phát sinh từ đơn gửi đi hoặc hàng hoàn.

1. Chọn đơn, kiện hoặc hồ sơ hoàn liên quan (một đơn có thể có nhiều vụ độc lập).
2. Chọn loại vấn đề: thiếu hàng, sai hàng, hư hỏng, sai lệch hàng hoàn, hàng không nhận được/vấn đề vận chuyển, khác.
3. Chọn video, ảnh, ghi chú, tài liệu; app gợi ý bằng chứng còn thiếu theo loại vụ việc.
4. Kiểm tra trạng thái tải lên và toàn vẹn của từng tài liệu.
5. Xuất bộ bằng chứng: bản tóm tắt, danh mục tài liệu, thời điểm, mã định danh, thông tin nguồn, mã băm. Tệp chưa tải lên/không đọc được phải được liệt kê rõ — không xuất như thể hoàn chỉnh.
6. Ghi thời hạn (người dùng nhập hoặc đồng bộ khi có nguồn hỗ trợ), người phụ trách, ngày gửi, phản hồi của sàn, kết quả.
7. Đóng vụ việc, giữ lịch sử theo chính sách lưu trữ.

Tạo tranh chấp liên kết bằng chứng bằng ID/tham chiếu, không tạo bản sao không cần thiết. App không tự mở tranh chấp nếu người dùng chưa chọn hoặc chưa có quy tắc tự động được phê duyệt. Không tuyên bố shop chắc chắn thắng; mỗi sàn có định dạng, thời hạn, quy trình riêng.

## Ma trận ngoại lệ

| Tình huống | Hành vi bắt buộc |
|---|---|
| Quét mã chưa tồn tại | Cho tạo đơn mới ngay, không bắt buộc đồng bộ sàn |
| Không có mã vận đơn | Nhập mã nội bộ hoặc hệ thống tạo ID nội bộ |
| Sản phẩm chưa có danh mục | Nhập tên tự do, số lượng, ghi chú |
| Quét trùng mã | Mở đơn hiện có và cảnh báo; không tạo đơn trùng |
| Nhiều kết quả khớp mã | Yêu cầu chọn đúng bản ghi; không tự chọn kết quả đầu |
| Quét nhầm mã vận đơn | Hiển thị thông tin đơn để xác nhận trước khi ghi nhận |
| Mất mạng khi quay | Giữ tệp trên thiết bị, đánh dấu chờ đồng bộ |
| Video chưa tải lên xong | Không hiển thị "đã sao lưu an toàn"; tiếp tục thử khi có thể |
| Đã bàn giao nhưng thiếu video | Đánh dấu thiếu bằng chứng, không tạo dữ liệu giả |
| Nhân viên sửa thông tin sau khi quay | Lưu lịch sử, người, thời điểm; không sửa ngầm dữ liệu lịch sử |
| Một đơn nhiều kiện | Mỗi kiện có lần đóng gói và bằng chứng riêng |
| Hàng hoàn không có mã đơn | Hồ sơ chờ xác minh/chưa liên kết, không liên kết bừa |
| Kiện đã mở trước khi quay | Nhánh ngoại lệ, ghi lý do, quay tình trạng hiện tại, đánh dấu thiếu bằng chứng quá trình mở |
| Hàng hoàn thiếu sản phẩm | Tạo sai lệch, cho bổ sung ảnh và ghi chú |
| Video bị xóa hoặc không đọc được | Cảnh báo, ghi nhận sự cố, phương án khôi phục nếu có |
| Một đơn có nhiều vụ tranh chấp | Các vụ độc lập cùng tham chiếu một đơn |

Ba nguyên tắc xử lý sự cố: **không âm thầm bỏ qua lỗi; không chữa lỗi bằng cách xóa dữ liệu gốc; không tuyên bố thành công khi chưa xác minh.**
