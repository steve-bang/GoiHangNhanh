# V1-19 web-legal-pages — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.1, 1.2, 3.3 V1-19, 7.5 (R-1, R-4, R-8, purge gồm `auditEvents`).

## Mục tiêu

Có URL công khai cho App Store/Google Play: Chính sách quyền riêng tư, Điều khoản sử dụng, Hỗ trợ, Yêu cầu xóa tài khoản (Google Play yêu cầu kênh web không cần mở lại app). Nội dung mô tả hành vi **của bản v1** (sau khi V1-12, V1-14, V1-15, V1-16 hợp nhất), trung thực theo bất biến 11.

## Tệp đổi

- `web/src/config/site.ts`: thêm `legal` (giữ chỗ email hỗ trợ, tên pháp nhân, địa chỉ, ngày hiệu lực, số ngày xử lý yêu cầu qua email) và `legalPages` (đường dẫn) + hàm `publicLinks()` (URL tuyệt đối để V1-18 đối chiếu với `src/core/config/public-links.ts`). `site.url` đổi `https://doncung.example` -> `https://don-chung.invalid` để app nhận diện được là giữ chỗ (`isPlaceholderLink` chỉ coi `.invalid` là giữ chỗ).
- `web/src/pages/{chinh-sach-quyen-rieng-tu,dieu-khoan,ho-tro,xoa-tai-khoan}.astro` (mới).
- `web/src/components/LegalPage.astro` (khung chung: h1, ngày hiệu lực, mục lục), `ContactLine.astro` (in email/tên pháp nhân hoặc câu "sẽ công bố" khi giữ chỗ).
- `web/src/layouts/BaseLayout.astro`: chân trang có `nav aria-label="Thông tin pháp lý"` liên kết 4 trang; bỏ câu "chưa có chính sách".
- `web/src/pages/index.astro`: sửa câu "Tải lên chạy nền" (vi phạm bất biến 11) thành "tải lên khi app đang mở".
- `web/scripts/check-seo.mjs`: thêm kiểm (1) khi `site.indexable = true` mà còn giữ chỗ `legal.*` thì lỗi (chặn phát hành nhầm), (2) danh sách từ cấm (bất biến 11) trong văn bản hiển thị, (3) 4 trang pháp lý có mặt trong sitemap.
- `web/README.md`, `docs/engineering/release-checklist.md` (C-2 mở rộng, C-6, C-7, D-4), `docs/engineering/decisions.md` (Q-29 mục con), `CHANGELOG.md`, `docs/engineering/web-keywords.md` (nếu có bảng trang).
- Ảnh: `docs/assets/screens/v1-19-web-legal-pages/` (4 trang × 390x844 + 1280x800, toàn trang) + README.

## Thiết kế nội dung

- **Không chữ "nháp" cho người đọc.** Hiện "Ngày hiệu lực" từ `site.legal.effectiveDate`. Ghi chú nội bộ "bản nháp chờ rà pháp lý (checklist C-2)" chỉ ở chú thích mã `---` của mỗi trang.
- **Giữ chỗ hiển thị trung thực:** email `null` -> "Địa chỉ email hỗ trợ sẽ được công bố tại đây trước khi ứng dụng phát hành." Không email giả, không `mailto` hỏng.
- **Quyền riêng tư:** dữ liệu lên máy chủ (email, họ tên nếu nhập, tên cửa hàng + nguồn bán, đơn/dòng sản phẩm/ghi chú do người dùng nhập, phiên, siêu dữ liệu tệp + mã băm, video/ảnh khi tải lên, bản neo định danh hàng hoàn, nhật ký kiểm toán, thời gian thiết bị và máy chủ lưu riêng); chỉ trên máy (nội dung hồ sơ hàng hoàn/tranh chấp, lịch sử tìm, **vị trí lúc chụp ảnh hàng hoàn**, tệp chưa tải); không ghi âm; báo lỗi ứng dụng mặc định bật, tắt được, không gắn tài khoản, đã che mã đơn/email (R-8); không quảng cáo, không bán dữ liệu, không analytics hành vi; nhà cung cấp Google Firebase, khu vực Singapore `asia-southeast1`; không vào iCloud/Android Backup (Q-24d) và hệ quả đổi máy; một máy một tài khoản (Q-24a); chưa tự xóa theo hạn lưu; xóa tài khoản (30 ngày, R-4; giữ `accountDeletions` R-1); quyền của người dùng (chung, không trích điều luật khi chưa rà); trẻ em; thay đổi chính sách; liên hệ.
- **Điều khoản:** dịch vụ miễn phí, không mua trong app; không phải dịch vụ pháp lý, không hứa kết quả khiếu nại; mã băm chỉ chứng minh tệp không đổi kể từ lúc tính; tải lên chỉ khi app mở; video đang quay có thể mất nếu app bị tắt; dữ liệu chỉ trên máy có thể mất khi gỡ app/đổi máy; trách nhiệm nội dung người dùng ghi (người xuất hiện trong video); sử dụng không được phép; chấm dứt; giới hạn trách nhiệm (câu ngắn, chờ luật sư); luật áp dụng: để luật sư điền (không viết khi chưa rà).
- **Hỗ trợ:** liên hệ (email giữ chỗ), FAQ ngắn hiển thị nguyên văn + `FAQPage` JSON-LD khớp.
- **Xóa tài khoản:** tên app + bên vận hành; Cách 1 trong app (Cá nhân > Quyền riêng tư và bảo mật > Xóa tài khoản: điều kiện chặn đang quay/tranh chấp mở, cảnh báo tệp chưa tải); Cách 2 qua email (gửi từ email đăng ký, nội dung tối thiểu, xác minh, xử lý trong `legal.emailRequestDays` ngày làm việc — giá trị đề xuất, chờ duyệt); bảng xóa ngay / xóa sau 30 ngày / giữ lại và lý do / trên máy; không khôi phục được.
- **JSON-LD:** `BreadcrumbList` mỗi trang; `FAQPage` chỉ ở Hỗ trợ. Không `Organization` có địa chỉ khi chưa có thật.

## Test / kiểm tra

`npm --prefix web ci`, `npm --prefix web run check` (astro check + build + check:seo mới), `npm run format:check` ở gốc (prettier gốc bỏ qua `web/`, `docs/`: chạy để chắc không ảnh hưởng). Không đụng mã app nên không chạy `expo export`; vẫn chạy `npm run check` gốc nếu `node_modules` có sẵn. Playwright chụp 4 trang × 2 cỡ, kiểm không tràn ngang ở 360px.

## Rủi ro

- Nội dung mô tả hành vi các PR chưa hợp nhất (V1-12/14/15/16): trang chỉ được mở công khai (`indexable = true`) khi các PR đó đã vào; thêm mục checklist C-6 "đối chiếu trang web với app thật".
- Thời hạn lưu dữ liệu báo lỗi do Google quyết định: không ghi số khi chưa đối chiếu tài liệu chính thức (checklist C-6).
- Câu pháp lý cần luật sư (C-2).

Tự review: đã chấp nhận. Điểm đã sửa sau vòng tự review: (1) bỏ ý ghi email giả `ho-tro@...invalid` lên trang (người đọc thấy địa chỉ không dùng được) -> câu "sẽ công bố" + kiểm build chặn khi mở index; (2) không ghi "90 ngày" cho Crashlytics vì chưa có nguồn chính thức hiện hành; (3) không trích điều luật Việt Nam cụ thể khi chưa rà pháp lý; (4) phát hiện câu "Tải lên chạy nền" ở landing trái bất biến 11, sửa luôn trong PR (một dòng); (5) đổi `site.url` sang `.invalid` để app V1-18 dùng chung giá trị mà vẫn khóa liên kết giữ chỗ.
