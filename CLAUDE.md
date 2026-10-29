# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Repo có tài liệu nghiệp vụ (`docs/`), **khung kỹ thuật** (Expo SDK 58 + React Native + TypeScript, Firebase, Security Rules có test, CI) và app đã dựng nhiều màn thật. Chi tiết từng quyết định và từng PR nằm ở `docs/engineering/decisions.md` (Q-xx, ADR) và các tệp kế hoạch trong `docs/engineering/`; mục này chỉ tóm tắt hiện trạng đã đối chiếu với mã ở HEAD `ffd2491`. Thiết kế kỹ thuật là **đề xuất, chờ người dùng duyệt** (không phải quyết định D-xx); thư viện native chưa chốt chờ spike trên thiết bị thật.

**Chưa có gì trong app từng chạy trên thiết bị thật hay build native iOS/Android.** Mọi thứ dưới đây chỉ được kiểm chứng bằng unit test (Jest, `node:sqlite`), Firebase Emulator (Rules, logic Functions) và `expo export`.

### Đã có và chạy trong test

- **Điều hướng và giao diện:** Expo Router, thanh tab 5 mục (Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân; D-16; `tab-config.ts`), design system theo token (`useTheme().tokens`), i18n tiếng Việt, logger che PII. Splash, Chào mừng, đăng ký/đăng nhập/quên mật khẩu, tạo shop đã được khách xác nhận, **không đổi giao diện** (`scripts/design-token-scope.cjs`).
- **Đơn hàng (tab Đơn hàng, Quét, Trang chủ):** quét mã bằng `expo-camera` (ADR-016); tra cứu trước khi tạo (`OrderMatchSheet`, không tự tạo/gộp/chọn hộ); Tạo đơn nhanh -> Xác nhận -> lưu một lần, idempotent, kiểm trùng (Q-22ac..ag); danh sách (tìm, chip, bộ lọc, phân trang keyset), chi tiết, Bằng chứng của đơn, Tìm đơn đã lưu có lịch sử tìm (Q-22); Sửa thông tin đơn **chỉ khi đơn chưa có phiên** (Q-22ah, `ORDER_HAS_SESSION`).
- **Kho cục bộ `expo-sqlite`** (ADR-017, `src/features/orders/data`): đơn, dòng, kiện, phiên, tệp bằng chứng, lịch sử tìm. **Migration v1–v6** (`sqlite-migrations.ts`: v2 `search_history`, v3 `evidence_files`, v4 dấu đã đăng, v5 `created_by`, v6 dấu đăng của kiện) + `repairLegacySchema` cho v3 cũ. Một kết nối dùng chung, hàng đợi tuần tự (`db-queue.ts`). `shopId` hôm nay có thể là `LOCAL_SHOP_ID` khi phiên chưa biết shop (Q-17d).
- **Máy trạng thái tệp** (`features/evidence/domain/file-state.ts`): chỉ sự kiện `origin: 'server'` tới `uploaded`/`verified`/`hash_mismatch`. SHA-256 thuần JS (`core/crypto/sha256.ts`, đối chiếu `node:crypto`).
- **Ghi video và hàng đợi tải lên (sau cờ, xem dưới):** `features/packing/domain/recording-controller.ts` (tạo bản ghi tệp + phiên TRƯỚC khi quay, chuyển tệp khỏi thư mục tạm, băm, khôi phục sau kill), `features/upload` (hàng đợi, backoff tối đa 8 lần, đối soát trạng thái máy chủ, tải qua URL ký), UI-C03/C04/C06 theo tệp thật.
- **Đồng bộ đơn/phiên lên Firestore** (ADR-019, Q-23): một chiều thiết bị -> máy chủ, đăng khi đơn đã có phiên, idempotent, chỉ đăng bản ghi do chính uid tạo. Chạy khi có Firebase thật và phiên có `shopId`.
- **Firebase** (`firebase/`): `firestore.rules` (cô lập theo shop qua `members`; `userShops`, `shops`, `orders` + `lines`/`packages`, `sessions`, `evidence`, `auditEvents`), `storage.rules` từ chối mọi truy cập client (ADR-006); Cloud Functions `createShop`, `updateShop`, `createUploadSession` (URL ký tạo-một-lần), `verifyEvidence` (băm lại phía máy chủ, `uploaded` -> `verified`/`hash_mismatch`, kiểm toán); **147 test Rules/Functions** (`npm run test:rules`; gồm bản neo `returns` và bằng chứng hàng hoàn, Q-28). Dự án dev `ghn-test-67b39`; chưa deploy (`firebase-setup.md`, Q-19).
- **Luồng Hàng hoàn thật, giai đoạn R1 + R2a/R2a-2 + R2b** (`features/returns`, Q-26): hồ sơ hàng hoàn cục bộ (migration v8), D01 danh sách thật, D02 tìm đơn gốc (không tự ghép, cảnh báo trùng, liên kết sau có lịch sử), D03 tình trạng bên ngoài + kiện mở trước khi quay + **chụp ảnh kiện (R2a: tối đa 5 (Q-26i chốt giữ 5), tùy chọn, bảng `return_media` migration v10, chỉ "Đã lưu trên máy", chưa kiểm chứng trên thiết bị; ảnh chưa đồng bộ chặn đăng xuất/chuyển cửa hàng và chọn được ở G03 Tranh chấp; R2a-2: **xóa ảnh chụp nhầm** khi hồ sơ chưa xác nhận, ảnh chưa trong tranh chấp và chưa lên máy chủ, có hộp thoại xác nhận và sự kiện lịch sử `photo_deleted`; xóa dòng + ghi sự kiện trong giao dịch TRƯỚC, xóa tệp vật lý SAU, xóa tệp lỗi chỉ để lại tệp mồ côi chưa dọn tự động (Q-26j, ngoại lệ bất biến 4); **ghi vị trí thiết bị lúc chụp** nếu có, vẫn chụp được khi không có (Q-26k, `expo-location` ~58.0.19 sau `platform/location.ts`, migration v11, quyền "khi đang dùng app", UI không hiện tọa độ, không chứng minh nơi chụp))**, D05 kiểm hàng (dòng dự kiến là bản sao, số thực nhận để trống), D06 xác nhận, D07 hoàn tất/xem. **R2b (Q-28, mới, chưa kiểm chứng trên thiết bị, chưa deploy Rules/Functions): ảnh và video hàng hoàn (giữ đúng loại video, khai báo `original_video` với mime video, thời lượng chưa gửi) đi qua CÙNG hàng đợi tải lên với bằng chứng đóng gói (`UploadSource`; chỉ khi hồ sơ đã đăng "bản neo" `shops/{shopId}/returns/{id}` và do chính uid tạo; Storage dùng chung `shops/{shopId}/evidence/{id}/original`, `createUploadSession`/`verifyEvidence` dùng nguyên); nhãn ở D03/D06/D07/G03/G04 theo trạng thái tệp thật (migration v12–v14). D04 quay video mở kiện THẬT khi bật `EXPO_PUBLIC_RECORDER_ENABLED=1` (mặc định tắt = xem trước như cũ; `startOpeningVideo`, mỗi hồ sơ tối đa một video, không quay bù, kiện mở trước vẫn là hạn chế bằng chứng); ảnh đã từng bắt đầu tải thì không xóa được, video không bao giờ xóa được; khôi phục ảnh/video dở dang sau khi app bị kill (`ReturnMediaRecovery`). Server chỉ có bản neo định danh, nội dung hồ sơ hoàn vẫn chỉ trên máy (Q-26c); vị trí ảnh không gửi lên; D04 chưa có kiểm tra pin/nhiệt độ như UI-C02; chưa quét mã ở D02.**
- **Luồng Tranh chấp** (`features/disputes`, Q-27): hồ sơ tranh chấp cục bộ (migration v9), G01 danh sách, G02 tạo (từ đơn, hàng hoàn hoặc tự chọn; báo trùng hồ sơ mở), G03 chọn bằng chứng (cảnh báo tệp chưa lên máy chủ, đánh dấu giữ), G04 xem trước và chia sẻ văn bản tóm tắt (không nhãn "đầy đủ"; mang nhãn "Hạn chế bằng chứng" của hàng hoàn), G05 chi tiết/ghi chú/đóng hồ sơ (không xóa dữ liệu). **Chỉ lưu trên máy này, chưa đồng bộ, chưa có gói tệp xuất.**
- **Tab Cá nhân (trên cổng giả):** hồ sơ, cửa hàng (sửa tên, chuyển cửa hàng, chặn khi đang quay hoặc có tệp chưa đồng bộ), đổi họ tên/mật khẩu, Đăng xuất an toàn (PER-21), cài đặt thông báo, quyền riêng tư, Trợ giúp, Dữ liệu bằng chứng, Thời hạn lưu, màn Xóa tài khoản (nút luôn khóa; Q-20e, Q-21af). **Gói dịch vụ đang ẩn** (`account-menu.ts`, Q-21ag; mã UI-H01 giữ nguyên). Menu mục chưa làm hiện "Sắp có". Kế hoạch: `personal-tab-plan.md`, `personal-tab-redesign-plan.md`.
- **Kiểm tra gần nhất (2026-10-29, sau sửa review PR #39):** Jest unit pass (174 suite, 3803 test, 2 todo); `npm run lint` (0 lỗi, 6 cảnh báo `import/no-duplicates` có sẵn), `tsc --noEmit` (gồm `firebase/`), prettier, `check:tokens` sạch; `npm run test:rules` pass (9 suite, 147 test); `expo export` iOS và Android đóng gói được. Chưa chạy trên thiết bị, chưa deploy.

### Đã viết nhưng chưa kiểm chứng trên thiết bị

- **Ghi video thật** (ADR-020): `expo-camera` `mode="video"`, không thu tiếng (O-09 chưa quyết), **tắt mặc định**, chỉ bật bằng `EXPO_PUBLIC_RECORDER_ENABLED=1` (`features/packing/domain/recorder.ts`). Khi tắt, màn quay chỉ xem trước camera với dải "chưa ghi video" và các màn xác nhận/hoàn tất báo chưa có video. Chưa thử: quay dài, cuộc gọi/nền, hết bộ nhớ, kill app, tốc độ băm JS trên Hermes.
- **Tải lên bằng chứng:** POST URL ký rồi `uploadAsync` PUT cả tệp (mỗi lần thử gửi lại từ đầu, chưa tiếp tục giữa chừng); chạy khi app mở (định kỳ 60 giây, khi foreground), **chưa có tải nền**. Không hứa tải xong khi app bị dừng.
- **Firebase Auth + tạo/sửa shop** (`src/api/firebase`): đã viết và qua test emulator, chưa chạy trên máy. Camera quét mã, SQLite, clipboard cũng chưa kiểm chứng trên máy.
- **Chạy thử:** `npx expo start --go --ios` (Expo Go, cổng giả). Build native (`expo run:ios`) chưa chạy được trên Xcode 16.4 (xem mục Lệnh).

### Còn là khung hoặc giả

- **Cổng giả** chọn qua `src/api/create-api.ts`: test và `__DEV__` = giả; bản build thường = Firebase thật, thiếu tệp cấu hình thì "chưa kết nối". `EXPO_PUBLIC_BACKEND=fake` hoặc `EXPO_PUBLIC_USE_FAKE_BACKEND=1` **ép cổng giả ở mọi bản build** (chưa có chốt chặn cho bản production).
- **Cổng tab Cá nhân ở chế độ Firebase là "chưa kết nối"** (Q-20t): hồ sơ, đăng xuất, đổi mật khẩu, danh sách/chuyển cửa hàng, cài đặt thông báo đều trả `AUTH_SERVICE_UNAVAILABLE`. Khôi phục mật khẩu và Apple/Google cũng chưa nối.
- **Chưa có route guard.** `useIsOffline` là khung (`platform/connectivity.ts`, luôn `false`); chưa có thư viện trạng thái mạng.
- **Màn minh họa:** Trung tâm đồng bộ UI-F01 (dữ liệu `ILLUSTRATIVE_SYNC_JOBS`, chưa có nút thử lại), Trang chủ (có dải "minh họa" trong mã); Thông báo, Thành viên, Dung lượng là khung (chưa rà từng màn). Chưa có xem lại video, xuất hồ sơ, hết hạn/giữ do tranh chấp, quản lý thành viên (O-03, O-07), thanh toán/gói (O-06, O-16), đẩy thông báo.
- Tên gói/hạn lưu, huy hiệu "Đã xác thực", địa chỉ hỗ trợ, URL điều khoản/quyền riêng tư, khung 19 "Về Đơn Chứng" (Q-21j) và nguồn số đếm bằng chứng còn thiếu dữ liệu thật.

### Hạn chế đã biết quan trọng và rủi ro chưa xử lý

Kế hoạch xử lý, theo thứ tự PR: **`docs/engineering/release-hardening-plan.md`** (câu hỏi chờ quyết định: `decisions.md` Q-24). Nguồn: review "người dùng thật" 2026-10-29.

- **Chặn phát hành:** (1) Ở bản Firebase thật, `shopId` và `uid` của phiên luôn `null` (cổng cá nhân "chưa kết nối", `SignInScreen` truyền `null`), nên đồng bộ đơn và tải bằng chứng không bao giờ chạy, `created_by` rỗng sau khi khởi động lại, và **không đăng xuất được**. (2) Đồng bộ một chiều: máy mới/cài lại/nhiều người không thấy dữ liệu; chưa có Function cấp URL xem video (phạm vi chờ Q-24a).
- **Cao:** không có trạng thái mạng thật và mọi lỗi tạm tốn lượt thử (~10 phút mất mạng là `needs_attention`, chưa có nút thử lại); lời gọi Firestore khi offline có thể treo hàng đợi; Trung tâm đồng bộ là dữ liệu minh họa; bộ lọc "Chưa có video" bậc hai (30.000 đơn đo 14 giây) và thiếu index `packing_sessions`; màn quay không giữ sáng và không xử lý nền; video đang ghi mất trắng khi app bị kill (Q-24b); băm JS và băm lại mỗi lần thử; chưa có trigger kiểm toán cho orders/sessions/evidence (Q-23k, bất biến 7).
- **Cần lưu ý khi làm tiếp:** đơn tạo khi phiên chưa biết shop nằm ở `LOCAL_SHOP_ID` và không bao giờ đăng; `eas.json` chưa đặt `APP_ENV` cho profile production (bundle id `.dev`, dự án Firebase dev); video và CSDL nằm trong thư mục tài liệu (có thể vào backup hệ điều hành, Q-24d); slogan màn Chào mừng "Lưu trữ an toàn" chưa khớp thực tế (Q-24e).
- **Chỉ được bật cờ ghi video cho người dùng thật** sau khi các mục Chặn/Cao liên quan xong và qua kịch bản thiết bị (QA-01…14).

Sản phẩm: **Đơn Chứng** (tên làm việc, có thể đổi sau khi kiểm tra nhãn hiệu; tên repo là `GoiHangNhanh`) — ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng thương mại điện tử: đóng gói → bàn giao → nhận hàng hoàn → đối chiếu → tranh chấp. Không phải "app lưu video đơn hàng".

Tài liệu nằm trong `docs/`, bắt đầu từ `docs/README.md` (mục lục + nhật ký quyết định). Mọi tài liệu viết bằng tiếng Việt.

## Lệnh và tài liệu kỹ thuật

### Lệnh (Node 22, npm 10; đã chạy được trong môi trường khung)

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài phụ thuộc theo `package-lock.json` |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | ESLint (gồm quy tắc lớp/import, chuỗi UI, `no-console`) / `tsc --noEmit` strict / Prettier |
| `npm test` | Unit test Jest (project `unit`); chạy một tệp: `npx jest --selectProjects unit -- <đường-dẫn>`. Test kho SQLite dùng `node:sqlite` của Node (cần Node >= 22.13; ADR-017) |
| `npm run test:rules` | Test Security Rules và logic Cloud Functions bằng Firebase Emulator (Firestore + Storage); cần Java 21, lần đầu tải emulator, và `npm --prefix firebase/functions ci` |
| `npm run check:tokens` | Kiểm tra cấu trúc Design Token (nguồn hex duy nhất, kiến trúc tầng, baseline ngoại lệ); rule ESLint `design-tokens/no-raw-design-values` chạy trong `npm run lint` |
| `npm run check` | lint + typecheck + format:check + check:tokens + unit test (chạy trước khi báo xong) |
| `npx expo start --go --ios` | **Cách chạy thử trên iOS Simulator** (đã chạy được, 2026-10-27): mở app trong Expo Go 58 và tự cài Expo Go khớp SDK nếu thiếu. Không cần build native/Xcode mới. **Không dùng `npm start`** để chạy thử: script đó có `--dev-client` và báo `No development build (vn.doncung.app.dev) ... installed` nếu chưa build. Camera quét mã không dùng được trên simulator; `expo-sqlite`/`expo-camera` chưa kiểm chứng kỹ trong Expo Go |
| `npx expo export --platform ios` / `--platform android` | Đóng gói JS (Metro) để bắt lỗi bundle; không cần Xcode/Android SDK. Thêm `--output-dir <thư mục ngoài repo>` nếu không muốn tạo `dist/`. `npx expo install` cần truy cập `api.expo.dev` (có thể bị chặn trong môi trường hạn chế: xem ADR-013) |

Chọn backend (`src/api/create-api.ts`): test = giả; `__DEV__` = giả; bản build thường = **Firebase thật** (thiếu `GoogleService-Info.plist`/`google-services.json` thì rơi về "chưa kết nối"). `EXPO_PUBLIC_BACKEND=firebase|fake` ép chọn; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=<host>` nối Firebase Emulator (Android emulator: `10.0.2.2`). Hai tệp cấu hình app không commit, đặt ở gốc repo hoặc trỏ `GOOGLE_SERVICES_INFO_PLIST`/`GOOGLE_SERVICES_JSON` (`app.config.js`). Cờ môi trường của cổng giả (không phải lệnh): `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (bật cổng giả ở bản không phải dev, ví dụ xuất web để chụp ảnh giao diện); `EXPO_PUBLIC_FAKE_SESSION=signed_out|no_shop|signed_in` (phiên giả khi mở app, màn Splash UI-A01; không đặt: dev/test = `signed_in`, bản xem trước = `signed_out`; bản build thường dùng Firebase thật (hoặc "chưa kết nối" nếu thiếu cấu hình: vào Chào mừng): `layout.md` mục 2.4, `decisions.md` Q-15, Q-19). `npx expo prebuild --no-install` đã chạy được trên bản sao ngoài repo (chỉ để kiểm tra cấu hình `app.json`), chưa build/chạy native. `EXPO_PUBLIC_RECORDER_ENABLED=1` bật ghi video thật (mặc định tắt; ADR-020, chưa kiểm chứng trên thiết bị). Hôm nay chưa có chốt chặn cho bản production khỏi cờ giả (xem release-hardening-plan.md PR6).

Build native (`npx expo run:ios`) **chưa chạy được trên máy có Xcode 16.4**: `ExpoModulesJSI` cần Swift tools 6.2 (Xcode 26+), lỗi `package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0`. CocoaPods cần `export LANG=en_US.UTF-8` (nếu không `pod install` lỗi Unicode Normalization). Thư mục `ios/` sinh ra đã được gitignore. Chưa có lệnh build/chạy native (dev build) chạy thật; sau `expo prebuild`/EAS cần bổ sung vào đây khi đã chạy thật. CI: `.github/workflows/ci.yml` (PR vào `main`): lint, typecheck, format, unit test, test Rules.

### Tài liệu kỹ thuật

- `docs/engineering/architecture.md` — kiến trúc, mô hình dữ liệu Firestore/Storage, máy trạng thái tệp, hàng đợi tải lên, Cloud Functions, so sánh thư viện (kiểm tra 2026-10-26), kế hoạch spike.
- `docs/engineering/conventions.md` — cấu trúc/đặt tên, quy tắc lớp, TypeScript, lỗi, i18n/UI, log/PII, bảo mật, commit/PR, định nghĩa "xong".
- `docs/engineering/layout.md` — khung giao diện: cấu trúc điều hướng, bảng route ↔ mã `UI-xx`, component dùng chung, quy tắc bố cục iOS/Android, cách thêm màn hình, cách đổi thanh tab (O-18).
- `docs/engineering/testing.md` — chiến lược test, ánh xạ QA-01…14, phần chưa tự động hóa được.
- `docs/engineering/release-hardening-plan.md` — kế hoạch gia cố trước phát hành (PR1…PR9) cho các rủi ro Chặn phát hành/Cao từ review 2026-10-29; câu hỏi chờ quyết định ở `decisions.md` Q-24. Đọc trước khi bật cờ ghi video hay phát hành.
- `docs/engineering/personal-tab-plan.md` — kế hoạch triển khai tab Cá nhân (PER-01…24): ánh xạ PER ↔ UI, chia PR, tiêu chí xong (đề xuất, chờ duyệt; Q-20, O-29).
- `docs/engineering/personal-tab-redesign-plan.md` — kế hoạch làm lại giao diện tab Cá nhân theo design board `docs/assets/ui/07-personal-tab-redesign-board.png`: mô tả 21 khung, gap, token mới tối thiểu, điểm lệch D1–D29, PR A–I, quy trình kiểm tra "giống design" (Q-21).
- `docs/engineering/decisions.md` — ADR đề xuất + câu hỏi cần duyệt (Q-xx).
- `docs/design-system.md` (cách dùng token), `docs/design-token-spec.md` (đặc tả), `docs/design-system-audit.md`, `docs/design-token-migration-report.md` — **màn trong app dùng `useTheme().tokens`, không viết hex/số thiết kế; Splash, đăng nhập/đăng ký, khôi phục mật khẩu và luồng thiết lập đã được khách hàng xác nhận, nằm ngoài phạm vi, không được đổi giao diện** (danh sách: `scripts/design-token-scope.cjs`).
- `docs/engineering/firebase-setup.md` — tạo dự án Firebase, tệp cấu hình app, chạy emulator, deploy Functions/Rules, kiểm chứng trên thiết bị, lỗi thường gặp, đổi backend.
- `docs/engineering/platform-support.md` — hỗ trợ iOS + Android: thị phần, sàn phiên bản, khác biệt nền tảng, ma trận kiểm thử.

Mã khung đáng chú ý: `src/api/` (lớp API: hợp đồng `ApiClient`, bản giả, bản "chưa kết nối", `create-api.ts`; Firebase thật ở `src/api/firebase`: Auth + Cloud Function `createShop`/`updateShop` + `userShops/{uid}`; **đã viết và qua test trên emulator, chưa chạy trên thiết bị và chưa deploy**; dự án dev `ghn-test-67b39` ở `firebase/.firebaserc`; khôi phục mật khẩu và Apple/Google vẫn trả `AUTH_SERVICE_UNAVAILABLE`), `src/app/` (route mỏng Expo Router), `src/bootstrap/navigation/tab-config.ts` (cấu hình thanh tab 5 mục, một nơi duy nhất; nút Quét giữa là hành động, không phải tab), `src/core/navigation/routes.ts` (bảng route ↔ `UI-xx`), `src/shared/ui` (design system), `src/shared/fixtures/illustrative-data.ts` (dữ liệu minh họa duy nhất), `src/platform/` (adapter điều hướng/bố cục/camera quét và ghi/lưu cục bộ/ID/clipboard/tệp bền `recording-files.ts`/băm `file-hasher.ts`/tải `resumable-upload.ts`/trạng thái mạng khung `connectivity.ts`); `src/features/packing` (luồng quay, `recording-controller.ts`, cờ `RECORDER_ENABLED`), `src/features/upload` (hàng đợi tải lên, `UploadRunner`), `src/core/crypto/sha256.ts`; `firebase/functions/src` (`shop.ts`, `uploads.ts`, `evidence.ts`, `index.ts`); `src/features/orders/{domain,data}` (đơn, gợi ý, tìm trùng, kho SQLite + bộ nhớ); `src/features/evidence/domain/file-state.ts` (máy trạng thái tệp; client không tự tới `uploaded`/`verified`), `src/core/theme/evidence-status.ts` (nhãn trạng thái docs/09 mục 3), `src/core/errors/codes.ts` (mã lỗi từ docs/04–05), `firebase/firestore.rules` + `firebase/tests/rules/` (cô lập theo shop, QA-11).

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
4. **Bản gốc bất biến.** Không ghi đè/chỉnh sửa video gốc; bản nén/cắt là bản dẫn xuất có liên kết. Quay bổ sung tạo phiên/tài liệu mới, không thay thế. Không xóa bản cục bộ chỉ vì tải lên đã bắt đầu. *Ngoại lệ có chủ đích duy nhất (Q-26j, người dùng đã duyệt):* xóa **ảnh kiện hàng hoàn** chụp nhầm khi hồ sơ chưa `confirmed`, ảnh chưa nằm trong tranh chấp và chưa lên máy chủ; ghi sự kiện lịch sử, không áp dụng cho video đóng gói hay bằng chứng khác.
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
