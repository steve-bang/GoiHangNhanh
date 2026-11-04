# Đề xuất "AmaBox Product Feature Blueprint" và đối chiếu với dự án

> **Trạng thái: đề xuất đầu vào + bản đối chiếu, chờ người dùng duyệt.** Không phải quyết định D-xx/Q-xx. Không thay thế tài liệu 01–09. Ngày ghi: 2026-11-04. Đối chiếu dựa trên `CLAUDE.md` ở HEAD hiện tại (hiện trạng v1, bảng quyết định đã chốt, 11 bất biến), **chưa** rà từng tài liệu `docs/01…09` (việc này giao `senior-ba`, xem mục 5).

## 1. Nội dung đề xuất (tóm tắt)

Định hướng: nền tảng quản lý và bảo vệ bằng chứng giao dịch cho người bán TMĐT, bao trọn vòng đời *trước giao hàng → đóng gói → bàn giao → tiếp nhận hàng hoàn → kiểm tra → tranh chấp → lưu trữ/truy xuất*. Tên đề xuất: **AmaBox** ("Protect Every Order. Preserve Every Proof."; ba giá trị Capture · Protect · Resolve).

### 1.1 Mười nhóm tính năng

| # | Nhóm | Mức | Ý chính |
|---|---|---|---|
| 01 | Cửa hàng và tài khoản | Nền tảng | Đăng ký/đăng nhập, nhiều shop, kết nối kênh bán (Shopee, TikTok Shop, Lazada…), nhân viên + vai trò + quyền, quản lý thiết bị/phiên, nhật ký hoạt động, logo/watermark shop |
| 02 | Đơn hàng và kiện hàng | Nền tảng | Quét/nhập mã, tìm kiếm, tạo đơn nhanh, sản phẩm/biến thể/số lượng, một đơn nhiều kiện, phát hiện trùng, nhập đơn từ file/tích hợp |
| 03 | Ghi hình đóng gói | Lõi | Quay liên tục tới khi niêm phong, kiểm tra camera/micro/bộ nhớ, gắn đơn-kiện-nhân viên-thiết bị, **Live Evidence Watermark** (thời gian, GPS, "Powered by AmaBox"), thumbnail + metadata, ghi nhận gián đoạn, nhiều bàn/nhân viên |
| 04 | Hàng hoàn | Lõi | Tìm đơn gốc hoặc hồ sơ chưa xác định, ảnh trước khi mở, quay mở kiện, niêm phong/bao bì, đối chiếu số lượng, phân loại thiếu/thừa/sai/hư hỏng, lịch sử chỉnh sửa |
| 05 | Quản lý bằng chứng và xác minh | Lợi thế | Evidence Timeline, ID tệp, SHA-256, dấu thời gian máy chủ, phát hiện tệp bị đổi, **trang xác minh bằng link/QR**, bản gốc bất biến, gắn cờ quan trọng/tranh chấp |
| 06 | Hồ sơ tranh chấp và xuất | Lợi thế | Tạo hồ sơ từ đơn/hoàn, chọn bằng chứng, tự tổng hợp, **PDF + ZIP**, link chỉ đọc có hạn, theo dõi trạng thái, Evidence Hold, kết quả do người dùng nhập |
| 07 | Đồng bộ và lưu trữ | Nền tảng | Tải nền, hàng đợi, retry, offline, phát hiện trùng/lỗi/hash lệch, theo dõi dung lượng, retention theo gói, cảnh báo, không xóa tệp chưa tải/đang Hold |
| 08 | Dashboard và phân tích | Mở rộng | Số đơn, tỷ lệ đủ bằng chứng, chờ/lỗi tải, hàng hoàn/tranh chấp, thống kê theo nhân viên/shop/kênh/bàn, cảnh báo bất thường (không thành phần mềm doanh thu) |
| 09 | Gói và thanh toán | Kinh doanh | Free/Basic/Pro/Business/Enterprise, hạn mức, nâng/hạ cấp, hóa đơn, dùng thử, khuyến mãi, chính sách dữ liệu khi hết hạn |
| 10 | Tích hợp và hệ sinh thái | Dài hạn | API, webhook, vận chuyển, đồng bộ đơn từ sàn, SDK, Google Drive, web dashboard nhiều shop, thiết bị chuyên dụng, cổng đối tác |

### 1.2 Năm năng lực tạo khác biệt

Order & Package · Packing Evidence · Return Evidence · Evidence Integrity & Timeline · Dispute-ready Package (giá trị nằm ở mối liên kết giữa chúng, không ở số tính năng). Ghi chú thị trường trong đề xuất: CAMBOX (watermark SHA-256, GPS, trang xác minh), Hoàn Hàng (đồng kiểm hàng hoàn, xuất hồ sơ một chạm), PackProof (nhận diện mã vận đơn, chia sẻ link, nhiều bàn). **Chưa kiểm chứng nguồn.**

### 1.3 Cấu trúc sản phẩm và điều hướng

- Ba sản phẩm: **Mobile** (quét, quay, hàng hoàn, xem bằng chứng), **Web Dashboard** (đơn, video, nhân viên, báo cáo, tranh chấp, lưu trữ), **Admin Portal** (nội bộ: khách hàng, subscription, dung lượng, giám sát).
- Mobile 5 mục: Tổng quan · Đơn hàng · Hàng hoàn · Đồng bộ · Tài khoản/Cửa hàng. Tranh chấp và Evidence Timeline vào từ chi tiết đơn.

### 1.4 Lộ trình đề xuất

1. **Core:** tài khoản/shop/nhân viên cơ bản, đơn-kiện, quay đóng gói, Live Watermark, hàng hoàn, tải nền/offline/retry, tra cứu bằng chứng, kiểm tra toàn vẹn, retention + dung lượng.
2. **Lợi thế:** Evidence Timeline, hồ sơ tranh chấp, PDF/ZIP, link chia sẻ + trang xác minh, Evidence Hold, phân quyền nâng cao, báo cáo chất lượng, tích hợp dữ liệu đơn.
3. **Scale:** multi-shop/kho, nhiều bàn/camera, API/webhook, báo cáo nâng cao, billing đầy đủ, cổng doanh nghiệp/đối tác, AI.

### 1.5 AI (chỉ gợi ý/cảnh báo, người dùng xác nhận)

Kiểm tra video (quá ngắn/thiếu đoạn/chất lượng thấp), nhận diện sản phẩm, kiểm tra hàng hoàn, tìm kiếm video, tổng hợp hồ sơ, cảnh báo rủi ro.

### 1.6 Sáu nguyên tắc

Evidence-first · Không mất dữ liệu · Không nhầm đơn · Minh bạch nguồn dữ liệu · Dễ dùng · Có khả năng mở rộng. Khuyến nghị: xây như SaaS nền tảng dùng chung (Auth, Multi-tenant, Role & Permission, Audit Log, File Management, Notification, Subscription, Evidence Workflow) và lấy 10 nhóm làm Blueprint chính thức.

## 2. Phần phù hợp với dự án

Định vị vòng đời bằng chứng, mô hình Đơn → Kiện → Phiên → Bằng chứng, sáu nguyên tắc ở 1.6 và các giới hạn của AI (gợi ý, người dùng xác nhận) khớp bất biến 1–3, 5, 8, 9, 11 và định hướng hiện có. Hầu hết nhóm 02–07 đã có nền ở v1 (xem mục 4).

## 3. Điểm xung đột với quyết định đã chốt (cần người dùng quyết)

| # | Đề xuất | Xung đột | Ghi chú |
|---|---|---|---|
| X-1 | Web Dashboard quản trị, Admin Portal (1.3) | Bảng "Quyết định đã chốt" (`CLAUDE.md`): web chỉ marketing/SEO; "web quản trị" nằm ở cột đã thay thế | Phải mở lại quyết định một cách tường minh |
| X-2 | Kết nối kênh bán, quản lý sản phẩm/biến thể, nhập đơn từ file/API (nhóm 01, 02, 10) | Nhập đơn tối giản; bất biến 10 (không bắt API sàn, không quản lý bán hàng) | Chỉ nên là tùy chọn về sau |
| X-3 | Watermark đóng vào hình, có GPS, "Powered by AmaBox" (nhóm 03) | Bất biến 4 (bản gốc bất biến; đóng dấu = bản dẫn xuất); Q-26 (vị trí không gửi lên); O-09 (ghi video hiện không thu tiếng, nên "kiểm tra micro" cũng cần chốt) | Chọn: đóng vào khung hình (xử lý lại video) hay lớp phủ khi xem; GPS cần quyết định riêng về quyền riêng tư |
| X-4 | Trang xác minh link/QR, link chia sẻ (nhóm 05, 06) | Bất biến 8 (không URL công khai vĩnh viễn); ADR-006 (Storage từ chối mọi truy cập client) | Khả thi qua Function cấp URL ký có hạn và phạm vi (tiền lệ: `getEvidenceReadUrl`), nhưng là thiết kế mới với rủi ro lộ dữ liệu |
| X-5 | Thanh điều hướng 5 mục không có Quét (1.3) | D-16: Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân | Bỏ tab Quét làm hỏng luồng chính "quét rồi quay"; Hàng hoàn/Đồng bộ hiện không có tab riêng (O-14, O-18) |
| X-6 | Gói Free→Enterprise, thanh toán, chính sách hết hạn (nhóm 09) | O-06, O-16 còn mở; QA-10 không áp dụng v1 | Chưa chốt tên gói hay hạn mức |
| X-7 | Nhân viên, vai trò, quản lý thiết bị, nhiều bàn đóng gói đưa vào Giai đoạn 1 | O-03, O-07 còn mở; v1 một máy một tài khoản (V1-07), đa thành viên để sau | Phạm vi Giai đoạn 1 quá rộng |
| X-8 | Tên "AmaBox" | O-11: "Đơn Chứng" là tên làm việc; D-1 (kiểm tra nhãn hiệu) | Ứng viên đổi tên, chưa phải quyết định |

Nội dung quảng bá (khẩu hiệu "Protect Every Order. Preserve Every Proof.") cần rà theo bất biến 11 để không bị hiểu thành cam kết tuyệt đối.

## 4. Đối chiếu nhanh với hiện trạng v1

Tất cả mới được kiểm bằng unit test/Emulator/`expo export`; **chưa có gì chạy trên thiết bị thật** (cổng G-0…G-13 chưa làm, V1-21 đang chờ).

| Nhóm | Hiện trạng |
|---|---|
| 01 | Có: Auth email/mật khẩu, tạo/đổi tên/chuyển shop, xóa tài khoản. Chưa: nhiều thành viên (O-03), vai trò, thiết bị, kết nối kênh bán, watermark/logo shop |
| 02 | Có: quét/nhập tay, tạo đơn nhanh, kiểm trùng, đơn → kiện → phiên. Chưa: sản phẩm/biến thể có cấu trúc đầy đủ, nhập từ file/tích hợp |
| 03 | Có (sau cờ, tắt mặc định): quay, gắn phiên/kiện trước khi quay, gián đoạn có ghi nhận. Chưa: watermark, kiểm tra micro/bộ nhớ, nhiều bàn |
| 04 | Có: D01–D07 cục bộ (đơn gốc, ảnh, video mở kiện, kiểm hàng, xác nhận). Chưa: đồng bộ nội dung hồ sơ, phân loại đầy đủ, quét mã ở D02 |
| 05 | Có: máy trạng thái tệp, SHA-256, `verifyEvidence`/`reverifyEvidence`, kiểm toán, URL đọc có hạn. Chưa: Evidence Timeline, trang xác minh/QR |
| 06 | Có: G01–G05 cục bộ, đánh dấu giữ. Chưa: đồng bộ, PDF/ZIP, link chia sẻ, Evidence Hold phía máy chủ |
| 07 | Có: hàng đợi bền, retry, trạng thái mạng, chỉ-Wi‑Fi. Chưa: tải nền, theo dõi dung lượng (UI-F03 là khung), retention |
| 08 | Chỉ có số đếm thật trên Trang chủ; chưa có dashboard |
| 09, 10 | Chưa có |

## 5. Rủi ro và việc tiếp theo

- **Rủi ro lớn nhất:** mở rộng phạm vi trước khi qua cổng thiết bị. Đề xuất xếp nhân viên/watermark/retention vào Giai đoạn 1 sẽ làm chậm V1-21.
- Cần dẫn nguồn và ngày cho phần so sánh đối thủ (1.2) trước khi đưa vào tài liệu chính thức.
- Mục AI: "nhận diện sản phẩm", "phân loại sai lệch hàng hoàn" chạm bất biến 5, 10, 11; phải có bước người dùng xác nhận, không tự kết luận.

**Khuyến nghị:**

1. Coi tài liệu này là **định hướng sau v1 (v2+)**, không thay thế tài liệu 01–09.
2. Giao `senior-ba` lập bảng đối chiếu 10 nhóm với `docs/01…09` và các Q-xx/O-xx, rồi ghi X-1…X-8 thành câu hỏi chờ duyệt trong `decisions.md`.
3. Giữ ưu tiên hiện tại: cổng thiết bị G, sau đó V1-21; chỉ mở Giai đoạn 2 khi hai việc này xong.

## 6. Câu hỏi cho người dùng

1. Có mở lại quyết định "web chỉ marketing" để làm Web Dashboard/Admin Portal không (X-1)?
2. Có đổi tên sang AmaBox không (X-8, O-11)?
3. Watermark: đóng vào khung hình, hay lớp phủ khi xem? Có dùng GPS không (X-3)?
4. Có bỏ tab Quét khỏi thanh điều hướng không (X-5)? Khuyến nghị: giữ.
