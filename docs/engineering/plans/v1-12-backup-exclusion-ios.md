# V1-12 backup-exclusion-ios — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (Q-24d = A), 3.0, 3.3 V1-12, 7.5; [release-checklist.md](../release-checklist.md) G-7. Android đã tắt Auto Backup ở V1-01 (`android.allowBackup: false`).

## Mục tiêu

Trên iOS, video/ảnh bằng chứng (`Documents/evidence/`) và CSDL cục bộ (`Documents/SQLite/`, gồm `doncung.db`, `-wal`, `-shm`) không vào iCloud Backup / sao lưu máy tính. Không đổi giao diện. Không đổi hành vi nghiệp vụ.

## Tệp đổi

| Tệp | Thay đổi |
|---|---|
| `modules/backup-exclusion/expo-module.config.json` (mới) | Module Expo cục bộ, **chỉ `apple`**; autolinking tự tìm trong `./modules` (mặc định của `expo-modules-autolinking`), không đổi `package.json` |
| `modules/backup-exclusion/ios/BackupExclusionModule.swift` (mới) | `AsyncFunction("excludeFromBackup")(path) -> String`: đặt `URLResourceValues.isExcludedFromBackup = true`, đọc lại để xác nhận; trả `excluded` / `not_found` / `failed`, không ném lỗi |
| `modules/backup-exclusion/ios/BackupExclusion.podspec` (mới) | Theo khuôn podspec của các module Expo trong SDK 58 (`static_framework`, `DEFINES_MODULE`), dùng được với `useFrameworks: "dynamic"` |
| `modules/backup-exclusion/README.md` (mới) | Mục đích, cách kiểm, phương án gỡ |
| `src/platform/backup-exclusion.ts` (mới) | Adapter `excludeFromBackup(target, uri)`: gọi module native nếu có (`requireOptionalNativeModule` từ `expo`); không có module (Android, web, Expo Go, Jest) thì no-op; lỗi chỉ log `backup_exclusion.*` với `target` + kết quả, **không** đường dẫn; không bao giờ ném |
| `src/platform/recording-files.ts` | `excludeEvidenceDirFromBackup()` (tạo `evidence/` nếu thiếu rồi đặt cờ); `persistRecording`/`probeEvidenceDirWritable` gọi lại khi chính chúng vừa tạo thư mục |
| `src/platform/local-db.ts` | Sau khi mở CSDL lần đầu (thư mục đã tồn tại): đặt cờ cho `defaultDatabaseDirectory` của `expo-sqlite`, không chờ, không chặn |
| `src/platform/index.ts` | Xuất `excludeEvidenceDirFromBackup` |
| `src/bootstrap/Providers.tsx` | Gọi `excludeEvidenceDirFromBackup()` một lần khi mở app (`useEffect`) |
| `src/platform/backup-exclusion.test.ts`, `recording-files.test.ts` | Test adapter + điểm gọi |
| `docs/06` "Hệ quả với Firebase", `architecture.md`, `platform-support.md`, `testing.md`, `release-checklist.md` G-7, `decisions.md` Q-29 / V1-12, `CHANGELOG.md` | Tài liệu |

## Thiết kế

- **Đặt cờ lên thư mục, không lên từng tệp.** Apple: thuộc tính áp cho thư mục loại cả nội dung bên trong, kể cả tệp tạo sau. Nên chỉ cần gọi khi thư mục được tạo (khởi động + khi `persistRecording`/`probe` tự tạo lại thư mục). Gọi lặp lại vô hại (idempotent).
- **CSDL:** `expo-sqlite` mở ở `defaultDatabaseDirectory` (`Documents/SQLite`). Thư mục chỉ chắc có sau `openDatabaseAsync`, nên đặt cờ ngay sau lần mở đầu tiên trong `openOnce` (một lần mỗi tiến trình). Tệp `-wal`/`-shm` cùng thư mục nên cũng bị loại.
- **Thứ tự an toàn:** cờ là gợi ý cho hệ thống sao lưu, không ảnh hưởng ghi/đọc. Lỗi đặt cờ không chặn quay, không chặn mở CSDL: chỉ log cảnh báo (không PII, không đường dẫn), lần mở app sau thử lại.
- **Android/web: không có mã native.** `expo-module.config.json` chỉ khai `apple`; adapter thấy không có module thì trả `unsupported` và không làm gì. Lý do (lệch nhỏ so với kế hoạch v1 "android/ no-op trả true"): Android đã loại toàn bộ dữ liệu app khỏi Auto Backup bằng `allowBackup: false` (V1-01); thêm Kotlin chỉ để trả `true` là thêm một module Gradle có thể hỏng build mà không bảo vệ thêm gì. D-12 vẫn giữ: cùng kết quả nghiệp vụ trên hai hệ điều hành, khác biệt nằm sau adapter `src/platform/`.
- **Expo Go:** không có module cục bộ, adapter no-op (log debug một lần). Chỉ dev build/EAS build mới có cờ.
- **Không đụng `Platform.OS`** ngoài adapter (thực ra adapter cũng không cần: dựa vào sự có mặt của module).

## Migration / Rules / Functions

Không.

## Test

- Jest `backup-exclusion.test.ts`: không có module -> `unsupported`, không ném; module trả `excluded` -> `excluded`; trả `not_found`/`failed`/giá trị lạ/ném lỗi/promise reject -> không ném, log `warn` không chứa đường dẫn.
- Jest `recording-files.test.ts`: `excludeEvidenceDirFromBackup` tạo thư mục nếu thiếu và gọi adapter với thư mục `evidence`; `persistRecording` gọi lại khi tự tạo thư mục, không gọi khi thư mục đã có.
- `npx expo-modules-autolinking resolve --platform apple` (repo): thấy module `backup-exclusion`; `--platform android`: không có.
- `npx expo prebuild --no-install --platform ios` trên bản sao ngoài repo: `Podfile` dùng `use_expo_modules!` + `use_frameworks! :linkage => :dynamic`; `pod install` không chạy được ở đây (Linux) nên kiểm `expo-modules-autolinking` sinh `ExpoModulesProvider` bằng lệnh `generate-modules-provider` có chứa `BackupExclusionModule`.
- `npx expo export --platform ios|android`.
- **Không kiểm được ở đây:** biên dịch Swift, `pod install`, chạy trên iPhone, kích thước sao lưu iCloud (checklist G-7).

## Màn cần chụp

Không có thay đổi giao diện.

## Rủi ro

- **Mã native đầu tiên của repo:** chỉ biết biên dịch được khi build EAS/Xcode. **Phương án gỡ nếu build hỏng:** xóa thư mục `modules/backup-exclusion/` (adapter tự thành no-op, không cần sửa JS), ghi rủi ro "video và CSDL có thể vào iCloud Backup trên iOS" vào chính sách quyền riêng tư và `release-checklist.md` G-7. Ghi trong `release-checklist.md`.
- Apple coi cờ là gợi ý; xác nhận bằng dung lượng sao lưu của app (G-7).
- Đổi máy/cài lại/khôi phục từ iCloud: video, ảnh và CSDL chưa tải lên **không** được chuyển sang máy mới (chấp nhận theo Q-24d; ghi `docs/06`). Bằng chứng đã tải lên vẫn ở máy chủ.
- Dữ liệu đã có trong bản sao lưu trước khi cài bản này: chỉ bị loại ở lần sao lưu sau.

## Tự review

Vòng 1 (bất biến 1–11, dữ liệu, kích thước):
- Bất biến 4 (không xóa bản cục bộ): không xóa/di chuyển gì; chỉ đặt thuộc tính. Đạt.
- Bất biến 3/11 (trung thực): không đổi nhãn; tài liệu nói rõ đổi máy mất tệp chưa tải, không hứa sao lưu. Đạt.
- Quyền riêng tư: log không có đường dẫn (đường dẫn container chứa UUID máy, ID bằng chứng). Đạt.
- Rủi ro: gọi native khi thư mục chưa tồn tại -> `not_found`; đã sửa thiết kế: evidence tạo thư mục trước, CSDL gọi sau khi mở.
- Rủi ro: `excludeFromBackup` ném đồng bộ (module lỗi khi nạp) -> bọc `try` cả lời gọi đồng bộ lẫn promise. Đã thêm vào thiết kế.
- Kích thước: ~150 dòng mã (Swift ~40, TS ~80). Trong ngân sách.

Vòng 2: lệch "android/ no-op" ghi ở Q-29 / V1-12 và kế hoạch này; đủ phương án gỡ. Không còn điểm mở.

**Tự review: đã chấp nhận.** Điểm đã sửa: tạo thư mục evidence trước khi đặt cờ; đặt cờ CSDL sau khi mở; bỏ mã Android; bọc lỗi đồng bộ.
