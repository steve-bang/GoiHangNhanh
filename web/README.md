# Web marketing Đơn Chứng

Website tĩnh (Astro + TypeScript) cho marketing, SEO và chuyển đổi. **Độc lập hoàn toàn với app di động**: có `package.json` và `package-lock.json` riêng, không dùng chung phụ thuộc với thư mục gốc. Web **không** mang nghiệp vụ quản lý đơn và **không** thu thập dữ liệu bằng chứng/đơn hàng (D-02).

Kế hoạch trang và từ khóa: `../docs/engineering/web-keywords.md`.

## Lệnh

Cần Node >= 22.12 (đã thử với Node 22.22, npm 10.9). Chạy trong thư mục `web/`.

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài phụ thuộc theo `package-lock.json` |
| `npm run dev` | Chạy thử cục bộ (http://localhost:4321) |
| `npm run build` | Build tĩnh ra `dist/` |
| `npm run preview` | Xem bản build |
| `npm run typecheck` | `astro check` (TypeScript + Astro) |
| `npm run check:seo` | Kiểm tra `dist/`: độ dài title/description, trùng lặp, canonical, `lang`, một `h1`, OG/Twitter, JSON-LD hợp lệ (và FAQ khớp nội dung hiển thị), link/anchor hỏng, ảnh có `alt` + `width/height`, `sitemap`, `robots.txt` |
| `npm run check` | typecheck + build + check:seo (chạy trước khi báo xong) |
| `node scripts/make-og.mjs` | Tạo lại `public/og-default.png` (giữ chỗ) khi đổi tên thương hiệu |

Astro gửi số liệu ẩn danh khi chạy lệnh. Tắt bằng `npx astro telemetry disable` hoặc biến môi trường `ASTRO_TELEMETRY_DISABLED=1`.

## Cấu trúc

```
web/
  astro.config.mjs        Cấu hình Astro; đọc URL từ src/config/site.ts
  public/                 Tệp tĩnh: favicon, ảnh OG 1200x630, logo
  scripts/                check-seo.mjs, make-og.mjs
  src/
    config/site.ts        MỘT nơi duy nhất: tên thương hiệu, URL, liên kết cửa hàng, cờ indexable
    styles/tokens.css     Token màu/khoảng cách/bo góc chép từ docs/design-token-spec.md
    styles/global.css     Nền tảng CSS (mobile-first từ 360px)
    layouts/BaseLayout    Head SEO (title, description, canonical, robots, OG, Twitter, JSON-LD), header/nav/main/footer
    lib/jsonld.ts         Hàm tạo JSON-LD: Organization, WebSite, BreadcrumbList, FAQPage, Article, MobileApplication
    components/           StoreButtons (nút tải app)
    pages/                index.astro (landing), 404.astro, robots.txt.ts
```

## Quy tắc khi thêm trang

1. Mỗi trang dùng `BaseLayout` với `title` (50-60 ký tự), `description` (120-160 ký tự), `path` duy nhất. `npm run check:seo` báo lỗi nếu sai.
2. Thêm JSON-LD qua `lib/jsonld.ts`, chỉ khi khớp nội dung hiển thị. Không đánh dấu giá hay đánh giá nếu không có thật. Không gọi `softwareApplicationLd()` khi ứng dụng chưa phát hành.
3. Tên thương hiệu viết qua `site.name`, không viết cứng.
4. Nội dung theo `CLAUDE.md` mục 11: không hứa thắng khiếu nại, không "bằng chứng pháp lý tuyệt đối", tính năng chưa có ghi "Sắp có". Không viết thời hạn/chính sách sàn TMĐT nếu chưa có nguồn chính thức kèm ngày kiểm tra.
5. Chỉ dùng màu có trong `tokens.css`.

## Giữ chỗ (chưa chốt, phải thay trước khi lên production)

- `site.url` = `https://doncung.example` (tên miền chưa chốt).
- `site.indexable = false`: mọi trang `noindex`, `robots.txt` chặn toàn site. Đặt `true` khi đã chốt tên miền, nội dung và hosting.
- `site.stores.*.url = null`: nút "App Store/Google Play: sắp có" không có liên kết.
- `public/og-default.png` và ảnh app dùng chung icon của app; chờ designer.
- Chưa có analytics, form, hosting, CMS (cần người dùng chốt).
