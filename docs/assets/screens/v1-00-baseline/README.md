# Ảnh mốc "trước" v1 (V1-00, 2026-10-30)

**Lưu ý trung thực:** ảnh render **bản web (react-native-web) trong Chromium với cổng giả**, **không phải ảnh iOS/Android thật**. Font, bóng, vùng an toàn, thanh trạng thái/điều hướng hệ thống, bàn phím, chữ lớn trên thiết bị khác. Web không có camera, SQLite thật (kho bộ nhớ, nên danh sách rỗng), Firebase, trạng thái mạng thật. Chưa kiểm chứng trên thiết bị.

Mục đích: mốc hiện trạng tại `main` 9fd1236 để các PR v1 sau (V1-08 Trung tâm đồng bộ, V1-10 Trang chủ/Thông báo, V1-03 Chào mừng…) so "trước/sau". Ảnh cho thấy đúng các hạn chế đã ghi ở kế hoạch v1 mục 2.3: Trang chủ còn "Shop minh họa", số 12/11/1 và dải "Dữ liệu minh họa…"; Trung tâm đồng bộ hiện thẻ minh họa "DEMO-0002 · Kiện 1"; thẻ Dữ liệu bằng chứng ở Cá nhân "Chưa có số liệu"; Thông báo là khung "Tính năng sắp có"; Chào mừng còn nút Apple/Google và câu "Lưu trữ an toàn" (Q-24e).

## Cách chụp

```bash
node scripts/screens/capture.cjs --work <thư mục ngoài repo> \
  --out docs/assets/screens/v1-00-baseline --routes-file scripts/screens/routes/v1-00-baseline.json
```

Một cỡ 390x844, `deviceScaleFactor` 2 (ảnh 780x1688), chờ 3,5 giây sau `networkidle`. Phiên giả `signed_in` (ảnh 01–07) và `signed_out` (ảnh 08). **Không có thay đổi tạm** trong bản sao; 0 lỗi trang.

| Ảnh | Route | Màn |
|---|---|---|
| `01-home-390x844.png` | `/` (chuyển tới `/home`) | Trang chủ |
| `02-orders-390x844.png` | `/orders` | Đơn hàng (UI-E01, rỗng) |
| `03-account-390x844.png` | `/account` | Cá nhân |
| `04-sync-390x844.png` | `/sync` | Trung tâm đồng bộ (UI-F01, minh họa) |
| `05-returns-390x844.png` | `/returns` | Hàng hoàn (UI-D01, rỗng) |
| `06-disputes-390x844.png` | `/disputes` | Tranh chấp (UI-G01, rỗng) |
| `07-notifications-390x844.png` | `/notifications` | Thông báo (khung) |
| `08-welcome-signed-out-390x844.png` | `/welcome` | Chào mừng (chưa đăng nhập) |

Không chụp: 320x568/360x800, chữ lớn, trạng thái có dữ liệu (cần thay đổi tạm), màn quay (web không có camera).
