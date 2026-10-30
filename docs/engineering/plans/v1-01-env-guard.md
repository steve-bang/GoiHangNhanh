# V1-01 env-guard — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (Build/phát hành, Q-24d, O-09), 3.3 V1-01, 7.5 (`APP_ENV` giữ `prod`, nhận bí danh `production`).

## Mục tiêu

Bản production không bao giờ chạy cổng giả, không mang bundle id `.dev`, không nối Firebase Emulator; Android không vào Auto Backup. Không đổi giao diện.

## Tệp đổi

| Tệp | Thay đổi |
|---|---|
| `scripts/env/validate-release-env.cjs` (mới) | Hàm thuần `validateReleaseEnv(env, { iosFile, androidFile })` trả `'dev' \| 'prod'` hoặc ném lỗi gom mọi vi phạm |
| `scripts/env/validate-release-env.test.cjs` (mới) | Test project `tooling` cho mọi tổ hợp cờ |
| `app.config.js` | Gọi `validateReleaseEnv`; dùng kết quả chọn thư mục cấu hình Firebase và bỏ `.dev` (giữ cả hai cách viết `GOOGLE_SERVICE(S)_INFO_PLIST`) |
| `app.json` | `android.allowBackup: false` (Q-24d), `android.blockedPermissions` (`RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`), `ios.config.usesNonExemptEncryption: false` |
| `eas.json` | `env` cho từng profile; khối `submit.production` giữ chỗ |
| `src/api/create-api.ts` | `appEnv` trong `BackendEnv`; `isProductionAppEnv`; `resolveBackendMode` trả `firebase` khi `EXPO_PUBLIC_APP_ENV` là `prod`/`production` (trước mọi cờ, kể cả `isTest`); `firebaseEmulatorHost(env)` trả `undefined` ở production |
| `src/api/create-remote-documents.ts` | Dùng `firebaseEmulatorHost` thay `env.emulatorHost` |
| `src/api/create-api.test.ts`, `create-remote-documents.test.ts` | Ca production + cờ giả/emulator |
| `jest.config.js`, `eslint.config.js` | Project `tooling` nhận `scripts/**/*.test.cjs`; globals Jest cho tệp test đó |
| `DEPLOYMENT.md` mục 5–6, `docs/engineering/firebase-setup.md` mục 1, `firebase/config/README.md` | Mô tả profile, chốt chặn, cách kiểm |
| `docs/engineering/decisions.md` Q-29 | Ghi các quyết định nhỏ tự chốt (Q-29a) |
| `CHANGELOG.md` | Một dòng nhóm Security |

## Thiết kế

**Build (lớp một).** `validateReleaseEnv`:

- `APP_ENV`: rỗng/không đặt hoặc `dev` -> `dev`; `prod`/`production` -> `prod`; giá trị khác -> **lỗi** (gõ nhầm `prd` không được lặng lẽ thành bản dev).
- `EXPO_PUBLIC_APP_ENV` là `prod`/`production` mà `APP_ENV` không phải prod -> lỗi (gói JS tưởng là production nhưng bundle id `.dev`, Firebase dev).
- Khi prod, lỗi nếu: `EXPO_PUBLIC_APP_ENV` không phải `prod`/`production` (thiếu thì mất lớp phòng thủ lúc chạy); `EXPO_PUBLIC_USE_FAKE_BACKEND` khác rỗng (mọi giá trị, chặt hơn lúc chạy chỉ nhận `1`); `EXPO_PUBLIC_BACKEND` khác rỗng và khác `firebase`; `EXPO_PUBLIC_FAKE_SESSION` khác rỗng; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` khác rỗng.
- Khi prod và đang chạy trên máy build EAS (`EAS_BUILD=true`): thiếu tệp cấu hình Firebase của nền tảng đang build (`EAS_BUILD_PLATFORM`; không rõ thì đòi cả hai) -> lỗi. Ngoài EAS (máy dev chạy `expo config`, `prod:ios`) không đòi tệp để còn kiểm cấu hình được.
- Không chặn `EXPO_PUBLIC_RECORDER_ENABLED` ở prod: V1-21 sẽ bật; `eas.json` production hôm nay không đặt.

**Chạy (lớp hai).** `EXPO_PUBLIC_APP_ENV` là `prod`/`production` -> `resolveBackendMode` luôn `firebase` (bỏ qua `EXPO_PUBLIC_USE_FAKE_BACKEND`, `EXPO_PUBLIC_BACKEND=fake`, `__DEV__`, kể cả `isTest`), không dùng emulator host. Thiếu cấu hình vẫn rơi về "chưa kết nối" như cũ (không giả thành công). Cổng cá nhân và cổng tài liệu máy chủ dùng chung `resolveBackendMode` nên tự theo.

**EAS profile.**

| Profile | `APP_ENV` | `EXPO_PUBLIC_APP_ENV` | Khác |
|---|---|---|---|
| `development`, `development-simulator` | `dev` | `dev` | dev client; JS do Metro máy dev đóng gói |
| `staging` (EAS environment `preview`) | `dev` | `dev` | `EXPO_PUBLIC_BACKEND=firebase`, `EXPO_PUBLIC_RECORDER_ENABLED=1` (cổng thiết bị) |
| `production` | `prod` | `prod` | `EXPO_PUBLIC_BACKEND=firebase`; **không** bật ghi video tới V1-21 |

`submit.production`: Android `track: internal`, `releaseStatus: draft`; iOS `ascAppId` giữ chỗ (`<ID app trên App Store Connect>`, S-6). Giữ chỗ không phá build; `eas submit` sẽ báo lỗi cho tới khi điền (chấp nhận, ghi ở DEPLOYMENT).

## Migration / Rules

Không.

## Test

- Tooling: `validateReleaseEnv` mọi cờ ở dev (cho phép) và prod (ném lỗi, gom nhiều lỗi), bí danh `production`, giá trị lạ, lệch `EXPO_PUBLIC_APP_ENV`, tệp Firebase trên EAS theo nền tảng.
- Unit: `resolveBackendMode` prod + từng cờ giả -> `firebase`; `firebaseEmulatorHost` prod -> `undefined`; `createApi` prod + emulator không truyền host; `createRemoteDocuments` prod + cờ giả -> gọi Firebase.
- Thủ công trên bản sao ngoài repo: `APP_ENV=prod npx expo config --type public` (bundle id), `APP_ENV=prod EXPO_PUBLIC_BACKEND=fake npx expo config` (phải lỗi), `npx expo prebuild --no-install` (`allowBackup="false"`, không `RECORD_AUDIO`, danh sách quyền; `Info.plist` có `ITSAppUsesNonExemptEncryption=false`, không micro).

## Màn cần chụp

Không có thay đổi giao diện.

## Rủi ro

- `allowBackup: false` làm mất cả phiên Auth Android khi đổi máy: phải đăng nhập lại (chấp nhận, khớp Q-24a). Không ảnh hưởng iOS (V1-12 lo phần iOS).
- `usesNonExemptEncryption: false`: app chỉ dùng HTTPS/TLS của hệ điều hành và SHA-256 (băm, không mã hóa), thuộc miễn trừ; nếu sau này thêm mã hóa riêng phải xem lại.
- Lớp chạy chỉ hiệu lực khi `EXPO_PUBLIC_APP_ENV` được nhúng; lớp build bắt buộc biến này ở prod nên hai lớp khớp nhau.
- Chưa chạy `eas build` thật (cần tài khoản Expo, S-1): `EAS_BUILD`/`EAS_BUILD_PLATFORM` theo tài liệu Expo, chưa kiểm trên máy build.

## Tự review

Vòng 1 (bất biến 1–11, dữ liệu, cỡ PR): không đụng dữ liệu, trạng thái tệp, Rules; bất biến 8 được tăng cường (không nối nhầm emulator/cổng giả ở bản thật); bất biến 11 không ảnh hưởng. Cỡ mã dự kiến < 300 dòng.

Điểm đã sửa sau vòng 1:

1. Ban đầu chỉ chặn `EXPO_PUBLIC_BACKEND=fake`; đổi thành chặn mọi giá trị khác `firebase` (giá trị lạ không được lặng lẽ rơi về quy tắc `__DEV__`).
2. Thêm chặn `APP_ENV` lạ và lệch `EXPO_PUBLIC_APP_ENV`, nếu không lớp chạy có thể không bật.
3. Kiểm tệp Firebase chỉ trên máy build EAS và theo nền tảng đang build, để `expo config`/`prod:ios` trên máy dev không bị chặn oan.
4. Sau khi chạy `expo prebuild` thử: manifest có `SYSTEM_ALERT_WINDOW` (mẫu RN) và `READ/WRITE_EXTERNAL_STORAGE` (`expo-file-system`) dù app không dùng -> thêm `android.blockedPermissions` cùng `RECORD_AUDIO` (phòng thủ O-09). Bản debug vẫn giữ `SYSTEM_ALERT_WINDOW` qua manifest `debug/` (menu dev).
5. Đặt kiểm production trước `isTest` trong `resolveBackendMode`: gói production mà `NODE_ENV` lạ vẫn không thành cổng giả.

Tự review: đã chấp nhận.
