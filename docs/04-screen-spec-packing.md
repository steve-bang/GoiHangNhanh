# 04 — Đặc tả màn hình: Đóng gói có ghi hình (A01–A08)

Danh mục màn hình giao diện (mã `UI-`) và ánh xạ sang các mã A01–A08 dưới đây: [09](09-ui-ux-design.md). Khung đặc tả mỗi màn hình: mục đích, thành phần, hành động, trạng thái, lỗi, tiêu chí nghiệm thu. Áp dụng các quy tắc chung ở cuối tài liệu.

Luồng chuẩn: **A01** Danh sách công việc → **A02** Tìm/tạo đơn → **A03** Xem nhanh đơn/kiện và bắt đầu quay → **A04** Kiểm tra sẵn sàng (chạy ngầm, chỉ hiện khi có vấn đề) → **A05** Quay → **A06** Xác nhận kết quả → **A07** Đồng bộ bằng chứng → **A08** Kết quả và đơn tiếp theo. Nhánh ngoại lệ có thể tới màn xử lý lỗi nhưng không được bỏ qua trạng thái lưu tệp, người thực hiện, hay quan hệ phiên–kiện.

## A01 — Danh sách công việc đóng gói

**Mục đích:** điểm bắt đầu thống nhất cho shop nhỏ và shop lớn.

**Thành phần:** nút Đóng gói đơn mới; nút quét mã; lối vào Đóng theo lô; bộ đếm phiên chưa hoàn tất / chờ tải lên / cần xử lý; danh sách phiên gần đây; cảnh báo dung lượng thiết bị hoặc tài khoản sắp hết hạn lưu.

| Hành động | Kết quả |
|---|---|
| Đóng gói đơn mới | Mở A02 |
| Đóng theo lô | Mở A02 ở chế độ liên tục |
| Chọn phiên chưa hoàn tất | Khôi phục đúng phiên nếu còn khả năng |
| Chọn video lỗi | Mở chi tiết lỗi và phương án xử lý |
| Chọn phiên đã hoàn tất | Mở hồ sơ bằng chứng; **không** tự bắt đầu quay mới |

**Lỗi:** không có quyền camera → chỉ cách cấp quyền trong cài đặt; thiếu dung lượng → cảnh báo trước khi quay; có phiên bị gián đoạn → thông báo và cho xử lý; mất mạng → vẫn cho vào luồng quay nếu lưu cục bộ được.

**Nghiệm thu:**
- Thấy được phiên cần xử lý và trạng thái bằng chứng mà không mở từng đơn.
- Mở phiên cũ không tạo phiên/video mới ngoài ý muốn.
- Bộ đếm theo dữ liệu thực, không tính video chưa tải lên là đã sao lưu.
- Không xem được danh sách của shop khác.

## A02 — Quét mã, nhập mã hoặc tạo đơn mới

**Mục đích:** bắt đầu từ mã vận đơn, mã nội bộ hoặc nhập thủ công, không cần tích hợp sàn.

**Thành phần:** khung camera quét barcode/QR (hỗ trợ cả máy quét ngoài); trường nhập mã; nút tìm; kết quả tìm thấy; nút Tạo đơn mới khi không có kết quả; nút hủy.

**Hành vi:**
- Quét thành công → chuẩn hóa ký tự trong phạm vi an toàn, tìm theo các loại mã hỗ trợ.
- Đúng một kết quả → hiển thị mã và tóm tắt để xác nhận.
- Không có → "Chưa có đơn hàng này" + lựa chọn tạo mới.
- Nhiều kết quả → yêu cầu chọn; không tự chọn kết quả đầu.
- Mã đã có phiên đóng gói → hiển thị lịch sử, hỏi xem phiên cũ hay tạo phiên mới.

**Quy tắc tạo nhanh (màn "Đơn hàng mới"):** gồm *Mã đơn hàng*, *Nguồn bán* (Shopee / TikTok Shop / Lazada / Khác–chưa xác định), và tùy chọn *Tên sản phẩm*, *Phân loại/variant*, *Số lượng*; nút **Lưu nhanh và tiếp tục** cùng lối **Quay ngay, khai báo sau**. Mã quét được điền sẵn.
- Không có mã ngoài → hệ thống tạo ID nội bộ.
- Tên sản phẩm/variant free text; không bắt buộc danh mục/SKU, giá, địa chỉ, thông tin khách hàng.
- Bỏ qua sản phẩm → hồ sơ mang nhãn **Chưa khai báo sản phẩm**; không chặn quay. Bổ sung sau có lịch sử.
- Gợi ý từ lịch sử nhập gần đây của shop; nhiều dòng trong cùng đơn, sửa số lượng ngay trên dòng; không gộp các variant khác nhau.
- Giá trị người dùng nhập được ghi nguồn *do người dùng nhập*.
- Kiểm tra trùng mã (mã đơn + nguồn bán) trong phạm vi shop trước khi tạo.

| Mã lỗi | Thông báo |
|---|---|
| `ORDER_NOT_FOUND` | Chưa tìm thấy đơn. Bạn có thể tạo đơn mới hoặc kiểm tra lại mã. |
| `ORDER_DUPLICATE` | Có nhiều bản ghi phù hợp với mã này. Hãy chọn đúng đơn trước khi tiếp tục. |
| `INVALID_CODE` | Mã nhập chưa hợp lệ hoặc chỉ chứa ký tự không được hỗ trợ. |
| `SEARCH_UNAVAILABLE` | Chưa thể tìm kiếm lúc này. Bạn có thể thử lại hoặc lưu bản nháp nếu có đủ thông tin. |

**Nghiệm thu:**
- Tạo được đơn mới khi không kết nối sàn nào.
- Free text giữ nguyên theo quy tắc chuẩn hóa đã công bố.
- Tạo đơn và vào quay được mà không nhập tên sản phẩm; hồ sơ hiện nhãn *Chưa khai báo sản phẩm*.
- Nhiều dòng cùng tên sản phẩm khác variant được giữ thành các dòng riêng.
- Quét trùng không ghi đè đơn/video cũ.
- Bấm nhiều lần khi mạng chậm không tạo đơn hai lần.
- Mất mạng → báo rõ việc tìm kiếm chưa hoàn tất; chỉ tạo bản nháp cục bộ khi có cơ chế xử lý trùng và đồng bộ.

## A03 — Xem nhanh đơn và kiện, bắt đầu quay

**Mục đích:** tạo liên kết chính xác đơn–kiện–phiên **trước khi mở camera**, nhưng không thêm bước xác nhận thừa: màn hình này vừa là chỗ nhìn lại đơn, vừa là nút bắt đầu quay.

**Thành phần:** mã đơn, nguồn bán, mã kiện (mặc định một kiện); các dòng sản phẩm/variant/số lượng nếu đã có (sửa số lượng ngay trên dòng); thêm dòng; chỉ nhập phần còn thiếu; thêm kiện (tùy chọn); nhãn *Chưa khai báo sản phẩm* nếu chưa có; nút **Bắt đầu quay**.

**Hành vi:**
- Sửa tự do trước khi quay.
- Đơn nhiều kiện → mỗi kiện có ID riêng.
- Sản phẩm trống → **không chặn**: cho quay ngay, gắn nhãn *Chưa khai báo sản phẩm*, nhắc bổ sung sau; hiển thị rằng nội dung đối chiếu sẽ hạn chế.
- Đơn đã đủ dữ liệu và một kiện → chỉ cần một chạm Bắt đầu quay; không có hộp thoại xác nhận phụ.
- Bấm Bắt đầu quay → tạo phiên đóng gói mới gắn đúng kiện, lưu ảnh chụp dữ liệu đơn tại thời điểm bắt đầu, rồi vào A05. Kiểm tra sẵn sàng (A04) đã chạy ngầm; chỉ chặn và hiện màn hình A04 khi có điều kiện bắt buộc không đạt.

**Lỗi:** "Vui lòng nhập số lượng hợp lệ"; "Kiện này đã có phiên đang thực hiện"; "Thông tin đơn đã thay đổi ở thiết bị khác" (yêu cầu tải lại hoặc xác nhận cách xử lý xung đột).

**Nghiệm thu:**
- Mỗi phiên có ID riêng, liên kết đúng shop, đơn, kiện.
- Thay đổi sau thời điểm bắt đầu quay không sửa ngầm ảnh chụp dữ liệu.
- Đơn nhiều kiện không dùng chung ID kiện.
- Không bắt đầu phiên khi chưa xác định được shop và đơn/kiện đích.

## A04 — Kiểm tra sẵn sàng ghi hình

**Mục đích:** phát hiện sớm điều kiện khiến video có thể không được lưu.

**Kiểm tra bắt buộc:** quyền camera; quyền micro (nếu quay có tiếng); dung lượng thiết bị theo ngưỡng vận hành; bộ nhớ tạm; phiên chưa bị thay thế bởi phiên khác; khả năng ghi tệp cục bộ; cảnh báo thiết bị quá nóng/bộ nhớ gần đầy nếu hệ điều hành cung cấp.

**Hiển thị:** các kiểm tra chạy ngầm từ A03; màn hình này chỉ hiện khi có điều kiện bắt buộc không đạt (hoặc người dùng mở lại để kiểm tra). Khi đạt hết, chuyển thẳng vào A05 mà không thêm thao tác.

**Hành động:** Bắt đầu quay (chỉ khi đạt điều kiện bắt buộc); Cấp quyền; Kiểm tra lại; Quay lại A03 không mất dữ liệu.

**Trạng thái:** Kiểm tra → Sẵn sàng | Không đủ điều kiện.

| Mã lỗi | Thông báo |
|---|---|
| `CAMERA_PERMISSION_DENIED` | Ứng dụng chưa có quyền camera. Hãy cấp quyền để ghi hình. |
| `MIC_PERMISSION_DENIED` | Ứng dụng chưa có quyền micro. Video có thể không có âm thanh; hãy cấp quyền hoặc tiếp tục theo chính sách shop. |
| `INSUFFICIENT_STORAGE` | Dung lượng thiết bị không đủ để bắt đầu an toàn. Hãy giải phóng dung lượng rồi kiểm tra lại. |
| `LOCAL_SAVE_UNAVAILABLE` | Không thể chuẩn bị nơi lưu video. Chưa bắt đầu ghi hình. |

**Nghiệm thu:**
- Không hiện "Đang quay" trước khi ghi tệp được.
- Lỗi dung lượng không xuất hiện lần đầu sau khi đã đóng gói xong.
- Quay không tiếng khi từ chối micro là chính sách cấu hình (O-09), không ngẫu nhiên.
- Quay lại không mất dữ liệu đơn.

## A05 — Màn hình quay video đóng gói

**Mục đích:** ghi liên tục quá trình đóng gói, dễ thao tác, khó gắn nhầm.

**Thành phần:** mã đơn, mã kiện, người thực hiện cố định trên màn hình; xem trước camera; bộ đếm thời lượng; chỉ báo đang ghi và trạng thái lưu cục bộ; checklist (thể hiện hàng hóa và số lượng / đưa hàng vào kiện / niêm phong); nút Dừng quay; nút Xử lý gián đoạn; cảnh báo khi camera ngắt hoặc lưu lỗi.

**Quy tắc:**
- ID phiên tạo trước khi bắt đầu ghi và gắn với đơn/kiện đang hiển thị.
- Ghi thời gian bắt đầu theo thiết bị, và thời điểm máy chủ biết khi có kết nối.
- Không chuyển phiên sang kiện khác khi đang ghi; đổi đơn khi đang quay → phải xử lý phiên hiện tại trước.
- Camera bị ngắt → không tự dừng và đánh dấu thành công.
- Sau khi dừng phải hoàn tất lưu tệp mới chuyển sang Đã lưu cục bộ.

| Gián đoạn | Hành vi |
|---|---|
| Cuộc gọi / app mất focus | Theo khả năng nền tảng: cảnh báo hoặc tạm dừng; đánh dấu phiên bị gián đoạn |
| Hệ điều hành thu hồi camera | Dừng an toàn nếu có thể; giữ phần đã lưu, ghi lỗi |
| Hết dung lượng giữa chừng | Cố kết thúc tệp an toàn; đánh dấu không hoàn chỉnh nếu không xác nhận được |
| Người dùng bấm dừng | Kết thúc ghi, chuyển sang hoàn tất lưu |
| App bị đóng đột ngột | Khôi phục bản ghi nếu tệp còn hợp lệ; không tự nhận là video đầy đủ |

Checklist hỗ trợ nhân viên nhưng không thay thế kiểm tra tính hợp lệ của tệp; app không bảo đảm mọi sự kiện vật lý đều có trong video.

**Nghiệm thu:**
- Mã đơn/kiện không đổi ngoài ý muốn trong phiên.
- Không có thao tác chuyển đơn khiến video tự gắn vào đơn mới khi phiên cũ chưa kết thúc.
- Thời lượng tăng khi ghi, dừng khi kết thúc.
- Chỉ đánh dấu Đã lưu cục bộ khi tệp lưu thành công.
- Phiên gián đoạn có trạng thái và thông báo riêng.
- Dừng, khôi phục, thử lại không tạo liên kết sai hay ghi đè bản gốc.

## A06 — Hoàn tất phiên và xác nhận video

**Mục đích:** phân biệt dừng quay, lưu tệp và xác nhận phiên.

**Thành phần:** xem trước video; mã đơn, kiện, thời lượng; trạng thái lưu cục bộ; Xác nhận hoàn tất; Xem lại; Ghi chú sự cố / Bắt đầu phiên bổ sung; thông báo gián đoạn hoặc khả năng thiếu nội dung.

**Quy tắc:**
- Chỉ xác nhận khi tệp đã lưu cục bộ và kiểm tra cơ bản thành công.
- Video ngắn hơn ngưỡng cấu hình (O-05) → cảnh báo, yêu cầu lý do hoặc quay lại theo chính sách shop.
- Quay bổ sung là phiên mới hoặc tài liệu bổ sung có quan hệ rõ với phiên ban đầu; không xóa video cũ.
- Video không phát được → đánh dấu lỗi, không cho xác nhận bằng chứng hoàn tất.

**Thông báo:**
- "Video đã lưu trên thiết bị. Đang chờ tải lên máy chủ."
- "Video có dấu hiệu bị gián đoạn. Hãy xem lại trước khi xác nhận."
- "Không thể đọc video vừa ghi. Tệp được giữ lại để xử lý; phiên chưa được xác nhận hoàn tất."
- "Video ngắn hơn mức khuyến nghị. Bạn có muốn kiểm tra lại hoặc ghi bổ sung không?"

**Nghiệm thu:** phân biệt được Đã lưu cục bộ và Đã tải lên; xem lại được trước khi xác nhận; phiên lỗi không thành hoàn tất chỉ bằng bấm xác nhận; ghi chú gắn đúng phiên; ghi bổ sung không ghi đè bản gốc.

## A07 — Tải lên nền và quản lý đồng bộ

**Mục đích:** nhân viên làm tiếp mà không mất kiểm soát bằng chứng.

**Thành phần:** danh sách video chờ; tiến độ; trạng thái mạng; Thử lại; Chi tiết lỗi; Mở hồ sơ liên quan; cảnh báo dung lượng và hạn mức gói.

**Quy tắc:**
- Mỗi tệp có mã công việc tải lên riêng; thử lại idempotent, không tạo bằng chứng trùng.
- Máy chủ đã nhận nhưng app chưa nhận phản hồi → lần sau đối soát trạng thái trước khi tải lại.
- Chỉ xóa bản cục bộ khi đạt điều kiện giải phóng đã phê duyệt (xem [06](06-evidence-retention-policy.md)).
- Vượt hạn mức → thông báo cách xử lý; không tự xóa video chưa tải lên.
- Gói hết hạn → hành vi theo điều khoản công bố, có cảnh báo rõ.

| Lỗi | Hành vi |
|---|---|
| Mất mạng | Giữ hàng đợi, tự thử lại khi điều kiện cho phép |
| Lỗi xác thực | Yêu cầu đăng nhập lại, giữ công việc cục bộ |
| Hết dung lượng lưu trữ đám mây | Cảnh báo hạn mức; không báo đã sao lưu |
| Tệp bị lỗi | Giữ trạng thái lỗi, hướng dẫn khôi phục |
| Mã băm không khớp | Cách ly tệp, không đánh dấu đã xác minh |
| Gói không cho lưu thêm | Hiển thị quyền lợi và lựa chọn; không xóa ngầm |
| Tệp vượt giới hạn dung lượng (ảnh 25 MB, video 2 GB; mã `UPLOAD_FILE_TOO_LARGE`) | "Tệp quá lớn nên không tải lên được. Tệp vẫn còn trên máy này." Chuyển ngay sang cần xử lý, không gửi, không tự thử lại; không xóa tệp trên máy |

**Nghiệm thu:**
- Video đang tải không chặn mở đơn tiếp theo.
- Đóng/mở lại app không mất hàng đợi.
- Không video nào thành Đã tải lên chỉ vì công việc tải bắt đầu.
- Mã băm sau tải lên được đối chiếu với bản gốc.
- Lỗi tệp và lỗi hạn mức hiện trong danh sách cần xử lý.
- Thử lại không tạo nhiều bản ghi cho cùng một tệp.
- Truy ngược được từ lỗi tải lên về đúng phiên, kiện, đơn.

## A08 — Kết quả đóng gói và đơn tiếp theo

**Mục đích:** kết thúc thao tác mà không làm nhân viên tưởng mọi bằng chứng đã an toàn.

- **Thành công:** hiển thị phiên hoàn tất và trạng thái video hiện tại; xem chi tiết; bắt đầu đơn tiếp theo hoặc về danh sách.
- **Video chưa tải xong:** "Phiên đóng gói đã hoàn tất — video đang chờ tải lên"; cho làm đơn khác; không dùng biểu tượng/màu gợi ý đã sao lưu.
- **Lỗi:** hiển thị việc cần làm, chi tiết lỗi, thử lại; không ép làm lại toàn bộ quy trình nếu chỉ lỗi ở khâu tải lên.

**Nghiệm thu:** chuyển đơn tiếp theo không đổi liên kết phiên trước; danh sách đúng trạng thái từng video; phiên chưa tải lên vẫn tìm được; xử lý lỗi sau được mà không phải đóng gói lại.

## Quy tắc chung (áp dụng cả A và B)

- Rời màn hình khi đang quay → cảnh báo, cho tiếp tục hoặc kết thúc phiên theo quy tắc an toàn. Vuốt đóng app không hủy phiên hay xóa tệp.
- App bị hệ điều hành kết thúc → lần mở sau khôi phục trạng thái phiên và hàng đợi khi dữ liệu còn.
- Mọi thao tác gắn với ID phiên và ID kiện/hồ sơ; không suy đoán từ mã đang hiển thị.
- Thao tác không thể đảo ngược (xóa bằng chứng) → kiểm tra quyền, xác nhận, ghi nhật ký.
- Thông báo lỗi theo **quy ước mới ở [docs/09 mục 5.1](09-ui-ux-design.md) ("Quy ước viết thông báo lỗi")**: tối đa 2 câu, dưới 20 từ, một ý, từ thường ngày; chỉ nêu ảnh hưởng khi người dùng có thể lo mất dữ liệu; có nút hành động khi có việc làm ngay. Tránh "Có lỗi xảy ra" khi xác định được nguyên nhân. *(Quy ước cũ "ba phần: điều gì xảy ra, ảnh hưởng, việc làm tiếp" đã thay thế.)* **Các thông báo trong docs 04 này chưa được viết lại theo quy ước mới** (ví dụ câu dài *"Video đã lưu trên điện thoại nhưng chưa tải lên được. Bằng chứng chưa được sao lưu lên máy chủ. Bạn có thể tiếp tục đơn khác và thử tải lại khi có mạng."* vượt 2 câu/20 từ); việc sau, cần BA rà soát từng màn. Nội dung "ảnh hưởng" của ví dụ này (chưa sao lưu lên máy chủ) vẫn cần giữ ý khi viết lại.
- Mỗi màn hình cần bộ trạng thái: loading, empty, offline, error, retry, success.
