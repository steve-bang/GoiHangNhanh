# 06 — Chính sách bằng chứng & lưu trữ

Đây là phần quan trọng nhất của sản phẩm: nếu không chứng minh được video thuộc đúng hồ sơ và không có dấu hiệu bị thay đổi, giá trị trong tranh chấp giảm đáng kể.

## Sáu nguyên tắc bắt buộc

1. **Định danh duy nhất.** Mỗi video, ảnh, phiên quay, lần đóng gói có ID riêng. Mã đơn chỉ là thuộc tính liên kết.
2. **Lưu nguyên bản.** Video gốc không bị chỉnh sửa/ghi đè trong quy trình thông thường. Bản cắt/nén/xem trước là bản dẫn xuất, giữ quan hệ với bản gốc. Không tự xóa bản gốc sau khi tạo bản xem trước.
3. **Kiểm tra toàn vẹn.** Tính mã băm mật mã (ví dụ SHA-256) trên tệp gốc đã hoàn tất; sau khi tải lên, kiểm tra lại nội dung lưu trữ so với mã băm đã ghi nhận.
4. **Nhật ký kiểm toán.** Ghi ai tạo, xem, xuất, liên kết, đổi thông tin, khôi phục, yêu cầu xóa bằng chứng; kèm thời điểm và kết quả. Người dùng thường không sửa/xóa được.
5. **Xác nhận sao lưu.** Chỉ hiển thị "Đã lưu an toàn trên máy chủ" khi tải lên đầy đủ và kiểm tra cần thiết thành công.
6. **Kiểm soát truy cập và xóa.** Chỉ thành viên có quyền trong shop truy cập được. Xóa/hết hạn/giải phóng dung lượng tuân theo thời hạn lưu, tình trạng tranh chấp và quyền hạn.

## Giới hạn của mức bảo đảm (phải diễn đạt chính xác)

- Mã băm chứng minh tệp nhất quán so với thời điểm tính; **không** chứng minh video chưa bị sửa trước khi đưa vào app, không chứng minh thời điểm quay, không chứng minh sự kiện được quay liên tục hay phản ánh sự thật.
- Thời gian điện thoại có thể sai/bị đổi → lưu riêng thời gian thiết bị và thời gian máy chủ tiếp nhận; không tuyên bố dấu thời gian tự nó chứng minh thời điểm quay.
- Phân biệt "không chỉnh sửa" (quy trình hạn chế + lưu dấu vết) với "không thể chỉnh sửa" — không hứa điều sau.
- Video nhập từ thư viện (nếu O-02 cho phép) phải được gắn nhãn nguồn và có mức bảo đảm thấp hơn video quay trong app.

Biện pháp tăng độ tin cậy: giữ nguyên tệp gốc; tính và lưu mã băm; kiểm tra sau tải lên; nhật ký kiểm toán có kiểm soát truy cập; không cho ghi đè tệp gốc qua giao diện; hạn chế quyền sửa metadata; sao lưu và khôi phục; tương lai có thể bổ sung dấu thời gian tin cậy hoặc ký số nếu cần chứng cứ pháp lý.

## Metadata tối thiểu của mỗi tài liệu

- ID tài liệu; ID phiên đóng gói hoặc hồ sơ hàng hoàn.
- ID shop, đơn, kiện, người thực hiện.
- Loại: video gốc, ảnh, bản dẫn xuất, tệp xuất; nguồn (quay trong app / nhập).
- Thời điểm bắt đầu/kết thúc quay (nếu xác định được); thời điểm app ghi nhận; thời điểm tải lên và máy chủ xác nhận.
- Thời lượng, dung lượng, định dạng, mã băm tệp gốc.
- Trạng thái lưu cục bộ, tải lên, kiểm tra toàn vẹn.
- Lịch sử lỗi, thử lại, thay đổi liên kết.
- Thời hạn lưu dự kiến; tình trạng bảo toàn do tranh chấp.
- Phiên bản app và thông tin thiết bị cần để điều tra sự cố — thu thập tối thiểu.

## Tải lên nền

iOS và Android giới hạn tiến trình nền khác nhau, nên **không thể hứa** video luôn tải xong sau khi người dùng đóng app hoặc hệ điều hành dừng app. Thiết kế phải có: hàng đợi tải lên bền vững lưu trên thiết bị; thử lại và tiếp tục tải (resumable) khi khả thi; tận dụng tải nền mà hệ điều hành hỗ trợ; tiếp tục khi mở lại app và thông báo khi người dùng cần mở app; cơ chế đối soát tìm video đã quay nhưng chưa tải xong.

| Tình huống | Quy tắc |
|---|---|
| Mất mạng | Giữ tệp cục bộ, chờ thử lại |
| Tải lên bị ngắt | Tiếp tục hoặc tải lại an toàn, không tạo bằng chứng trùng |
| Thoát app | Giữ trạng thái, khôi phục hàng đợi khi mở lại |
| Thiết bị sắp hết dung lượng | Cảnh báo, ưu tiên bảo vệ tệp chưa tải lên |
| Tệp hỏng | Đánh dấu lỗi, không báo đã sao lưu |
| Máy chủ nhận đủ tệp | Kiểm tra dung lượng, metadata, mã băm |
| Tải lên thành công | Ghi thời điểm xác nhận và trạng thái lưu trữ |
| Xóa bản cục bộ | Chỉ theo chính sách an toàn, sau khi xác nhận bản máy chủ đầy đủ và người dùng được thông báo |

Không tự xóa video gốc trên điện thoại chỉ vì tải lên đã bắt đầu.

## Chính sách lưu trữ theo gói

Thời hạn tính theo chính sách áp dụng cho từng bằng chứng, không chỉ theo trạng thái đơn. Mỗi bằng chứng có: mốc bắt đầu tính hạn theo quy tắc công bố; ngày dự kiến hết hạn; gói/chính sách áp dụng; cờ giữ lại do tranh chấp; trạng thái chờ xóa / đã xóa / được gia hạn. Điều khoản dịch vụ phải nói rõ mốc bắt đầu (lúc quay, lúc tải lên thành công hay mốc khác) — O-06.

| Giai đoạn | Hành vi |
|---|---|
| Sắp hết hạn | Thông báo trong app theo các mốc công bố; danh sách bằng chứng sắp hết hạn; hướng dẫn nâng cấp, xuất hồ sơ, xử lý |
| Có tranh chấp đang mở | Đánh dấu cần bảo toàn; dọn dẹp tự động không được xóa trong thời gian giữ lại |
| Đã hết hạn | Theo chính sách công bố: gia hạn, chuyển gói, xuất dữ liệu, hoặc xóa có kiểm soát; xác định riêng cách xử lý bản sao lưu |

Quy tắc không được bỏ qua:

- Nâng cấp gói cập nhật quyền lợi lưu trữ theo điều kiện công bố.
- Hạ cấp không xóa ngay; có cảnh báo, thời gian chuyển tiếp, quy tắc rõ ràng.
- Ngừng gia hạn → thông báo tình trạng truy cập và lịch xóa dự kiến.
- Giữ lại do tranh chấp theo chính sách công bố, không mặc định vô thời hạn.
- Xóa có nhật ký, áp dụng cho dữ liệu chính và bản sao lưu theo lịch phù hợp.
- Không quảng cáo dữ liệu khôi phục được vĩnh viễn sau khi đã xóa theo chính sách.
- Cần rà soát pháp lý trước vận hành chính thức.

## Sao lưu và khôi phục

Có sao lưu, kiểm tra phục hồi định kỳ, mục tiêu thời gian khôi phục (RTO) và mức mất dữ liệu chấp nhận được (RPO) xác định trước khi phát hành.

## Hệ quả với Firebase (ghi chú cho giai đoạn thiết kế kỹ thuật — chưa chốt)

Nghiệp vụ trên phải hiện thực được trên React Native + Firebase mà không cắt yêu cầu. Những điểm cần xác nhận khi thiết kế kỹ thuật:

- "Không xây backend riêng" nhưng các bước tin cậy (xác minh mã băm sau tải lên, ghi nhật ký kiểm toán, đổi trạng thái sang Đã xác minh, dọn dẹp theo hạn lưu, tạo URL có thời hạn, xuất hồ sơ) **không được để client tự thực hiện** — cần chạy phía máy chủ trong hệ sinh thái Firebase (ví dụ Cloud Functions), còn client chỉ được ghi những gì Security Rules cho phép.
- Cô lập theo shop phải được thực thi bằng Security Rules cho cả cơ sở dữ liệu và Storage, và có kiểm thử truy cập chéo (QA-11).
- Mã băm do client tính phải được máy chủ tính lại trên tệp đã lưu để so sánh; không tin giá trị client gửi lên.
- Thời gian máy chủ lấy từ máy chủ, không từ thiết bị.
- Đánh giá chi phí lưu trữ/băng thông video và giới hạn tải lên nền của thư viện React Native được chọn trên thiết bị thật.

### Làm rõ từ thiết kế kỹ thuật đề xuất (chưa được duyệt)

Chi tiết và lý do: [engineering/architecture.md](engineering/architecture.md), [engineering/decisions.md](engineering/decisions.md). Các điểm dưới đây **làm rõ hoặc giới hạn** cách hiện thực nghiệp vụ; chúng không đổi hành vi nghiệp vụ, nhưng người dùng cần biết:

- **Tải nền có giới hạn nền tảng cụ thể.** iOS không tiếp tục tải nếu người dùng vuốt tắt app; Android 15 giới hạn dịch vụ nền loại truyền dữ liệu (`dataSync`) 6 giờ trong 24 giờ. Vì vậy giao diện chỉ được nói "sẽ tiếp tục khi có thể", và mỗi lần mở app phải đối soát lại hàng đợi với máy chủ.
- **Trạng thái "Đã tải lên", "Đã xác minh" chỉ do máy chủ xác lập.** Security Rules cấm client ghi các giá trị này; client chỉ phản ánh dữ liệu máy chủ. "Đã tải lên" = đối tượng trong Storage đã hoàn tất ghi; "Đã xác minh" = Cloud Function đã tính lại SHA-256 trên đối tượng và khớp mã băm client khai báo.
- **Bản cục bộ chỉ được giải phóng khi "Đã xác minh"** (điều kiện cần; còn chính sách an toàn và thông báo người dùng). "Đã tải lên" chưa đủ vì chưa kiểm tra mã băm — đây là cách đọc chặt của dòng "Xóa bản cục bộ" ở bảng tải lên nền.
- **Storage không cho client truy cập trực tiếp.** Tải lên qua phiên tải có thể tiếp tục do Function cấp; đọc qua URL có thời hạn do Function cấp (có nhật ký). Không dùng URL tải xuống kèm token của SDK vì không hết hạn.
- **Thu hồi quyền có hiệu lực ngay** nhờ Rules tra bảng thành viên ở mỗi thao tác (không dựa vào claims trong token, vốn cập nhật chậm).
- **Thời gian**: thời gian thiết bị (`…Device`) và thời gian máy chủ (`serverTimestamp`/`request.time`, do Rules ép) lưu riêng. Mốc bắt đầu tính hạn lưu (O-06) được giữ dưới dạng cấu hình trong `retention`, không hard-code, cho tới khi O-06 được chốt.
- **Ngoại tuyến**: dùng Firebase SDK native (không dùng JS SDK vì thiếu bộ nhớ đệm bền trên React Native). Firestore không ép duy nhất mã đơn nên đơn trùng tạo ngoại tuyến chỉ phát hiện được khi đồng bộ (câu hỏi Q-03).
- **Hồ sơ hàng hoàn trên máy chủ chỉ là bản "neo" định danh (R2b, Q-28).** Ảnh/video mở kiện của hàng hoàn được tải lên và xác minh phía máy chủ như bằng chứng đóng gói, nhưng nội dung hồ sơ hoàn (đơn gốc liên kết, tình trạng bên ngoài, kiểm kê, sai lệch) vẫn chỉ ở thiết bị cho tới khi làm đồng bộ nội dung (Q-26c). Hệ quả: máy chủ biết có bằng chứng thuộc hồ sơ nào nhưng chưa biết hồ sơ đó liên kết đơn nào; vị trí thiết bị lúc chụp ảnh KHÔNG gửi lên (chờ chính sách quyền riêng tư). Ảnh đã từng bắt đầu tải lên thì không xóa được (máy chủ có thể đã nhận).
- **Video, ảnh và CSDL trên máy không vào sao lưu của hệ điều hành (Q-24d = A, V1-01 + V1-12).** Android tắt Auto Backup cho cả app; iOS đặt cờ loại khỏi iCloud Backup cho thư mục bằng chứng và thư mục CSDL. Hệ quả: **đổi máy, cài lại app hoặc khôi phục máy từ bản sao lưu thì mất các tệp chưa tải lên và mọi dữ liệu chỉ có trên máy** (đơn chưa đăng, hồ sơ hàng hoàn, tranh chấp cục bộ); bằng chứng đã tải lên vẫn ở máy chủ. Giao diện không được nói dữ liệu trên máy "đã sao lưu". Trên iOS cờ là gợi ý cho hệ điều hành và chỉ có ở bản build có module cục bộ (không có trong Expo Go); chưa kiểm chứng trên máy (release-checklist G-7).
- **Xác minh mã băm cho video lớn** bị giới hạn thời gian/chi phí của Cloud Function; cần kiểm chứng trước khi cam kết SLA xác minh.
