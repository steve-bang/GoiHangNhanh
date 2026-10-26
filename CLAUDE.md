# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Repo hiện **chỉ có tài liệu nghiệp vụ**, chưa có mã nguồn, chưa có lệnh build/lint/test. Khi mã nguồn được thêm vào, cập nhật file này với các lệnh thực tế; không suy đoán lệnh trước khi có `package.json`/cấu hình.

Sản phẩm: **Đơn Chứng** (tên làm việc, có thể đổi sau khi kiểm tra nhãn hiệu; tên repo là `GoiHangNhanh`) — ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng thương mại điện tử: đóng gói → bàn giao → nhận hàng hoàn → đối chiếu → tranh chấp. Không phải "app lưu video đơn hàng".

Tài liệu nằm trong `docs/`, bắt đầu từ `docs/README.md` (mục lục + nhật ký quyết định). Mọi tài liệu viết bằng tiếng Việt.

## Quyết định đã chốt (bản mới nhất thắng)

Các trao đổi ban đầu đã thay đổi định hướng nhiều lần. Chỉ áp dụng bản cuối:

| Chủ đề | Đã chốt | Đã bị thay thế (không dùng) |
|---|---|---|
| Nền tảng chính | App iOS + Android là sản phẩm chính; web chỉ để marketing/SEO/chuyển đổi | Web quản trị cho người bán, PWA ghi hình |
| Mobile | **React Native** | Flutter, PWA |
| Backend | **Firebase** (backend-as-a-service), không xây backend riêng | NestJS, PostgreSQL, Redis, S3 multipart |
| Nhập đơn | Quét mã hoặc nhập tay; mã chưa có thì tạo nhanh. Dữ liệu đơn **tối giản**: mã đơn + nguồn bán (+ mã vận đơn) để định danh; dòng sản phẩm (tên, variant, số lượng free text) để đối chiếu. Không bắt nhập sản phẩm trước khi quay; tích hợp sàn không bắt buộc | Bắt buộc API sàn, danh mục/SKU, form dài, quản lý bán hàng thu nhỏ |
| Chế độ đóng hàng | Cả đơn lẻ và theo lô, dùng **chung một quy trình và mô hình dữ liệu** | Hai tính năng rời |
| Kiểu video | Video đầy đủ: từ trước khi đóng gói đến khi niêm phong xong | Quay ngắn |
| Tải lên | Tải lên nền, cho làm đơn tiếp theo, trạng thái minh bạch | Chờ tải xong mới cho làm tiếp |
| Lưu trữ | Thời hạn theo gói dịch vụ, có cảnh báo và bảo toàn khi tranh chấp | Thời hạn cố định |

Các quyết định còn mở: xem `docs/README.md#quyết-định-còn-mở`. Không tự chốt thay người dùng.

## Bất biến nghiệp vụ (không được vi phạm trong thiết kế hay mã)

Đây là phần cần đọc nhiều file mới thấy; mọi tính năng phải tuân thủ:

1. **Không "một đơn = một video".** Đơn → nhiều Kiện → nhiều Phiên ghi nhận → nhiều Bằng chứng; đơn có thể có nhiều lượt hoàn và nhiều vụ tranh chấp. Mã đơn/mã vận đơn chỉ là thuộc tính tìm kiếm, **không** phải định danh; mọi đối tượng có ID nội bộ ổn định.
2. **Bằng chứng gắn với ID phiên + ID kiện được tạo trước khi bắt đầu quay**, không suy ra từ mã đơn đang hiển thị. Chuyển sang đơn tiếp theo không được làm thay đổi liên kết của phiên trước.
3. **Trạng thái tệp tách khỏi trạng thái phiên/đơn.** Vòng đời tệp: Đang ghi → Đang lưu trên thiết bị → Chờ tải lên → Đang tải lên → Đã tải lên → Đã xác minh (mã băm khớp), cùng các trạng thái lỗi riêng. Chỉ hiển thị "đã lưu an toàn trên máy chủ" sau khi máy chủ xác nhận và kiểm tra cần thiết thành công.
4. **Bản gốc bất biến.** Không ghi đè/chỉnh sửa video gốc; bản nén/cắt là bản dẫn xuất có liên kết. Quay bổ sung tạo phiên/tài liệu mới, không thay thế. Không xóa bản cục bộ chỉ vì tải lên đã bắt đầu.
5. **Không tự liên kết, không tự kết luận.** Mã không khớp/nhiều kết quả → yêu cầu xác minh, không chọn kết quả đầu tiên. Hàng hoàn không xác định đơn gốc → hồ sơ chưa liên kết. Không tự kết luận nguyên nhân sai lệch hay bên chịu trách nhiệm.
6. **Không dữ liệu giả.** Quên quay thì ghi nhận thiếu bằng chứng, không cho tạo video bổ sung giả như quay lúc đóng hàng. Kiện mở trước khi quay → nhánh ngoại lệ, đánh dấu thiếu bằng chứng quá trình mở.
7. **Mọi thay đổi sau khi bắt đầu quay/sau xác nhận đều lưu lịch sử**; nhật ký kiểm toán không cho người dùng thường sửa/xóa.
8. **Cô lập dữ liệu theo shop** trên mọi truy vấn, kể cả khi đoán ID. Không URL công khai vĩnh viễn tới video.
9. **Không xóa bằng chứng đang bị giữ do tranh chấp**; hạ cấp/hết hạn gói không được xóa ngầm.
10. **Dữ liệu đơn tối giản, nguồn rõ ràng.** Đơn Chứng không quản lý bán hàng (không SKU/giá/khách hàng/tồn kho). Thiếu thông tin sản phẩm không được chặn quay — gắn nhãn *Chưa khai báo sản phẩm*. Không gộp các variant khác nhau. Thông tin do người dùng nhập phải ghi nguồn là do người dùng nhập, không giả định là dữ liệu chính thức từ sàn. Quét mã vận đơn không có nghĩa là lấy được tên sản phẩm.
11. **Ngôn ngữ trung thực:** không quảng cáo "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại, không hứa tải nền vô hạn (iOS/Android giới hạn chạy nền). Mã băm chỉ chứng minh tệp không đổi kể từ lúc tính, không chứng minh thời điểm quay hay tính chân thực; thời gian thiết bị và thời gian máy chủ lưu riêng.

## Quy ước khi viết tài liệu/mã

- Mỗi màn hình đặc tả theo khung: mục đích, thành phần, hành động, trạng thái, lỗi, tiêu chí nghiệm thu. Mã màn hình: `A01–A08` (đóng gói), `B01–B08` (hàng hoàn).
- Thông báo lỗi gồm ba phần: điều gì xảy ra, ảnh hưởng gì, người dùng làm gì tiếp. Mã lỗi nghiệp vụ dạng `UPPER_SNAKE_CASE` (ví dụ `ORDER_NOT_FOUND`), danh sách trong `docs/04-*` và `docs/05-*`.
- Thiết kế exception-first: mỗi luồng phải có nhánh ngoại lệ, không chỉ đường thuận.
- UX: người bán dùng phải cực kỳ đơn giản; ưu tiên camera/máy quét, hạn chế gõ, không bắt cấu hình khi đăng ký.
- Công nghệ phục vụ nghiệp vụ: không cắt nghiệp vụ quan trọng chỉ vì Firebase/React Native khó làm; nếu xung đột, ghi vào mục "Hệ quả với Firebase" trong `docs/06-evidence-retention-policy.md` và hỏi người dùng.
