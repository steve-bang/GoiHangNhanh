# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Repo có tài liệu nghiệp vụ (`docs/`), **khung kỹ thuật** (Expo SDK 58 + React Native + TypeScript, Firebase, Security Rules có test, CI) và app đã dựng các luồng v1. Chi tiết từng quyết định và từng PR nằm ở `docs/engineering/decisions.md` (Q-xx, ADR; các PR v1 ở mục `#### Q-29 / V1-xx`), `CHANGELOG.md` `[Unreleased]` và `docs/engineering/plans/`; mục này chỉ tóm tắt hiện trạng đã đối chiếu với mã ở HEAD mã `12aa19d` (#65, 2026-10-31; các commit sau đó chỉ sửa tài liệu). Đã hợp nhất V1-00…V1-20 cùng V1-07b, V1-17b (#40–#65); còn **V1-21** (bản 1.0.0, bật ghi video ở production) chờ cổng thiết bị do con người làm (`release-checklist.md`). Thiết kế kỹ thuật là **đề xuất, chờ người dùng duyệt** (không phải D-xx); quyết định Q-29 do điều phối chốt thay người dùng.

**Chưa có gì trong app từng chạy trên thiết bị thật hay build native iOS/Android.** Mọi thứ dưới đây chỉ được kiểm chứng bằng unit test (Jest, `node:sqlite`), Firebase Emulator (Rules, logic Functions) và `expo export`. Rules/Functions chưa deploy lên dự án nào.

### Đã có và chạy trong test

- **Điều hướng và giao diện:** Expo Router, thanh tab 5 mục (Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân; D-16; `tab-config.ts`), design system theo token (`useTheme().tokens`), i18n tiếng Việt, logger che PII. Mọi màn, kể cả Splash, Chào mừng, đăng ký/đăng nhập/quên mật khẩu, tạo shop, dùng token và Bright Orange (D-20 thay D-17; ảnh minh họa Splash đã đổi sang cam; icon app và ảnh splash native của hệ điều hành vẫn tông jade). Đã bỏ hết dữ liệu minh họa (V1-10): Trang chủ và thẻ Dữ liệu bằng chứng đếm thật trên máy, tab Thông báo là trạng thái rỗng trung thực (app chưa gửi thông báo).
- **Cổng phiên (V1-06):** ở bản Firebase/"chưa kết nối", `withSessionGate` chặn màn nghiệp vụ (kể cả liên kết sâu) khi chưa đăng nhập/chưa có shop; `useWritableShopId()` không cho tạo đơn, phiên, hồ sơ hoàn khi chưa biết shop thật (không còn ghi mới dưới `LOCAL_SHOP_ID`); màn đang quay giữ shop lúc mở. Cổng giả giữ hành vi cũ.
- **Đơn hàng:** quét mã `expo-camera` (ADR-016); tra cứu trước khi tạo (không tự tạo/gộp/chọn hộ); Tạo đơn nhanh -> Xác nhận, idempotent, kiểm trùng; danh sách, chi tiết, Bằng chứng của đơn, lịch sử tìm (Q-22); sửa đơn **chỉ khi chưa có phiên** (`ORDER_HAS_SESSION`).
- **Kho cục bộ `expo-sqlite`** (ADR-017): **migration v1–v16** (`sqlite-migrations.ts`; v8 hàng hoàn, v9 tranh chấp, v10–v14 media hàng hoàn, v15 `device_settings` (V1-09), v16 dấu đã băm + cờ gián đoạn video hàng hoàn + index (V1-13)) + `repairLegacySchema` cho v3 cũ. Một kết nối dùng chung, hàng đợi tuần tự (`db-queue.ts`).
- **Máy trạng thái tệp** (`features/evidence/domain/file-state.ts`): chỉ sự kiện `origin: 'server'` tới `uploaded`/`verified`/`hash_mismatch`. SHA-256 thuần JS (`core/crypto/sha256.ts`), băm nhường luồng định kỳ và không băm lại tệp không đổi kích thước/thời điểm sửa (V1-13, `platform/file-hasher.ts`).
- **Ghi video (sau cờ, tắt mặc định) và hàng đợi tải lên:** `recording-controller.ts` (tạo bản ghi tệp + phiên TRƯỚC khi quay, chuyển tệp khỏi thư mục tạm, băm, khôi phục sau kill); màn quay giữ sáng (`platform/keep-awake.ts`), vào nền thì dừng có chủ đích, lưu phần đã quay, phiên `interrupted` (V1-11). `features/upload`: hàng đợi bền, đối soát trạng thái máy chủ, URL ký; **trạng thái mạng thật** (NetInfo 12.0.1 sau `platform/connectivity.ts`, V1-02): lỗi mạng không tốn lượt, chỉ lỗi máy chủ tính tối đa 8 lượt, lệnh máy chủ hạn 30 giây; công tắc **Chỉ tải khi có Wi‑Fi** (V1-09, mặc định tắt); chỉ tải tệp do chính uid đang đăng nhập tạo (V1-07).
- **Trung tâm đồng bộ UI-F01/F02 thật** (V1-08): tệp thật theo bốn mục, Thử lại có điều kiện (R-3), Kiểm tra lại tệp kẹt "Đã tải lên", Chi tiết lỗi.
- **Xem lại trên máy, chỉ đọc** (`expo-video` sau `platform/video-player.tsx`): UI-E04 từ Bằng chứng của đơn (V1-17); ảnh/video hàng hoàn và tệp của tranh chấp qua `/returns/[returnId]/media/[mediaId]`, `/disputes/[disputeId]/evidence/[evidenceId]` (V1-17b, kiểm tệp thuộc đúng hồ sơ và shop, mang nhãn "Hạn chế bằng chứng", không hiện vị trí). Chưa xem được từ máy chủ.
- **Đồng bộ đơn/phiên lên Firestore** (ADR-019, Q-23): một chiều thiết bị -> máy chủ, đăng khi đơn đã có phiên, idempotent, chỉ bản ghi do chính uid tạo; nguồn bán "Khác" ánh xạ `other` ↔ `other_unknown` ở ranh giới (#52).
- **Firebase** (`firebase/`): `firestore.rules` (cô lập theo shop qua `members`; `userShops`, `shops` + `orders`/`lines`/`packages`, `sessions`, `returns` (bản neo), `evidence`, `auditEvents`, `accountDeletions`; kiểm kiểu/độ dài và trần dung lượng ảnh 25 MB, video 2 GB), `storage.rules` từ chối mọi truy cập client (ADR-006). Functions: `createShop`, `updateShop`, `createUploadSession`, `verifyEvidence`, `reverifyEvidence`, 6 trigger kiểm toán `audit*Write` (đơn, dòng, kiện, phiên, bằng chứng, hàng hoàn; V1-04), `deleteAccount` + lịch `purgeDeletedShops` (xóa hẳn sau 30 ngày, trừ `legalHold`; V1-14). **Người khai báo bằng chứng (V1-07b):** đóng gói chỉ người tạo phiên khai báo được; hàng hoàn chỉ người tạo media, bản neo chỉ cần tồn tại; Rules và `createUploadSession` cùng ép (deploy cùng đợt, G-10c). Dự án dev `ghn-test-67b39`.
- **Hàng hoàn** (`features/returns`, Q-26, Q-28): hồ sơ cục bộ, D01–D07 (tìm đơn gốc không tự ghép; kiện mở trước khi quay; tối đa 5 ảnh, vị trí không gửi lên, xóa ảnh nhầm theo Q-26j; video mở kiện sau cờ, tối đa một, không quay bù; kiểm hàng; xác nhận). Ảnh/video đi CÙNG hàng đợi tải lên khi hồ sơ đã đăng bản neo `shops/{shopId}/returns/{id}`; nội dung hồ sơ chỉ trên máy (Q-26c). D04 chưa kiểm pin/nhiệt độ như UI-C02; D02 chưa quét mã.
- **Tranh chấp** (`features/disputes`, Q-27): G01–G05 cục bộ (tạo, chọn bằng chứng có đánh dấu giữ, xem trước và chia sẻ văn bản tóm tắt, ghi chú, đóng không xóa dữ liệu). **Chỉ trên máy này, chưa đồng bộ, chưa có gói tệp xuất.**
- **Tab Cá nhân:** cổng Firebase nối thật hồ sơ, đổi họ tên, đổi mật khẩu (xác thực lại), danh sách/đổi tên/chuyển cửa hàng, đăng xuất an toàn (V1-05); quên mật khẩu bằng thư đặt lại Firebase + màn "Kiểm tra hộp thư" (V1-03); ẩn Apple/Google, Gói dịch vụ, Thành viên, Cài đặt thông báo (`account-menu.ts`). **Xóa tài khoản thật** (V1-15, UI-I05 > Xóa tài khoản): nhập mật khẩu, chặn khi đang quay/còn tranh chấp mở/máy có dữ liệu tài khoản khác, cảnh báo + tích riêng cho tệp chưa tải; chỉ sau khi máy chủ xác nhận mới xóa tệp `evidence/` và 15 bảng nghiệp vụ, dấu `.pending-local-wipe` để xóa tiếp nếu app bị tắt (`LocalWipeProvider`). Công tắc **Gửi báo lỗi ứng dụng** ở UI-I05.
- **Báo lỗi Crashlytics (V1-16):** adapter duy nhất `src/platform/crash-reporter.ts`, lọc bằng danh sách cho phép `core/logging/crash-safe.ts` (không gửi `error.message`, uid, shopId, mã đơn, đường dẫn; không `setUserId`); handler lọc cài ngay khi nạp module (`src/bootstrap/crash-reporting-early`, import đầu `src/app/_layout.tsx`); `RootErrorBoundary` không vẽ UI (lỗi -> `null`, chuyển handler như fatal). Công tắc lưu `device_settings` `privacy.crash_reports`, mặc định bật. `firebase.json` ở gốc repo là cấu hình RNFirebase (tắt thu tự động, bật qua adapter), không phải của CLI.
- **Phát hành và nội dung:** env theo profile `eas.json` (`development`, `staging` bật ghi video, `production`), production chặn cờ giả/emulator lúc build và lúc chạy, Android `allowBackup: false` (V1-01); iOS loại `evidence/` và CSDL khỏi iCloud Backup bằng module Expo cục bộ `modules/backup-exclusion` (V1-12); liên kết công khai và email hỗ trợ gom ở `src/core/config/public-links.ts`, test `scripts/public-links.test.cjs` so khớp `web/src/config/site.ts`, giá trị vẫn **giữ chỗ** (D-4) (V1-18); trang web pháp lý (V1-19); tài liệu store `docs/store/` (V1-20).
- **Kiểm tra gần nhất (2026-10-31, HEAD `12aa19d`):** `npm run check` pass: lint 0 lỗi, 6 cảnh báo có sẵn (4 `import/no-duplicates`, 2 `no-extend-native`), `tsc`, prettier, `check:tokens`; Jest (project `unit` + `tooling`) 222 suite pass + 1 bỏ qua, 4875 test pass, 1 bỏ qua, 2 todo. `npm run test:rules` pass (16 suite, 267 test). `expo export` iOS và Android đóng gói được.

### Đã viết nhưng chưa kiểm chứng trên thiết bị

- **Mọi mô-đun native:** `expo-camera` (quét, ghi `mode="video"` không thu tiếng, O-09), `expo-sqlite`, NetInfo, `expo-keep-awake`, `expo-video`, `expo-location`, RNFirebase (Auth, Firestore, Functions, Crashlytics với iOS `useFrameworks: "dynamic"` chưa từng build, S-3b), module cục bộ `backup-exclusion` (Expo Go không có, adapter no-op).
- **Tải lên bằng chứng:** POST URL ký rồi `uploadAsync` PUT cả tệp (mỗi lần thử gửi lại từ đầu, chưa tiếp tục giữa chừng); chạy khi app mở (định kỳ 60 giây, khi foreground, khi có mạng lại), **chưa có tải nền**. Không hứa tải xong khi app bị dừng.
- **Firebase thật:** Auth, quên mật khẩu (gửi thư thật), cổng Cá nhân, xóa tài khoản, kiểm toán, `purgeDeletedShops` chỉ qua emulator; mã lỗi mạng thật của SDK chưa ghi nhận (G-13).
- **Chạy thử:** `npx expo start --go --ios` (Expo Go, cổng giả) chạy được 2026-10-27, trước các PR V1 thêm mô-đun native; chưa chạy lại. Build native chưa chạy được (xem mục Lệnh).

### Còn là khung hoặc giả

- **Cổng giả** chọn qua `src/api/create-api.ts`: test và `__DEV__` = giả; bản build thường = Firebase thật, thiếu tệp cấu hình thì "chưa kết nối". `EXPO_PUBLIC_BACKEND=fake` hoặc `EXPO_PUBLIC_USE_FAKE_BACKEND=1` ép cổng giả (production `EXPO_PUBLIC_APP_ENV=prod` bỏ qua, V1-01).
- Ở bản Firebase còn trả `AUTH_SERVICE_UNAVAILABLE` nhưng không có lối vào: đăng nhập Apple/Google (O-15), khôi phục bằng mã 6 số (O-22). Màn Dung lượng UI-F03 là khung; Thành viên, Gói, Cài đặt thông báo ẩn.
- Chưa có: xem video từ máy chủ, đồng bộ hai chiều, xuất hồ sơ, thời hạn lưu/giữ do tranh chấp phía máy chủ (QA-10 không áp dụng v1), mời thành viên (O-03, O-07), thanh toán/gói (O-06, O-16), đẩy thông báo.
- Tên gói/hạn lưu, huy hiệu "Đã xác thực", email hỗ trợ, tên miền và URL pháp lý (giữ chỗ `.invalid`, D-4), khung 19 "Về Đơn Chứng" (Q-21j) còn thiếu dữ liệu thật.

### Hạn chế đã biết còn mở

Việc con người còn phải làm và cổng phát hành: **`docs/engineering/release-checklist.md`** (D, F, S, G, C, P). Phân tích gốc: `release-hardening-plan.md`, `decisions.md` Q-24, Q-29.

- **Cổng thiết bị (G-0…G-13) chưa làm:** QA-01…14 trên iOS + Android thật, đường tải lên Wi‑Fi/4G (G-3), quay/kill (G-4), đo băm và quyết R-5 (G-5), xem lại (G-6), sao lưu (G-7), xóa tài khoản (G-8), Crashlytics (G-9), chéo shop và người khai báo (G-10, G-10c), EXIF ảnh không mang GPS (G-12). Build EAS (S-1…S-8) và Firebase production (F-1…F-10) chưa có.
- **Dữ liệu chỉ trên máy tạo ra nó (Q-24a):** đồng bộ một chiều; máy mới/cài lại/nhiều người không thấy đơn, hồ sơ hoàn, tranh chấp; iOS và Android đều không sao lưu tệp (V1-01, V1-12) nên đổi máy hay gỡ app mất tệp chưa tải. Một máy một tài khoản (V1-07); đa thành viên để sau (O-03).
- **Video đang ghi mất khi app bị kill (Q-24b)**, chưa chia đoạn; tải nền chưa có; băm JS chưa đo trên máy.
- Offline lần đầu chưa có đệm `userShops` thì không tạo được đơn tới khi có mạng (V1-06). Dữ liệu cũ dưới `LOCAL_SHOP_ID` trên máy dev giữ nguyên, không bao giờ đăng.
- Câu chữ và mã lỗi mới của Q-29 chờ BA (C-1); pháp lý trang web (C-2), Splash/slogan "Lưu trữ an toàn" (Q-24e, C-3); tên app và bundle id (D-1, O-11), sàn hệ điều hành (D-2, O-20).
- **Chỉ được bật cờ ghi video cho người dùng thật** ở V1-21, sau khi cổng thiết bị G đạt (QA-01…14).

Sản phẩm: **Đơn Chứng** (tên làm việc, có thể đổi sau khi kiểm tra nhãn hiệu; tên repo là `GoiHangNhanh`) — ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng thương mại điện tử: đóng gói → bàn giao → nhận hàng hoàn → đối chiếu → tranh chấp. Không phải "app lưu video đơn hàng".

Tài liệu nằm trong `docs/`, bắt đầu từ `docs/README.md` (mục lục + nhật ký quyết định). Mọi tài liệu viết bằng tiếng Việt.

## Lệnh và tài liệu kỹ thuật

### Lệnh (Node 22, npm 10; đã chạy được trong môi trường khung)

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài phụ thuộc theo `package-lock.json` |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | ESLint (gồm quy tắc lớp/import, chuỗi UI, `no-console`) / `tsc --noEmit` strict / Prettier |
| `npm test` | Jest project `unit` + `tooling` (test script, `public-links`); chạy một tệp: `npx jest --selectProjects unit -- <đường-dẫn>`. Test kho SQLite dùng `node:sqlite` (Node >= 22.13; ADR-017) |
| `npm run test:rules` | Test Security Rules và logic Cloud Functions bằng Firebase Emulator (Firestore + Storage); cần Java 21, lần đầu tải emulator, và `npm --prefix firebase/functions ci` |
| `npm run check:tokens` | Kiểm tra cấu trúc Design Token; rule ESLint `design-tokens/no-raw-design-values` chạy trong `npm run lint` |
| `npm run check` | lint + typecheck + format:check + check:tokens + `npm test` (chạy trước khi báo xong) |
| `npx firebase … --config firebase/firebase.json --project <dự án>` | Mọi lệnh Firebase CLI (emulator, deploy): **luôn** truyền `--config firebase/firebase.json` vì `firebase.json` ở gốc repo là của RNFirebase (`firebase-setup.md`) |
| `npm --prefix firebase/functions run account:delete -- --project <dự án> --email <email> [--execute]` | Script nhân viên xử lý yêu cầu xóa tài khoản qua email (không `--execute` = chỉ in kế hoạch; V1-14) |
| `node scripts/screens/capture.cjs --work <ngoài repo> --out <thư mục> --routes "/a=ten"` | Chụp ảnh bản web cổng giả cho PR (Playwright cài ngoài repo; `scripts/screens/README.md`, V1-00). Ảnh web, không phải thiết bị |
| `npm --prefix web run check` / `check:release` | Website Astro; `check:release` báo lỗi khi còn email/tên miền giữ chỗ (C-7) |
| `npx expo start --go --ios` | Chạy thử trên iOS Simulator trong Expo Go 58 (chạy được 2026-10-27, cổng giả). **Không dùng `npm start`** để chạy thử: có `--dev-client`, báo `No development build ... installed` nếu chưa build. Camera không dùng được trên simulator; Expo Go không có module `backup-exclusion`, Crashlytics no-op |
| `npm run dev:ios` / `dev:android` / `prod:*` / `fake:*` | Chỉ macOS: mở máy ảo và chạy theo `scripts/env/{dev,prod,fake}.env` (dev/prod cần dev build và tệp ở `firebase/config/<env>/`) |
| `npx expo export --platform ios` / `--platform android` | Đóng gói JS (Metro) để bắt lỗi bundle; thêm `--output-dir <thư mục ngoài repo>`. `npx expo install` cần `api.expo.dev` (có thể bị chặn: ADR-013) |

Chọn backend (`src/api/create-api.ts`): test = giả; `__DEV__` = giả; bản build thường = **Firebase thật** (thiếu `GoogleService-Info.plist`/`google-services.json` thì "chưa kết nối"). `EXPO_PUBLIC_BACKEND=firebase|fake` ép chọn; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=<host>` nối Emulator (Android emulator: `10.0.2.2`). Tệp cấu hình app không commit, đặt ở `firebase/config/<APP_ENV>/` (gốc repo chỉ cho dev) hoặc trỏ `GOOGLE_SERVICES_INFO_PLIST`/`GOOGLE_SERVICES_JSON` (`app.config.js`, `firebase/config/README.md`). Cờ cổng giả: `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (ví dụ xuất web chụp ảnh); `EXPO_PUBLIC_FAKE_SESSION=signed_out|no_shop|signed_in` (phiên giả khi mở app; không đặt: dev/test = `signed_in`, bản xem trước = `signed_out`; `layout.md` mục 2.4, Q-15, Q-19). `EXPO_PUBLIC_RECORDER_ENABLED=1` bật ghi video thật (mặc định tắt; profile `staging` bật; ADR-020). Production (`APP_ENV=prod`) chặn cờ giả hai lớp (V1-01): lúc build `validateReleaseEnv` (`scripts/env/validate-release-env.cjs`) dừng khi có cờ giả/emulator, thiếu `EXPO_PUBLIC_APP_ENV=prod` hoặc tệp Firebase không khớp mã app; lúc chạy `EXPO_PUBLIC_APP_ENV=prod` luôn dùng Firebase (`DEPLOYMENT.md` mục 5.3). `npx expo prebuild --no-install` chạy được trên bản sao ngoài repo (chỉ kiểm cấu hình).

Build native (`npx expo run:ios`) **chưa chạy được trên máy có Xcode 16.4**: `ExpoModulesJSI` cần Swift tools 6.2 (Xcode 26+). CocoaPods cần `export LANG=en_US.UTF-8`. `ios/`/`android/` sinh ra đã gitignore. Build EAS (`eas.json` có sẵn) chưa chạy lần nào (S-1…S-4); bổ sung lệnh vào đây khi đã chạy thật. CI: `.github/workflows/ci.yml` (PR vào `main`): lint, typecheck, format, unit test, test Rules.

### Tài liệu kỹ thuật

- `docs/engineering/architecture.md` — kiến trúc, mô hình dữ liệu, máy trạng thái tệp, hàng đợi tải lên, Functions, so sánh thư viện, spike.
- `docs/engineering/conventions.md` — cấu trúc/đặt tên, quy tắc lớp, TypeScript, lỗi, i18n/UI, log/PII, bảo mật, commit/PR, định nghĩa "xong".
- `docs/engineering/layout.md` — khung giao diện: điều hướng, bảng route ↔ mã `UI-xx`, cổng phiên (mục 2.4a), component dùng chung, bố cục iOS/Android, thêm màn hình, đổi thanh tab (O-18).
- `docs/engineering/testing.md` — chiến lược test, ánh xạ QA-01…14, phần chưa tự động hóa được.
- `docs/engineering/v1-release-plan.md` — **kế hoạch phát hành v1.0** (V1-00…V1-21, trạng thái từng PR, quyết định R-x mục 7.5); `docs/engineering/plans/` — kế hoạch chi tiết từng PR V1-xx; `docs/engineering/release-checklist.md` — **việc con người phải làm** (D/F/S/G/C/P); `DEPLOYMENT.md` — quy trình môi trường, Firebase, EAS, biến môi trường; `CHANGELOG.md` — mỗi PR một dòng; ảnh PR ở `docs/assets/screens/<pr>/`.
- `docs/engineering/release-hardening-plan.md` — phân tích gốc rủi ro từ review 2026-10-29 (PR1…PR9; thứ tự thực hiện đã thay bằng kế hoạch v1), Q-24.
- `docs/store/` — mô tả store, App Privacy/Data safety, ghi chú cho người duyệt; phải khớp bản build nộp (C-4).
- `docs/engineering/personal-tab-plan.md`, `personal-tab-redesign-plan.md` — tab Cá nhân (PER-01…24, board 07; Q-20, Q-21).
- `docs/engineering/decisions.md` — ADR đề xuất + câu hỏi cần duyệt (Q-xx; v1 ở `#### Q-29 / V1-xx`).
- `docs/design-system.md` (cách dùng token), `docs/design-token-spec.md` (đặc tả), `docs/design-system-audit.md`, `docs/design-token-migration-report.md` — **mọi màn dùng `useTheme().tokens`, không viết hex/số thiết kế**; từ D-20 Splash, đăng nhập/đăng ký, khôi phục mật khẩu và luồng thiết lập cũng nằm trong phạm vi (phạm vi: `scripts/design-token-scope.cjs`). Màn không nằm trong `Screen` phải bọc `AppThemeScope`.
- `docs/engineering/firebase-setup.md` — dự án Firebase, tệp cấu hình app, emulator, deploy Functions/Rules (lưu ý deploy V1-07b), xóa tài khoản thủ công, lỗi thường gặp.
- `docs/engineering/platform-support.md` — hỗ trợ iOS + Android: sàn phiên bản, khác biệt nền tảng, ma trận kiểm thử.

Mã đáng chú ý: `src/api/` (hợp đồng `ApiClient`, bản giả, bản "chưa kết nối", `create-api.ts`; Firebase thật ở `src/api/firebase`, `error-map.ts` ánh xạ lỗi SDK/callable); `src/app/` (route mỏng Expo Router, bọc `withSessionGate`); `src/bootstrap/` (`tab-config.ts` một nơi cho thanh tab, `RootErrorBoundary`, `crash-reporting-early`); `src/core/navigation/routes.ts` (route ↔ `UI-xx`); `src/core/config/` (`recorder.ts` cờ ghi video, `public-links.ts`); `src/shared/ui` (design system); `src/platform/` (mọi adapter SDK native: camera, SQLite, tệp bền, băm, tải, mạng, keep-awake, video, vị trí, báo lỗi, sao lưu, dấu xóa; `src/platform/README.md`); `src/features/packing` (`recording-controller.ts`), `src/features/upload` (`UploadRunner`, Trung tâm đồng bộ), `src/features/orders/{domain,data}` (kho SQLite, `device-settings.ts`, `wipe-local-data.ts`), `src/features/evidence/domain/file-state.ts`, `src/core/theme/evidence-status.ts` (nhãn docs/09 mục 3), `src/core/errors/codes.ts` (mã lỗi docs/04–05), `src/core/logging/{logger,crash-safe}.ts`; `firebase/functions/src` (`index.ts` liệt kê mọi Function), `firebase/firestore.rules` + `firebase/tests/rules/` (cô lập theo shop, QA-11).

## Quyết định đã chốt (bản mới nhất thắng)

Các trao đổi ban đầu đã thay đổi định hướng nhiều lần. Chỉ áp dụng bản cuối:

| Chủ đề | Đã chốt | Đã bị thay thế (không dùng) |
|---|---|---|
| Nền tảng chính | App iOS + Android là sản phẩm chính; web chỉ để marketing/SEO/chuyển đổi | Web quản trị cho người bán, PWA ghi hình |
| Mobile | **React Native** | Flutter, PWA |
| Hệ điều hành | **Cả iOS và Android, ngang hàng**, phù hợp các phiên bản phổ biến. Tính năng chỉ xong khi chạy đúng trên cả hai; khác biệt nền tảng ghi trong `docs/engineering/platform-support.md`. Sàn phiên bản tối thiểu **chưa chốt** (O-20) | iOS-first hoặc Android-first, nền tảng "phụ" |
| Backend | **Firebase** (backend-as-a-service), không xây backend riêng | NestJS, PostgreSQL, Redis, S3 multipart |
| Nhập đơn | Quét mã hoặc nhập tay; mã chưa có thì tạo nhanh. Dữ liệu đơn **tối giản**: mã đơn + nguồn bán (+ mã vận đơn) để định danh; dòng sản phẩm (tên, variant, số lượng free text) để đối chiếu. Không bắt nhập sản phẩm trước khi quay; tích hợp sàn không bắt buộc | Bắt buộc API sàn, danh mục/SKU, form dài, quản lý bán hàng thu nhỏ |
| Chế độ đóng hàng | Cả đơn lẻ và theo lô, dùng **chung một quy trình và mô hình dữ liệu** | Hai tính năng rời |
| Kiểu video | Video đầy đủ: từ trước khi đóng gói đến khi niêm phong xong | Quay ngắn |
| Tải lên | Tải lên nền, cho làm đơn tiếp theo, trạng thái minh bạch | Chờ tải xong mới cho làm tiếp |
| Lưu trữ | Thời hạn theo gói dịch vụ, có cảnh báo và bảo toàn khi tranh chấp | Thời hạn cố định |

Các quyết định còn mở: xem `docs/README.md#quyết-định-còn-mở`. Không tự chốt thay người dùng.

## Bất biến nghiệp vụ (không được vi phạm trong thiết kế hay mã)

Đây là phần cần đọc nhiều file mới thấy; mọi tính năng phải tuân thủ:

1. **Không "một đơn = một video".** Đơn → nhiều Kiện → nhiều Phiên ghi nhận → nhiều Bằng chứng; đơn có thể có nhiều lượt hoàn và nhiều vụ tranh chấp. Mã đơn/mã vận đơn chỉ là thuộc tính tìm kiếm, **không** phải định danh; mọi đối tượng có ID nội bộ ổn định.
2. **Bằng chứng gắn với ID phiên + ID kiện được tạo trước khi bắt đầu quay**, không suy ra từ mã đơn đang hiển thị. Chuyển sang đơn tiếp theo không được làm thay đổi liên kết của phiên trước.
3. **Trạng thái tệp tách khỏi trạng thái phiên/đơn.** Vòng đời tệp: Đang ghi → Đang lưu trên thiết bị → Chờ tải lên → Đang tải lên → Đã tải lên → Đã xác minh (mã băm khớp), cùng các trạng thái lỗi riêng. Chỉ hiển thị "đã lưu an toàn trên máy chủ" sau khi máy chủ xác nhận và kiểm tra cần thiết thành công.
4. **Bản gốc bất biến.** Không ghi đè/chỉnh sửa video gốc; bản nén/cắt là bản dẫn xuất có liên kết. Quay bổ sung tạo phiên/tài liệu mới, không thay thế. Không xóa bản cục bộ chỉ vì tải lên đã bắt đầu. *Ngoại lệ có chủ đích thứ nhất (Q-26j, người dùng đã duyệt):* xóa **ảnh kiện hàng hoàn** chụp nhầm khi hồ sơ chưa `confirmed`, ảnh chưa nằm trong tranh chấp và chưa lên máy chủ; ghi sự kiện lịch sử, không áp dụng cho video đóng gói hay bằng chứng khác. *Ngoại lệ có chủ đích thứ hai (R-2 A, V1-15; điều phối chốt thay người dùng, chưa có xác nhận trực tiếp):* khi người dùng xóa tài khoản và máy chủ ĐÃ xác nhận, app xóa mọi tệp bằng chứng và dữ liệu nghiệp vụ trên máy, kể cả tệp chưa tải lên (có cảnh báo và ô tích xác nhận riêng); không cho xóa khi đang quay, khi còn tranh chấp mở trên máy, hoặc khi máy còn dữ liệu của tài khoản khác.
5. **Không tự liên kết, không tự kết luận.** Mã không khớp/nhiều kết quả → yêu cầu xác minh, không chọn kết quả đầu tiên. Hàng hoàn không xác định đơn gốc → hồ sơ chưa liên kết. Không tự kết luận nguyên nhân sai lệch hay bên chịu trách nhiệm.
6. **Không dữ liệu giả.** Quên quay thì ghi nhận thiếu bằng chứng, không cho tạo video bổ sung giả như quay lúc đóng hàng. Kiện mở trước khi quay → nhánh ngoại lệ, đánh dấu thiếu bằng chứng quá trình mở.
7. **Mọi thay đổi sau khi bắt đầu quay/sau xác nhận đều lưu lịch sử**; nhật ký kiểm toán không cho người dùng thường sửa/xóa.
8. **Cô lập dữ liệu theo shop** trên mọi truy vấn, kể cả khi đoán ID. Không URL công khai vĩnh viễn tới video.
9. **Không xóa bằng chứng đang bị giữ do tranh chấp**; hạ cấp/hết hạn gói không được xóa ngầm.
10. **Dữ liệu đơn tối giản, nguồn rõ ràng.** Đơn Chứng không quản lý bán hàng (không SKU/giá/khách hàng/tồn kho). Thiếu thông tin sản phẩm không được chặn quay — gắn nhãn *Chưa khai báo sản phẩm*. Không gộp các variant khác nhau. Thông tin do người dùng nhập phải ghi nguồn là do người dùng nhập, không giả định là dữ liệu chính thức từ sàn. Quét mã vận đơn không có nghĩa là lấy được tên sản phẩm.
11. **Ngôn ngữ trung thực:** không quảng cáo "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại, không hứa tải nền vô hạn (iOS/Android giới hạn chạy nền). Mã băm chỉ chứng minh tệp không đổi kể từ lúc tính, không chứng minh thời điểm quay hay tính chân thực; thời gian thiết bị và thời gian máy chủ lưu riêng.

## Quy ước khi viết tài liệu/mã

- Mỗi màn hình đặc tả theo khung: mục đích, thành phần, hành động, trạng thái, lỗi, tiêu chí nghiệm thu. Mã màn hình: `A01–A08` (đóng gói), `B01–B08` (hàng hoàn).
- Có hai bộ mã màn hình, không nhầm lẫn: `A01–A08`/`B01–B08` là đặc tả **quy trình** (docs/04, 05); `UI-A01…UI-J15` là danh mục màn hình **giao diện** (docs/09, bảng ánh xạ ở cuối mục 4). Nhãn trạng thái bằng chứng hiển thị theo bảng ở docs/09 mục 3.
- Thông báo lỗi viết cho người không rành công nghệ: tối đa 2 câu, dưới 20 từ, một ý, từ thường ngày; chỉ nêu ảnh hưởng khi người dùng có thể lo mất dữ liệu; có nút hành động khi có việc làm ngay (quy ước đầy đủ ở `docs/09` mục 5.1). Mã lỗi nghiệp vụ dạng `UPPER_SNAKE_CASE` (ví dụ `ORDER_NOT_FOUND`), danh sách trong `docs/04-*` và `docs/05-*`.
- Thiết kế exception-first: mỗi luồng phải có nhánh ngoại lệ, không chỉ đường thuận.
- UX: người bán dùng phải cực kỳ đơn giản; ưu tiên camera/máy quét, hạn chế gõ, không bắt cấu hình khi đăng ký.
- Công nghệ phục vụ nghiệp vụ: không cắt nghiệp vụ quan trọng chỉ vì Firebase/React Native khó làm; nếu xung đột, ghi vào mục "Hệ quả với Firebase" trong `docs/06-evidence-retention-policy.md` và hỏi người dùng.
