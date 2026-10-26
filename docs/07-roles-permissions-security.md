# 07 — Vai trò, phân quyền & bảo mật

## Vai trò

| Vai trò | Quyền nghiệp vụ |
|---|---|
| Chủ shop | Quản lý thành viên, gói dịch vụ, dữ liệu, chính sách shop |
| Quản lý | Quản lý đơn, phiên đóng gói, hồ sơ hoàn, phân công công việc |
| Nhân viên đóng gói | Tạo đơn, ghi hình, hoàn tất phiên đóng gói, xem các đơn được phép |
| Nhân viên hàng hoàn | Tạo hồ sơ hoàn, ghi hình mở kiện, ghi nhận sai lệch |
| Người xử lý tranh chấp | Xem bằng chứng, tạo hồ sơ, xuất bộ tài liệu theo quyền được cấp |
| Người chỉ xem | Xem dữ liệu được cấp quyền, không sửa/xóa |

Một người có thể giữ nhiều vai trò nếu chủ shop cấp. Về sau mở rộng phân quyền theo shop, kho và chức năng; nhiều bàn đóng hàng hoạt động đồng thời. Ma trận quyền chi tiết theo từng hành động (xem, tải, xuất, sửa liên kết, yêu cầu xóa) còn mở — O-07. Mô hình nhiều shop/một tài khoản và nhân viên làm nhiều shop — O-03.

## Quy tắc bảo mật

- Mọi truy vấn và thao tác kiểm tra quyền theo shop. Người dùng shop A không đọc/tải được video shop B bằng cách thay ID trong yêu cầu.
- Mã hóa dữ liệu khi truyền và khi lưu; quản lý khóa và quyền tải tệp.
- Đường dẫn video có thời hạn hoặc được kiểm soát; không URL công khai vĩnh viễn.
- Ghi nhật ký thao tác nhạy cảm: xuất, tải xuống, xóa, đổi quyền.
- Kiểm soát tải xuống, chia sẻ, xuất dữ liệu.
- Thu hồi quyền ngay khi nhân viên nghỉ việc.
- Thiết bị dùng chung: phân biệt tài khoản, ghi người thực hiện, quy trình đăng xuất.
- Phân quyền xóa, cơ chế lưu giữ và khôi phục chống xóa ngoài ý muốn.

## Quyền riêng tư

Video có thể chứa khuôn mặt, địa chỉ, nhãn vận đơn, thông tin khách hàng — quyền riêng tư là yêu cầu sản phẩm từ đầu, không phải tính năng bổ sung.

- Thu thập ở mức cần thiết; hạn chế lộ địa chỉ, số điện thoại, thông tin khách trong video, ảnh, tệp xuất.
- Quy định thời gian lưu; chính sách xử lý yêu cầu truy cập, xuất, chỉnh sửa, xóa dữ liệu cá nhân theo pháp luật áp dụng.
- Điều khoản dịch vụ và chính sách riêng tư minh bạch, công bố trên website.
