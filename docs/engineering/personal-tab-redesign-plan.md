# Kế hoạch nâng cấp giao diện tab Cá nhân theo design board 07

> Trạng thái: **kế hoạch đã được người dùng duyệt; các mặc định Q-21a..i đã được ủy quyền áp dụng** (xem [decisions.md Q-21](decisions.md)). Câu hỏi chưa chốt (Q-21j..n) cần designer/BA. **PR-A (token + thành phần dùng chung) đã squash-merge vào `main`** (mục 6.1); **PR-B (màn chính 1a-1e) đã squash-merge vào `main`** (mục 6.2); **PR-C (Sửa họ tên, Đổi mật khẩu, hộp thoại Đăng xuất) đã squash-merge vào `main`** (mục 6.3); **PR-D (Cửa hàng: khung 5, 6, 7a-7c) đã làm trên nhánh `claude/personal-tab-redesign-pr-d`** (mục 6.4); các PR E-I chưa làm.

## 1. Mục tiêu, nguồn và phạm vi

- **Nguồn:** `docs/assets/ui/07-personal-tab-redesign-board.png` (1536x1024, designer giao). Tên board: "Tab Cá nhân - Thiết kế giao diện mobile".
- **Mục tiêu:** giao diện mọi màn của tab Cá nhân **giống board** trên cổng giả và bản "chưa kết nối", nhưng **nội dung trung thực** (không số liệu/gói/trạng thái bịa; xem mục 5). Bố cục, thứ bậc chữ, màu thẻ, icon, nút, header và thanh tab theo board; chỗ board vẽ nội dung trái bất biến thì giữ khung và đổi nội dung (D1..D27).
- **Ngoài phạm vi:** màn khách đã xác nhận (`scripts/design-token-scope.cjs`); đổi nghiệp vụ; Firebase thật cho hồ sơ/đổi mật khẩu (Q-20t); thanh toán/gói thật (O-06, O-16); xóa tài khoản thật (Q-20e).
- **Ràng buộc kỹ thuật:** chỉ dùng `useTheme().tokens` (không hex/số thiết kế thô); prop mới của thành phần dùng chung chỉ **tùy chọn** và mặc định giữ nguyên (test `frozen-*-equivalence` phải xanh; hai test đó chỉ phủ `Button`/`Text`/`Icon`, các thành phần khác được bảo vệ bằng test mặc-định-giữ-nguyên, xem mục 6.1); chuỗi qua i18n; cô lập theo shop; trợ năng, chữ lớn, 320/360/390px.
- **Độ tin cậy khi đọc board:** mỗi khung đã cắt và phóng 5-7 lần rồi đọc lại (script Pillow trong thư mục tạm, không commit). Board là ảnh 1536px nên chữ nhỏ bị nhòe; chỗ không đọc chắc chắn ghi ở mục 2.3.

## 2. Mô tả từng khung

Ký hiệu cột TB: **Có** = có thanh tab dưới (Trang chủ, Đơn hàng, nút Quét tròn giữa, Thông báo, Cá nhân đang chọn); **Không** = không thanh tab; **Mờ** = hộp thoại phủ lớp tối, màn nền không thấy thanh tab.

### 2.1 Bảng khung

| # | Khung | Nội dung đọc được | TB |
|---|---|---|---|
| 1a | Màn chính, mặc định | Header: "‹ Cá nhân" bên trái, một icon tròn nhỏ bên phải (không rõ là gì, xem 2.3). Thẻ hồ sơ trắng: avatar tròn chữ "T" nền xám-teal nhạt; "Trần Văn Minh" (đậm); email che dạng `minh****@gmail.com`; huy hiệu mint chữ xanh **"Đã xác thực"**. Thẻ cửa hàng: ô icon vuông bo góc nền **xanh dương nhạt** + icon tòa nhà xanh dương; ba dòng "Shop của bạn" (nhỏ, mờ) / "Shop Thời Trang" (đậm) / "Quản lý cửa hàng" (nhỏ, mờ); chevron phải. Thẻ hero gói **xanh lục đậm** (có chuyển sắc), bo góc lớn: "Gói dịch vụ" (nhỏ, trắng mờ), "Gói tiêu chuẩn" (đậm, trắng), huy hiệu nền xanh sáng "Đang hoạt động" ở góc phải trên, "Thời hạn lưu: Chưa có thông tin" (nhỏ, trắng mờ), chevron phải mờ. Khối trắng "Dữ liệu bằng chứng ›": 3 cột icon + nhãn (không có số): **Trên thiết bị** (icon tài liệu, nền teal nhạt), **Đang chờ đồng bộ** (icon cam, nền cam nhạt, có chấm cam), **Trên đám mây** (icon đám mây teal, nền teal nhạt). Nút chính full-width xanh lục "Xem trung tâm đồng bộ". Hàng "Cài đặt ›" (icon bánh răng). Dưới hàng này bị thanh tab che; nhìn thấy mép một hàng nữa nhưng không đọc được. | Có |
| 1b | Đang tải | Header như 1a. Skeleton dựng theo hình thật: (1) thẻ hồ sơ: vòng tròn + 3 thanh; (2) thẻ cửa hàng: ô vuông + 3 thanh + chevron; (3) thẻ gói: ô vuông + 3 thanh + viên thuốc ở góc phải (chữ mờ "Đang h..."); (4) khối "Dữ liệu bằng chứng ›" (tiêu đề mờ, hàng ô vuông + 2 thanh + viên thuốc, hai thanh dài); (5) khối thứ hai có tiêu đề mờ + chevron. Tất cả xám nhạt. | Có |
| 1c | Lỗi | Thẻ hồ sơ dạng skeleton; giữa màn **thẻ nền hồng nhạt** (không viền): chấm tròn đỏ có dấu "!" , "Không thể tải thông tin cá nhân" (đậm), "Vui lòng thử lại.", nút chính xanh lục "Thử lại". Dưới thẻ lỗi là skeleton mờ của khối 3 ô. | Có |
| 1d | Ngoại tuyến | Thẻ hồ sơ skeleton rất nhạt; giữa màn, **không có thẻ nền**: icon "mất kết nối" nét xanh dương-teal (hình dây/ổ cắm bị ngắt, không phải biểu tượng wifi), "Đang ngoại tuyến" (đậm), "Dữ liệu có thể đã cũ.", nút chính "Thử lại". Phần còn lại trống. | Có |
| 1e | Chưa có họ tên | **Toàn màn là trạng thái trống** (không có thẻ nào khác): icon người trong vòng tròn nét teal, "Chưa có họ tên" (đậm, lớn hơn 1c/1d), "Vui lòng cập nhật thông tin cá nhân.", nút chính "Cập nhật". Không còn thẻ cửa hàng/gói/dữ liệu. | Có |
| 2 | Sửa họ tên | Header "← Sửa họ tên" (mũi tên trái, tiêu đề lệch trái). Nhãn "Họ và tên *" (sao đỏ), ô nhập viền mint, giá trị "Trần Văn Minh". Nút chính "Lưu" full-width ngay dưới ô (cách ~24px, không dính đáy). Không có ô email chỉ đọc. | Không |
| 3 | Đổi mật khẩu | Header "← Đổi mật khẩu". Ba trường có icon mắt bên phải: "Mật khẩu hiện tại *" (placeholder "Nhập mật khẩu hiện tại"), "Mật khẩu mới *" ("Nhập mật khẩu mới"; gợi ý dưới: "Tối thiểu 8 ký tự, bao gồm chữ và số"), "Xác nhận mật khẩu mới *" ("Nhập lại mật khẩu mới"). Nút "Lưu". Dưới cùng thẻ nền xanh nhạt: "Tài khoản Apple/Google" (đậm) + "Bạn đang đăng nhập bằng Apple/Google. Vui lòng đổi mật khẩu trong cài đặt tài khoản." **Thẻ này hiện cùng lúc với form** (xem D18). | Không |
| 4a | Hộp thoại Đăng xuất: xác nhận | Màn nền (header có mũi tên trái, icon phải) bị phủ lớp tối xám. Thẻ trắng giữa màn, bo góc lớn, **chỉ lệch trong lề (~12px)**: icon teal đặc (máy quay/túi có dấu tích), "Xác nhận đăng xuất", "Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng?", nút chính xanh lục **"Ở lại ứng dụng"** (trên), nút **viền đỏ nền trắng chữ đỏ "Đăng xuất"** (dưới). Hai nút xếp dọc. | Mờ |
| 4b | Đang quay | Cùng khung: icon camera nét teal; "Đang quay video"; "Bạn đang quay video đóng gói. Vui lòng dừng quay trước khi đăng xuất."; **một** nút "Ở lại ứng dụng". | Mờ |
| 4c | Còn bằng chứng chưa đồng bộ | Icon tam giác cảnh báo **vàng-cam đặc**; "Còn bằng chứng chưa đồng bộ"; "Bạn có 3 video đang chờ đồng bộ. Đăng xuất có thể làm gián đoạn quá trình đồng bộ."; nút chính "Xem trung tâm đồng bộ"; nút phụ **viền teal nhạt** "Ở lại ứng dụng". **Không có nút "Đăng xuất"** (xem D21). | Mờ |
| 5 | Cài đặt cửa hàng | Header "← Cửa hàng". Thẻ thông tin trắng: ô logo vuông nền xám-xanh nhạt với icon nhà/cửa hàng teal, một nhãn rất nhỏ dưới logo (không đọc được, có thể "Sửa"), "Shop Thời Trang" (đậm), "ID: 12345678900" (mờ), huy hiệu mint "Đang hoạt động". Hai hàng **không có thẻ nền riêng**, icon người nhỏ mờ bên trái: "Vai trò / Quản lý" và "Trạng thái / Đang hoạt động" (chữ xanh lục), **cả hai có chevron** (xem D23). Ba thẻ hàng riêng, mỗi thẻ một hàng có chevron: "Sửa tên cửa hàng" (icon bút), "Chuyển cửa hàng" (icon hai mũi tên), "Xóa cửa hàng" (icon thùng rác đỏ, chữ đỏ, chevron tối). | Không |
| 6 | Sửa tên cửa hàng | Header "← Sửa tên cửa hàng". "Tên cửa hàng *", ô giá trị "Shop Thời Trang"; **bộ đếm "20/50" căn phải dưới ô** (số trên board không khớp độ dài chữ, xem D22). Nút chính "Lưu". | Không |
| 7a | Chuyển cửa hàng | Header "← Chuyển cửa hàng". Ô tìm nền xám nhạt, icon kính lúp, "Tìm cửa hàng...". Danh sách phân cách bằng đường mảnh: **Shop Thời Trang** (icon tròn xanh lục có dấu tích ở trái, "Đang dùng" xanh lục, thêm dấu tích tròn xanh ở bên phải); **Shop Mỹ Phẩm** (icon tile tài liệu teal, "Đang hoạt động" xanh lục); **Shop Gia Dụng** (như trên); **Shop Phụ Kiện** (icon khóa đỏ, "Bị khóa" đỏ). Nút chính đáy màn "Xác nhận". | Không |
| 7b | Xác nhận chuyển | Màn nền phủ tối (tiêu đề nền ghi nhầm "Gói dịch vụ", xem D24). Thẻ trắng: biểu tượng tròn đặc teal đậm có dấu chữ V/khiên trắng; "Xác nhận chuyển cửa hàng"; "Bạn có chắc chắn muốn chuyển sang Shop Mỹ Phẩm?"; **hai nút cạnh nhau**: "Hủy" (nền xám-teal nhạt, chữ teal) và "Xác nhận" (xanh lục đặc). | Mờ |
| 7c | Không thể chuyển | Nền như 7b (cũng ghi "Gói dịch vụ"). Icon máy quay + khóa **đỏ đặc**; "Không thể chuyển cửa hàng"; "Bạn đang quay video đóng gói. Vui lòng dừng quay trước khi chuyển."; hai nút cạnh nhau: "Ở lại" (nền nhạt) và "Chuyển cửa hàng" (**mờ, vô hiệu**). | Mờ |
| 8 | Gói dịch vụ hiện tại | Header "← Gói dịch vụ". Thẻ trắng: "Gói tiêu chuẩn" (đậm, lớn) + huy hiệu mint "Đang hoạt động" ở phải; "Thời hạn lưu: Chưa có thông tin". Tiêu đề "Quyền lợi", năm dòng có **dấu tích xanh lục trần** (không vòng): Lưu video đóng gói / Lưu ảnh giao hàng / Lưu ảnh hoàn hàng / Đối chiếu đơn hàng / Hỗ trợ 24/7. Đường kẻ. Nút chính "Chi tiết gói"; nút phụ **viền teal** "Nâng cấp gói". | Không |
| 9 | Chi tiết gói dịch vụ | Header "← Chi tiết gói dịch vụ". Thẻ nền mint rất nhạt: ô icon vuông nền xám-xanh (icon tài liệu teal), "Gói tiêu chuẩn", huy hiệu "Đang hoạt động". "Quyền lợi chi tiết" (đậm) + liên kết "Xem tất cả ›" bên phải (đích không rõ, D27). Năm dòng như khung 8 nhưng dấu tích **trong vòng tròn xanh lục đặc**. "Thời hạn lưu" + hàng icon "ⓘ Chưa có thông tin". Nút chính **"Nâng cấp gói"** (khung 8 là nút phụ viền, khung 9 là nút đặc). | Không |
| 10 | Lịch sử thanh toán | Header "← Lịch sử thanh toán". Trạng thái trống giữa màn: icon hóa đơn có biểu tượng con mắt/mục, nét xám-teal; "Chưa có lịch sử thanh toán" (đậm); "Khi có giao dịch, thông tin sẽ hiển thị ở đây." | Không |
| 11 | Dữ liệu bằng chứng | Header "← Dữ liệu bằng chứng". Thẻ trắng: icon + "Tổng số bằng chứng" (mờ) + "Chưa có thông tin" (đậm). Ba **hàng** có đường kẻ (không phải ba thẻ): "Trên thiết bị" (icon teal) / "Đang chờ đồng bộ" (icon **cam đặc tròn**) / "Trên đám mây" (icon đám mây **xanh dương**), mỗi hàng "Chưa có thông tin" (mờ). Nút chính đáy "Xem trung tâm đồng bộ". | Không |
| 12 | Thời hạn lưu | Header "← Thời hạn lưu". Thẻ: icon + "Thời hạn lưu theo gói dịch vụ" (mờ) + "Gói tiêu chuẩn" (đậm). Ba hàng icon mờ: Video đóng gói / Ảnh giao hàng / Ảnh hoàn hàng, mỗi hàng "Chưa có thông tin". Thẻ ghi chú nền xanh dương nhạt cuối màn: "Khi hết hạn, dữ liệu có thể vẫn xem được trên thiết bị của bạn." (**khẳng định chưa có cơ sở**, D19). | Không |
| 13 | Thông báo | Header "← Thông báo". Năm hàng có công tắc, **tất cả bật** (màu teal đậm), mỗi hàng icon + tiêu đề + mô tả: **Đồng bộ dữ liệu** "Nhận thông báo khi đồng bộ hoàn tất"; **Thời hạn lưu** "Nhắc nhở trước khi hết hạn lưu"; **Gói dịch vụ** "Thông báo khi có thay đổi gói"; **Tài khoản** "Thông báo hoạt động tài khoản"; **Cập nhật sản phẩm** "Nhận thông báo về tính năng mới". Dưới: thẻ **nền cam nhạt**: icon cảnh báo cam, "Quyền thông báo bị từ chối", "Vui lòng mở Cài đặt để cho phép thông báo.", dính liền nút chính "Mở Cài đặt". | Không |
| 14 | Quyền riêng tư và bảo mật | Header "← Quyền riêng tư và bảo mật". Năm hàng thẻ riêng có chevron: **Đổi mật khẩu**; **Xác thực 2 lớp** (nhãn đỏ "Chưa bật" bên phải); **Thiết bị đăng nhập**; **Dữ liệu và quyền truy cập**; **Xóa tài khoản** (icon, chữ và chevron đỏ). | Không |
| 15 | Trung tâm trợ giúp | Header "← Trợ giúp". Ô tìm "Tìm kiếm bài viết...". "Danh mục" (đậm) với **4** hàng có chevron: Hướng dẫn sử dụng / Xử lý sự cố / Câu hỏi thường gặp / Cập nhật sản phẩm. "Bài viết đề xuất" với 2 hàng không chevron, icon nhỏ mờ: "Cách quay video đóng gói" / "Hướng dẫn đồng bộ dữ liệu". | Không |
| 16 | Chi tiết bài hướng dẫn | Header "← Hướng dẫn sử dụng". **Ảnh chụp thật** (hộp carton + thiết bị, bo góc) có nút phát tròn đen ở giữa. "Cách quay video đóng gói" (đậm); "Hướng dẫn chi tiết cách quay video đóng gói đúng chuẩn, rõ nét."; "Các bước thực hiện": 1. Chuẩn bị sản phẩm 2. Quay video theo hướng dẫn 3. Kiểm tra và lưu video. Nút chính đáy "Tiếp theo". | Không |
| 17 | Liên hệ hỗ trợ | Header "← Liên hệ hỗ trợ". "Họ và tên *" (điền sẵn "Trần Văn Minh"), "Số điện thoại *" ("Nhập số điện thoại"), "Nội dung *" (ô nhiều dòng cao ~120px, "Nhập nội dung cần hỗ trợ..."). Nút chính **"Gửi yêu cầu"**. | Không |
| 18 | Điều khoản và chính sách | Header "← Điều khoản và chính sách". **Bốn** hàng icon tài liệu + chevron: Điều khoản sử dụng / Chính sách bảo mật / **Chính sách đổi trả** / Chính sách dữ liệu (D20). | Không |
| 19 | (không có) | Board đánh số 18 rồi 20; **không có khung 19** (Q-21j). | - |
| 20 | Xóa tài khoản | Header "← Xóa tài khoản". Chấm tròn đỏ dấu "!"; "Xác nhận xóa tài khoản"; "Tài khoản của bạn sẽ bị xóa vĩnh viễn. Dữ liệu có thể không thể khôi phục."; "Điều kiện" (icon ⓘ) với 3 dấu tích xanh: "Đã đồng bộ dữ liệu (nếu có)" / "Không có video đang quay" / "Đã đăng xuất khỏi tất cả thiết bị"; hộp kiểm **viền đỏ** "Tôi hiểu và đồng ý"; nút **đỏ đặc** "Xóa tài khoản". | Không |
| 21 | Một số trạng thái khác | Dải tám thẻ ngang, mỗi thẻ icon + tên + dòng phụ: **Đang quay video** (nền hồng viền đỏ, chấm đỏ, "00:00:28" đỏ kèm icon đồng hồ); **Đang tải lên** (icon tròn teal, thanh tiến độ teal đậm trên nền xám nhạt, "70%" bên phải); **Đã đồng bộ** (tròn xanh lục dấu tích, "Đã đồng bộ thành công" xanh lục); **Lưu trên thiết bị** (icon điện thoại teal, "Chỉ lưu trên thiết bị" xám); **Lưu trên đám mây** (đám mây **xanh dương**, "Đã lưu trên đám mây" xám); **Sắp hết thời hạn lưu** (đồng hồ **cam**, "Còn 3 ngày nữa" cam); **Đã hết thời hạn lưu** (tròn viền đỏ, "Đã hết hạn" đỏ); **Lỗi đồng bộ** (icon đỏ, "Không thể đồng bộ" đỏ). Thẻ trắng viền mảnh, tám thẻ cùng kiểu trừ thẻ đầu. | - |

### 2.2 Quy ước chung quan sát được

- Header màn con: mũi tên trái + tiêu đề **lệch trái** (không căn giữa), không có nút phải (khác 1a–1e, nơi có icon tròn bên phải). Hộp thoại phủ lên header nền, header nền còn nút trái và icon phải mờ.
- Nút chính: xanh lục có chuyển sắc nhẹ, bo ~12px, cao ~44-48px (ảnh), chữ trắng đậm. Nút phụ: nền trắng, viền teal nhạt, chữ teal. Nút nguy hiểm: viền đỏ (khung 4a) hoặc đỏ đặc (khung 20).
- Thẻ: nền trắng, bo ~12-16px, **không bóng đáng kể, viền rất mảnh** (nền màn kem nhạt).
- Nhãn trường: chữ xanh đen cỡ nhỏ, dấu sao đỏ cho trường bắt buộc.
- Thanh tab: chỉ ở 1a-1e; mọi màn con 2-20 không có (khớp Q-20r).

### 2.3 Chỗ KHÔNG đọc được chắc chắn (cần designer cấp bản >= 3000px, Q-21k)

1. **Icon tròn bên phải header khung 1a-1e**: ở 1a trông như hình thoi/chuông, ở 1d/1e như "ⓘ". Không xác định chức năng. Mặc định: **không dựng** (app không có mục tương ứng), ghi D28.
2. **Nhóm dưới hàng "Cài đặt ›" ở 1a**: bị thanh tab che; không biết còn nhóm/hàng nào (Thông báo, Quyền riêng tư, Trợ giúp, Điều khoản, Đăng xuất chưa xuất hiện ở bất kỳ khung nào của màn chính). **Board cũng không có khung trung tâm "Cài đặt"** (Q-21l).
3. **Nhãn nhỏ dưới logo ở khung 5** (một từ, ~3 ký tự).
4. **Icon cụ thể** của các hàng khung 13/14/15/18 (đọc được hình khối chung: đồng hồ, khiên, khóa, điện thoại, tài liệu; không đủ nét để chọn glyph chính xác). Mặc định: chọn glyph Ionicons gần nghĩa, designer duyệt khi xem ảnh PR.
5. **Giá trị chuyển sắc chính xác** của hero và nút (chỉ thấy lục đậm đến lục sáng nhẹ); kích thước/khoảng cách tính bằng px ảnh 1536, không phải dp (mức đo chỉ ước lượng, xem mục 8).
6. **Chữ rất nhỏ ở viền khung** (đồng hồ trạng thái 9:41, nhãn thanh tab dưới 1a-1e): không cần cho triển khai.

Ngoài các chỗ trên, mọi chuỗi trong bảng 2.1 đã được đọc lại ở độ phóng đại 5-7 lần; vài chữ còn nhòe (ví dụ "Hỗ trợ 24/7", mô tả khung 12, 20) được đọc theo ngữ cảnh, designer nên xác nhận khi cấp bản lớn.

## 3. Gap analysis theo màn

Mức: S nhỏ, M vừa, L lớn. "Có sẵn" lấy từ `src/features/personal/ui` và `src/shared/ui` (đã rà ngày 2026-10-28). Đính chính so với bản nháp đầu: `ConfirmDialog` **đã là hộp thoại trung tâm** (Modal giữa màn, có `primary`, `confirmOutlined`, `detail`), nên 4a/4b/4c/7b/7c chỉ thiếu icon và bố cục hai nút cạnh nhau, không phải đổi từ BottomSheet.

| # | Màn | Hiện có | Khác biệt chính | Việc cần làm | Dùng chung (mới/sửa) |
|---|---|---|---|---|---|
| 1a | Màn chính (UI-I01) | `ProfileScreen`: thẻ hồ sơ + menu nhóm kiểu iOS | Thêm thẻ hero gói, khối "Dữ liệu bằng chứng" + nút trung tâm đồng bộ, thẻ cửa hàng 3 dòng icon xanh dương, nhóm Cài đặt dạng một hàng (Q-21l) L | Dựng lại bố cục; dữ liệu bằng chứng lấy `countUnsyncedOnDevice` (hôm nay 0), phần còn lại "Chưa có thông tin" | Mới: `HeroCard`, `IconTile`, `MetricTile` (đánh giá tái dùng `StatTile`); sửa `ProfileSummaryCard`, `MenuRow` |
| 1b | Tải | Skeleton hình thật của bố cục cũ | Đổi hình theo 5 khối ở mục 2.1 S | Cập nhật `RegionParts`/skeleton | `Skeleton` |
| 1c | Lỗi | Lỗi một khu vực (`ErrorState`) | Thẻ nền hồng giữa màn trên nền skeleton, chấm đỏ "!" S | Biến thể thẻ cho `ErrorState` | `ErrorState variant="card"` |
| 1d | Ngoại tuyến | `OfflineBanner` | Trạng thái trống riêng, icon "mất kết nối" M | `EmptyState` có icon + nút; nối với trạng thái ngoại tuyến của vùng hồ sơ | `EmptyState` (icon, action) |
| 1e | Chưa có họ tên | Dòng "Thêm họ tên" trong thẻ hồ sơ | Board thay **toàn màn**; Q-21e mặc định chỉ thay **phần thẻ hồ sơ** và giữ phần còn lại (cửa hàng, gói, menu vẫn cần truy cập) M | Trạng thái trống + "Cập nhật" thay thẻ hồ sơ, mở `editProfile` | `EmptyState` |
| 2 | Sửa họ tên | `EditProfileScreen` có ô email chỉ đọc, Lưu tắt khi chưa đổi | Board không có email; Lưu ngay dưới ô S | Bỏ ô email (hoặc để dưới nút nếu cần cho trung thực: giữ hành vi chặn Lưu khi chưa đổi) | `FormField`, `Button` |
| 3 | Đổi mật khẩu | `ChangePasswordScreen` | Thêm gợi ý "chữ và số"? (xem D29), icon mắt đã có (`PasswordField`), thẻ Apple/Google chỉ hiện với tài khoản social, **thay** form (D18) M | Thẻ thông tin theo `signInMethod`; câu gợi ý giữ "Từ 8 ký tự" (D-13) | `Notice`, `PasswordField` |
| 4a-c | Đăng xuất x3 | `ConfirmDialog` + `use-sign-out` (chặn quay, cảnh báo chưa đồng bộ) | Icon đầu hộp thoại; 4c có nút "Xem trung tâm đồng bộ" làm nút chính; còn lối "Vẫn đăng xuất" (D21) M | `ConfirmDialog` thêm `icon`/`iconTone`; nối UI-F01 (đang có) | `ConfirmDialog` (sửa) |
| 5 | Cài đặt cửa hàng | `ShopSettingsScreen` (UI-I02) | Thẻ logo + ID + huy hiệu, hàng thuộc tính, hàng hành động riêng, "Xóa cửa hàng" M | Dựng lại; "ID" ẩn đến khi có trường (D1); "Xóa cửa hàng" ẩn (Q-21d); hàng thuộc tính không chevron | `IconTile`, `ListGroup`, `StatusBadge` |
| 6 | Sửa tên cửa hàng | `ShopEditScreen` | Bộ đếm "n/50" S | `TextField.counter` thật (độ dài hiện tại, D22) | `TextField` (sửa) |
| 7a | Chuyển cửa hàng | `ShopSwitchScreen` | Ô tìm, hàng có icon/trạng thái ("Bị khóa"), nút "Xác nhận" đáy, dấu tích đang dùng M | Chỉnh; ô tìm chỉ khi >= 6 cửa hàng (đề xuất, ghi trong PR); chọn hàng rồi "Xác nhận" mở hộp thoại | `SearchField`, `IconTile` |
| 7b-c | 2 hộp thoại | Cảnh báo/chặn đã có | Icon + hai nút cạnh nhau S | `ConfirmDialog actionsLayout="row"` | `ConfirmDialog` |
| 8 | Gói hiện tại | `plan` (UI-H01) khung | Cả màn mới; nội dung theo Q-21c L | Màn mới; khung giữ, giá trị "Chưa có thông tin", huy hiệu "Sắp có", nút "Nâng cấp gói" khóa | `Card`, `ListItem`, `StatusBadge` |
| 9 | Chi tiết gói | Chưa có route | Màn mới M | Route con của `plan` (Q-21b); "Xem tất cả ›" không đích: ẩn (D27) | như trên |
| 10 | Lịch sử thanh toán | Chưa có | Màn trống S | Route con; `EmptyState` | `EmptyState` |
| 11 | Dữ liệu bằng chứng | Chưa có | Màn mới M | Route con của UI-I01; "Trên thiết bị"/"Đang chờ đồng bộ" từ kho cục bộ (0 thật), "Tổng"/"Trên đám mây": "Chưa có thông tin" | `MetricTile` |
| 12 | Thời hạn lưu | Chưa có | Màn mới S | Chuỗi "Chưa có thông tin"; thẻ ghi chú đổi câu (D19) | `ListItem`, `Notice` |
| 13 | Thông báo | `notifications` khung; `Switch` + `SettingsGateway` chưa ai dùng | Năm công tắc thật lưu cục bộ, thẻ quyền hệ điều hành M | Công tắc lưu cục bộ (Q-21i); thẻ cam theo quyền thật | `Switch`, `Notice` |
| 14 | Quyền riêng tư và bảo mật | `security` khung | Năm hàng; 2 hàng khóa, 1 hàng xóa tài khoản M | Q-21d, Q-21h | `ListGroup`, `MenuRow` |
| 15 | Trợ giúp | `help` khung | Tìm kiếm, danh mục, bài đề xuất M | Nội dung tĩnh trong app (Q-20g) | `SearchField`, `ListGroup` |
| 16 | Bài hướng dẫn | Chưa có | Ảnh minh họa + nút phát, bước, "Tiếp theo" M | Nội dung tĩnh; **ảnh/video cần tài nguyên và bản quyền** (rủi ro mục 7) | `Card` |
| 17 | Liên hệ hỗ trợ | Chưa có | Form 3 trường, ô nhiều dòng M | Gửi bằng email soạn sẵn, không giả "đã gửi" (Q-21i) | `TextField` (nhiều dòng), `FormField` |
| 18 | Điều khoản | Chưa có | 4 hàng liên kết M | Mở URL từ `legal-links.ts`; **không có "Chính sách đổi trả"** (D20) | `ListGroup` |
| 19 | (thiếu) | - | - | Q-21j | - |
| 20 | Xóa tài khoản | Hoãn (Q-20e) | Màn xác nhận đầy đủ M | Chỉ thông tin + điều kiện thật + nút xóa khóa (Q-21h) | `Checkbox`, `Button` |
| 21 | Dải trạng thái | Không có | Tám thẻ trạng thái M | `StatusCard` dựng và test; **không hiển thị ở app thật** khi chưa có dữ liệu (Q-21i, D10) | Mới `StatusCard`; tái dùng `EvidenceStatusBadge` nếu hợp |

## 4. Ánh xạ token

Có sẵn (`src/core/theme`): jade 950/700/100, green 700/100, amber 700/50, red 700/50, teal 50, mint 200, slate 900/500, neutral, alpha black50/55 và white75; `space` 2..24; bán kính 8/12/16/full; chữ 12..24 (và nhóm form 13/14); `components.tile` 28/44/52/56; `elevation.floating`.

| Thành phần board | Dùng token hiện có | Thiếu / đề xuất |
|---|---|---|
| Nền hero gói | `color.brand.deep` phẳng (Q-21a, không chuyển sắc, không thêm thư viện) | - |
| Chữ phụ trên hero | `color.text.onAction` (tiêu đề) | **Mới `color.text.onBrandMuted`** = `palette.alpha.white75` (đã có, không thêm hex); đo tương phản trên jade 950 >= 4.5:1 (ước tính ~7:1) |
| Huy hiệu "Đang hoạt động" trên hero | `feedback.success` (fg green 700 trên nền green 100: chip sáng trên nền đậm) | Không cần token mới |
| Icon tile xanh dương (cửa hàng, đám mây) | tile 44/52 + `brand.soft`/`feedback.*` cho các tông khác | **Mới `palette.blue[50]`, `palette.blue[700]`** (tầng 1) và `color.accent.blue = { fg, bg }` (tầng 2); kiểm tương phản fg trên bg >= 4.5:1 (icon cần >= 3:1) |
| Tile cam (chờ đồng bộ) | `feedback.warning` (amber) | Không mới (board cam sáng hơn, chấp nhận amber) |
| Tile teal / xám-xanh | `feedback.info.bg` (teal 50) / `surface.muted` | Không mới |
| Thẻ ghi chú xanh nhạt (khung 3, 12) | `feedback.info.bg` | Không mới (board hơi xanh dương, chấp nhận teal) |
| Thanh tiến độ (khung 21) | `status.uploading.fg` (vạch), `border.field` (nền vạch) | **Mới `components.progress.height`** (6) |
| Hộp kiểm | `border.default`, `action.primary`, `action.destructive` (viền khi lỗi) | **Mới `components.checkbox.size`** (24) |
| Ô nhiều dòng (khung 17) | `components.field.minHeight` cho 1 dòng | **Mới `components.field.multilineMinHeight`** (120) |
| Công tắc | `Switch` đã có, màu bật `action.primary` | Kiểm tra tương phản khi xây ở PR-G |
| Hộp thoại | `overlay.scrim`, `radius.lg`, tile 52 | Không mới |
| Bóng thẻ | - | **Không thêm bóng** (Q-21g): thẻ dùng viền `border.default` như `Card` hiện có (board vẽ viền mint nhạt; `border.field` đậm hơn và sẽ đổi tông mọi thẻ khác) |
| Cỡ chữ số lớn | - | Không cần (board không có số lớn: giá trị là "Chưa có thông tin") |
| Chuyển sắc nút/hero | - | Không (Q-21a) |

**Danh sách token mới tối thiểu (cuối cùng): 2 primitive + 3 semantic/component** là: `palette.blue[50]`, `palette.blue[700]` (tầng 1); `color.accent.blue.{fg,bg}`, `color.text.onBrandMuted` (tầng 2); `components.progress.height`, `components.checkbox.size`, `components.field.multilineMinHeight` (tầng 3). Mỗi token: tạo ở đúng tầng, cập nhật `docs/design-token-spec.md`, `src/core/theme/theme.test.ts` (giá trị, tham chiếu tầng, tương phản), chạy `npm run check:tokens`. `colors.ts`/`colors.golden.json` (bảng đóng băng của màn đã xác nhận) **không đổi**.

## 5. Điểm lệch cần xử lý (board vẽ trái bất biến, nghiệp vụ hoặc backend)

D1..D17 theo bản nháp đã chỉnh; D18..D29 là phát hiện thêm sau khi phóng board.

| # | Board vẽ | Vì sao lệch | Phương án giữ bố cục |
|---|---|---|---|
| D1 | Tên "Trần Văn Minh", cửa hàng "Shop Thời Trang", ID `12345678900`, email che | Dữ liệu minh họa; mô hình chưa có "mã cửa hàng" (Q-20n) | Dữ liệu minh họa **chỉ ở cổng giả/ảnh minh họa**; bản thật hiển thị dữ liệu thật; dòng "ID" ẩn đến khi có trường |
| D2 | "Gói tiêu chuẩn", "Đang hoạt động", 5 quyền lợi có tích, "Hỗ trợ 24/7" | Gói/quyền lợi chưa chốt (O-06, O-16); "24/7" là cam kết không có cơ sở (bất biến 11) | Giữ khung; tên gói "Chưa có thông tin"; huy hiệu "Sắp có"; chỉ nêu quyền lợi kiểm chứng được; bỏ "Hỗ trợ 24/7" (Q-21c) |
| D3 | "Nâng cấp gói" | Chưa có thanh toán (O-16, Q-20d) | Nút giữ vị trí, **khóa** + "Sắp có" |
| D4 | Thời hạn lưu cụ thể cho video/ảnh giao/ảnh hoàn | Không có nguồn dữ liệu; thời hạn theo gói | "Chưa có thông tin" (board đã dùng chữ này) |
| D5 | "Xác thực 2 lớp: Chưa bật" | Chưa có MFA backend | Khóa, huy hiệu "Sắp có" (Q-21d) |
| D6 | "Thiết bị đăng nhập" | Cần theo dõi phiên thiết bị | Khóa, "Sắp có" (Q-21d) |
| D7 | "Xóa cửa hàng" | Có thể phá bằng chứng; bất biến 9; O-03/O-07 | **Ẩn** (Q-21d) |
| D8 | Xóa tài khoản đầy đủ quy trình | Chính sách chưa có (Q-20e); bất biến 9 | Màn thông tin + điều kiện thật (đang quay, tệp chưa đồng bộ); hộp kiểm hiển thị; nút xóa **khóa** + hướng dẫn qua hỗ trợ (Q-21h) |
| D9 | Mọi công tắc thông báo bật | Chưa có hạ tầng đẩy | Công tắc lưu **cục bộ**, mặc định theo đặc tả UI-I04; ghi rõ chưa gửi thông báo đẩy (Q-21i) |
| D10 | "Đang tải lên 70%", "Đã đồng bộ", "Lưu trên đám mây" | Chưa có hàng đợi/tệp; "đã sao lưu" chỉ sau máy chủ xác nhận (bất biến 3) | `StatusCard` dựng và test với dữ liệu giả **chỉ trong test/ảnh minh họa**; app thật không hiển thị cho tới khi có dữ liệu thật (Q-21i) |
| D11 | Số liệu "Dữ liệu bằng chứng" | Hôm nay không có tệp; chỉ 0 thật | Đếm thật hoặc "Chưa có thông tin"; không số giả |
| D12 | "Sắp hết thời hạn lưu: Còn 3 ngày nữa" | Cần ngày hết hạn thật | Thành phần có sẵn, chỉ dùng khi có dữ liệu |
| D13 | Sửa hồ sơ/đổi mật khẩu bản Firebase | Hợp đồng API chưa có (Q-20t) | Giữ "chưa kết nối" trung thực |
| D14 | "Gửi yêu cầu" | Chưa có kênh nhận | Mở email soạn sẵn; không giả "đã gửi" (Q-21i) |
| D15 | "Vai trò: Quản lý" | Danh sách vai trò chưa chốt (O-07) | Hiện theo cổng (`owner`/`member`) hoặc ẩn khi không chắc |
| D16 | Thiếu khung "Về Đơn Chứng" | Board bỏ khung 19 | Q-21j |
| D17 | Câu quảng bá ("Bảo vệ đơn hàng", "bảo mật" trong tiêu đề, "đám mây") | Test i18n chặn "bảo vệ" ngoài ngoại lệ (Q-20s); từ "đám mây" so "máy chủ" (O-28c) | Câu trung thực đã duyệt; tiêu đề "Quyền riêng tư và bảo mật" dùng được (đã là tên mục menu); khung chữ giữ |
| D18 | Khung 3 hiện **cả form lẫn thẻ Apple/Google** | Tài khoản Apple/Google không có mật khẩu để đổi (Q-20c) | Thẻ thay cho form khi đăng nhập social; hiện form khi email+mật khẩu |
| D19 | Khung 12: "dữ liệu có thể vẫn xem được trên thiết bị của bạn" sau hết hạn | docs/06 chưa chốt xử lý khi hết hạn và bản cục bộ (O-06); không được hứa | Đổi thành câu trung thực ("Thời hạn lưu theo gói; thông tin chi tiết sẽ cập nhật khi gói được chốt") hoặc bỏ thẻ; BA duyệt |
| D20 | Khung 18: "Chính sách đổi trả" | Đơn Chứng không bán hàng, không có chính sách này | **Không dựng** hàng này; 3 hàng còn lại |
| D21 | Khung 4c: không có lối "Đăng xuất" | Q-20l (2a) đang áp dụng là chỉ chặn; (2b) "Vẫn đăng xuất" chờ BA | **PR-C: giữ đúng board, chỉ chặn** (Q-21q); nếu BA chọn (2b) thì thêm liên kết chữ nhỏ dưới nút phụ |
| D22 | Khung 6: "20/50" trong khi tên có 15 ký tự | Số đếm sai | Đếm theo độ dài thật |
| D23 | Khung 5: hàng "Vai trò", "Trạng thái" có chevron | Hàng thuộc tính không mở được màn nào | Bỏ chevron |
| D24 | Khung 7b/7c: tiêu đề nền ghi "Gói dịch vụ" | Lỗi minh họa | Nền là màn "Chuyển cửa hàng" |
| D25 | Khung 20: "Đã đăng xuất khỏi tất cả thiết bị" | App không kiểm chứng được | Chỉ hiện điều kiện kiểm được (đang quay, tệp chưa đồng bộ, đã đăng nhập lại gần đây nếu cần); mục thiết bị bỏ |
| D26 | Khung 16: ảnh chụp thật + nút phát | Cần tài nguyên video/ảnh và bản quyền; không có video hướng dẫn | Ảnh/hình minh họa do dự án có; chưa có thì ô minh họa trung tính **không nút phát** |
| D27 | Khung 9: "Xem tất cả ›" | Không có đích | Ẩn |
| D28 | Khung 1a-1e: mũi tên "‹" và icon tròn phải trên header gốc tab | Màn gốc tab không có "quay lại"; chức năng icon phải không rõ | Giữ tiêu đề "Cá nhân" không mũi tên, không icon phải (Q-21k hỏi designer) |
| D29 | Khung 3: gợi ý "bao gồm chữ và số" | D-13 chỉ yêu cầu từ 8 ký tự | Giữ "Từ 8 ký tự" (không thêm luật mật khẩu mới ở UI) |

## 6. Kế hoạch PR (A-I)

Mỗi PR: nhánh tách từ `main` mới nhất sau khi PR trước merge; theo quy trình repo (dev làm, `npm run check` xanh, ảnh bản web đối chiếu board, tạo PR theo mẫu, reviewer, sửa, CI xanh, squash merge). Mỗi PR cập nhật ảnh trong `docs/assets/screens/personal-tab-redesign/` (README ghi rõ là bản web, cổng giả, chưa kiểm chứng trên thiết bị).

**Thứ tự khuyến nghị:** A -> B -> C -> D (tuần tự, vì cùng vùng và dùng chung hộp thoại) rồi E, F, G, H có thể song song (độc lập) và I cuối (chờ Q-21h, Q-20e). Có thể đưa C trước B nếu muốn sớm thấy thay đổi nhỏ.

| PR | Phạm vi | Tệp chính | Thành phần / route | Test | Tiêu chí xong | Phụ thuộc |
|---|---|---|---|---|---|---|
| **A** | Token + thành phần dùng chung | `src/core/theme/{primitives,semantic,components}.ts`, `theme.test.ts`, `docs/design-token-spec.md`; `src/shared/ui/{HeroCard,IconTile,MetricTile,StatusCard,Checkbox}.tsx`, sửa `ConfirmDialog.tsx` (`icon`, `iconTone`, `actionsLayout`), `TextField.tsx` (`counter`), `ErrorState.tsx` (`variant="card"`), `EmptyState.tsx` (`icon`, `action`), `ScreenHeader.tsx` (`trailing`, căn trái), `Icon.tsx` (glyph mới), `index.ts`, `README.md` | Không đổi route | Test từng thành phần + tương phản token; `frozen-*-equivalence` xanh; `check:tokens` | `npm run check` xanh; ảnh các thành phần ở sáng; prop mới tùy chọn, mặc định cũ | Không |
| **B** | Màn chính + 5 trạng thái (1a-1e) | `ProfileScreen.tsx`, `ProfileSummaryCard.tsx`, `MenuRow.tsx`, `RegionParts.tsx`, `account-menu.ts`, `nav.json`, `personal.json` | Không route mới; thẻ gói/dữ liệu bằng chứng mở route đã có hoặc khóa "Sắp có" | `ProfileScreen.test.tsx` đủ 5 trạng thái, chữ lớn, 320/360/390 | Khớp checklist 1a-1e (mục 8); không số giả | A |
| **C** (đã làm, mục 6.3) | Sửa họ tên, Đổi mật khẩu, hộp thoại Đăng xuất | `EditProfileScreen.tsx`, `ChangePasswordScreen.tsx`, `use-sign-out.ts`, `ProfileScreen.tsx` (hộp thoại) | Không route mới | Cập nhật test hiện có + test thẻ social thay form | Khớp 2, 3, 4a-c; vẫn chặn khi quay, vẫn đủ lối đăng xuất (D21) | A |
| **D** (đã làm, mục 6.4) | Cửa hàng: cài đặt, sửa tên, chuyển + 2 hộp thoại | `ShopSettingsScreen.tsx`, `ShopEditScreen.tsx`, `ShopSwitchScreen.tsx`, `use-switch-shop.ts` | Không route mới | Test hiện có + bộ đếm, "Bị khóa", ô tìm | Khớp 5, 6, 7a-c; "Xóa cửa hàng" ẩn | A |
| **E** | Gói, chi tiết gói, lịch sử thanh toán | `src/app/(tabs)/account/{plan,plan-detail,payment-history}.tsx`, màn mới trong `features/personal/ui`, `routes.ts` (route con của `plan`, `UI-H01`), `nav.json` | `plan` (có sẵn) + 2 route con `parent` (Q-21b) | `routes.test.ts` (route con khai báo `parent`), màn | Khớp 8, 9, 10; mọi giá trị "Chưa có thông tin"; nút nâng cấp khóa | A, Q-21b |
| **F** | Dữ liệu bằng chứng, thời hạn lưu | màn mới + `routes.ts` (route con của `profile` UI-I01) | 2 route con | Test đếm thật (0) và chữ "Chưa có thông tin" | Khớp 11, 12; không số bịa; thẻ ghi chú theo D19 | A, B |
| **G** | Thông báo, Quyền riêng tư và bảo mật | `NotificationsScreen`, `SecurityScreen`, `SettingsGateway` (bản giả + chưa kết nối), `account-menu.ts` (đổi `available`) | `notifications`, `security` (có sẵn) | Test công tắc lưu/đọc cục bộ, thẻ quyền bị từ chối, hàng khóa | Khớp 13, 14; không hứa đẩy | A, C |
| **H** | Trợ giúp, bài hướng dẫn, liên hệ, điều khoản (+ Về ứng dụng nếu Q-21j chốt giữ) | màn mới, nội dung tĩnh trong `personal.json`, `legal-links.ts` | `help` (có sẵn) + route con bài/liên hệ/điều khoản | Test tìm kiếm tĩnh, mở email soạn sẵn không "đã gửi" | Khớp 15-18; không "Chính sách đổi trả" | A, Q-21j/k cho tài nguyên |
| **I** | Xóa tài khoản | màn mới, `Checkbox`, kết nối `use-sign-out` (đếm tệp) | route con của `security` | Test điều kiện thật, nút khóa | Khớp 20; không xóa thật | A, G, Q-21h, Q-20e |

### 6.1 Trạng thái PR-A (đã làm, chờ duyệt)

- **Token:** đúng danh sách mục 4 (`palette.blue[50/700]`, `color.accent.blue`, `color.text.onBrandMuted`, `components.progress.height`, `components.checkbox.size`, `components.field.multilineMinHeight`); không bóng, không gradient, không thư viện; `colors.ts`/golden không đổi; tương phản có test; `check:tokens` xanh (baseline ngoại lệ không tăng).
- **Thành phần mới** (`src/shared/ui`): `HeroCard`, `IconTile` (+ `tone.ts`), `MetricTile` (mới, không mở rộng `StatTile` vì thẻ nền màu/số lớn khác mục đích), `StatusCard` (kiểu union: `progress` chỉ với `status="uploading"`; nhãn trạng thái bằng chứng không ghi đè được; `title` chỉ ở nhánh `tone`; `progress` không hữu hạn bị bỏ, ngoài 0-100 bị kẹp), `Checkbox`; `HeroCard` có `badgeLabel` để huy hiệu được đọc; glyph mới chỉ còn `disconnect` (ngoại tuyến, PR-B) và `receipt` (lịch sử thanh toán trống, PR-E). Các glyph `warning-solid`, `play` (D26: không dựng nút phát), `cloud`, `document`, `person` đã bỏ vì chưa có nơi dùng; PR dùng đến thì thêm lại.
- **Prop tùy chọn mới** (mặc định giữ nguyên; bảo vệ bằng test mặc-định-giữ-nguyên trong `redesign-components.test.tsx` cho `ConfirmDialog`/`TextField`/`ErrorState`/`EmptyState`/`ScreenHeader`: không truyền prop mới thì cùng cấu trúc/style như trước. Hai test `frozen-*-equivalence` chỉ phủ `Button`/`Text`/`Icon`, không phủ năm thành phần này): `ConfirmDialog` (`icon`, `iconTone`, `actionsLayout`), `TextField` (`counterMax`, `multiline`), `ErrorState` (`variant="card"`), `EmptyState` (`iconTone`, `actionVariant`; `actionLabel` và `onAction` cùng có hoặc cùng không, kiểu union nên thiếu một trong hai là lỗi biên dịch), `ScreenHeader` (`backIcon`). `EmptyState` đã có `icon` và `ScreenHeader` đã có `trailing` và căn trái sẵn từ trước, nên không thêm gì cho các việc đó.
- **Lệch so với plan/board:** (1) `TextField` dùng `counterMax` (đếm theo `value.length`) thay vì chuỗi "20/50" tự truyền, để D22 đúng từ gốc; (2) viền hộp kiểm dùng `text.secondary` thay `border.default` (tương phản); (3) thẻ "Đang quay video" của khung 21 chưa dựng (ngoại lệ D-18 chỉ cho chấm ghi hình); (4) nhãn mặc định `StatusCard` theo nhãn chuẩn docs/09, không phải chữ board; (5) icon hộp thoại trong ô tròn nền nhạt thay vì biểu tượng đặc; (6) ngắt kết nối dùng `unlink-outline`. Chi tiết và ảnh: `docs/assets/screens/personal-tab-v3/README.md`.
- **Chưa làm ở PR-A:** `ConfirmDialog` chưa có nút xác nhận vô hiệu (khung 7c) và chưa có liên kết "Vẫn đăng xuất" (D21): để PR-C/PR-D. Chưa kiểm chứng trên thiết bị, chưa chụp ở chữ lớn.

### 6.2 Trạng thái PR-B (đã merge)

Màn UI-I01 dựng lại theo khung 1a-1e; **không route/mã UI mới** (Q-21b). Tệp: `ProfileScreen.tsx`, `ProfileCards.tsx` (thẻ cửa hàng, thẻ gói, khối dữ liệu bằng chứng, trạng thái 1d/1e), `ProfileSkeletons.tsx` (khung chờ 1b/1c), `ProfileSummaryCard.tsx`, `RegionParts.tsx` (`RegionError card`), `account-menu.ts` (`planMenuItem`), `personal.json`; dùng chung: glyph `cloud` mới, `ErrorState variant="card"` có nút thử lại là nút chính. Ảnh: `docs/assets/screens/personal-tab-v3/pr-b-*.png` (xem README ở đó). Ảnh `pr-b-1a-*` đã chụp lại ở PR-C (có dòng "Chưa có số liệu" dưới nhãn ba ô bằng chứng).

**Cách thể hiện từng khung**

| Khung | Cách làm |
|---|---|
| 1a | Header chỉ "Cá nhân" (không mũi tên, không icon phải: D28/Q-21k); thẻ hồ sơ; thẻ cửa hàng (`IconTile store blue`); `HeroCard` gói; khối "Dữ liệu bằng chứng" (3 `MetricTile`, giá trị "Chưa có số liệu") + nút "Xem trung tâm đồng bộ" (`ROUTES.sync`); rồi nhóm Tài khoản (Đổi mật khẩu, chỉ khi đăng nhập bằng mật khẩu) / Cài đặt / Hỗ trợ / Đăng xuất + phiên bản |
| 1b | Mỗi thẻ khung chờ là MỘT phần tử "Đang tải" cho trình đọc màn hình (thanh con bị ẩn). Chỉ khi **cả hai** khu vực (hồ sơ, cửa hàng) chưa xong: khung chờ cho cả năm khối. Một khu vực xong trước thì khu vực đó hiện thật, khu vực kia vẫn khung chờ; thẻ gói và khối bằng chứng (nội dung tĩnh) hiện ngay |
| 1c | Lỗi hồ sơ: khung chờ mờ (ẩn khỏi trình đọc màn hình) + `ErrorState variant="card"`; lỗi cửa hàng: thẻ lỗi tại chỗ. Mỗi khu vực độc lập, không che khu vực đã tải xong |
| 1d | **Chỉ khi ngoại tuyến, lỗi là lỗi mạng (`AUTH_NETWORK_ERROR`) và chưa có dữ liệu hồ sơ nào**; lỗi mã khác dù đang ngoại tuyến đi khung 1c: `EmptyState icon="disconnect"` + "Thử lại". Đã có dữ liệu thì GIỮ dữ liệu + thẻ cảnh báo "dữ liệu đã lưu, có thể chưa mới nhất" (hành vi trung thực cũ), không xóa vì ngoại tuyến |
| 1e | Q-21e cách 1: chỉ thay thẻ hồ sơ bằng `EmptyState icon="user"` + "Cập nhật" (mở Sửa họ tên); thẻ cửa hàng, gói, bằng chứng, menu, Đăng xuất vẫn dùng được |

**Quyết định cho Q-21l (ghi theo ủy quyền, chờ designer):** board chỉ thấy hàng "Cài đặt ›". Giữ cấu trúc nhóm hiện tại dưới nút đồng bộ: Tài khoản (Đổi mật khẩu) / Cài đặt (Thông báo, Quyền riêng tư và bảo mật) / Hỗ trợ (Trợ giúp), rồi Đăng xuất; không thêm màn trung tâm "Cài đặt". Nhóm "Cửa hàng và gói" bỏ tiêu đề vì thẻ cửa hàng và thẻ gói đã đứng riêng; mục `plan` của `account-menu.ts` điều khiển thẻ gói (bật `available` thì thẻ mở được, hôm nay khóa + "Sắp có"). Mục `members` vẫn ẩn.

**Lệch có chủ đích so với board** (lý do)

1. Không có huy hiệu "Đã xác thực": `UserProfile` chưa có dữ liệu xác thực email (Q-21m; xem câu hỏi mới ở `decisions.md`).
2. Thẻ gói: tên gói "Chưa có thông tin", huy hiệu "Sắp có", không "Gói tiêu chuẩn"/"Đang hoạt động", không mũi tên (khóa, Q-21c); nền phẳng `brand.deep` (Q-21a).
3. Ba ô bằng chứng giữ đúng ba nhãn của board nhưng mỗi ô có giá trị "Chưa có số liệu" (đồng nhất; trợ năng đọc "Trên đám mây: Chưa có số liệu"; sau review PR #15, Q-21p cách 1), **không số**: chưa có tệp bằng chứng, và `countUnsyncedOnDevice` đếm cả máy (mọi cửa hàng) nên không khớp nghĩa "Đang chờ đồng bộ" của một cửa hàng; PR-F quyết định nguồn số. Không có chấm cam; tên "Trên đám mây" giữ theo board (O-28c: tên chính thức còn mở; hôm nay chưa có gì hiện là đã ở đó).
4. Khối bằng chứng không có mũi tên "›" ở tiêu đề (chưa có màn khung 11; PR-F thêm).
5. Thẻ hồ sơ vẫn có mũi tên (board không vẽ) để lối vào Sửa họ tên không bị ẩn.
6. 1c: khung chờ chỉ ở chỗ thẻ hồ sơ; các khối bên dưới là nội dung thật (không vẽ khung chờ mờ cho nội dung tĩnh). Lời lỗi theo mã lỗi (docs/04-05), không phải "Không thể tải thông tin cá nhân".
7. 1d: câu mô tả "Chưa tải được thông tin cá nhân. Hãy kết nối mạng rồi thử lại." thay "Dữ liệu có thể đã cũ." (không có dữ liệu nào để gọi là cũ); banner ngoại tuyến toàn cục (UI-F04) vẫn hiện phía trên. Glyph ngắt kết nối là `unlink-outline` (PR-A).
8. 1e: "Hãy cập nhật họ tên để hoàn tất thông tin cá nhân." thay "Vui lòng ..." (test từ cấm của repo chặn "vui lòng"); icon `person-circle` thay icon người trong vòng tròn nét.
9. Hero nền phẳng, nút chính phẳng (không chuyển sắc); thẻ viền `border.default` không bóng (Q-21g).

**Chưa kiểm chứng:** trạng thái ngoại tuyến **không xảy ra trong app thật** vì `useIsOffline` (khung tạm) luôn trả `false`; khung 1d chỉ được test bằng mock và chụp bằng bản thử đổi ở bản sao ngoài repo. Chưa chụp ở chữ lớn (font scale), chưa chạy trên iOS/Android thật.

### 6.3 Trạng thái PR-C (đã merge)

Không route/mã UI mới (`UI-I01`/`UI-I05` giữ nguyên). Ảnh: `docs/assets/screens/personal-tab-v3/pr-c-*.png` (bản web, cổng giả, 320/360/390), ảnh ghép `pr-c-compare-board-vs-app-390.png`, checklist ở README thư mục đó.

| Khung | Cách làm |
|---|---|
| 2 Sửa họ tên | Nhãn "Họ và tên *" (`TextField required`: dấu sao đỏ chỉ trang trí, ẩn khỏi trình đọc, ô báo `aria-required`), ô chữ, nút "Lưu" ngay dưới ô (không ghim đáy; chỉ hiện khi đã tải hồ sơ). Bỏ ô email chỉ đọc và `ReadOnlyField` (email vẫn thấy ở thẻ hồ sơ màn Cá nhân). Giữ: Lưu tắt khi chưa đổi/đang gửi, kiểm tra khi bấm + focus ô lỗi, toast chỉ sau khi cổng xác nhận, `PROFILE_SAVE_FAILED` tại màn, hủy khi có thay đổi thì hỏi |
| 3 Đổi mật khẩu | Ba ô có icon mắt (đã có), nhãn có dấu sao, gợi ý nhập theo board ("Nhập mật khẩu hiện tại"/"mới"/"Nhập lại mật khẩu mới"), nhãn ô ba "Xác nhận mật khẩu mới", dòng yêu cầu thời gian thực "Tối thiểu 8 ký tự" (biểu tượng + chữ, theo D-13; KHÔNG "chữ và số" vì app không kiểm tra, D29), nút "Lưu" ngay dưới. Màn tự đọc `signInMethod`: Apple/Google thấy thẻ "Tài khoản Apple/Google" (nêu đúng nhà cung cấp) THAY form; đang tải/lỗi tải hồ sơ không hiện form. Giữ `AUTH_WRONG_CURRENT_PASSWORD`, `AUTH_WEAK_PASSWORD`, `AUTH_REQUIRES_RECENT_LOGIN`/`AUTH_SESSION_EXPIRED` (nút "Đăng nhập lại"), chống gửi lặp, không log mật khẩu. Bỏ câu mô tả đầu trang (board không có) |
| 4a | `ConfirmDialog` có icon `sign-out`; nút chính "Ở lại ứng dụng", nút viền đỏ "Đăng xuất"; câu "Video và dữ liệu trên máy này vẫn được giữ lại." giữ làm dòng phụ vì đúng hành vi (Q-20h) |
| 4b | Icon camera, tiêu đề "Đang quay video", "Bạn đang quay video đóng gói. Hãy dừng quay trước khi đăng xuất."; MỘT nút "Ở lại ứng dụng" (`ConfirmDialog hideConfirm`) |
| 4c | Icon cảnh báo (tông warning), "Còn bằng chứng chưa đồng bộ"; nút chính "Xem trung tâm đồng bộ", nút phụ "Ở lại ứng dụng"; KHÔNG có "Đăng xuất" (giữ chỉ chặn, Q-20l; Q-21q) |

**Thành phần dùng chung (prop tùy chọn, mặc định giữ nguyên, có test):** `TextField.required`; `ConfirmDialog.hideConfirm` (kiểu union: không nhận `confirmLabel`/`onConfirm`), `messageTestID`, `confirmTestID`. Nút xác nhận vô hiệu cho khung 7c do PR-D thêm (`confirmDisabled`). `useSignOut` không đổi logic (chỉ sửa chú thích); `ProfileScreen` bỏ `BottomSheet` ở hai nhánh chặn/cảnh báo.

**Lệch có chủ đích so với board**

1. Khung 3: thẻ Apple/Google thay form thay vì hiện cùng form (D18, Q-21s); nêu đúng "Apple" hoặc "Google"; câu "Hãy đổi trong cài đặt tài khoản Apple/Google" thay "Vui lòng ..." (test từ cấm).
2. Khung 3: gợi ý "Tối thiểu 8 ký tự" không có "bao gồm chữ và số" (D29).
3. Khung 3 và 2: board không có lỗi tại ô nên không so được; app giữ lỗi tại ô (đã duyệt từ PR 4b).
4. Hộp thoại: icon trong ô tròn nền nhạt (PR-A), lề thẻ 24dp thay ~12dp (Q-21r), nút phụ 4c có viền xanh đậm hơn viền teal nhạt của board; nội dung 4a thêm dòng phụ về dữ liệu trên máy; tiêu đề/nội dung 4c nêu đúng hành vi chặn ("Hãy đồng bộ xong rồi đăng xuất", số tệp thật) thay "Đăng xuất có thể làm gián đoạn..." (câu đó ngụ ý được phép đăng xuất).
5. Khung 2: ô nhập hiện viền xanh khi đang focus (board vẽ viền mint ở trạng thái thường).
6. Thanh tab ẩn trên khung 2/3 (khớp board, đã làm ở PR 4b); 4a-4c hiện trên màn Cá nhân có thanh tab dưới lớp tối (board che bằng khung giả không thanh tab).

**Chưa kiểm chứng:** thiết bị iOS/Android thật, chữ lớn (font scale) chưa chụp, VoiceOver/TalkBack (dấu sao ẩn, `aria-required`, hộp thoại `accessibilityViewIsModal`), bàn phím che nút Lưu trên màn hẹp (nút nằm trong nội dung cuộn được).

**Ghi chú:** PR-C đổi chuỗi `switchShop.unsyncedTitle` từ "Còn video chưa lưu lên máy chủ" thành "Còn bằng chứng chưa đồng bộ" (cả `signOut` và `switchShop`) cho khớp 4c; tiêu đề cảnh báo chưa đồng bộ khi chuyển cửa hàng đổi theo, nội dung giữ.

### 6.4 Trạng thái PR-D (đã làm, chờ duyệt)

Không route/mã UI mới (`UI-I02` giữ nguyên, Q-21b). Ảnh: `docs/assets/screens/personal-tab-v3/pr-d-*.png` (bản web, cổng giả, 320/360/390), ảnh ghép `pr-d-compare-board-vs-app-390.png`, checklist ở README thư mục đó. Tệp chính: `ShopSettingsScreen.tsx`, `ShopEditScreen.tsx`, `ShopSwitchScreen.tsx`, `ShopSwitchRow.tsx` (mới), `domain/shop-list.ts` (mới: lọc theo tên không dấu, ngưỡng ô tìm), `personal.json`/`nav.json`; dùng chung: `ConfirmDialog.confirmDisabled`, dấu sao `TextField required` màu trung tính.

| Khung | Cách làm |
| --- | --- |
| 5 | Header "Cửa hàng"; thẻ thông tin (ô icon cửa hàng, tên, huy hiệu trạng thái); hai hàng Vai trò/Trạng thái chỉ đọc, KHÔNG thẻ nền, KHÔNG mũi tên (D23); mỗi hành động một thẻ: "Sửa tên cửa hàng" (khi `canEdit`), "Chuyển cửa hàng" (khi từ hai cửa hàng). Bỏ câu mô tả đầu trang. **Không có "Xóa cửa hàng"** (Q-21d, bất biến 9) và **không có dòng "ID"** (D1, Q-20n). Vai trò theo cổng ("Chủ cửa hàng"/"Thành viên"), không bịa "Quản lý" (D15) |
| 6 | Nhãn "Tên cửa hàng *" (`required`), bộ đếm theo độ dài thật `n/50` (D22), nút Lưu ngay dưới ô; giữ: Lưu tắt khi chưa đổi/đang gửi, kiểm tra khi bấm + focus, hủy hỏi xác nhận, toast sau khi cổng xác nhận, quyền theo `canEdit`. Giữ câu "Đổi tên không làm thay đổi video và lịch sử đã lưu." dưới nút |
| 7a | Danh sách: ô icon, tên, dòng trạng thái màu ("Đang dùng"/"Đang hoạt động"/"Bị khóa") kèm vai trò, dấu tích phải khi được chọn; "Đang dùng" và "Bị khóa" KHÔNG chọn được. Luồng mới: chọn hàng rồi nút "Xác nhận" ở chân màn (tắt khi chưa chọn); điều kiện bảo vệ dữ liệu chạy khi bấm "Xác nhận". Ô tìm (không phân biệt dấu) chỉ khi từ 6 cửa hàng (`SHOP_SEARCH_MIN_SHOPS`, đề xuất) |
| 7b | `ConfirmDialog` icon `swap`, "Xác nhận chuyển cửa hàng", "Bạn có chắc chắn muốn chuyển sang {tên}?", dòng phụ "Dữ liệu của cửa hàng hiện tại vẫn được giữ trên máy.", hai nút cạnh nhau "Hủy"/"Xác nhận" |
| 7c | `ConfirmDialog` icon `camera`, "Không thể chuyển cửa hàng", "Bạn đang quay video đóng gói. Hãy dừng quay trước khi chuyển."; "Ở lại" (nút chính) và "Chuyển cửa hàng" vô hiệu (`confirmDisabled`) |
| Giữ | Cảnh báo chưa đồng bộ (BottomSheet có "Xem trung tâm đồng bộ" và "Vẫn chuyển cửa hàng", Q-20o), chặn bảo thủ khi không đọc được kho (`SHOP_SWITCH_FAILED`), phiên chỉ đổi sau khi cổng xác nhận, cô lập dữ liệu A -> B (test) |

**Lệch có chủ đích so với board**

1. Dấu sao `required` màu trung tính (`text.secondary`), board vẽ đỏ: `docs/design-system.md` chỉ cho đỏ lỗi/phá hủy. Áp dụng cho mọi `TextField required` (cả Sửa họ tên, Đổi mật khẩu của PR-C).
2. Khung 5: không "ID", không "Xóa cửa hàng", không nhãn nhỏ dưới logo (có thể là "Sửa": không có chỗ lưu logo), vai trò không "Quản lý", hàng thuộc tính không mũi tên, thanh tab vẫn hiện (route gốc UI-I02; Q-21t).
3. "Bị khóa" dùng tông cảnh báo (cam) và nhãn "Bị khóa" thay "Tạm khóa" ở cả màn Cửa hàng; board vẽ đỏ (đỏ chỉ cho lỗi/phá hủy). Hàng có thêm vai trò sau trạng thái.
4. Trạng thái "Đang hoạt động" ở khung 5 và 7a dùng tông info/brand, không `success` (dành cho việc máy chủ xác nhận).
5. 7a: không chọn gì thì nút "Xác nhận" tắt (board vẽ bật); dấu tích phải là "đã chọn" (board gắn với cửa hàng đang dùng). Đang dùng có dấu tích trái như board.
6. Icon 7b/7c: ô tròn nền nhạt, glyph `swap`/`camera` (board: khiên đặc, máy quay có khóa đỏ); nút phụ có viền, nút vô hiệu 7c dạng viền mờ. 7b có thêm dòng phụ về dữ liệu trên máy. Lề hộp thoại 24dp (Q-21r).
7. Bỏ câu "Chọn cửa hàng bạn muốn làm việc." (board không có).
8. Cảnh báo chưa đồng bộ khi chuyển giữ BottomSheet (board không có khung; cần ba lối nên không vừa `ConfirmDialog` hai nút).

**Chưa kiểm chứng:** thiết bị iOS/Android thật, chữ lớn (chưa chụp), VoiceOver/TalkBack (`radio` + `selected`/`disabled`), `String.prototype.normalize` của Hermes trên cả hai nền tảng (lọc không dấu), bàn phím trên màn hẹp, 7c nút vô hiệu đọc bởi trình đọc màn hình.

## 7. Rủi ro

1. **Board độ phân giải thấp**: chữ nhỏ, icon, khoảng cách ước lượng. Giảm: yêu cầu bản >= 3000px (Q-21k), designer duyệt ảnh PR.
2. **Nội dung board vs bất biến**: D2, D3, D10, D19, D25 nếu designer coi là bắt buộc thì cần quyết định sản phẩm, không phải dev.
3. **Nội dung đổi sau khi gói/chính sách chốt**: khung gói/thời hạn có thể phải dựng lại (giá trị "Chưa có thông tin" là chỗ giữ).
4. **Tài nguyên khung 16** (ảnh/video hướng dẫn): chưa có, bản quyền chưa rõ.
5. **Thuật ngữ**: board dùng "Cửa hàng" (khớp Q-20q), "đám mây" (O-28c).
6. **Khối lượng**: ~15 màn mới, chuỗi i18n và test tăng; không thêm thư viện (không gradient).
7. **Chưa kiểm chứng trên thiết bị**: mọi ảnh là bản web; font scale lớn, vùng an toàn, Android phải xem trên thiết bị thật (QA).
8. **Màn khách đã xác nhận**: không được động tới; PR chỉ sửa `features/personal` và `shared/ui` (có test đóng băng).

## 8. Quy trình kiểm tra "giống design"

1. **Chụp bản web** theo `docs/assets/screens/personal-tab-v2/README.md` (cổng giả, tool ngoài repo, không thêm phụ thuộc); kích thước 360x800 và 390x844 (và 320x568 cho chữ lớn).
2. **Cắt khung tương ứng** từ board bằng Python (`python3 -I`, Pillow nếu có, script và ảnh ở thư mục tạm ngoài repo) rồi **ghép cạnh nhau** cùng chiều cao (board ở bên trái, ảnh app ở bên phải), phóng khung board 3-4x cho dễ so.
3. **Checklist mỗi khung** (đánh dấu từng dòng trong mô tả PR): bố cục và thứ tự khối; thứ bậc chữ (tiêu đề, phụ, nhãn); màu thẻ và nền; icon (hình khối và tông màu); khoảng cách giữa các khối; nút chính/phụ/nguy hiểm và thứ tự; header (căn lề, nút trái/phải); có hay không thanh tab; mọi trạng thái (tải, lỗi, ngoại tuyến, trống, khóa, vô hiệu); chuỗi chữ khớp board trừ các điểm D đã liệt kê.
4. **Ngưỡng đạt:** mọi dòng đạt, hoặc lệch đã nằm trong D1..D29 và được người dùng duyệt. Chênh khoảng cách <= 4dp quy về token gần nhất, không thêm token để "khớp từng pixel". Lệch màu: chấp nhận khi dùng đúng token đã ghi ở mục 4.
5. **Ghi rõ** trong README ảnh: đây là bản web trên cổng giả, **chưa kiểm chứng trên thiết bị iOS/Android thật**.

## 9. Câu hỏi mở

Xem [decisions.md Q-21](decisions.md): j (khung 19 "Về Đơn Chứng"), k (bản board >= 3000px, icon header 1a-1e), l (nhóm "Cài đặt" ở 1a và các hàng dưới), m (nội dung khung 12/18/25 cần BA duyệt: D19, D20, D25), n (mã UI cho BA gán). Cập nhật bảng ánh xạ PER-xx/UI-xx ở [personal-tab-plan.md](personal-tab-plan.md) khi BA trả lời.
