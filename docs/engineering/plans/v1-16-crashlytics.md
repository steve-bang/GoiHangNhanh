# V1-16 crashlytics — kế hoạch chi tiết

> Đề xuất kỹ thuật (2026-10-30), nhánh `claude/v1-16-crashlytics` từ `main` `134296a`. Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (dòng "Crash reporting"), 3.3 (V1-16), R-8 A (mặc định bật). Quyết định tự chốt: [decisions.md `Q-29 / V1-16`](../decisions.md). **Không build native trong PR này**: mọi phần native chỉ kiểm bằng `expo config`/`prebuild --no-install` trên bản sao.

## Mục tiêu

Biết app lỗi ở đâu trên máy người dùng thật mà **không gửi PII**: không `setUserId`, không email/uid/shopId/mã đơn/mã vận đơn/đường dẫn tệp; người dùng tắt được ở UI-I05.

## Thiết kế

1. **Thư viện:** `@react-native-firebase/crashlytics` 27.1.0 (cùng họ `app`/`auth`/`firestore`/`functions` ^27.1.0). Plugin `@react-native-firebase/crashlytics` trong `app.json` (chỉ sửa Gradle Android: plugin `com.google.firebase.crashlytics` để tải mapping; iOS tự có pha tải dSYM trong podspec/SPM).
2. **`firebase.json` ở gốc repo** (RNFirebase đọc lúc build, khác `firebase/firebase.json` của CLI): `crashlytics_auto_collection_enabled: false` (lần mở đầu tiên chưa gửi gì tới khi app đọc công tắc), `crashlytics_debug_enabled: false` (bản debug không thu), `crashlytics_is_error_generation_on_js_crash_enabled: false` (không dùng đường JS crash của RNFirebase, vì nó gửi nguyên `error.message`). Mọi lệnh Firebase CLI của repo đều dùng `--config firebase/firebase.json` nên không bị ảnh hưởng.
3. **Lọc dữ liệu (core, TypeScript thuần) `src/core/logging/crash-safe.ts`:**
   - `crashSafeEvent(event)`: chỉ giữ tên sự kiện dạng `a_b.c_d` (chữ thường, `_`, `.`, ≤ 64 ký tự), khác thì `invalid_event`.
   - `crashSafeFields(fields)`: **danh sách cho phép** khóa (`reason`, `step`, `target`, `result`, `kind`, `status`, `stage`, `attempt`); giá trị chỉ giữ nếu là mã lỗi trong `ERROR_CODES`, tên lỗi JS (`TypeError`, `…Error`), từ chữ thường không số (`sqlite`, `unknown`, `on`), boolean, hoặc số nguyên nhỏ 0..999. Còn lại bỏ hẳn (không gửi `[REDACTED]`).
   - `sanitizeErrorForCrash(error)`: `name` an toàn (mặc định `Error`), `message` = mã `AppError` nếu có, không thì `name` (**không gửi câu tự do**); `stack` chỉ giữ dòng khung KẾT THÚC bằng vị trí (`:dòng:cột`, `native`, `<anonymous>`), tên hàm phải là định danh JS (không chuỗi 4+ chữ số), tệp chỉ giữ tên cuối có đuôi mã/bundle (`main.jsbundle:1:234`), không khớp thì `<unknown>`/`<file>`, tối đa 30 dòng (sửa sau review PR #62).
4. **Logger** (`logger.ts`): thêm `setLogSink(sink | null)`. Sau khi `redact`, mức `warn` và `error` đưa **bản đã lọc** (`crashSafeEvent` + `crashSafeFields`) cho sink; `debug`/`info` không. Lỗi của sink bị nuốt (log không bao giờ làm hỏng luồng chính).
5. **Adapter `src/platform/crash-reporter.ts`** (+ `crash-reporter.web.ts` no-op): `getCrashReporter()` nạp lười `@react-native-firebase/crashlytics` trong `try` (Expo Go/thiếu module native/thiếu tệp cấu hình -> no-op). API hẹp: `available`, `setEnabled(on)`, `breadcrumb(line)`, `recordError(error)`, `installGlobalHandler()`. **Không** có `setUserId`/`setAttribute(s)`. Khi tắt: `setCrashlyticsCollectionEnabled(false)` + `deleteUnsentReports()`; mọi `breadcrumb`/`recordError` bị bỏ ngay trong JS. `installGlobalHandler` thay handler của RNFirebase: lỗi JS không bắt được -> tạo lỗi đã lọc, ghi non-fatal khi bật (lỗi không fatal), rồi chuyển **lỗi đã lọc** cho handler mặc định của React Native (bản release: sập, Crashlytics bắt sập native với thông điệp đã lọc).
6. **Cài đặt** `privacy.crash_reports` (boolean, mặc định `true`, R-8 A) trong `device_settings` (khóa/giá trị, **không migration**), định nghĩa ở `features/personal/domain`, đăng ký trong danh sách khóa của `orders/domain/device-settings.ts`.
7. **Cầu nối** `src/bootstrap/CrashReportingBridge.tsx` (trong `DeviceSettingsProvider`): chỉ chạy khi bản build cho phép (`!__DEV__`, không test, backend `firebase`); đọc cài đặt -> `setEnabled` + gắn/gỡ sink logger; nghe thay đổi.
   - **Tắt:** áp dụng ngay (JS ngừng ghi, báo cáo chưa gửi bị xóa, thu thập native tắt và lưu bền).
   - **Bật lại:** lỗi JS ghi ngay; thu thập sập native **chắc chắn từ lần mở app sau** (iOS SDK ghi rõ giá trị áp dụng ở lần chạy sau). Ghi ở mô tả công tắc.
8. **UI-I05:** thêm một nhóm có công tắc "Gửi báo lỗi ứng dụng" (component `Switch` sẵn có, token), giữa nhóm bảo mật và nhóm Xóa tài khoản; không đổi màn khác. Ghi lỗi -> toast, giữ giá trị cũ (như `WifiOnlySwitch`).
9. **iOS privacy manifest** `ios.privacyManifests` trong `app.json`: 4 loại API cần lý do (E174.1, C617.1, CA92.1, 35F9.1), `NSPrivacyTracking: false`, kiểu dữ liệu thu thập khớp `docs/store/privacy-declarations.md` mục 3.1 (kèm 4 kiểu của Crashlytics, không gắn danh tính).
10. **ErrorBoundary (sửa sau review PR #62):** `RootErrorBoundary` gốc không vẽ UI (có lỗi thì `null`), lọc lỗi tại chỗ rồi chuyển fatal cho handler đã lọc; handler lọc cài ngay khi nạp `_layout`.

## Tệp đổi

`package.json`, `package-lock.json`, `app.json`, `firebase.json` (mới), `src/core/logging/{crash-safe.ts (mới), logger.ts}`, `src/platform/{crash-reporter.ts, crash-reporter.web.ts (mới), index.ts, README.md}`, `src/bootstrap/{CrashReportingBridge.tsx (mới), Providers.tsx}`, `src/features/personal/{domain/crash-reports.ts (mới), ui/SecurityScreen.tsx, index.ts}`, `src/features/orders/domain/device-settings.ts` (chú thích khóa), i18n `personal.json`, `jest.setup.ts` (mock adapter), tài liệu (`decisions.md`, `architecture.md`, `release-checklist.md`, `privacy-declarations.md`, `firebase-setup.md`, `web/` chính sách nếu cần câu), `CHANGELOG.md`.

**Migration/Rules/Functions:** không.

## Test

- `crash-safe.test.ts`: chuỗi mẫu PII (email, `DH-12345`, `SPX0123456789`, uid, shopId, `file:///…/evidence/…mp4`, URL ký, số điện thoại) không lọt qua sự kiện/trường/stack; mã lỗi và tên lỗi giữ.
- `logger.test.ts`: sink nhận đúng mức warn/error, không nhận info/debug, không nhận PII; sink ném không làm logger ném; gỡ sink thì không gọi.
- `crash-reporter.test.ts` (mock module RNFirebase): không bao giờ gọi `setUserId`/`setAttribute(s)`; tắt -> `setCrashlyticsCollectionEnabled(false)` + `deleteUnsentReports` và không ghi nữa; module thiếu -> no-op không ném; global handler gửi lỗi đã lọc cho handler mặc định.
- `CrashReportingBridge.test.tsx`: build không cho phép -> không gọi gì; cho phép -> mặc định bật; đổi công tắc -> `setEnabled(false)`, gỡ sink.
- `SecurityScreen.test.tsx`: công tắc mặc định bật, tắt lưu vào `device_settings`, ghi lỗi -> toast và giữ giá trị.

## Màn cần chụp

UI-I05 với công tắc bật và tắt (bản web, cổng giả).

## Rủi ro

- iOS `useFrameworks: "dynamic"` + Crashlytics qua SPM chưa từng build (release-checklist). Nếu build iOS hỏng không sửa được trong một ngày: tách PR khỏi v1 (kế hoạch tổng).
- Tải dSYM (iOS, SPM) / mapping (Android) chỉ kiểm được trên build thật; thiếu thì stack native không đọc được (không ảnh hưởng người dùng).
- Stack JS trong Crashlytics là vị trí trong bundle đã nén (Crashlytics không giải sourcemap JS): chẩn đoán dựa vào tên sự kiện + mã lỗi.
- Từ chối Hermes promise rejection không được gửi (RNFirebase chỉ theo dõi polyfill `promise`): chỉ lỗi đi qua `logger.error` và lỗi toàn cục.

## Tự review

Vòng 1: (1) Bản nháp chỉ dựa vào `redact` của logger: `redact` không che `uid`, `shopId`, đường dẫn và giữ chuỗi tự do -> đổi sang danh sách cho phép khóa + kiểu giá trị, bỏ hẳn giá trị lạ. (2) Bản nháp để handler mặc định của RNFirebase: nó gửi nguyên `error.message` (có thể chứa mã đơn) và cả thông điệp sập native -> tự cài handler, đưa lỗi đã lọc cho cả Crashlytics lẫn handler RN. (3) `crashlytics_auto_collection_enabled: true` sẽ gửi sập ở lần mở đầu trước khi đọc công tắc; đặt `false`, bật bằng mã sau khi đọc (lần sau SDK nhớ giá trị đã đặt). (4) Tắt công tắc phải xóa báo cáo chưa gửi, không chỉ ngừng ghi. (5) Bất biến 3/4/11: không đụng trạng thái tệp/bằng chứng; câu chữ không hứa "ẩn danh tuyệt đối", chỉ nói không gửi email/mã đơn/video. (6) Kích thước ước tính ~450 dòng mã ngoài test/tài liệu.

Tự review: đã chấp nhận.

Sau review PR #62 (điều phối chọn A cho mục 1): (1) lỗi render RN 0.88 đi thẳng `ExceptionsManager.handleException`, không qua handler toàn cục -> thêm `RootErrorBoundary` (không vẽ UI, lọc lỗi tại chỗ, chuyển fatal cho handler đã lọc) và cài handler lọc ngay khi nạp `_layout` (`crash-reporting-early.ts`); (2) `sanitizeStack` chỉ nhận dòng kết thúc bằng vị trí, tên hàm/tệp vẫn qua bộ lọc (dòng 2+ của thông điệp nhiều dòng từng lọt qua); (3) ghi rõ handler Promise của RNFirebase gửi `message` gốc nhưng bất hoạt trên Hermes, kiểm ở G-9; (4) `DEPLOYMENT.md` 4.4 dùng `--config firebase/firebase.json`.
