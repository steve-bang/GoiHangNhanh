# 02 — Mô hình nghiệp vụ & trạng thái

## Nguyên tắc

- **Không thiết kế "mỗi đơn có một video đóng hàng và một video hoàn hàng".** Một đơn có thể có nhiều kiện, nhiều lần đóng gói, nhiều video, nhiều lượt hoàn và nhiều vụ tranh chấp.
- Mỗi đối tượng có **ID nội bộ ổn định**. Mã đơn/mã vận đơn do sàn hoặc hãng vận chuyển cấp chỉ là thuộc tính liên kết và tìm kiếm — có thể nhập sai, thay đổi hoặc trùng trong dữ liệu thủ công.
- Mỗi tệp bằng chứng liên kết tới phiên ghi nhận, kiện và đơn phù hợp. Hệ thống phải **phát hiện liên kết không hợp lệ** thay vì âm thầm gắn nhầm.
- Mỗi đối tượng có **trạng thái riêng**, không dùng một trường trạng thái chung cho toàn bộ đơn.

Ví dụ: đơn có hai kiện, một kiện hoàn về trước, kiện còn lại hoàn sau → hai lượt hoàn riêng, mỗi lượt có bằng chứng riêng, cùng liên kết đơn gốc.

## Đối tượng nghiệp vụ

```
Shop (tổ chức sở hữu dữ liệu)
 ├── Thành viên (vai trò)
 ├── Gói dịch vụ
 └── Đơn hàng
      ├── Kiện hàng ──── Phiên đóng gói ──── Bằng chứng (video/ảnh, gốc + dẫn xuất)
      ├── Lượt vận chuyển (đi / hoàn)
      └── Hồ sơ hàng hoàn (có thể chưa liên kết đơn)
            ├── Phiên quay mở kiện ── Bằng chứng
            └── Sai lệch
 Vụ tranh chấp ── tham chiếu đơn / kiện / hồ sơ hoàn / bằng chứng
      └── Bộ bằng chứng xuất ra
 Sự kiện kiểm toán (xuyên suốt)
```

| Đối tượng | Ý nghĩa nghiệp vụ |
|---|---|
| Shop | Đơn vị sở hữu dữ liệu và thanh toán gói dịch vụ |
| Thành viên | Chủ shop, quản lý, nhân viên đóng gói, nhân viên hàng hoàn, người xử lý tranh chấp, người chỉ xem |
| Đơn hàng | Bản ghi **tối giản** để gắn đúng bằng chứng và đối chiếu hàng: mã đơn, nguồn bán, mã vận đơn (nếu có), các dòng sản phẩm, ghi chú, trạng thái, lịch sử, nguồn dữ liệu (xem "Thông tin đơn hàng tối giản") |
| Dòng sản phẩm | Một dòng đối chiếu của đơn: tên sản phẩm, phân loại/variant (free text), số lượng. Không phải danh mục sản phẩm; không có SKU, giá |
| Kiện hàng | Đơn vị vật lý được đóng gói và bàn giao; mỗi kiện có ID và lịch sử riêng |
| Lượt vận chuyển | Một lần vận chuyển đi hoặc hoàn, gắn mã vận đơn |
| Phiên ghi nhận / Phiên đóng gói | Một lần quay/chụp cho một công đoạn của một kiện; có thể bị gián đoạn và có phiên bổ sung liên kết |
| Bằng chứng (Media Asset) | Video, ảnh, tài liệu hoặc bản ghi sự kiện; bản gốc tách khỏi bản dẫn xuất (xem trước, nén, cắt) |
| Hồ sơ hàng hoàn | Quá trình tiếp nhận, mở và kiểm tra một kiện trả về |
| Sai lệch | Thiếu, thừa, sai loại/mẫu, khác màu/size/phiên bản, hư hỏng, thiếu phụ kiện, không xác định được, khác |
| Vụ tranh chấp | Vấn đề, bằng chứng, ghi chú, người phụ trách, thời hạn, trạng thái, phản hồi, kết quả |
| Bộ bằng chứng xuất ra | Tập tài liệu được chọn và đóng gói để dùng ngoài ứng dụng, kèm danh mục và thông tin toàn vẹn (evidence manifest) |
| Sự kiện kiểm toán | Lịch sử hành động quan trọng của người dùng và hệ thống |

## Thông tin đơn hàng tối giản

Đơn Chứng **không phải phần mềm quản lý bán hàng thu nhỏ**: người bán đã quản lý đơn trên Shopee, TikTok Shop, Lazada. Ứng dụng chỉ giữ đủ thông tin để gắn đúng bằng chứng với đúng đơn và đối chiếu hàng khi đóng gói/nhận hàng hoàn. Ít nhập liệu nhất có thể; ưu tiên quét mã, tái sử dụng dữ liệu; chỉ yêu cầu bổ sung khi thực sự cần.

| Nhóm | Trường | Ghi chú |
|---|---|---|
| Định danh | Mã đơn, nguồn bán (Shopee / TikTok Shop / Lazada / Khác–chưa xác định), mã vận đơn nếu có | Ưu tiên lấy từ mã quét hoặc dữ liệu đồng bộ. Mã đơn + nguồn bán dùng để nhận diện đơn; không thay thế ID nội bộ |
| Đối chiếu | Danh sách dòng sản phẩm: tên, variant, số lượng | Không bắt buộc SKU, giá bán, địa chỉ, thông tin khách hàng — cũng là thu thập dữ liệu tối thiểu |
| Bằng chứng | Phiên quay đóng gói, video mở hàng hoàn, ảnh, ghi chú sai lệch, trạng thái tải lên | Xem [06](06-evidence-retention-policy.md) |

Quy tắc:

- Mã đơn và nguồn bán dùng để định danh; sản phẩm, variant, số lượng là thông tin đối chiếu.
- **Không bắt buộc nhập sản phẩm trước khi quay.** Hồ sơ bỏ qua bước này mang nhãn **Chưa khai báo sản phẩm**; bổ sung sau được, mọi bổ sung/sửa lưu lịch sử. Nhãn này là việc còn thiếu, không chặn quay, không chặn hoàn tất phiên.
- Không tự tạo sản phẩm chuẩn hóa/SKU/danh mục nếu người dùng không yêu cầu.
- **Không gộp hai variant khác nhau thành một dòng** chỉ vì trùng tên sản phẩm; mỗi variant là một dòng riêng với số lượng riêng.
- Mỗi giá trị lưu **nguồn thông tin**: *do người dùng nhập* hoặc *đồng bộ từ nguồn hợp lệ* (khi có tích hợp). Dữ liệu người dùng nhập không được thể hiện hay xuất như dữ liệu chính thức từ sàn.
- Quét mã vận đơn **không** đồng nghĩa lấy được tên sản phẩm/variant/số lượng. Khi chưa có tích hợp hay dữ liệu đồng bộ, app chỉ dùng được: dữ liệu đã nhập trước đó (gồm gợi ý từ lịch sử gần đây của chính shop), dữ liệu đồng bộ từ nguồn hợp lệ, hoặc để người dùng nhập nhanh.
- Dữ liệu dự kiến khi đóng gói không bị sửa khi tiếp nhận hàng hoàn; hàng thực nhận lưu thành bản ghi riêng (xem [05 — B06](05-screen-spec-returns.md)).
- Mọi sửa đổi quan trọng sau khi phiên quay hoàn tất có lịch sử.

Khi bắt đầu một phiên, lưu **ảnh chụp dữ liệu đơn tại thời điểm bắt đầu** để đối chiếu lịch sử; sửa đơn sau đó không làm thay đổi ảnh chụp này.

## Máy trạng thái

### Đơn hàng

| Trạng thái | Ý nghĩa |
|---|---|
| Mới tạo | Đã có bản ghi |
| Sẵn sàng đóng gói | Đủ thông tin tối thiểu để xử lý |
| Đang đóng gói | Có phiên đóng gói đang thực hiện |
| Đã đóng gói | Có phiên hoàn tất — **không** mặc định video đã tải lên |
| Đã bàn giao | Người dùng ghi nhận đã bàn giao vận chuyển. Khi không có tích hợp, đây là xác nhận thủ công, không được thể hiện như trạng thái xác minh tự động từ hãng |
| Đã hoàn tất | Quy trình bán hàng kết thúc theo nghiệp vụ của shop |
| Đã hủy | Đơn bị hủy; lịch sử vẫn giữ theo quy tắc lưu trữ |

### Phiên đóng gói / phiên quay

Chưa bắt đầu → Đang ghi hình → Đã kết thúc → Đã xác nhận hoàn tất; nhánh: **Bị gián đoạn / Cần xử lý**.

Phiên có thể đã xác nhận trong khi video vẫn chưa tải lên. Không được tự đánh dấu thành công khi phiên lỗi hoặc gián đoạn.

### Vòng đời tệp bằng chứng (độc lập với phiên và đơn)

| # | Trạng thái | Điều kiện |
|---|---|---|
| 1 | Đang ghi hình | Camera đang ghi |
| 2 | Đang lưu trên thiết bị | Đang hoàn tất ghi thành tệp cục bộ |
| 3 | Chờ tải lên | Tệp đã lưu cục bộ, đọc được, chờ mạng/lượt xử lý |
| 4 | Đang tải lên | Đang truyền tới máy chủ |
| 5 | Đã tải lên | Máy chủ đã nhận đủ tệp theo giao thức tải lên |
| 6 | Đã xác minh | Tệp trên máy chủ khớp mã băm bản gốc đã ghi nhận |

Trạng thái lỗi rõ ràng: **Lỗi lưu cục bộ, Tải lên thất bại (có thể thử lại), Tệp không khớp mã băm (cách ly), Cần xử lý, Không thể khôi phục**. Không chuyển thành thành công chỉ vì người dùng đóng màn hình hoặc vì yêu cầu tải lên đã được gửi.

### Hồ sơ hàng hoàn

Chưa bắt đầu → Đang tiếp nhận → Đang mở kiện → Đang kiểm tra → Đã xác nhận → Đã đóng; nhánh: Cần xử lý, Chờ tải lên (về bằng chứng). Trạng thái liên kết đơn gốc riêng: Chưa liên kết / Đã liên kết (mỗi lần liên kết là một sự kiện có người thực hiện, thời điểm, căn cứ).

### Vụ tranh chấp

Mới tạo → Đang thu thập bằng chứng → Đủ điều kiện xuất hồ sơ → Đã gửi ra ngoài → Đang chờ phản hồi → Đã giải quyết / Đã đóng. Từ "Đang chờ phản hồi" có thể quay về "Cần bổ sung" → "Đang thu thập bằng chứng".

"Đủ điều kiện xuất hồ sơ" là kiểm tra nội bộ, không có nghĩa đáp ứng mọi yêu cầu của nền tảng tiếp nhận.

### Bảng điều kiện hoàn tất

| Trạng thái | Đóng gói | Hàng hoàn |
|---|---|---|
| Bản ghi được tạo | Có đơn và phiên đóng gói | Có hồ sơ hàng hoàn |
| Đã lưu cục bộ | Video đọc được trên thiết bị | Video mở kiện đọc được trên thiết bị |
| Nghiệp vụ hoàn tất | Phiên đóng gói đã xác nhận | Kiểm kê đã xác nhận |
| Đã tải lên | Máy chủ nhận đủ video | Máy chủ nhận đủ video mở kiện |
| Đã xác minh | Tệp máy chủ khớp mã băm | Tệp máy chủ khớp mã băm |
| Đầy đủ bằng chứng | Đạt checklist và chính sách | Đạt checklist và chính sách |
| Có ngoại lệ | Thiếu đoạn, gián đoạn, thiếu video | Kiện mở trước, gián đoạn, thiếu video |

"Đầy đủ bằng chứng" là đánh giá theo checklist nội bộ, không khẳng định video chứng minh mọi sự kiện hay chắc chắn được sàn chấp nhận.
