# 09 — Thiết kế UI/UX

Hướng thiết kế cho ứng dụng iOS/Android. Tài liệu này nói **giao diện và tương tác**; hành vi nghiệp vụ, trạng thái và quy tắc dữ liệu vẫn do [02](02-domain-model-and-states.md)–[08](08-acceptance-qa-risks.md) quy định. Khi hai nơi khác nhau, nghiệp vụ thắng và phải sửa tài liệu này. Wireframe, màu và số liệu ở đây là định hướng, **chưa phải thiết kế đã dựng (Figma) hay ứng dụng đã triển khai**.

Đơn Chứng không được trông như một ERP thu nhỏ: đó là công cụ ghi nhận bằng chứng nhanh, rõ, có kiểm soát, luôn cho người dùng biết bằng chứng đang ở đâu. Người dùng thường đang cầm hàng, quét mã, quay video — không ngồi nhập liệu.

## Mã màn hình trong tài liệu này

Danh mục màn hình dùng tiền tố **`UI-`** (UI-A01…UI-J15) để không trùng với mã đặc tả quy trình `A01–A08` (đóng gói, [04](04-screen-spec-packing.md)) và `B01–B08` (hàng hoàn, [05](05-screen-spec-returns.md)). Bảng ánh xạ nằm ở cuối mục "Danh mục màn hình".

## 1. Triết lý

1. **Scan first, type less.** Từ Tổng quan chạm một nút là tới camera quét; chỉ hỏi phần còn thiếu; không bắt nhập tên sản phẩm trước khi quay (D-10).
2. **Evidence first, administration second.** Quay và lưu bằng chứng là hành động chính; sản phẩm, lịch sử, cài đặt đứng sau.
3. **Trạng thái trung thực.** Phân biệt lưu trên máy / đang tải / đã tải lên / đã xác minh; không dùng một dấu tick xanh cho tất cả.
4. **Một tay.** Nút chính ở vùng dễ chạm, nhãn chữ rõ, không phụ thuộc icon khó đoán.
5. **Không làm mất bằng chứng.** Không tự xóa video chưa đồng bộ, không ghi đè bản gốc, không ghép đoạn gián đoạn thành video có vẻ liên tục.

## 2. Kiến trúc thông tin

Thanh tab dưới, 4 tab:

| Tab | Vai trò |
|---|---|
| **Tổng quan** | Điểm bắt đầu: *Đóng gói đơn*, *Nhận hàng hoàn*, việc dang dở, cảnh báo đồng bộ/dung lượng |
| **Đơn hàng** | Tìm, lọc, mở hồ sơ đơn và bằng chứng liên quan |
| **Hàng hoàn** | Danh sách và tiếp nhận hàng hoàn, kiểm đếm, đối chiếu |
| **Đồng bộ** | Video đang tải, lỗi, dung lượng, trạng thái lưu trữ |

Hồ sơ shop, thành viên, gói dịch vụ, lưu trữ, cài đặt, trợ giúp nằm trong **menu tài khoản** (góc trên) / mục Hồ sơ. Tranh chấp (nhóm G) không phải tab: đi vào từ hồ sơ đơn, hồ sơ hàng hoàn hoặc "việc cần xử lý" — xem O-14.

Quy tắc điều hướng:
- Bắt đầu tác vụ chính trong ≤ 2–3 thao tác (Tổng quan → *Đóng gói đơn* → quét → quay).
- **Khi đang quay: giao diện quay chuyên biệt, ẩn thanh tab**, không cho rời bằng thao tác vô tình; rời phải cảnh báo hậu quả.
- Mỗi màn chỉ một hành động chính nổi bật; sửa/xóa/xuất ở vị trí phụ.
- Video đã lưu an toàn trên máy → được chuyển đơn tiếp theo, không chờ tải lên.
- Luôn có đường quay lại an toàn.

Luồng tổng thể: Mở app (kiểm tra phiên, shop, trạng thái lưu video) → Đóng gói *hoặc* Nhận hàng hoàn → Hồ sơ bằng chứng → (khi có tranh chấp) Hồ sơ vụ việc → chọn bằng chứng → xuất/chia sẻ theo khả năng hệ thống.

## 3. Design system

**Màu** (định hướng; kiểm tra tương phản đạt chuẩn trước khi chốt):

| Vai trò | Màu |
|---|---|
| Thương hiệu | Xanh rừng |
| Nền màn hình | Trắng ngà |
| Thành công (đã lưu/đã xác minh) | Xanh thành công |
| Cần chú ý / đang chờ | Cam cảnh báo |
| Lỗi, hành động phá hủy, nguy cơ mất dữ liệu | Đỏ — chỉ dùng cho các trường hợp này |

Màu không bao giờ là tín hiệu duy nhất: mọi trạng thái có **chữ + biểu tượng**. Hai trạng thái cùng sắc xanh (*Đã tải lên*, *Đã xác minh*) phải khác nhau rõ về nhãn và biểu tượng. Cần bản chế độ sáng; chế độ tối là quyết định mở.

**Chữ và kích thước:** font hệ thống hoặc sans-serif hỗ trợ đầy đủ tiếng Việt; tiêu đề màn 24–28 pt, tiêu đề khu vực 17–20 pt, nội dung 15–17 pt, chú thích ≥ 12–13 pt (không dùng cho thông tin quan trọng). Vùng chạm tối thiểu 44 pt (iOS) / 48 dp (Android). Tôn trọng Dynamic Type/font scale, vùng an toàn, bàn phím hệ thống. Bo góc vừa phải, ít đổ bóng/gradient/hiệu ứng trang trí.

**Thành phần dùng chung:** nút chính cố định gần đáy; thanh trạng thái bằng chứng có nhãn; ô quét/tìm/nhập nhanh; thẻ đơn, dòng sản phẩm, thumbnail video; bottom sheet cho lựa chọn ngắn (trang riêng cho tác vụ phức tạp); dialog xác nhận chỉ cho hành động quan trọng; skeleton khi tải; empty state có hành động cụ thể.

### Chuẩn hiển thị trạng thái bằng chứng

Nhãn thống nhất toàn app, ánh xạ với vòng đời tệp ở [02](02-domain-model-and-states.md):

| Nhãn hiển thị | Ý nghĩa | Trạng thái nghiệp vụ |
|---|---|---|
| **Đã lưu trên máy** | Lưu cục bộ, đọc được; chưa có bản trên máy chủ | Chờ tải lên (sau khi lưu xong) |
| **Chờ tải lên** | Đang chờ mạng/lượt xử lý; ghi lý do (ví dụ mất mạng) | Chờ tải lên |
| **Đang tải lên** | Có tiến độ khi xác định được | Đang tải lên |
| **Đã tải lên** | Máy chủ đã nhận đủ tệp | Đã tải lên |
| **Đã xác minh** | Mã băm trên máy chủ khớp bản gốc | Đã xác minh |
| **Lỗi – cần xử lý** | Nguyên nhân dễ hiểu + nút thử lại/cách khắc phục | Các trạng thái lỗi |

Trong lúc ghi (*Đang ghi*, *Đang lưu trên thiết bị*) màn quay hiển thị trạng thái riêng, không dùng các nhãn trên.

Quy tắc diễn đạt:
- Cụm "Đã lưu an toàn trên máy chủ" chỉ dùng cho **Đã xác minh** (khớp [06](06-evidence-retention-policy.md)). *Đã tải lên* mô tả đúng điều đó, không thêm "an toàn".
- "Đã xác minh" chỉ nói điều hệ thống thực sự kiểm tra (tính toàn vẹn tệp). Không diễn đạt thành "chắc chắn được sàn chấp nhận" hay "video chứng minh ai đúng ai sai".
- Thông tin người dùng khai báo không bị trình bày như dữ liệu đã xác minh từ sàn.
- Không dùng "Hoàn tất toàn bộ" khi còn lỗi hoặc bước bắt buộc dang dở; không dùng nút "OK/Tiếp tục" mơ hồ khi có thể dùng nhãn cụ thể (ví dụ *Giữ video và quay lại*).

## 4. Danh mục màn hình

Mỗi màn: mục đích, thành phần, hành động chính. Quy tắc nghiệp vụ chi tiết, mã lỗi, nghiệm thu: xem cột "Đặc tả".

### Nhóm A — Khởi động và thiết lập

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-A01 | Splash | Logo; kiểm tra phiên/cấu hình/đồng bộ ở nền; không đứng lâu; mất mạng vẫn vào được phần công việc cục bộ nếu phiên và dữ liệu cho phép |
| UI-A02 | Chào mừng | "Bảo vệ bằng chứng cho từng đơn hàng"; CTA *Đăng nhập* / *Tạo tài khoản*; liên kết Điều khoản và Quyền riêng tư; không onboarding nhiều trang; nút *Apple*/*Google* (bật bằng cờ cấu hình, O-15); liên kết pháp lý hiện là URL giữ chỗ, chưa có trang thật |
| UI-A03 | Đăng nhập / tạo tài khoản | Kiểm tra dữ liệu tại trường; quên mật khẩu, xác thực email, trạng thái đang xử lý; không báo thành công trước khi máy chủ xác nhận. Phương thức đăng nhập: O-15 |
| UI-A04 | Tạo hồ sơ shop | Tên shop là chính; nguồn bán chọn nhiều (Shopee, TikTok Shop, Lazada, Khác), bỏ qua được; không bắt địa chỉ, mã số thuế, dữ liệu khách hàng |
| UI-A05 | Giải thích quyền | Vì sao cần camera/micro/ảnh–tệp/thông báo; **chỉ xin quyền khi bắt đầu tác vụ liên quan**; bị từ chối → hướng dẫn mở Cài đặt, không lặp popup; không xin danh bạ/vị trí |
| UI-A06 | Hoàn tất thiết lập | "Quét mã đơn để bắt đầu"; CTA *Bắt đầu sử dụng*; bỏ qua hướng dẫn được |

### Nhóm B — Tổng quan và bắt đầu công việc

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-B01 | Tổng quan | Thứ tự trên xuống: tên shop + menu tài khoản; khối đồng bộ (nếu có lỗi/tệp chờ); hai nút lớn *Đóng gói đơn*, *Nhận hàng hoàn*; đơn gần đây; việc cần xử lý (video lỗi, phiên chưa hoàn tất, dung lượng). **Không** biểu đồ doanh thu/lợi nhuận |
| UI-B02 | Trung tâm quét mã | Camera quét ngay; đèn pin, nhập tay, tìm đơn đã lưu; hiện mã vừa quét; quét xong tự tra cứu (không nút "Tìm"); chống quét lặp; mã không nhận diện → nhập lại hoặc tạo nhanh |
| UI-B03 | Tìm đơn thủ công | Ô tìm lớn theo mã đơn/vận đơn; lịch sử tìm; kết quả: mã đơn, nguồn bán, ngày, trạng thái bằng chứng; trùng mã giữa nhiều nguồn → bắt chọn đúng hồ sơ |
| UI-B04 | Tạo hồ sơ đơn nhanh | Mã đơn (điền từ mã quét), nguồn bán, mã vận đơn (tùy chọn), sản phẩm (gợi ý từ lịch sử), variant, số lượng (tăng/giảm nhanh, mặc định 1). Nút chính *Lưu và quay video*; phụ *Bỏ qua thông tin sản phẩm*. Mã chưa có → "Chưa có hồ sơ đơn này", không giả vờ lấy dữ liệu từ sàn |
| UI-B05 | Chế độ xử lý liên tục | Đếm số đơn đã quét trong phiên; mỗi mã một mục trong danh sách tạm; quét tiếp/sửa nhanh/mở để quay; khi quay khóa đúng đơn và kiện; **không tự chuyển đơn khi video đang ghi** |

### Nhóm C — Đóng gói và quay video gửi hàng

Luồng rút gọn: Quét/nhập mã → tra cứu hoặc tạo nhanh → (kiểm tra ngầm) → quay → lưu an toàn → tải nền → đơn tiếp theo.

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-C01 | Xem nhanh đơn trước khi quay | Mã đơn + nguồn bán nổi bật; sản phẩm dạng tóm tắt; nhãn *Chưa khai báo sản phẩm* nếu có; thêm nhiều dòng; đơn nhiều kiện → chọn/tạo kiện. CTA chính **Bắt đầu quay** (đồng thời là bước tạo phiên) |
| UI-C02 | Kiểm tra trước khi quay | Camera, micro, bộ nhớ đủ cho phiên dự kiến, quyền, khả năng lưu cục bộ. **Chạy ngầm; chỉ hiện khi có điều kiện không đạt**, kèm cách khắc phục cụ thể. Chỉ cho quay khi đủ điều kiện ghi và lưu an toàn |
| UI-C03 | Quay video | Khung camera chiếm phần lớn; mã đơn, mã kiện, đồng hồ luôn hiện; nút ghi/dừng rõ; cảnh báo camera gián đoạn/gần hết bộ nhớ; **không** bộ lọc/làm đẹp/chỉnh sửa; không đổi đơn khi đang quay; gián đoạn phải ghi nhận và hiển thị |
| UI-C04 | Kết thúc và xác nhận | Thumbnail, thời lượng, mã đơn; xem lại / ghi thêm đoạn riêng / dùng video; nhãn "phiên quay bị gián đoạn" nếu có; CTA *Lưu bằng chứng* — báo lưu thành công chỉ sau khi tệp đã ghi an toàn |
| UI-C05 | Lưu và đồng bộ | Trạng thái cục bộ tách khỏi cloud; tiến độ khi xác định được; được làm tiếp trong lúc tải; mất mạng → *Chờ tải lên* và tự thử lại; không xóa tệp cục bộ trước khi máy chủ xác nhận và chính sách cho phép. Không bắt đứng nhìn thanh tiến trình |
| UI-C06 | Hoàn tất đóng gói | Tóm tắt số video + trạng thái; chưa tải xong → "Video đã lưu trên thiết bị — đang chờ đồng bộ"; CTA chính *Đóng gói đơn tiếp theo*, phụ *Xem bằng chứng* |

### Nhóm D — Nhận hàng hoàn

Phải khác luồng đóng gói: ghi nhận tình trạng kiện **trước** khi mở rồi mới kiểm hàng; không chỉ đổi tiêu đề của màn quay.

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-D01 | Danh sách hàng hoàn | Tìm theo mã đơn/vận đơn/mã hoàn; gần đây; lọc: đang tiếp nhận, đang kiểm tra, đã kiểm tra, có sai lệch, chưa đồng bộ; CTA *Tiếp nhận hàng hoàn* |
| UI-D02 | Tìm đơn gốc | Quét/nhập; thấy đơn → hiện nguồn bán và dữ liệu khai báo ban đầu; không thấy → tạo hồ sơ hoàn chưa ghép đơn; nhiều kết quả → bắt chọn chính xác; **không tự ghép vì mã gần giống** |
| UI-D03 | Ghi nhận kiện bên ngoài | Ảnh tổng thể + nhãn vận chuyển; tình trạng (nguyên vẹn, móp, rách, ướt, niêm phong bất thường, nhãn không đọc được, khác, chưa xác định); ghi chú ngắn; không bắt mô tả dài; CTA *Tiếp tục ghi hình mở kiện* |
| UI-D04 | Quay video mở kiện | Giao diện camera giống đóng gói để giảm học; mã hồ sơ hoàn cố định; hướng dẫn "Quay từ trước khi mở niêm phong đến khi lấy hết hàng ra"; kiện đã mở trước → ghi ngoại lệ; gián đoạn → lưu từng phiên riêng, hiển thị rõ |
| UI-D05 | Kiểm tra hàng thực nhận | Mỗi dòng: tên + variant khai báo, SL dự kiến vs thực nhận, tình trạng (bình thường, hư hỏng, thiếu phụ kiện, khác), kết quả đối chiếu (khớp, thiếu, thừa, sai variant, hư hỏng, chưa xác định). Dữ liệu ban đầu chỉ để đối chiếu, **không bị ghi đè** |
| UI-D06 | Xác nhận kết quả kiểm tra | Tóm tắt kiện + sản phẩm + sai lệch; sửa trước khi xác nhận; lưu lịch sử sửa; **không kết luận ai có lỗi** — chỉ ghi điều quan sát và khai báo |
| UI-D07 | Hoàn tất tiếp nhận | Trạng thái nghiệp vụ tách khỏi trạng thái tải lên; liệt kê bằng chứng đã lưu/chưa tải/lỗi; CTA *Xem hồ sơ hàng hoàn*, phụ *Tạo hồ sơ tranh chấp*; chưa đồng bộ → cảnh báo rõ nhưng không mất dữ liệu kiểm tra đã lưu |

### Nhóm E — Đơn hàng và hồ sơ bằng chứng

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-E01 | Danh sách đơn | Tìm theo mã đơn/vận đơn; lọc nguồn bán, thời gian, trạng thái bằng chứng; thẻ: mã, nguồn bán, ngày, số video — không nhồi nhiều trường |
| UI-E02 | Chi tiết đơn | Khu vực thu gọn được: nhận diện; sản phẩm/variant khai báo; kiện; bằng chứng đóng gói; hàng hoàn liên quan; lịch sử. CTA chính *Xem bằng chứng*; sửa thông tin là hành động phụ |
| UI-E03 | Danh sách bằng chứng | Thumbnail; loại (đóng gói, mở kiện hoàn, ảnh tình trạng kiện, ảnh kiểm hàng); thời gian, thời lượng; trạng thái theo chuẩn mục 3 — không chỉ thumbnail xanh/dấu tick |
| UI-E04 | Chi tiết video | Trình phát; mã đơn/kiện, thời điểm, thời lượng; trạng thái tải lên/xác minh; thông tin phiên quay kể cả gián đoạn; chia sẻ/xuất nếu được phép. Thêm phiên mới không ghi đè bản gốc |
| UI-E05 | Lịch sử thay đổi | Ai, lúc nào, trường nào; trường quan trọng có giá trị trước/sau; phân biệt dữ liệu người dùng nhập với dữ liệu xác nhận từ nguồn tích hợp (nếu có sau này); không sửa/xóa theo cách thông thường |

### Nhóm F — Đồng bộ, lỗi, dung lượng

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-F01 | Trung tâm đồng bộ | Lọc: Đang tải lên, Chờ tải lên, Lỗi, Đã tải lên; mỗi tệp: tên hồ sơ, dung lượng, tiến độ/lý do chờ; thử lại, chi tiết, mở hồ sơ; thử lại hàng loạt cho tệp đủ điều kiện; **không có "Xóa tất cả"** |
| UI-F02 | Chi tiết lỗi đồng bộ | Ví dụ: "Video vẫn được lưu trên thiết bị. Chưa thể tải lên vì kết nối mạng không ổn định."; nêu nguyên nhân, nêu dữ liệu còn ở đâu; CTA *Thử tải lên lại*; không bắt quay lại nếu tệp gốc còn nguyên |
| UI-F03 | Dung lượng và lưu trữ | Riêng biệt: dung lượng cục bộ, tệp chờ tải, cloud đã dùng, giới hạn + thời hạn theo gói, tệp giải phóng được an toàn. Không tự xóa tệp chưa tải/bằng chứng bị giữ; trước dọn phải nêu tệp nào bị xóa và bản nào vẫn còn |
| UI-F04 | Ngoại tuyến | Banner nhỏ "Đang ngoại tuyến — bằng chứng sẽ được đồng bộ khi có mạng"; tiếp tục ghi nhận nếu lưu cục bộ được; thao tác cần máy chủ đánh dấu riêng; có mạng lại thì tự đồng bộ; phiên đăng nhập hết hạn không bị bỏ qua âm thầm |

### Nhóm G — Tranh chấp và xuất bằng chứng

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-G01 | Danh sách tranh chấp | Mã vụ việc/đơn; ngày tạo; trạng thái; số bằng chứng; nhãn thiếu bằng chứng/chưa đồng bộ; không tự kết luận kết quả |
| UI-G02 | Tạo hồ sơ tranh chấp | Chọn đơn hoặc hồ sơ hoàn; vấn đề (thiếu hàng, sai variant, hư hỏng, tình trạng kiện, khác); mô tả ngắn; không bắt khai lại thông tin đã có |
| UI-G03 | Chọn bằng chứng | Video/ảnh theo thời gian; chọn nhiều; cảnh báo tệp chưa tải/gián đoạn; trạng thái đầy đủ của bộ; có tranh chấp → đánh dấu giữ bằng chứng |
| UI-G04 | Xem trước và xuất | Danh sách nội dung; thông tin đơn, thời điểm, trạng thái tệp; bản tóm tắt + gói file theo định dạng hỗ trợ; tệp chưa trên cloud → báo trước; không gắn nhãn "đầy đủ" khi thiếu thành phần bắt buộc |
| UI-G05 | Chi tiết và đóng hồ sơ | Lý do, đơn liên quan, bằng chứng, lịch sử; bổ sung tệp/ghi chú; xác nhận trước khi đóng; chỉ bỏ trạng thái giữ theo quy tắc nghiệp vụ, không xóa dữ liệu chỉ vì đổi trạng thái |

Lưu ý: xuất PDF/ZIP/chia sẻ phải được xác định trong đặc tả và kiểm thử riêng. App không tuyên bố "đã gửi" khi mới tạo file hoặc mở màn chia sẻ (O-08).

### Nhóm H — Gói dịch vụ và thanh toán

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-H01 | Gói hiện tại | Tên gói, trạng thái, thời hạn; giới hạn lưu trữ + thời gian lưu; cảnh báo sắp đạt giới hạn; CTA *Xem các gói* |
| UI-H02 | So sánh gói | Thời gian lưu, dung lượng cloud, số thành viên/thiết bị, xuất hồ sơ + tính năng nâng cao, giá/chu kỳ/gia hạn; **nêu rõ điều gì xảy ra với dữ liệu khi hết hạn gói**, không chỉ làm nổi giá |
| UI-H03 | Xác nhận thanh toán | Gói, giá, chu kỳ, điều kiện gia hạn; phương thức hỗ trợ; điều khoản quan trọng; thành công/thất bại lấy từ kết quả thật của nhà cung cấp thanh toán. Kênh thanh toán: O-16 |
| UI-H04 | Gần/vượt giới hạn | Báo giới hạn cụ thể bị ảnh hưởng; đề xuất nâng gói / giải phóng an toàn / chờ gia hạn; không mất video đang chờ tải; không khóa người dùng khỏi truy cập bằng chứng hiện có chỉ vì đổi gói |

### Nhóm I — Hồ sơ, shop, thành viên, cài đặt

| Mã | Màn | Nội dung chính |
|---|---|---|
| UI-I01 | Hồ sơ tài khoản | Tên hiển thị, email, shop đang dùng, gói, bảo mật, trợ giúp, đăng xuất |
| UI-I02 | Cài đặt shop | Tên shop, nguồn bán, tùy chọn mặc định; không thành trang quản lý danh mục sản phẩm; đổi tên shop không đổi lịch sử bằng chứng đã ghi |
| UI-I03 | Thành viên và quyền | Danh sách thành viên; vai trò theo [07](07-roles-permissions-security.md); mời, thu hồi, trạng thái lời mời; mọi thao tác trong phạm vi shop |
| UI-I04 | Thông báo | Chọn: upload lỗi/cần xử lý; đồng bộ hoàn tất (tùy chọn); dung lượng sắp đầy; gói sắp hết hạn. Không báo từng video tải thành công |
| UI-I05 | Bảo mật và dữ liệu | Đăng xuất thiết bị; quản lý phiên/thiết bị nếu hỗ trợ; chính sách lưu trữ và xóa; yêu cầu tải dữ liệu/xóa tài khoản; **cảnh báo dữ liệu chưa đồng bộ trước khi đăng xuất hoặc xóa app** |
| UI-I06 | Trợ giúp | Hướng dẫn đóng gói đúng cách; ghi hình hàng hoàn; giải thích trạng thái upload; xử lý mất mạng/hết dung lượng; liên hệ + báo lỗi |

### Nhóm J — Trạng thái ngoại lệ bắt buộc thiết kế

| Mã | Tình huống | UI/UX cần xử lý | Đặc tả liên quan |
|---|---|---|---|
| UI-J01 | Mã không tìm thấy | Tạo hồ sơ nhanh hoặc tiếp tục dạng chưa ghép đơn | `ORDER_NOT_FOUND`, `SOURCE_ORDER_NOT_FOUND` |
| UI-J02 | Mã trùng | Liệt kê hồ sơ phù hợp để chọn | `ORDER_DUPLICATE`, `SOURCE_ORDER_AMBIGUOUS` |
| UI-J03 | Camera/micro bị từ chối | Hướng dẫn cấp quyền, không báo lỗi mơ hồ | `CAMERA_PERMISSION_DENIED`, `MIC_PERMISSION_DENIED` |
| UI-J04 | Bộ nhớ sắp đầy | Cảnh báo trước khi quay; đề xuất giải phóng an toàn | `INSUFFICIENT_STORAGE` |
| UI-J05 | Hết bộ nhớ khi đang quay | Xử lý tệp hiện có, ghi phiên không hoàn chỉnh, không tuyên bố thành công | QA-12 |
| UI-J06 | App bị đóng / hệ điều hành ngắt | Khôi phục phần khôi phục được; ghi nhận gián đoạn | QA-04 |
| UI-J07 | Mất mạng | Lưu cục bộ nếu được, xếp hàng đồng bộ | QA-02 |
| UI-J08 | Máy chủ nhận file nhưng mất phản hồi | Thử lại an toàn, tránh bản sao/upload trùng | QA-05 |
| UI-J09 | Mã băm không khớp | Đánh dấu lỗi xác minh, không gắn "Đã xác minh" | QA-09 |
| UI-J10 | Gói hết hạn | Giải thích quyền lợi bị ảnh hưởng và trạng thái dữ liệu hiện có | [06](06-evidence-retention-policy.md) |
| UI-J11 | Sắp xóa theo thời hạn lưu | Thông báo trước; tôn trọng bằng chứng bị giữ do tranh chấp | QA-10 |
| UI-J12 | Đổi shop / tài khoản | Xác nhận phạm vi dữ liệu; không gắn nhầm video sang shop khác. Phụ thuộc O-03 | QA-11 |
| UI-J13 | Nhiều nhân viên cùng sửa đơn | Giải quyết xung đột, bảo toàn lịch sử, không ghi đè âm thầm | "Thông tin đơn đã thay đổi ở thiết bị khác" |
| UI-J14 | Phiên quay bị gián đoạn | Hiển thị từng đoạn và mốc gián đoạn; không giả lập liên tục | A05, B05 |
| UI-J15 | Xóa app / đăng xuất khi còn tệp cục bộ | Cảnh báo dữ liệu chưa đồng bộ và yêu cầu xác nhận rõ ràng | UI-I05 |

### Ánh xạ với đặc tả quy trình

| Mã `UI-` | Đặc tả quy trình |
|---|---|
| UI-B02, UI-B03, UI-B04 | A02 (quét, nhập, tạo đơn) |
| UI-C01 | A03 (xem nhanh đơn và kiện, bắt đầu quay) |
| UI-C02 | A04 (kiểm tra sẵn sàng — chạy ngầm) |
| UI-C03 | A05 |
| UI-C04 | A06 |
| UI-C05 | A07 |
| UI-C06 | A08 |
| UI-B01 | A01 (danh sách công việc) |
| UI-D01 | B01 |
| UI-D02 | B02 |
| UI-D03 | B03 |
| UI-D04 | B04 (kiểm tra ngầm) + B05 |
| UI-D05 | B06 |
| UI-D06 | B07 |
| UI-D07 | B08 |

Các nhóm A (khởi động), E, F, G, H, I chưa có đặc tả quy trình riêng ở 04/05; cần đặc tả theo khung "mục đích, thành phần, hành động, trạng thái, lỗi, nghiệm thu" trước khi bàn giao lập trình (xem mục 8).

## 5. Bản thiết kế mẫu (concept mockups)

Bốn tấm hình dưới đây là **mockup khái niệm**, lưu ở `docs/assets/ui/`. Chúng minh họa hướng thị giác (xanh rừng, bo góc, thẻ lớn) và bố cục các luồng chính; **chưa phải thiết kế cuối**: chưa có Figma, chưa kiểm thử với người dùng, và có một số chỗ trái với đặc tả (xem bảng đối chiếu bên dưới). Chữ trong ảnh có vài lỗi chính tả hoặc đoạn vô nghĩa (ví dụ "Binh giữ nhiệt", dòng quảng cáo ở màn Tổng quan) — không sao chép nguyên văn; các câu quảng bá viết tay và khẩu hiệu cạnh màn hình là phần trình bày, không phải nội dung giao diện.

### 5.1 Khởi động và thiết lập — UI-A02, A03, A04, A06

![Đăng nhập, tạo tài khoản, tạo hồ sơ shop, hoàn tất thiết lập](assets/ui/01-onboarding.png)

### 5.2 Tổng quan và quét mã — UI-B01, B02

![Màn hình Tổng quan và quét mã đơn hàng](assets/ui/02-home-and-scan.png)

### 5.3 Tạo đơn nhanh, xem nhanh đơn, quay video — UI-B04, C01, C03

![Tạo đơn nhanh, xác nhận đơn trước khi quay, màn hình quay](assets/ui/03-quick-order-confirm-record.png)

### 5.4 Xác nhận lưu và đồng bộ — UI-C04, C05, F01

![Xác nhận lưu video và trung tâm đồng bộ](assets/ui/04-save-confirm-and-sync.png)

### 5.5 Đối chiếu mockup với đặc tả

Phần đúng hướng: bảng màu và phong cách khớp mục 3; Tổng quan có hai nút lớn *Đóng gói đơn* / *Nhận hàng hoàn*; màn quay ẩn thanh tab, cố định mã đơn + kiện + đồng hồ, có hướng dẫn "quay từ khi lấy hàng đến khi dán niêm phong"; có nhãn *Chưa khai báo sản phẩm* và lối *Bỏ qua, quay ngay*; gợi ý sản phẩm từ lịch sử; chọn kiện và thêm kiện; danh sách đồng bộ có lý do chờ ("Đang chờ mạng").

**A. Cần sửa trong mockup** (trái nguyên tắc nghiệp vụ trong `CLAUDE.md`; không cần quyết định thêm):

| # | Mockup | Vấn đề | Cách sửa |
|---|---|---|---|
| 1 | 04: tiêu đề "Bằng chứng của bạn đã được lưu an toàn!", "Không lo mất dữ liệu", "lưu an toàn trên cả thiết bị và đám mây" | Ở bước xác nhận lưu, video mới nằm trên máy. Cụm "an toàn" chỉ dùng khi **Đã xác minh** | Ví dụ "Video đã lưu trên thiết bị. Đang chờ tải lên." |
| 2 | 04, sync: dòng `.jpg` "Đã lưu trên thiết bị" có **dấu tick xanh tròn** | Tick xanh cho trạng thái chỉ-trên-máy, đúng điều mục 1 cấm | Dùng nhãn + biểu tượng riêng (không phải tick thành công) cho *Đã lưu trên máy* |
| 3 | 04, "Trạng thái lưu trữ": lưới 6 mục hiện cùng lúc cả "Đã xác minh" (tick) lẫn "Chưa xác minh" | Không rõ trạng thái hiện tại là gì | Hiện **một** trạng thái hiện tại của từng tệp, hoặc chuỗi bước có chỉ rõ bước đang ở |
| 4 | 04, sync: "chúng tôi sẽ tự động hoàn tất" | Hứa quá mức, vì tải nền bị hệ điều hành giới hạn | "Sẽ tiếp tục khi có thể; mở app nếu bị tạm dừng" |
| 5 | 01: "Bảo vệ bằng chứng tuyệt đối"; 03: "Lưu trữ đa lớp, **chống giả mạo**"; 02: "Tăng uy tín shop", "Bảo vệ quyền lợi của bạn" | Hứa quá mức ("tuyệt đối", chống giả mạo — mã băm không chứng minh tính chân thực) | Bỏ hoặc viết "Ghi nhận có cấu trúc, kiểm tra toàn vẹn tệp" |
| 6 | 03, màn xác nhận đơn: hiện sản phẩm "Áo thun cotton Đen/XL ×2" **đồng thời** nhãn "Chưa khai báo sản phẩm" | Mâu thuẫn | Nhãn chỉ hiện khi chưa có dòng sản phẩm nào |
| 7 | 03, màn tạo đơn nhanh: dòng gợi ý gộp "Áo thun cotton - Đen / XL" | Spec: tên và variant là hai trường riêng, gợi ý tên rồi gợi ý variant | Tách; chọn gợi ý tên thì gợi ý variant gần đây |
| 8 | 03: số lượng mặc định 2 | Spec: mặc định 1 | Mặc định 1 |
| 9 | 02, Tổng quan: thống kê "Đơn đã xử lý", "Đã đồng bộ" | "Đã xử lý"/"Đã đồng bộ" mơ hồ, không khớp nhãn trạng thái | Dùng nhãn mục 3 (ví dụ "Chờ tải lên", "Lỗi – cần xử lý") |
| 10 | 02, Tổng quan: hai banner quảng bá chiếm nhiều chỗ; thiếu "đơn gần đây" và "việc cần xử lý" | Mục UI-B01 ưu tiên khối đồng bộ, việc dang dở, đơn gần đây | Thay banner bằng các khối đó; hướng dẫn nhanh đặt ở Trợ giúp |
| 11 | 03, màn quay: nút X góc trên trái | Rời phiên đang quay phải cảnh báo hậu quả | Bấm X → hộp thoại "Giữ video và quay lại" / "Kết thúc phiên" |
| 12 | 03, tiêu đề "Kiểm tra 30 giây để tiết kiệm cả giờ" | Con số không có căn cứ | Bỏ |
| 13 | 01: màn tạo hồ sơ shop ghi "Nguồn bán *" (bắt buộc) | UI-A04: bỏ qua được (có "Bỏ qua, để sau") | Bỏ dấu `*` |
| 14 | 01: "Gói Tiêu chuẩn (30 ngày)" | Tên gói và thời hạn chưa chốt (O-06); khung gói là Cơ bản/Tăng trưởng/Vận hành lớn | Ghi là minh họa hoặc dùng tên gói chưa gán số liệu |
| 15 | 02, màn quét: thiếu đèn pin và tìm đơn đã lưu | UI-B02 yêu cầu | Thêm |

**B. Cần quyết định** (mockup khác đặc tả; chưa sửa tài liệu theo mockup):

| Mã | Điểm khác | Phương án / khuyến nghị |
|---|---|---|
| O-18 | Mockup 02 có thanh dưới: Trang chủ, Đơn hàng, **nút Quét ở giữa**, Thông báo, Cá nhân. D-11 quy định 4 tab: Tổng quan, Đơn hàng, Hàng hoàn, Đồng bộ | Khuyến nghị: *Tổng quan · Đơn hàng · **Quét** · Hàng hoàn · Đồng bộ*. Giữ nút Quét giữa (hợp "scan first") và giữ Đồng bộ trên thanh để lỗi tải lên luôn thấy. Thông báo (chuông) và Cá nhân (avatar) đã nằm ở thanh trên của Tổng quan nên không cần chiếm tab |
| O-19 | Đóng gói đơn mới đi qua **3 màn** trước camera: Tạo đơn nhanh → nút "Lưu và xác nhận đơn" → Xác nhận đơn → "Kiểm tra camera và bắt đầu". Spec (D-10) muốn một lần chạm | Khuyến nghị: nút chính ở Tạo đơn nhanh là **Lưu và quay video**, thẳng sang màn Xem nhanh đơn đã gộp nút bắt đầu, hoặc bỏ hẳn màn Xác nhận khi vừa mới tạo đơn (người dùng vừa nhập xong). Màn Xác nhận chỉ cần khi quét ra đơn có sẵn |
| O-02 | Màn quay có nút **thư viện ảnh** ở góc dưới phải | Nhập từ thư viện đang là câu hỏi mở. Nếu chưa chốt thì bỏ nút khỏi màn quay; nếu cho nhập, đặt ở nơi khác và gắn nhãn nguồn "nhập từ thư viện" |

## 6. Tương tác chi tiết

**Nhập sản phẩm trong vài giây**
- Gợi ý theo tên từ lịch sử của chính shop; chọn tên đã dùng thì gợi ý variant gần đây.
- Tên sản phẩm và variant là hai trường riêng; số lượng mặc định 1, tăng/giảm bằng chạm.
- Không bắt chọn SKU hay tạo danh mục. Gợi ý chỉ là tiện ích, **không** tự khẳng định là sản phẩm của đơn hiện tại.

**Quét mã nhanh nhưng không ghép nhầm**
- Quét xong tự tra cứu; phản hồi rung/âm ngắn nếu người dùng bật; chống quét lặp cùng một mã.
- Mã đã tồn tại → mở đúng hồ sơ hoặc hỏi khi nhiều kết quả; hồ sơ đã có phiên đóng gói → hỏi xem phiên cũ hay tạo phiên mới (A02).
- Phân biệt rõ mã đơn, mã vận đơn, mã nội bộ.
- Màn hình đơn (UI-C01) chính là bước người dùng nhìn lại đơn để phát hiện quét nhầm; không thêm hộp thoại xác nhận riêng.

**Đồng bộ không làm gián đoạn công việc**
- Tải nền trong giới hạn của hệ điều hành; hệ điều hành tạm dừng upload → hiển thị "chờ tiếp tục", không báo lỗi giả.
- Hàng đợi rõ, thử lại an toàn, chống tệp trùng; cho biết tệp nào còn trên máy, tệp nào đã trên cloud.

**Xác nhận chỉ khi cần**
- Không hỏi khi lưu thông tin bình thường. Có xác nhận khi xóa dữ liệu, đóng hồ sơ, đổi quan trọng, rời phiên quay chưa kết thúc.
- Nội dung nêu rõ hậu quả và dữ liệu bị ảnh hưởng; nút có nhãn cụ thể.

## 7. Hai nhóm khách hàng, một sản phẩm

| | Shop nhỏ, một người | Shop lớn, nhiều nhân viên |
|---|---|---|
| Ưu tiên | Đơn giản, ít bước | Tốc độ, kiểm soát |
| Trải nghiệm | Mở app thấy hai tác vụ chính; quét rồi quay; bỏ qua sản phẩm; không thiết lập kho/nhân sự; không ép chế độ hàng loạt | Quét liên tục; hàng đợi upload; phân quyền theo shop/vai trò; ghi người thực hiện; theo dõi lỗi, dữ liệu chưa đồng bộ, xung đột cập nhật |

Tính năng nâng cao chỉ xuất hiện khi cần; không làm hai phiên bản app.

## 8. Nghiệm thu UI/UX

Bổ sung cho [08](08-acceptance-qa-risks.md); đánh dấu chỉ khi đã kiểm tra thật.

**Tốc độ thao tác**
- [ ] Người mới bắt đầu quy trình đóng gói không cần hướng dẫn trực tiếp
- [ ] Thông tin sản phẩm bỏ qua được; không bắt nhập SKU hoặc giá
- [ ] Quét mã, tìm đơn, tạo hồ sơ mới có trạng thái rõ ràng
- [ ] Chuyển đơn tiếp theo không chờ upload xong

**Độ rõ ràng**
- [ ] Mọi trạng thái bằng chứng có nhãn chữ, không chỉ màu
- [ ] Phân biệt rõ đã lưu trên máy và đã tải lên/đã xác minh
- [ ] Không có nút chính mơ hồ ("OK", "Tiếp tục") khi có thể dùng nhãn cụ thể
- [ ] Cảnh báo nêu rõ hậu quả và cách khắc phục

**An toàn dữ liệu**
- [ ] Không tự ghép hàng hoàn vào đơn không xác định
- [ ] Không ghi đè video gốc khi thêm phiên quay mới
- [ ] Xử lý đúng khi mất mạng, hết dung lượng, app bị đóng
- [ ] Không xóa tệp chưa đồng bộ hay tệp đang giữ cho tranh chấp

**Khả năng sử dụng**
- [ ] Nút lớn, dễ chạm, phù hợp thao tác một tay
- [ ] Bàn phím không che nút chính hoặc trường đang nhập
- [ ] Hỗ trợ chữ lớn, vùng an toàn, nhiều kích thước màn hình
- [ ] Luồng chính nhất quán trên iOS và Android

**Tin cậy và quyền riêng tư**
- [ ] Người dùng biết dữ liệu nào được lưu và trong bao lâu
- [ ] Thông tin người dùng khai báo không bị trình bày thành dữ liệu đã xác minh từ sàn
- [ ] Quyền truy cập shop được kiểm tra ở mọi thao tác dữ liệu
- [ ] Sự cố và chỉnh sửa quan trọng có lịch sử truy vết

## 9. Bàn giao thiết kế

Cần khóa trước khi giao đội lập trình:
- **Điều hướng và luồng:** danh sách màn hình đầy đủ, sơ đồ chuyển trạng thái, điều kiện vào/ra từng màn.
- **Design system:** màu, typography, khoảng cách, button, input, card, bottom sheet, dialog, trạng thái, quy tắc responsive.
- **Đặc tả tương tác:** loading, empty, error, offline, permission denied, thao tác gián đoạn và cách khôi phục.
- **Bàn giao:** Figma có component + variant, prototype các luồng chính, acceptance criteria, liên kết từng màn với yêu cầu nghiệp vụ.

Thứ tự thiết kế đề xuất:
1. Tổng quan, Quét mã, Tạo đơn nhanh, Quay video đóng gói (UI-B01–B05, C01–C06) — kiểm thử với người bán thật.
2. Toàn bộ luồng Nhận hàng hoàn và sai lệch (nhóm D).
3. Hồ sơ bằng chứng, trung tâm đồng bộ, lỗi và lưu trữ (nhóm E, F, J).
4. Tranh chấp, gói dịch vụ, tài khoản, thành viên (nhóm G, H, I, A).
5. Kiểm thử prototype trên iPhone và nhiều kích thước Android, đặc biệt khi một tay đang cầm kiện hàng.

Thành công của UI/UX đo bằng việc người bán ghi đúng bằng chứng cho đúng đơn gần như không phải suy nghĩ, và luôn biết dữ liệu đã được lưu an toàn đến đâu.
