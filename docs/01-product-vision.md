# 01 — Tầm nhìn & phạm vi sản phẩm

## Định nghĩa sản phẩm

Đơn Chứng là **ứng dụng quản lý bằng chứng theo vòng đời đơn hàng**, giúp người bán ghi nhận đúng, tìm lại nhanh và đối chiếu được bằng chứng đóng hàng – giao hàng – nhận hàng hoàn – tranh chấp.

Triết lý: hệ thống phía sau phải mạnh, nhưng người bán dùng phía trước phải cực kỳ đơn giản.

Sản phẩm giải quyết bốn vấn đề:

- **Phòng ngừa:** hạn chế đơn hàng không có bằng chứng cần thiết.
- **Truy xuất:** tìm đúng bằng chứng ngay cả khi có hàng chục nghìn đơn.
- **Đối soát:** phát hiện khác biệt giữa hàng đã gửi và hàng hoàn về.
- **Bảo vệ quyền lợi:** chuẩn bị hồ sơ có tổ chức để người bán gửi yêu cầu xử lý tới sàn.

Ứng dụng quản lý mối quan hệ giữa: đơn đang xử lý, kiện đã đóng gói, bằng chứng ở từng công đoạn, hàng hoàn có khớp hàng đã gửi hay không, bằng chứng cần dùng khi có sự cố, và hồ sơ đã đủ chưa/người bán còn phải làm gì. Hệ thống phải đúng cả khi mọi việc bình thường lẫn khi phát sinh lỗi.

**Định vị trung thực:** hệ thống giúp ghi nhận có cấu trúc, truy xuất nhanh và tăng khả năng kiểm tra tính toàn vẹn. Không quảng cáo là "bằng chứng pháp lý tuyệt đối", không cam kết thắng kháng nghị.

## Vấn đề người bán gặp

- Khách báo thiếu hàng, sai hàng hoặc hàng hư hỏng.
- Hàng hoàn về không giống hàng đã gửi.
- Đã quay video nhưng không tìm được video đúng đơn.
- Video nằm trong thư viện điện thoại, dung lượng lớn, dễ bị xóa hoặc thất lạc.
- Có video nhưng không biết thuộc kiện nào, ai quay, quay lúc nào, đã tải lên đầy đủ chưa.
- Cần tập hợp nhanh bằng chứng để làm việc với sàn, đơn vị vận chuyển hoặc khách hàng.

## Kết quả phải mang lại

- **Truy xuất nhanh:** tìm một đơn và xem toàn bộ lịch sử đóng gói, kiện, video, ảnh, hồ sơ hoàn.
- **Không mất dấu bằng chứng:** phân biệt rõ chưa tải, tải lỗi, đã tải đủ, đã kiểm tra toàn vẹn.
- **Xử lý tranh chấp có hệ thống:** gom bằng chứng theo đơn và vụ việc, lưu lịch sử, xuất hồ sơ.
- **Dùng được ở nhiều quy mô:** shop nhỏ thao tác từng đơn; shop lớn phân quyền nhân viên và xử lý liên tục.

## Đối tượng khách hàng

Shop cá nhân, doanh nghiệp có nhiều nhân viên đóng hàng, nhà bán đa sàn, kho hàng hoàn, đơn vị fulfillment. Người dùng trực tiếp: chủ shop, quản lý, nhân viên đóng gói, nhân viên hàng hoàn. Khách hàng trọng tâm khi ra mắt: còn mở (O-01).

## Phạm vi

| Thành phần | Phạm vi |
|---|---|
| Ứng dụng iOS và Android (React Native) | Sản phẩm chính, ưu tiên thiết kế và trải nghiệm |
| Backend | Firebase (backend-as-a-service), không xây backend riêng |
| Landing page | Giới thiệu sản phẩm, gói dịch vụ, đăng ký, liên kết tải app |
| Website hướng dẫn | Bài SEO, hướng dẫn quay và quản lý bằng chứng |
| Kết nối sàn | Không bắt buộc để bắt đầu; nhập thủ công là luồng cơ bản |
| Quản trị nội bộ | Quản lý khách hàng, thanh toán, hỗ trợ — giao diện nội bộ riêng khi cần, không phải web app cho người bán |

Các chức năng triển khai theo giai đoạn, nhưng mô hình dữ liệu và quy tắc nghiệp vụ phải thiết kế để không phải xây lại khi mở rộng.

### Website marketing

Chỉ phục vụ marketing, SEO và chuyển đổi; không mang nghiệp vụ quản lý đơn lên web.

- Trang chủ/landing: nỗi đau, cách giải quyết, quy trình dùng, lợi ích, nút tải app.
- Trung tâm kiến thức: hướng dẫn đóng hàng, quay video đúng cách, xử lý hàng hoàn, chuẩn bị hồ sơ kháng nghị.
- SEO theo ý định tìm kiếm: trả lời câu hỏi cụ thể của người bán, không viết bài đại trà.
- Trang tin cậy: bảng giá, FAQ, liên hệ, chính sách quyền riêng tư, điều khoản dịch vụ, chính sách lưu trữ dữ liệu.
- Đo lường: nguồn truy cập, lượt nhấn tải app, đăng ký mới, tỷ lệ chuyển đổi.

## Nguyên tắc trải nghiệm

Shop mới phải bắt đầu được trong vài phút: đăng ký → tạo shop → quét mã đầu tiên hoặc tạo đơn → dùng quy trình mặc định → quay thử và thấy xác nhận đã lưu → dùng ngay; chỉ cấu hình thêm khi có nhiều nhân viên/kho/quy trình đặc biệt.

- Màn hình chính có nút lớn: **Đóng hàng, Hàng hoàn, Tra cứu bằng chứng, Tranh chấp**; hiển thị hồ sơ thiếu video và lượt kiểm tra đang chờ.
- Ưu tiên camera và máy quét, hạn chế gõ; không bắt nhập lại thông tin đã có.
- Không coi video mới quay nhưng chưa tải xong là bằng chứng đã lưu.
- Mất mạng: báo rõ trạng thái và cách tiếp tục; không hứa lưu ngoại tuyến nếu thiết bị không hỗ trợ.
- Hướng dẫn ngắn ngay tại thao tác, không bắt đọc tài liệu dài.
- Hồ sơ đơn hiển thị dạng dòng thời gian: đóng hàng, bàn giao, hoàn hàng, kiểm tra, bất thường, vụ việc liên quan.
- Cần chuẩn hóa design system: màu, typography, khoảng cách, trạng thái tải lên, lỗi, quyền camera, component dùng chung.

## Gói dịch vụ (khung phân tầng)

Không chỉ bán "số ngày lưu video"; gói phản ánh quy mô, dung lượng, nhu cầu quản lý. Đây là khung, **chưa phải bảng giá hay cam kết giới hạn**.

| Quyền lợi | Cơ bản | Tăng trưởng | Vận hành lớn |
|---|---|---|---|
| Quản lý đơn và bằng chứng | Có | Có | Có |
| Quay video và tải lên nền | Có | Có | Có |
| Thời hạn lưu | Ngắn hơn | Dài hơn | Dài nhất theo chính sách |
| Số thành viên | Giới hạn | Mở rộng | Phân quyền nâng cao |
| Quản lý theo lô | Cơ bản | Nâng cao | Nâng cao |
| Hàng hoàn, tranh chấp | Chức năng nền tảng | Báo cáo mở rộng | Quy trình và báo cáo nâng cao |
| Xuất bộ bằng chứng | Giới hạn hợp lý | Hạn mức cao hơn | Hạn mức cao hơn, quản trị tốt hơn |

Hạn mức và thời hạn phải hiển thị ngay trong ứng dụng; không để người dùng tưởng bằng chứng an toàn rồi mới phát hiện bị giới hạn hoặc sắp hết hạn.

## Năng lực mở rộng (sau lõi)

- **Báo cáo vận hành:** bao nhiêu đơn đã đóng nhưng thiếu video hôm nay; đơn hoàn chờ kiểm tra; hồ sơ chưa đủ bằng chứng; kho/nhân viên hay bỏ bước ghi hình; giá trị hàng liên quan vụ việc; chi phí lưu trữ theo shop. Báo cáo dựa trên dữ liệu thực, có lọc và xuất file.
- **Quản trị SaaS nội bộ:** tenant, người dùng, shop; gói, giới hạn đơn/dung lượng/thời gian lưu; thanh toán, hóa đơn, gia hạn; hỗ trợ và sự cố; giám sát chi phí lưu trữ/băng thông; quản lý tích hợp; xử lý yêu cầu xuất/xóa dữ liệu.
- **Tích hợp & tự động hóa:** sàn và đơn vị vận chuyển có API/quyền hợp lệ; cần cơ chế đồng bộ lại, xử lý sự kiện trùng, cảnh báo khi kết nối lỗi. Nhập file Excel/CSV.
- **Loại hàng đặc thù:** hàng giá trị cao, điện tử, mỹ phẩm, dễ vỡ, đơn nhiều sản phẩm. Mỗi shop dùng quy trình mặc định, chỉ tùy chỉnh khi cần.

## Lộ trình

Thứ tự đưa năng lực vào sản phẩm — không có nghĩa dùng mô hình dữ liệu tạm rồi xây lại. Ngay từ đầu phải chuẩn hóa định danh, quan hệ đơn–kiện–phiên–bằng chứng, quyền sở hữu dữ liệu, quy tắc lưu trữ.

1. **Nền tảng nghiệp vụ:** tài khoản/shop, đơn hàng, phiên đóng gói, video gốc, tải lên nền, trạng thái, nhật ký.
2. **Hoàn thiện vòng đời:** hàng hoàn, sai lệch, vụ tranh chấp, xuất bộ bằng chứng.
3. **Vận hành chuyên nghiệp:** phân quyền nâng cao, báo cáo, quản lý theo lô, gói dịch vụ, quản lý dung lượng.
4. **Mở rộng:** tích hợp sàn, nhập file, tự động hóa, dịch vụ xác minh bằng chứng nâng cao (dấu thời gian tin cậy, ký số).

Thời gian và ngân sách chỉ xác định sau khi chốt phạm vi, quy mô đơn, dung lượng video và mức tích hợp; không đưa con số cố định trước khi có đặc tả đủ chi tiết.

**Bước tiếp theo:** hoàn thiện wireframe và đặc tả A05/A06 và B03/B05 trước (điểm quyết định video có được ghi, lưu và gắn đúng hồ sơ), rồi đến danh sách, tìm kiếm, đồng bộ, tranh chấp; sau đó bản đồ điều hướng toàn app; cuối cùng chuyển thành thiết kế kỹ thuật React Native + Firebase.
