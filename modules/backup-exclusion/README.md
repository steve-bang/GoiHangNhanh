# backup-exclusion (module Expo cục bộ, chỉ iOS)

V1-12, Q-24d A. Đặt `URLResourceValues.isExcludedFromBackup = true` cho thư mục bằng chứng
(`Documents/evidence`: video, ảnh hàng hoàn) và thư mục CSDL `expo-sqlite` (`Documents/SQLite`), để
chúng không vào iCloud Backup / sao lưu máy tính. Android không cần mã native: `android.allowBackup: false`
(V1-01) đã loại toàn bộ dữ liệu app khỏi Auto Backup.

- Liên kết tự động: `expo-modules-autolinking` tìm thư mục `./modules` (mặc định), không có trong
  `package.json`. Kiểm: `npx expo-modules-autolinking resolve --platform apple`.
- JS chỉ gọi qua adapter `src/platform/backup-exclusion.ts` (tên native `DonChungBackupExclusion`).
  Không có module (Android, web, Expo Go, Jest) thì adapter không làm gì.
- Lỗi đặt cờ không chặn app; log không chứa đường dẫn.
- **Chưa biên dịch/chạy trên thiết bị** (cần build EAS hoặc Xcode 26+). Kiểm trên máy: release-checklist G-7.

**Gỡ nếu module làm hỏng build iOS:** xóa thư mục này (không cần sửa JS: adapter thành no-op), ghi rủi ro
"video và CSDL có thể vào iCloud Backup trên iOS" vào chính sách quyền riêng tư và release-checklist G-7.
Kế hoạch: `docs/engineering/plans/v1-12-backup-exclusion-ios.md`.
