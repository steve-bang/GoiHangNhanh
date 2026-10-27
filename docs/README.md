# Đơn Chứng — Bộ tài liệu sản phẩm

Tài liệu nghiệp vụ (BRD/PRD) cho ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng. Phiên bản hiện hành: **v1.1**. Các tài liệu 01–09 mô tả sản phẩm *cần làm gì*. Thiết kế kỹ thuật ở [engineering/](engineering/architecture.md) là **đề xuất, chờ duyệt** (không phải quyết định D-xx). Các wireframe và số liệu ví dụ chỉ là minh họa, không phải ứng dụng đã triển khai.

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
| 08 | [Nghiệm thu, kiểm thử & rủi ro](08-acceptance-qa-risks.md) | Checklist, kịch bản QA-01..14, danh mục rủi ro, điều kiện bàn giao |
| 09 | [Thiết kế UI/UX](09-ui-ux-design.md) | Triết lý, kiến trúc thông tin (4 tab), design system, chuẩn nhãn trạng thái, danh mục màn hình `UI-A01…UI-J15`, mockup khái niệm (`docs/assets/ui/`) kèm đối chiếu với đặc tả, nghiệm thu UI/UX |
| — | [Kỹ thuật (đề xuất, chờ duyệt)](engineering/architecture.md) | [Kiến trúc](engineering/architecture.md), [quy ước](engineering/conventions.md), [kiểm thử](engineering/testing.md), [nhật ký quyết định kỹ thuật ADR + câu hỏi](engineering/decisions.md) |

## Nhật ký quyết định

### Đã chốt

| Mã | Quyết định | Ghi chú |
|---|---|---|
| D-01 | Định vị là nền tảng quản trị bằng chứng theo vòng đời đơn hàng, không phải công cụ lưu video | Bốn mục tiêu: phòng ngừa, truy xuất, đối soát, bảo vệ quyền lợi |
| D-02 | Mobile-first: ứng dụng iOS + Android là sản phẩm chính; website chỉ phục vụ marketing, SEO, chuyển đổi | Không xây web app nghiệp vụ cho người bán |
| D-03 | Công nghệ: **React Native** cho mobile, **Firebase** làm backend-as-a-service, không xây backend riêng | Thay thế các đề xuất trước (NestJS/PostgreSQL/S3, Flutter, PWA) |
| D-04 | Bắt đầu đơn bằng quét mã hoặc nhập tay; mã chưa có thì tạo đơn ngay; không bắt buộc tích hợp sàn | Nhập file/tích hợp sàn là giai đoạn mở rộng. Dữ liệu đơn chi tiết hơn: xem D-10 |
| D-05 | Hỗ trợ cả đóng từng đơn và đóng theo lô trên cùng một quy trình và mô hình dữ liệu | "Theo lô" ≠ một video chung cho nhiều đơn |
| D-06 | Video đầy đủ từ trước khi đóng gói đến khi niêm phong xong | |
| D-07 | Tải lên nền, cho làm đơn tiếp theo, trạng thái minh bạch | Không hứa tải nền vô hạn |
| D-08 | Thời hạn lưu bằng chứng theo gói dịch vụ, có cảnh báo, bảo toàn khi tranh chấp | Cần rà soát pháp lý trước vận hành |
| D-09 | Tạm gác kiến trúc kỹ thuật; hoàn thiện nghiệp vụ trước | Thiết kế kỹ thuật RN + Firebase làm sau khi đặc tả màn hình xong |
| D-10 | Dữ liệu đơn hàng **tối giản**, Đơn Chứng không phải phần mềm quản lý bán hàng: định danh = mã đơn + nguồn bán (+ mã vận đơn); đối chiếu = dòng sản phẩm (tên, variant free text, số lượng); không SKU/giá/địa chỉ/khách hàng/danh mục. Không bắt nhập sản phẩm trước khi quay (nhãn *Chưa khai báo sản phẩm*); gợi ý từ lịch sử của shop; không gộp variant; dữ liệu người dùng nhập ghi nguồn, không giả làm dữ liệu sàn | Bước xác nhận đơn–kiện (A03) gộp với nút Bắt đầu quay; kiểm tra sẵn sàng (A04) chạy ngầm. Chi tiết: [02](02-domain-model-and-states.md#thông-tin-đơn-hàng-tối-giản) |
| D-11 | Hướng UI/UX: mobile-first; 4 tab (Tổng quan, Đơn hàng, Hàng hoàn, Đồng bộ); hồ sơ/cài đặt/gói trong menu tài khoản; ẩn thanh tab khi đang quay; nhãn trạng thái bằng chứng thống nhất; danh mục màn hình mã `UI-` | Chi tiết: [09](09-ui-ux-design.md). Chưa phải thiết kế Figma |
| D-12 | Ứng dụng phải chạy đúng trên **cả iOS và Android**, phù hợp các phiên bản hệ điều hành phổ biến; hai nền tảng ngang hàng, không có nền tảng phụ | Tại Việt Nam Android ≈ 60,65%, iOS ≈ 39,31% (StatCounter 06/2026). Sàn phiên bản cụ thể chưa chốt (O-20). Chi tiết: [engineering/platform-support.md](engineering/platform-support.md) |
| D-13 | Bản đầu **chỉ đăng nhập bằng email + mật khẩu** (cộng Apple/Google qua cờ cấu hình); số điện thoại để sau. Mật khẩu chỉ cần **từ 8 ký tự**. **Bỏ ô "Duy trì đăng nhập"** (phiên luôn được giữ vì tải nền cần phiên; tránh mất bằng chứng chờ tải) và **bỏ nút TikTok** | Người dùng duyệt khi làm màn Đăng nhập/Quên mật khẩu/Nhập mã/Mật khẩu mới (UI-A03, A07-A09). Điểm lệch so với mockup 05: [09 mục 5.1](09-ui-ux-design.md), [engineering/decisions.md Q-14](engineering/decisions.md) |
| D-14 | Hướng gửi mã xác minh thật khi quên mật khẩu: **tự xây OTP bằng Cloud Functions** (phương án B của O-22, giữ đủ 4 màn). **Chưa làm ngay**: hiện chỉ có giao diện + cổng giả (mã giả `123456`); chỉ ghi lại phương án | Người dùng chốt hướng, hoãn triển khai. Yêu cầu khi làm: mã 6 số băm phía máy chủ, hết hạn, giới hạn số lần xin/nhập mã, phản hồi trung tính, thu hồi phiên cũ sau khi đặt lại; cần chọn nhà cung cấp gửi email. Chi tiết: [engineering/decisions.md Q-14](engineering/decisions.md) |

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
| O-04 | Được hoàn tất phiên khi chưa quay? Quy tắc chi tiết cho đơn nhiều kiện? (Việc nhập sản phẩm/số lượng không còn bắt buộc — D-10) | — |
| O-05 | Chuẩn bằng chứng: thời lượng tối thiểu, điều kiện "đầy đủ", ngưỡng cảnh báo video ngắn | — |
| O-06 | Thời hạn lưu từng gói, mốc cảnh báo, mốc bắt đầu tính hạn (lúc quay hay lúc tải lên thành công), thời gian giữ khi tranh chấp | Phải ghi rõ trong điều khoản dịch vụ |
| O-07 | Ai được xem, tải, xuất, sửa liên kết, yêu cầu xóa | Khung vai trò ở [07](07-roles-permissions-security.md) |
| O-08 | Chuẩn xuất hồ sơ: cấu trúc thư mục, danh mục, metadata, cách thể hiện tệp thiếu/lỗi | — |
| O-09 | Video có tiếng hay không khi quyền micro bị từ chối | Là chính sách cấu hình theo shop, không phải hành vi ngẫu nhiên |
| O-10 | Công nghệ website marketing | Trước đây đề xuất Next.js; chưa chốt lại sau D-03 |
| O-11 | Tên thương hiệu chính thức | "Đơn Chứng" là tên làm việc |
| O-12 | Chính sách xử lý khi hồ sơ *Chưa khai báo sản phẩm* tồn tại lâu (nhắc bổ sung sau bao lâu, có hiện trong báo cáo thiếu bằng chứng không) | Nhắc nhẹ trong danh sách công việc, không chặn; thời hạn cần chốt |
| O-13 | Nguồn bán là danh sách cố định (Shopee/TikTok Shop/Lazada/Khác) hay shop tự thêm nguồn | Danh sách cố định + "Khác" cho bản đầu |
| O-14 | Lối vào **Tranh chấp** trên giao diện: không phải tab (4 tab ở D-11). Đi từ hồ sơ đơn/hàng hoàn/"việc cần xử lý", hay có nút riêng ở Tổng quan? (Trước đây [01](01-product-vision.md) liệt kê Tranh chấp là một trong bốn hành động ở màn hình chính) | Từ hồ sơ đơn/hàng hoàn + mục "việc cần xử lý"; thêm lối vào ở Tổng quan khi có vụ việc mở |
| O-15 | Phương thức đăng nhập (email/mật khẩu, số điện thoại OTP, Google/Apple…) | Chốt cùng thiết kế Firebase Auth; nếu có đăng nhập bên thứ ba thì kiểm tra yêu cầu của App Store |
| O-16 | Kênh thanh toán gói dịch vụ trong app (mua trong ứng dụng của Apple/Google hay thanh toán ngoài) | Cần kiểm tra chính sách App Store/Google Play hiện hành trước khi thiết kế UI-H03; chưa kết luận |
| O-17 | Chế độ tối; ngôn ngữ ngoài tiếng Việt | Bản đầu chế độ sáng, tiếng Việt |
| O-18 | Thanh điều hướng dưới: mockup có Trang chủ/Đơn hàng/Quét/Thông báo/Cá nhân; D-11 có Tổng quan/Đơn hàng/Hàng hoàn/Đồng bộ | Tổng quan · Đơn hàng · Quét (giữa) · Hàng hoàn · Đồng bộ; Thông báo và Cá nhân ở thanh trên. Xem [09 mục 5.5](09-ui-ux-design.md#55-đối-chiếu-mockup-với-đặc-tả) |
| O-19 | Đóng gói đơn mới đi qua 3 màn trước camera (mockup) so với một lần chạm (D-10) | Nút chính "Lưu và quay video"; chỉ dùng màn Xác nhận khi quét ra đơn có sẵn |
| O-20 | Sàn phiên bản hệ điều hành tối thiểu cho iOS và Android | Đặt bằng sàn kỹ thuật cao nhất của framework và thư viện native đã chọn sau spike (hiện RN 0.88: iOS 15.1, Android 7.0); chỉ nâng khi có số liệu người dùng thật. Xem [platform-support](engineering/platform-support.md#3-sàn-phiên-bản) |
| O-21 | Hỗ trợ máy tính bảng/màn hình gập? | Bản đầu chỉ điện thoại |
| O-22 | ~~Cách gửi mã xác minh khi quên mật khẩu~~ **Đã chốt hướng: B** (xem D-14). Còn mở: nhà cung cấp gửi email, thời hạn mã, số lần xin/nhập tối đa, mốc chờ gửi lại | Triển khai sau khi hết giai đoạn cổng giả |
