# Ảnh V1-19 web-legal-pages

Ảnh **trang web tĩnh** (`web/`, Astro), không phải ứng dụng di động. Chụp 2026-10-30 bằng Playwright 1.63 (Chromium headless) trên bản `npm run build` phục vụ cục bộ, hệ số điểm ảnh 1, rồi giảm còn 128 màu (Pillow) để nhẹ.

| Tệp | Trang | Cỡ |
|---|---|---|
| `01-chinh-sach-quyen-rieng-tu-{390x844,1280x800}.png` | `/chinh-sach-quyen-rieng-tu/` | toàn trang |
| `02-dieu-khoan-{390x844,1280x800}.png` | `/dieu-khoan/` | toàn trang |
| `03-ho-tro-{390x844,1280x800}.png` | `/ho-tro/` | toàn trang |
| `04-xoa-tai-khoan-{390x844,1280x800}.png` | `/xoa-tai-khoan/` | toàn trang |
| `05-trang-chu-chan-trang-{390x844,1280x800}.png` | `/`, cuộn tới chân trang | một màn |

Kiểm thêm khi chụp: cỡ 360x800 cả 5 trang không tràn ngang; 0 lỗi trang/console.

Giới hạn:

- Email hỗ trợ, tên và địa chỉ bên vận hành còn **giữ chỗ** (`web/src/config/site.ts`), nên trang hiện câu "sẽ được công bố tại đây trước khi phát hành".
- Nội dung là bản chờ luật sư rà (release-checklist C-2) và mô tả hành vi bản v1 sau các PR V1-12/14/15/16; chưa đối chiếu với app thật (C-6).
- Chưa kiểm trên trình duyệt điện thoại thật. Lighthouse 12 đã chạy cục bộ trên bốn trang (Chromium headless, không phải số đo thực tế p75): Accessibility, Best Practices, Performance 1.0; SEO 0.69 chỉ vì `noindex` có chủ đích.

## Ảnh

### Chính sách quyền riêng tư (`/chinh-sach-quyen-rieng-tu/`)

![Quyền riêng tư 390x844](01-chinh-sach-quyen-rieng-tu-390x844.png)
![Quyền riêng tư 1280x800](01-chinh-sach-quyen-rieng-tu-1280x800.png)

### Điều khoản sử dụng (`/dieu-khoan/`)

![Điều khoản 390x844](02-dieu-khoan-390x844.png)
![Điều khoản 1280x800](02-dieu-khoan-1280x800.png)

### Hỗ trợ (`/ho-tro/`)

![Hỗ trợ 390x844](03-ho-tro-390x844.png)
![Hỗ trợ 1280x800](03-ho-tro-1280x800.png)

### Yêu cầu xóa tài khoản (`/xoa-tai-khoan/`)

![Xóa tài khoản 390x844](04-xoa-tai-khoan-390x844.png)
![Xóa tài khoản 1280x800](04-xoa-tai-khoan-1280x800.png)

### Chân trang có liên kết pháp lý (trang chủ `/`)

![Chân trang 390x844](05-trang-chu-chan-trang-390x844.png)
![Chân trang 1280x800](05-trang-chu-chan-trang-1280x800.png)
