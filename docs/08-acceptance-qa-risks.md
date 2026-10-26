# 08 — Nghiệm thu, kiểm thử & rủi ro

## Checklist nghiệm thu nghiệp vụ

Tiêu chí tối thiểu; ngưỡng hiệu năng cụ thể xác lập sau khi biết dung lượng video mục tiêu và thiết bị thực tế. Đánh dấu trong tài liệu không có nghĩa là đã kiểm thử.

**Đơn hàng**
- [ ] Quét mã và tìm đúng đơn hiện có
- [ ] Tạo đơn mới khi mã chưa tồn tại
- [ ] Nhập tên sản phẩm, variant, số lượng bằng free text; không gộp các variant khác nhau
- [ ] Quay được khi chưa khai báo sản phẩm; hồ sơ mang nhãn *Chưa khai báo sản phẩm* và bổ sung sau có lịch sử
- [ ] Giá trị người dùng nhập được ghi nguồn, không thể hiện như dữ liệu chính thức từ sàn
- [ ] Cảnh báo khi quét trùng, không âm thầm tạo đơn trùng

**Ghi hình**
- [ ] Bắt đầu quay trước khi đóng gói
- [ ] Lưu được video sau khi dừng quay
- [ ] Phân biệt phiên hoàn tất và phiên bị gián đoạn
- [ ] Không gắn video vào đơn khác khi chuyển sang đơn tiếp theo

**Tải lên**
- [ ] Xử lý đơn khác trong khi video tải lên nền
- [ ] Phục hồi công việc chờ tải sau khi app bị đóng
- [ ] Hiển thị lỗi và cho thử lại
- [ ] Chỉ báo đã tải lên sau khi máy chủ xác nhận nhận đủ

**Bảo vệ bằng chứng**
- [ ] Tạo mã băm cho tệp gốc
- [ ] Phát hiện tệp không khớp mã băm
- [ ] Lưu nhật ký thao tác nhạy cảm
- [ ] Người không có quyền không xem/xuất được bằng chứng

**Hàng hoàn và tranh chấp**
- [ ] Tạo hồ sơ hoàn chưa liên kết đơn
- [ ] Liên kết hồ sơ hoàn với đơn gốc khi có căn cứ
- [ ] Tạo vụ tranh chấp từ bằng chứng liên quan
- [ ] Không tự động xóa bằng chứng đang được giữ lại

**Lưu trữ**
- [ ] Hiển thị thời hạn lưu dự kiến
- [ ] Cảnh báo trước khi hết hạn theo chính sách
- [ ] Xử lý hạ cấp và hết hạn theo quy tắc công bố
- [ ] Ghi lịch sử xóa và xử lý bản sao lưu

## Kịch bản QA đầu-cuối

Kiểm thử trên thiết bị iOS và Android thực tế, kể cả khi app chạy nền.

| Mã | Kịch bản | Các bước | Kết quả mong đợi |
|---|---|---|---|
| QA-01 | Đóng gói online bình thường | Tạo đơn → xác nhận kiện → quay → dừng → tải lên → xác minh | Video gắn đúng kiện; trạng thái lưu và tải lên đúng; truy xuất được |
| QA-02 | Đóng gói khi mất mạng | Tắt mạng → tạo/khôi phục phiên → quay → dừng → bật mạng | Giữ cục bộ, chờ tải; đồng bộ không tạo bản ghi trùng |
| QA-03 | Đóng liên tục nhiều đơn | Quay A → hoàn tất → chuyển B → quay B | A và B có ID phiên riêng, liên kết chính xác |
| QA-04 | App bị đóng khi đang quay | Bắt đầu quay → kết thúc app đột ngột → mở lại | Khôi phục hoặc đánh dấu phiên lỗi; không tự nhận video đầy đủ |
| QA-05 | Mất phản hồi sau khi máy chủ đã nhận tệp | Mô phỏng mất phản hồi → thử lại | Đối soát trước khi gửi lại; không trùng bằng chứng |
| QA-06 | Hàng hoàn không có đơn gốc | Tạo hồ sơ độc lập → chụp kiện → quay mở → kiểm kê | Hoàn tất được mà không liên kết sai |
| QA-07 | Kiện đã mở trước khi quay | Chọn ngoại lệ → ghi lý do → quay hiện trạng → kiểm kê | Đánh dấu thiếu bằng chứng quá trình mở ban đầu |
| QA-08 | Phát hiện hàng thiếu | Quay mở → nhập số lượng thực nhận thấp hơn dự kiến → lưu sai lệch | Sai lệch được ghi; không tự kết luận nguyên nhân |
| QA-09 | Video gốc bị thay đổi | Sửa tệp thử sau khi tính mã băm → kiểm tra toàn vẹn | Phát hiện không khớp; không đánh dấu đã xác minh |
| QA-10 | Tranh chấp sắp hết hạn | Mở tranh chấp → tới mốc hết hạn → chạy dọn dẹp | Bằng chứng đang giữ không bị xóa |
| QA-11 | Truy cập chéo shop | Đăng nhập tài khoản shop khác → mở ID tài liệu | Bị từ chối; không lộ video hay metadata nhạy cảm |
| QA-12 | Hết dung lượng giữa phiên | Mô phỏng đầy bộ nhớ → quay → dừng | Báo lỗi trung thực, giữ phần đọc được, không đánh dấu đầy đủ |
| QA-13 | Quay trước, khai báo sau | Quét mã chưa có → tạo nhanh chỉ với mã và nguồn bán → quay ngay → hoàn tất → bổ sung sản phẩm sau | Quay không bị chặn; nhãn *Chưa khai báo sản phẩm* hiện đến khi bổ sung; bổ sung có lịch sử; ảnh chụp dữ liệu lúc bắt đầu không bị sửa ngầm |
| QA-14 | Nhiều variant cùng sản phẩm | Nhập "Áo thun cotton" Đen/XL ×2 và Trắng/L ×1 → quay → nhận hoàn → kiểm kê | Hai dòng riêng ở cả đóng gói và kiểm kê; không gộp; dữ liệu dự kiến không bị ghi đè bởi thực nhận |

Thêm điều kiện thực tế: điện thoại nóng, bộ nhớ gần đầy, Wi-Fi yếu, chuyển Wi-Fi ↔ 4G/5G, app bị đóng đột ngột, quay nhiều video liên tiếp, nhiều phiên bản iOS/Android và dòng máy phổ biến.

## Điều kiện phát hành thương mại

| Nhóm | Điều kiện |
|---|---|
| Ghi hình | Quay, phát lại, liên kết chính xác với phiên |
| Lưu trữ | Không đánh dấu hoàn tất khi máy chủ chưa xác nhận đủ tệp |
| Mạng yếu | Khôi phục luồng tải lên trong giới hạn hệ điều hành |
| Định danh đơn | Không tự gắn video vào đơn không xác định |
| Bảo mật | Phân quyền theo shop, kiểm thử truy cập chéo |
| Dữ liệu | Sao lưu, kiểm thử khôi phục, chính sách lưu giữ |
| Mobile | Chạy đúng trên **cả iOS và Android**; kiểm thử nhiều phiên bản và dòng máy theo ma trận ở [engineering/platform-support.md](engineering/platform-support.md#5-ma-trận-kiểm-thử-đề-xuất-tối-thiểu), gồm phiên bản sàn, giữa và mới nhất, cấu hình thấp |
| Vận hành | Giám sát lỗi, cảnh báo, đo chi phí, quy trình sự cố |
| Phát hành | Beta, kiểm thử hồi quy, quản lý phiên bản |

## Danh mục rủi ro

Đánh giá ban đầu để ưu tiên thiết kế, không phải thống kê sự cố.

| Rủi ro | Ưu tiên | Biện pháp |
|---|---|---|
| Video gắn nhầm đơn | Rất cao | Gắn phiên với kiện trước khi quay; xác nhận mã; lịch sử liên kết |
| Video chưa tải lên nhưng tưởng đã an toàn | Rất cao | Trạng thái rõ; không dùng nhãn "đã sao lưu" trước xác nhận máy chủ |
| Mất video khi app bị đóng | Rất cao | Lưu cục bộ an toàn, phục hồi hàng đợi, cảnh báo |
| Video bị chỉnh sửa/ghi đè | Rất cao | Giữ bản gốc, mã băm, kiểm tra toàn vẹn, nhật ký |
| Truy cập chéo giữa shop | Rất cao | Kiểm tra quyền theo shop mọi thao tác; kiểm thử bảo mật |
| Hết hạn lưu trong lúc tranh chấp | Rất cao | Giữ lại theo hồ sơ đang mở và chính sách công bố |
| Thiết bị hết dung lượng | Cao | Kiểm tra trước khi quay, cảnh báo, giải phóng an toàn |
| Nhân viên cố tình thay đổi dữ liệu | Cao | Phân quyền, nhật ký không sửa được, đối soát thay đổi |
| Quay thiếu đoạn quan trọng | Cao | Hướng dẫn trực quan, checklist, cảnh báo phiên ngắn/gián đoạn |
| Xuất hồ sơ thiếu tài liệu | Cao | Kiểm tra đầy đủ, liệt kê trạng thái tệp, cảnh báo tệp chưa tải |
| Chi phí lưu trữ vượt dự toán | Cao | Gói dung lượng, cảnh báo sử dụng, theo dõi chi phí |
| Thiết bị dùng chung | Cao | Tài khoản riêng, ghi người thực hiện, đăng xuất |
| Khiếu nại quyền riêng tư | Cao | Thu thập tối thiểu, điều khoản minh bạch, kiểm soát truy cập |
| Hàng hoàn không xác định đơn gốc | Trung bình–cao | Hồ sơ độc lập, liên kết sau |

## Điều kiện bàn giao sang UI/UX và phát triển

- Wireframe chi tiết A01–A08 và B01–B08 (ưu tiên A05/A06, B03/B05).
- Bản đồ điều hướng: quay lại, lưu tạm, khôi phục, phiên gián đoạn.
- Bộ trạng thái giao diện: loading, empty, offline, error, retry, success.
- Bộ thông báo chuẩn có mã lỗi nghiệp vụ.
- Quy tắc phân quyền theo từng hành động.
- Ma trận dữ liệu bắt buộc/tùy chọn và điều kiện hoàn tất mỗi màn hình.
- Bộ kiểm thử nghiệm thu iOS và Android.
- Đặc tả lưu trữ bằng chứng, mã băm, nhật ký kiểm toán, bảo toàn hồ sơ tranh chấp.
