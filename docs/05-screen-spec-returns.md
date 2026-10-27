# 05 — Đặc tả màn hình: Tiếp nhận hàng hoàn có ghi hình (B01–B08)

Áp dụng quy tắc chung ở cuối [04](04-screen-spec-packing.md#quy-tắc-chung-áp-dụng-cả-a-và-b). Nguyên tắc riêng của quy trình: xem [03 — Quy trình C](03-workflows.md#quy-trình-c--tiếp-nhận-hàng-hoàn).

> **Quy ước thông báo lỗi:** các câu "Thông báo" trong tài liệu này còn viết theo mẫu cũ (ba phần). Quy ước hiện hành ở [docs/09 mục 5.1](09-ui-ux-design.md) (tối đa 2 câu, dưới 20 từ, chỉ nêu ảnh hưởng khi người dùng có thể lo mất dữ liệu). Chưa viết lại; việc sau, cần BA rà soát từng màn.

Luồng chuẩn: **B01** Danh sách hàng hoàn → **B02** Tìm đơn gốc / tạo hồ sơ độc lập → **B03** Tiếp nhận kiện → **B04** Kiểm tra sẵn sàng → **B05** Quay mở kiện → **B06** Kiểm tra và đối chiếu → **B07** Xác nhận hồ sơ → **B08** Đồng bộ và xử lý tiếp.

## B01 — Danh sách tiếp nhận hàng hoàn

**Mục đích:** biết hồ sơ nào cần tiếp nhận, đang kiểm tra, thiếu bằng chứng hoặc chưa đồng bộ.

**Thành phần:** nút Nhận hàng hoàn mới; nút quét mã; danh sách gần đây; bộ lọc (chưa bắt đầu, đang mở kiện, đang kiểm tra, cần xử lý, chờ tải lên, hoàn tất); cảnh báo hồ sơ gián đoạn hoặc lỗi lưu video.

| Hành động | Kết quả |
|---|---|
| Nhận hàng hoàn mới | Mở B02 |
| Chọn hồ sơ dở dang | Khôi phục hồ sơ đó |
| Chọn hồ sơ hoàn tất | Mở chi tiết và bằng chứng |
| Chọn lỗi đồng bộ | Mở màn theo dõi tải lên (A07) |
| Tìm kiếm | Theo mã hoàn, mã đơn, mã vận đơn, mã hồ sơ |

| Mã lỗi | Hành vi |
|---|---|
| `RETURN_LIST_UNAVAILABLE` | Không tải được danh sách; nếu có dữ liệu cục bộ, hiển thị riêng và đánh dấu chưa đồng bộ |
| `RETURN_SESSION_INTERRUPTED` | Hồ sơ trước chưa hoàn tất; cho tiếp tục hoặc xem trạng thái |
| `RETURN_UPLOAD_PENDING` | Hồ sơ đã ghi nhận nhưng video chưa sao lưu lên máy chủ |

**Nghiệm thu:** hồ sơ dở dang không mất sau khi đóng app; phân biệt chưa đồng bộ với đã lưu máy chủ; mở hồ sơ không tạo bản ghi trùng.

## B02 — Xác định đơn gốc hoặc tạo hồ sơ độc lập

**Mục đích:** liên kết đúng hàng hoàn với đơn đã gửi, không bắt buộc biết mã đơn ngay.

**Thành phần:** quét mã trên kiện hoàn; nhập mã đơn/mã vận đơn; tìm đơn gần đây; kết quả và tóm tắt; lựa chọn **Không xác định được đơn gốc**; nút tiếp tục.

**Quy tắc:**
- Đúng một đơn → hiển thị mã, sản phẩm, lịch sử kiện để xác nhận.
- Không tìm thấy → tìm lại hoặc tạo hồ sơ chưa liên kết.
- Nhiều đơn phù hợp → không tự chọn kết quả đầu.
- Chưa chắc chắn → cho tiếp tục không liên kết.
- Liên kết về sau → sự kiện liên kết mới, ghi người, thời điểm, căn cứ.

| Mã lỗi | Thông báo |
|---|---|
| `SOURCE_ORDER_NOT_FOUND` | Chưa tìm được đơn gốc. Bạn có thể tiếp tục với hồ sơ chưa liên kết. |
| `SOURCE_ORDER_AMBIGUOUS` | Có nhiều đơn phù hợp. Hãy kiểm tra thêm trước khi chọn. |
| `RETURN_CODE_DUPLICATE` | Mã này đã có hồ sơ hàng hoàn. Hãy mở hồ sơ hiện có hoặc xác nhận đây là lần tiếp nhận khác. |
| `RETURN_ORDER_CONFLICT` | Thông tin đang chọn không khớp với hồ sơ hiện có. Hãy kiểm tra trước khi tiếp tục. |

**Nghiệm thu:** bắt đầu được khi không có mã đơn gốc; không liên kết ngầm với đơn không phù hợp; liên kết sau có lịch sử, không ghi đè quan hệ cũ; phân biệt nhiều lần hoàn của cùng một đơn.

## B03 — Tiếp nhận và ghi tình trạng bên ngoài kiện

**Mục đích:** lưu bằng chứng tình trạng kiện trước khi mở.

**Thành phần:** chọn nhiều tình trạng quan sát được — Nguyên vẹn; Móp/biến dạng; Rách/thủng; Ướt/thấm nước; Băng keo/niêm phong bất thường; Nhãn vận đơn khó đọc; Khác/chưa xác định. Chụp ảnh nhãn vận đơn, các mặt kiện, vị trí bất thường. Ghi chú. Xác nhận đã tiếp nhận → B04.

**Quy tắc:**
- Không mặc định "nguyên vẹn" khi nhân viên không chọn dấu hiệu nào.
- "Chưa xác định" là giá trị hợp lệ.
- Có dấu hiệu hư hỏng → đề nghị chụp vị trí đó trước khi mở.
- Ảnh trước khi mở là tài liệu bổ sung, không thay thế video mở kiện.
- Ghi thời điểm và người tiếp nhận.
- Mã vận đơn đọc được nhưng chưa khớp đơn gốc → lưu giá trị quan sát được, không tự liên kết.

**Thông báo:** "Chưa thể lưu ảnh. Hãy kiểm tra quyền camera và dung lượng thiết bị."; "Ảnh đã lưu trên thiết bị nhưng chưa tải lên máy chủ."; "Bạn chưa xác nhận tình trạng bên ngoài. Hãy kiểm tra lại trước khi tiếp tục."; "Không thể xác định tình trạng kiện. Bạn có thể ghi nhận là chưa xác định và tiếp tục."

**Nghiệm thu:** ghi được nhiều dấu hiệu đồng thời; ảnh gắn đúng hồ sơ; tình trạng lưu như quan sát của nhân viên, không bị diễn giải thành kết luận nguyên nhân; thiếu ảnh do lỗi thiết bị vẫn lưu được theo ngoại lệ, kèm cảnh báo thiếu bằng chứng hình ảnh.

## B04 — Kiểm tra sẵn sàng quay mở kiện

Dùng chung các kiểm tra kỹ thuật của [A04](04-screen-spec-packing.md#a04--kiểm-tra-sẵn-sàng-ghi-hình), thêm:

- Hồ sơ hàng hoàn đã có ID và đã lưu trạng thái tiếp nhận.
- Không có phiên quay khác đang hoạt động trên cùng hồ sơ.
- Người dùng có quyền ghi nhận hàng hoàn.

**Hành động:** Bắt đầu quay mở kiện; Kiểm tra lại; Quay lại bổ sung thông tin; Lưu tạm và tiếp tục sau (nếu chưa mở kiện).

**Ngoại lệ kiện đã mở trước khi quay:** không yêu cầu quay lại như thể chưa mở. Chọn nhánh *Kiện đã mở trước khi ghi hình*, ghi lý do, quay/chụp tình trạng hiện tại; hồ sơ đánh dấu quá trình mở ban đầu không được ghi lại.

**Thông báo:** "Không thể bắt đầu quay vì thiết bị chưa sẵn sàng lưu video."; "Hồ sơ đã có phiên quay mở kiện đang hoạt động."; "Kiện đã được mở trước khi quay. Hãy ghi nhận ngoại lệ thay vì xác nhận video đầy đủ."

**Nghiệm thu:** không quay khi không lưu cục bộ được; không có hai phiên mở kiện đồng thời trên một hồ sơ nếu không có quy tắc cho phép; xử lý được kiện mở trước mà không sai lịch sử; không ép hủy hồ sơ vì không quay được từ đầu.

## B05 — Quay video mở kiện

**Mục đích:** ghi liên tục từ trước khi mở niêm phong đến khi lấy hết hàng và kiểm tra ban đầu.

**Thành phần:** mã hồ sơ (ví dụ `RH-00082`), đơn gốc hoặc "chưa xác định"; xem trước camera; thời lượng; trạng thái lưu cục bộ; checklist (niêm phong trước khi mở / thao tác mở / hàng và phụ kiện được lấy ra / tình trạng hàng sau khi lấy ra); Dừng quay.

**Quy tắc:**
- Bắt đầu trước khi mở niêm phong; giữ nguyên ID hồ sơ và ID phiên suốt phiên.
- Đánh dấu checklist không tự khiến video được coi là đầy đủ.
- Camera gián đoạn → ghi thời điểm và nguyên nhân nếu có.
- Dừng rồi quay lại → phiên bổ sung liên kết phiên trước.
- Không cắt ghép/thay thế video gốc âm thầm.
- Kết thúc → lưu cục bộ và xác nhận đọc được trước khi chuyển bước.

**Ngoại lệ phải hỗ trợ:** kiện mở trước khi quay; niêm phong rách/mất; nhãn không đọc được; hàng đổ/rơi khi mở; video gián đoạn; phát hiện sai lệch ngay khi mở; hết dung lượng hoặc camera ngừng.

**Thông báo:**
- "Video đã bị gián đoạn. Phần đã lưu được giữ lại; hãy quay bổ sung và ghi nhận khoảng gián đoạn."
- "Không thể xác nhận video hoàn chỉnh. Hồ sơ vẫn được giữ lại để xử lý."
- "Kiện đã mở trước khi quay. Hồ sơ sẽ được đánh dấu là thiếu bằng chứng quá trình mở ban đầu."
- "Video đã lưu trên thiết bị. Chưa xác nhận tải lên máy chủ."

**Nghiệm thu:** phiên gắn đúng hồ sơ; gián đoạn không thành hoàn chỉnh; phiên bổ sung không xóa bản gốc; ghi rõ nếu không quay từ đầu; không tự kết luận hàng bị thay/thiếu/hư chỉ dựa vào video.

## B06 — Kiểm tra hàng nhận về và đối chiếu

**Mục đích:** biến quan sát thành bản ghi có cấu trúc để so sánh với đơn gửi đi.

**Thành phần:** hàng dự kiến theo đơn gốc (nếu có); hàng thực nhận; số lượng dự kiến / thực nhận; tình trạng; ghi chú, ảnh bổ sung; thêm dòng; ghi nhận sai lệch.

Mỗi dòng thực nhận: tên hàng và variant (free text), số lượng nếu xác định được, tình trạng quan sát, ghi chú, tài liệu liên quan. Có đơn gốc → gợi ý dòng để đối chiếu; không có → nhập thủ công, không cần danh mục. Dữ liệu dự kiến lấy từ đơn gốc (đúng như lúc đóng gói) được giữ nguyên; dữ liệu thực nhận là bản ghi riêng, không ghi đè. Hai variant khác nhau không gộp thành một dòng.

**Nhóm sai lệch:** thiếu hàng; thừa hàng; sai loại/mẫu; khác màu, kích cỡ, phiên bản; hư hỏng bên ngoài; thiếu phụ kiện; không xác định được; khác.

**Quy tắc:**
- "Không xác định được" là giá trị hợp lệ; không tự kết luận nguyên nhân.
- Sửa số lượng không xóa khai báo ban đầu — lưu lịch sử.
- Hàng không có trong đơn gốc → thêm dòng riêng, không thay sản phẩm dự kiến.
- Chưa có dữ liệu đơn gốc → hiển thị "Chưa có dữ liệu đối chiếu", **không** hiển thị số lượng dự kiến là 0.

**Thông báo:** "Số lượng nhập chưa hợp lệ."; "Chưa có dữ liệu đơn gốc để so sánh. Bạn có thể tiếp tục kiểm kê thủ công."; "Thông tin kiểm kê đã thay đổi ở thiết bị khác. Hãy tải lại trước khi lưu."; "Bạn đang ghi nhận sai lệch. Hãy bổ sung mô tả hoặc ảnh nếu có thể."

**Nghiệm thu:** kiểm kê được khi không có đơn gốc; so sánh không mất dữ liệu gốc; thêm được hàng ngoài dự kiến; mỗi sai lệch có ID, người ghi, thời điểm, tài liệu; không tự quy trách nhiệm khi chưa đủ căn cứ.

## B07 — Xác nhận hồ sơ hàng hoàn

**Mục đích:** tổng hợp tình trạng kiện, video mở kiện, kết quả kiểm tra, sai lệch.

**Thành phần:** tóm tắt đơn gốc hoặc trạng thái chưa liên kết; tình trạng trước khi mở; danh sách video/ảnh và trạng thái từng tài liệu; hàng thực nhận và sai lệch; ghi chú cuối; Xác nhận hồ sơ; Lưu tạm; Tạo vụ tranh chấp.

**Quy tắc:**
- Có thể hoàn tất nghiệp vụ khi video chưa tải xong (nếu chính sách cho phép), nhưng hiển thị rõ bằng chứng chưa sao lưu.
- Thiếu video mở kiện → ghi lý do và cảnh báo.
- Có video lỗi → không hiển thị "đầy đủ bằng chứng".
- Xác nhận hồ sơ ≠ kết luận tranh chấp.
- Thay đổi sau xác nhận lưu lịch sử; không viết lại ngầm.

**Thông báo:** "Hồ sơ đã hoàn tất. Video vẫn đang chờ tải lên."; "Hồ sơ có sai lệch chưa được xử lý. Bạn có thể xác nhận kiểm kê và tiếp tục xử lý."; "Thiếu video mở kiện. Hồ sơ sẽ được đánh dấu là có hạn chế về bằng chứng."; "Không thể xác nhận vì tài liệu cốt lõi chưa được lưu cục bộ."

**Nghiệm thu:** lưu tạm và tiếp tục được; hồ sơ hoàn tất có danh sách tài liệu, kiểm kê, lịch sử; trạng thái bằng chứng tách khỏi trạng thái kiểm kê; thay đổi sau xác nhận giữ dấu vết; người không có quyền không xác nhận/sửa được.

## B08 — Đồng bộ, mở tranh chấp hoặc đóng hồ sơ

**Lựa chọn:** xem hồ sơ; theo dõi tải lên; tạo tranh chấp từ sai lệch; liên kết đơn gốc sau; đóng hồ sơ khi không còn việc.

**Quy tắc:**
- Không tự mở tranh chấp khi người dùng chưa chọn hoặc chưa có quy tắc tự động được phê duyệt.
- Tạo tranh chấp liên kết bằng chứng bằng ID/tham chiếu, không sao chép thừa.
- Còn sai lệch chưa xử lý → cảnh báo trước khi đóng.
- Video còn trên thiết bị chưa tải lên → cảnh báo nổi bật.
- Hồ sơ thuộc tranh chấp đang mở → áp dụng bảo toàn dữ liệu.

**Nghiệm thu:** tạo tranh chấp không mất liên kết với hồ sơ hoàn; hồ sơ đã đóng vẫn tìm được theo quyền; bằng chứng đang giữ không bị dọn dẹp tự động xóa; mọi liên kết, xuất hồ sơ, đổi trạng thái được ghi nhật ký.
