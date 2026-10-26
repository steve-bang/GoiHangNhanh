# Đơn Chứng — Bộ tài liệu sản phẩm

Tài liệu nghiệp vụ (BRD/PRD) cho ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng. Phiên bản hiện hành: **v1.1**. Các tài liệu mô tả sản phẩm *cần làm gì*; chưa có mã nguồn, chưa có thiết kế kỹ thuật chi tiết. Các wireframe và số liệu ví dụ chỉ là minh họa, không phải ứng dụng đã triển khai.

## Mục lục

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [Tầm nhìn & phạm vi sản phẩm](01-product-vision.md) | Định vị, vấn đề, khách hàng, phạm vi, website, gói dịch vụ, lộ trình |
| 02 | [Mô hình nghiệp vụ & trạng thái](02-domain-model-and-states.md) | Đối tượng nghiệp vụ, quan hệ, máy trạng thái |
| 03 | [Quy trình nghiệp vụ & ngoại lệ](03-workflows.md) | Quy trình A–D end-to-end, ma trận ngoại lệ |
| 04 | [Đặc tả màn hình — Đóng gói (A01–A08)](04-screen-spec-packing.md) | Từng màn hình, lỗi, tiêu chí nghiệm thu |
| 05 | [Đặc tả màn hình — Hàng hoàn (B01–B08)](05-screen-spec-returns.md) | Từng màn hình, lỗi, tiêu chí nghiệm thu |
| 06 | [Chính sách bằng chứng & lưu trữ](06-evidence-retention-policy.md) | Toàn vẹn, metadata, tải lên nền, thời hạn lưu |
| 07 | [Vai trò, phân quyền & bảo mật](07-roles-permissions-security.md) | Vai trò, quy tắc truy cập, quyền riêng tư |
| 08 | [Nghiệm thu, kiểm thử & rủi ro](08-acceptance-qa-risks.md) | Checklist, kịch bản QA-01..12, danh mục rủi ro, điều kiện bàn giao |

## Nhật ký quyết định

### Đã chốt

| Mã | Quyết định | Ghi chú |
|---|---|---|
| D-01 | Định vị là nền tảng quản trị bằng chứng theo vòng đời đơn hàng, không phải công cụ lưu video | Bốn mục tiêu: phòng ngừa, truy xuất, đối soát, bảo vệ quyền lợi |
| D-02 | Mobile-first: ứng dụng iOS + Android là sản phẩm chính; website chỉ phục vụ marketing, SEO, chuyển đổi | Không xây web app nghiệp vụ cho người bán |
| D-03 | Công nghệ: **React Native** cho mobile, **Firebase** làm backend-as-a-service, không xây backend riêng | Thay thế các đề xuất trước (NestJS/PostgreSQL/S3, Flutter, PWA) |
| D-04 | Bắt đầu đơn bằng quét mã hoặc nhập tay; mã chưa có thì tạo đơn ngay với sản phẩm/số lượng free text; không bắt buộc tích hợp sàn | Nhập file/tích hợp sàn là giai đoạn mở rộng |
| D-05 | Hỗ trợ cả đóng từng đơn và đóng theo lô trên cùng một quy trình và mô hình dữ liệu | "Theo lô" ≠ một video chung cho nhiều đơn |
| D-06 | Video đầy đủ từ trước khi đóng gói đến khi niêm phong xong | |
| D-07 | Tải lên nền, cho làm đơn tiếp theo, trạng thái minh bạch | Không hứa tải nền vô hạn |
| D-08 | Thời hạn lưu bằng chứng theo gói dịch vụ, có cảnh báo, bảo toàn khi tranh chấp | Cần rà soát pháp lý trước vận hành |
| D-09 | Tạm gác kiến trúc kỹ thuật; hoàn thiện nghiệp vụ trước | Thiết kế kỹ thuật RN + Firebase làm sau khi đặc tả màn hình xong |

### Đã bị thay thế — không áp dụng

- Web quản trị cho người bán, PWA ghi hình, Next.js làm giao diện nghiệp vụ.
- Flutter + Dart, Riverpod.
- NestJS, PostgreSQL, Redis/worker riêng, object storage S3 multipart, kiến trúc modular monolith tự vận hành.
- Lộ trình 5 giai đoạn kỹ thuật ban đầu → thay bằng lộ trình 4 giai đoạn năng lực trong [01](01-product-vision.md#lộ-trình).
- Danh sách vai trò ban đầu (quản trị viên, quản lý kho…) → thay bằng bộ vai trò trong [07](07-roles-permissions-security.md).

### Quyết định còn mở

| Mã | Câu hỏi | Khuyến nghị hiện có |
|---|---|---|
| O-01 | Khách hàng trọng tâm khi ra mắt: shop nhỏ, doanh nghiệp lớn hay cả hai? | Cả hai, nhưng trải nghiệm bắt đầu phù hợp shop nhỏ (D-05 đã ngầm hỗ trợ cả hai) |
| O-02 | Cho phép nhập video có sẵn từ thư viện điện thoại không? | Hỗ trợ cả quay trực tiếp và nhập, ưu tiên quay trực tiếp trong quy trình chuẩn. Nếu cho nhập: phải gắn nhãn nguồn "nhập từ thư viện", vì mã băm không chứng minh video chưa bị sửa trước khi đưa vào app |
| O-03 | Một tài khoản quản lý nhiều shop? Nhân viên làm cho nhiều shop? | — |
| O-04 | Có bắt buộc nhập số lượng? Được hoàn tất phiên khi chưa quay? Quy tắc nhiều kiện? | — |
| O-05 | Chuẩn bằng chứng: thời lượng tối thiểu, điều kiện "đầy đủ", ngưỡng cảnh báo video ngắn | — |
| O-06 | Thời hạn lưu từng gói, mốc cảnh báo, mốc bắt đầu tính hạn (lúc quay hay lúc tải lên thành công), thời gian giữ khi tranh chấp | Phải ghi rõ trong điều khoản dịch vụ |
| O-07 | Ai được xem, tải, xuất, sửa liên kết, yêu cầu xóa | Khung vai trò ở [07](07-roles-permissions-security.md) |
| O-08 | Chuẩn xuất hồ sơ: cấu trúc thư mục, danh mục, metadata, cách thể hiện tệp thiếu/lỗi | — |
| O-09 | Video có tiếng hay không khi quyền micro bị từ chối | Là chính sách cấu hình theo shop, không phải hành vi ngẫu nhiên |
| O-10 | Công nghệ website marketing | Trước đây đề xuất Next.js; chưa chốt lại sau D-03 |
| O-11 | Tên thương hiệu chính thức | "Đơn Chứng" là tên làm việc |
