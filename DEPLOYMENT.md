# Triển khai Đơn Chứng

Hướng dẫn từ máy phát triển đến phát hành production trên **Google Play** và **Apple App Store**, cùng Firebase phía máy chủ.

> **Đọc trước.** Tại thời điểm viết (2026-10-27) repo là khung kỹ thuật chạy bằng cổng giả. **Đã có** `eas.json` (chưa chạy build nào) và mã Firebase thật (chưa deploy, chưa chạy trên thiết bị). **Chưa có** tệp `google-services.json`/`GoogleService-Info.plist`, ghi video thật, và build native chưa từng được chạy trên máy ảo hay thiết bị. Các bước dưới đây là quy trình chuẩn của Expo/EAS/Firebase/cửa hàng; những bước phụ thuộc phần chưa có được đánh dấu **[Chưa có]**. Lệnh và giao diện của Expo, Apple, Google thay đổi thường xuyên: đối chiếu tài liệu chính thức trước khi chạy và cập nhật lại tệp này khi bạn chạy thật (xem mục 11).

## Mục lục

1. [Điều kiện phát hành](#1-điều-kiện-phát-hành-readiness-gate)
2. [Môi trường và tài khoản](#2-môi-trường-và-tài-khoản)
3. [Chạy trên máy cục bộ (phát triển)](#3-chạy-trên-máy-cục-bộ-phát-triển)
4. [Firebase](#4-firebase)
5. [Cấu hình app trước khi build](#5-cấu-hình-app-trước-khi-build)
6. [Build bằng EAS](#6-build-bằng-eas)
7. [Phát hành Android: Google Play](#7-phát-hành-android-google-play)
8. [Phát hành iOS: App Store](#8-phát-hành-ios-app-store)
9. [Phát hành bản cập nhật](#9-phát-hành-bản-cập-nhật)
10. [Xử lý sự cố](#10-xử-lý-sự-cố)
11. [Tài liệu tham khảo và bảo trì tệp này](#11-tài-liệu-tham-khảo-và-bảo-trì-tệp-này)

---

## 1. Điều kiện phát hành (readiness gate)

Không gửi bản lên cửa hàng công khai khi còn mục nào dưới đây chưa xong.

| #   | Việc                                                                                               | Trạng thái  | Ghi chú                                                                        |
| --- | -------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
| 1   | Chốt **tên ứng dụng và định danh gói** (O-11, Q-06)                                                | Chưa        | `vn.doncung.app.dev` là chỗ giữ chỗ và **không đổi được sau khi đã phát hành** |
| 2   | Chốt **khu vực dữ liệu Firebase** (Q-08)                                                           | Chưa        | Không đổi được sau khi tạo; cần rà soát pháp lý (D-08)                         |
| 3   | Tạo dự án Firebase `dev`/`staging`/`prod`, thay cổng giả bằng Firebase thật (ADR-002, ADR-009)     | Chưa        | Hiện chỉ có Rules + Emulator                                                   |
| 4   | Chốt thư viện **ghi video, tải nền, mã băm** qua spike S1–S6 trên thiết bị thật (ADR-003, ADR-004) | Chưa        | Rủi ro kỹ thuật cao nhất                                                       |
| 5   | Bật ghi video thật (`RECORDER_ENABLED`), bỏ dải "chưa ghi video"                                   | Chưa        | Không phát hành bản quảng bá ghi bằng chứng khi chưa ghi được                  |
| 6   | Chốt **sàn phiên bản** iOS/Android (O-20)                                                          | Chưa        | Xem `docs/engineering/platform-support.md`                                     |
| 7   | Chốt **đăng nhập Apple/Google** (O-15) và OTP (O-22)                                               | Chưa        | Liên quan quy định của Apple (mục 8.3)                                         |
| 8   | URL thật cho Điều khoản và Chính sách quyền riêng tư                                               | Chưa        | `src/core/config/legal-links.ts` đang là `.invalid`                            |
| 9   | Chọn dịch vụ crash/analytics hoặc quyết định không dùng (Q-07)                                     | Chưa        | Phải lọc mã đơn/vận đơn/thông tin khách                                        |
| 10  | Chạy ma trận kiểm thử trên máy thật iOS + Android (`platform-support.md` mục 5, QA-01…14)          | Chưa        |                                                                                |
| 11  | `npm run check` và `npm run test:rules` qua trên commit phát hành                                  | Có thể chạy |                                                                                |
| 12  | Quyết định sao lưu bản gốc cục bộ (Q-09)                                                           | Chưa        |                                                                                |

## 2. Môi trường và tài khoản

### 2.1 Phần mềm trên máy phát triển

| Công cụ                                        | Dùng cho                                    | Ghi chú                                                                                            |
| ---------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Node **>= 22.13**, npm 10                      | Mọi thứ                                     | `nvm use` đọc `.nvmrc` (22)                                                                        |
| Git                                            |                                             |                                                                                                    |
| Java **21** (JDK)                              | Test Rules / Emulator; build Android cục bộ | Temurin 21 là đủ                                                                                   |
| Android Studio + Android SDK                   | Build/chạy Android cục bộ, trình giả lập    | Cài SDK Platform và Build-Tools theo `compileSdk`/`targetSdk` mà Expo SDK 58 sinh ra (xem mục 3.3) |
| Xcode (macOS) + Command Line Tools + CocoaPods | Build/chạy iOS cục bộ, trình giả lập iOS    | Chỉ chạy trên **macOS**. Dùng bản Xcode mà App Store yêu cầu tại thời điểm gửi (kiểm tra mục 8)    |
| EAS CLI                                        | Build trên đám mây, gửi cửa hàng            | `npm i -g eas-cli` hoặc `npx eas-cli`                                                              |
| Firebase CLI                                   | Triển khai Rules/Functions, Emulator        | Đã có trong `devDependencies` (`npx firebase`)                                                     |

Không có Mac: vẫn build và gửi iOS được bằng **EAS Build** (máy macOS trên đám mây), nhưng không chạy được trình giả lập iOS cục bộ.

### 2.2 Tài khoản (cần tạo trước, một số mất vài ngày để duyệt)

| Tài khoản                                      | Dùng cho                                             | Lưu ý                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Expo (EAS)**                                 | Build, gửi cửa hàng, quản lý chứng chỉ               | Có gói miễn phí giới hạn lượt build                                                                                                                                                                                                          |
| **Apple Developer Program** (trả phí theo năm) | App Store, TestFlight, chứng chỉ, Sign in with Apple | Tài khoản tổ chức cần số D-U-N-S và có thể mất vài ngày duyệt                                                                                                                                                                                |
| **Google Play Console** (phí đăng ký một lần)  | Google Play                                          | Tài khoản mới có thể phải xác minh danh tính; **tài khoản cá nhân mới tạo thường phải chạy kiểm thử kín với số người tối thiểu trong một khoảng thời gian trước khi được phát hành công khai**: kiểm tra yêu cầu hiện hành trên Play Console |
| **Firebase / Google Cloud**                    | Backend                                              | Cần gói thanh toán (Blaze) để dùng Cloud Functions; bật cảnh báo ngân sách                                                                                                                                                                   |
| **GitHub**                                     | CI, mã nguồn                                         |                                                                                                                                                                                                                                              |

## 3. Chạy trên máy cục bộ (phát triển)

Dự án dùng **dev build, không dùng Expo Go**, vì cần module native (camera, SQLite, sau này là Firebase và ghi/tải video). Thư mục `ios/` và `android/` được **sinh ra** bởi `expo prebuild` và đã nằm trong `.gitignore`.

### 3.1 Cài đặt

```bash
git clone https://github.com/steve-bang/goihangnhanh.git
cd goihangnhanh
nvm use
npm ci
npm run check          # xác nhận môi trường sạch (79 suite, 1651 test ở thời điểm viết)
```

### 3.2 Kiểm tra nhanh không cần SDK native

```bash
npx expo export --platform ios --output-dir /tmp/export-ios
npx expo export --platform android --output-dir /tmp/export-android
```

Lệnh này đóng gói JS bằng Metro để bắt lỗi bundle. Nó **không** chứng minh app chạy được trên máy.

Xem giao diện bằng cổng giả (bản không phải dev cần cờ):

```bash
EXPO_PUBLIC_USE_FAKE_BACKEND=1 EXPO_PUBLIC_FAKE_SESSION=signed_out npx expo export --platform web
```

(Ở bản dev, cổng giả bật sẵn và phiên mặc định là `signed_in`.) Xem các giá trị `EXPO_PUBLIC_FAKE_SESSION` ở `README.md`.

### 3.3 Chạy trên Android (trình giả lập hoặc điện thoại)

1. Cài Android Studio, mở **Device Manager** tạo một máy ảo (hoặc bật _USB debugging_ trên điện thoại và cắm cáp). Đặt biến môi trường `ANDROID_HOME` trỏ tới Android SDK và thêm `platform-tools` vào `PATH`.
2. Kiểm tra thiết bị: `adb devices`.
3. Sinh dự án native và build dev:

```bash
npx expo prebuild --platform android --no-install   # sinh android/ (đã bị .gitignore)
npx expo run:android                                # build, cài và mở app
```

4. Lần sau chỉ cần chạy Metro: `npm start` (script là `expo start --dev-client`), rồi mở app dev đã cài.

Camera trên **trình giả lập** chỉ là ảnh giả; để kiểm tra quét mã và quay thật phải dùng điện thoại thật.

### 3.4 Chạy trên iOS (chỉ macOS)

```bash
sudo xcode-select -s /Applications/Xcode.app
npx expo prebuild --platform ios --no-install       # sinh ios/ và chạy pod install
npx expo run:ios                                    # chọn trình giả lập, hoặc --device cho iPhone thật
```

Chạy trên **iPhone thật** cần ký mã: mở `ios/*.xcworkspace` bằng Xcode, chọn _Team_ ở _Signing & Capabilities_ (tài khoản Apple miễn phí đủ để thử trên máy của bạn, có giới hạn). Trình giả lập iOS không có camera thật.

### 3.5 Dev build bằng EAS (khi không có SDK native tại máy, hoặc build cho cả đội)

```bash
npx eas-cli login
npx eas-cli build --profile development --platform android      # APK cài trực tiếp
npx eas-cli build --profile development --platform ios --simulator   # bản cho trình giả lập iOS
# iPhone thật: cần đăng ký thiết bị trước:  npx eas-cli device:create
npm start
```

Hồ sơ `development` được định nghĩa ở mục 6.1 **[Chưa có]**.

### 3.6 Khi `ios/` hoặc `android/` bị lỗi lạ

Vì các thư mục này là kết quả sinh ra, cách sửa sạch nhất là xóa và sinh lại:

```bash
npx expo prebuild --clean
```

Mọi cấu hình native phải nằm trong `app.json` / config plugin, **không sửa tay** trong `ios/` hay `android/` (sẽ mất khi sinh lại). Nếu một thư viện buộc phải sửa native tùy biến, ghi vào ADR-001 và cân nhắc commit thư mục native (chuyển sang bare).

### 3.7 Firebase Emulator (cục bộ)

Project id giả `demo-doncung`, không chạm Firebase thật:

```bash
npm run test:rules                                  # chạy test Rules trong Emulator, rồi tự tắt
npx firebase emulators:start --config firebase/firebase.json --project demo-doncung   # giữ Emulator chạy (UI: http://localhost:4000)
```

Cổng: Auth 9099, Firestore 8080, Storage 9199, UI 4000. Lần đầu sẽ tải Emulator; cần Java 21 và truy cập mạng.

Chưa có mã app nào kết nối Emulator **[Chưa có]**: khi tích hợp `@react-native-firebase`, thêm cấu hình trỏ tới máy chủ Emulator. Trình giả lập Android truy cập máy chủ qua `10.0.2.2`, không phải `localhost`.

## 4. Firebase

Chỉ làm sau khi chốt khu vực (Q-08) và có Firebase thật trong app (điều kiện 2–3).

### 4.1 Tạo ba dự án

`doncung-dev`, `doncung-staging`, `doncung-prod` (tên tham khảo, ADR-009). Chọn **cùng một khu vực dữ liệu** đã chốt cho Firestore, Storage và Functions; không đổi được sau này.

Bật: Authentication (Email/Password; Apple/Google khi chốt O-15), Firestore, Storage, Cloud Functions (gói Blaze), App Check (Play Integrity cho Android, App Attest/DeviceCheck cho iOS).

### 4.2 Liên kết CLI với từng môi trường

Tạo `.firebaserc` ở thư mục gốc **[Chưa có]** (mẫu):

```json
{
  "projects": { "dev": "doncung-dev", "staging": "doncung-staging", "prod": "doncung-prod" }
}
```

### 4.3 Triển khai Rules và chỉ mục

Test Rules phải qua trước khi triển khai:

```bash
npm run test:rules
npx firebase deploy --config firebase/firebase.json --project staging --only firestore:rules,firestore:indexes,storage
# sau khi staging đạt:
npx firebase deploy --config firebase/firebase.json --project prod --only firestore:rules,firestore:indexes,storage
```

Rules là lớp bảo vệ thật (cô lập theo shop, bất biến #8): **không bao giờ** triển khai Rules chưa qua `npm run test:rules`. Client bị từ chối ghi vào Storage hoàn toàn theo thiết kế (ADR-006, chờ duyệt); xác nhận cách tải lên thật trước khi phát hành.

### 4.4 Cloud Functions

`firebase/functions/` chưa có mã **[Chưa có]**. Khi thêm: tạo `package.json` riêng, thêm khối `"functions"` vào `firebase/firebase.json`, thêm Functions vào Emulator của `test:rules`/CI, rồi `npx firebase deploy --only functions --project <env>`. Callable `createShop` là chức năng đầu tiên dự kiến (decisions Q-14).

### 4.5 Tệp cấu hình Firebase cho app

Với mỗi môi trường, tải từ Firebase Console:

- Android: `google-services.json` (đăng ký app với **applicationId** trùng `android.package`; thêm vân tay SHA-1/SHA-256 của khóa ký, gồm cả khóa ký Google Play, mục 7.4)
- iOS: `GoogleService-Info.plist` (đăng ký với `bundleIdentifier`)

Hai tệp **không commit** (đã nằm trong `.gitignore`; không phải bí mật cho phép truy cập dữ liệu nhưng vẫn không đưa vào repo, ADR-009). Nạp lúc build bằng EAS file secret:

```bash
npx eas-cli env:create --environment production --name GOOGLE_SERVICES_JSON --type file --visibility secret --value ./secrets/prod/google-services.json
npx eas-cli env:create --environment production --name GOOGLE_SERVICE_INFO_PLIST --type file --visibility secret --value ./secrets/prod/GoogleService-Info.plist
```

rồi tham chiếu trong cấu hình động (mục 5.2). Tên và cờ lệnh `eas env:*` thay đổi giữa các phiên bản EAS CLI: kiểm tra `eas env:create --help`.

## 5. Cấu hình app trước khi build

### 5.1 Định danh, phiên bản, quyền

Trong `app.json` hiện có:

- `ios.bundleIdentifier` / `android.package` = `vn.doncung.app.dev` (**giữ chỗ**; đặt giá trị chính thức trước bản build gửi cửa hàng đầu tiên). `app.config.js` bỏ hậu tố `.dev` khi `APP_ENV=prod` (hoặc bí danh `production`): profile `production` của `eas.json` ra `vn.doncung.app`
- `version` = `0.0.0`
- Quyền camera có chuỗi mô tả tiếng Việt; micro **tắt** (`microphonePermission: false`, `recordAudioAndroid: false`)
- `android.allowBackup: false` (Q-24d): video, CSDL và phiên đăng nhập không vào Android Auto Backup; đổi máy phải đăng nhập lại. Phần iOS (loại khỏi iCloud Backup) làm ở V1-12: module Expo cục bộ `modules/backup-exclusion` (Swift, tự liên kết, chỉ có ở bản build native, không có trong Expo Go)
- `android.blockedPermissions`: gỡ `RECORD_AUDIO` (O-09, phòng thủ thêm), `SYSTEM_ALERT_WINDOW` (mẫu RN thêm vào, app không cần; bản debug vẫn giữ trong manifest `debug/`), `READ/WRITE_EXTERNAL_STORAGE` (`expo-file-system` thêm; app chỉ ghi trong thư mục riêng của app)
- `ios.config.usesNonExemptEncryption: false` -> `ITSAppUsesNonExemptEncryption = false` (app chỉ dùng HTTPS của hệ điều hành và SHA-256 để băm, không mã hóa riêng; thêm mã hóa riêng thì phải xem lại khai báo xuất khẩu)

Cần cập nhật khi chuẩn bị phát hành:

- `version` (chuỗi hiển thị với người dùng, ví dụ `1.0.0`).
- `ios.buildNumber` và `android.versionCode` (số nguyên tăng dần cho mỗi bản gửi). Cách dễ nhất: để EAS tự tăng với `"appVersionSource": "remote"` và `"autoIncrement": true` (mục 6.1).
- **Micro:** nếu bản có quay video kèm tiếng, phải bật quyền micro và viết lại chuỗi mô tả quyền. Quyết định này ảnh hưởng đến khai báo quyền riêng tư của cả hai cửa hàng.
- Mỗi thư viện native thêm sau này (ghi video, tải nền, Firebase) có thể thêm quyền; kiểm tra lại `AndroidManifest.xml` và `Info.plist` sinh ra bằng `expo prebuild` trên bản sao.
- Icon/splash: `assets/images/` đang là **tạm**. Cửa hàng yêu cầu icon 1024×1024 không trong suốt (App Store) và 512×512 (Google Play).
- Thay `LEGAL_LINKS` (`src/core/config/legal-links.ts`) bằng URL thật.
- `userInterfaceStyle` đang `light`; chế độ tối chưa làm (O-17).

### 5.2 Cấu hình động cho Firebase **[Đã có `app.config.js`]**

`app.config.js` (ở gốc repo) đã đọc đường dẫn tệp từ `GOOGLE_SERVICES_JSON` và `GOOGLE_SERVICE_INFO_PLIST` (hoặc `GOOGLE_SERVICES_INFO_PLIST`), nếu không có thì dùng tệp cùng tên ở gốc repo; không có tệp thì không gắn. Mẫu `app.config.ts` dưới đây là phương án ban đầu, chỉ để tham khảo:

Đổi `app.json` thành `app.config.ts` để đọc đường dẫn tệp từ biến môi trường của EAS (mẫu):

```ts
import type { ExpoConfig } from 'expo/config';
import base from './app.json';

const config: ExpoConfig = {
  ...base.expo,
  ios: { ...base.expo.ios, googleServicesFile: process.env.GOOGLE_SERVICE_INFO_PLIST },
  android: { ...base.expo.android, googleServicesFile: process.env.GOOGLE_SERVICES_JSON },
};
export default config;
```

Plugin của `@react-native-firebase/*` sẽ được thêm vào `plugins` khi tích hợp. Phải qua lint/typecheck và chạy `expo prebuild` thử trên bản sao ngoài repo để xác nhận cấu hình hợp lệ.

### 5.3 Biến môi trường

Biến `EXPO_PUBLIC_*` được **nhúng vào gói JS và ai cũng đọc được**. Tuyệt đối không đặt bí mật trong đó.

| Biến                           | Ý nghĩa                                                                                                                                   | Giá trị theo profile `eas.json`                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `APP_ENV`                      | Chọn mã app (`.dev` hay không) và thư mục `firebase/config/<env>/`. Nhận `dev`, `prod`, bí danh `production`; giá trị khác làm build dừng | `development`/`staging`: `dev`; `production`: `prod`                      |
| `EXPO_PUBLIC_APP_ENV`          | Nhúng vào gói JS: `prod`/`production` thì app **luôn** dùng Firebase thật, bỏ qua mọi cờ cổng giả và emulator (`src/api/create-api.ts`)   | `development`/`staging`: `dev`; `production`: `prod`                      |
| `EXPO_PUBLIC_BACKEND`          | `firebase` \| `fake` (ép chọn backend)                                                                                                    | `staging`, `production`: `firebase`                                       |
| `EXPO_PUBLIC_RECORDER_ENABLED` | `1` bật ghi video thật (ADR-020)                                                                                                          | chỉ `staging` (cổng thiết bị); `production` bật ở V1-21 sau cổng thiết bị |

**Chốt chặn bản production (V1-01), hai lớp:**

1. **Lúc build:** `app.config.js` gọi `validateReleaseEnv` (`scripts/env/validate-release-env.cjs`). Khi `APP_ENV` là `prod`/`production`, mọi lệnh đọc cấu hình (`npx expo config`, `expo prebuild`, `eas build`) **dừng với lỗi** nếu: thiếu `EXPO_PUBLIC_APP_ENV=prod`; có `EXPO_PUBLIC_USE_FAKE_BACKEND` (mọi giá trị); `EXPO_PUBLIC_BACKEND` khác `firebase`; có `EXPO_PUBLIC_FAKE_SESSION`; có `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`; trên máy build EAS (`EAS_BUILD=true`) thiếu tệp cấu hình Firebase của nền tảng đang build. Bản production **không** lấy tệp ở gốc repo (nơi đặt tệp dev): chỉ đường dẫn qua `GOOGLE_SERVICE_INFO_PLIST`/`GOOGLE_SERVICES_INFO_PLIST`/`GOOGLE_SERVICES_JSON` (EAS file secret) hoặc `firebase/config/prod/`; tệp tìm thấy phải có `BUNDLE_ID` (plist) và `package_name` (json) đúng mã app production (`vn.doncung.app`), lệch thì build dừng. Ngược lại, `EXPO_PUBLIC_APP_ENV=prod` mà `APP_ENV` không phải prod cũng bị từ chối (gói JS và mã app lệch môi trường). Kiểm cả biến đặt trên trang EAS (environment `production`), không chỉ `eas.json`.
2. **Lúc chạy:** gói JS có `EXPO_PUBLIC_APP_ENV=prod` thì `resolveBackendMode` trả Firebase trước mọi cờ, không nối emulator; thiếu tệp cấu hình thì "chưa kết nối", không rơi về cổng giả.

Tự kiểm trên máy dev (không cần tài khoản EAS):

```bash
APP_ENV=prod EXPO_PUBLIC_APP_ENV=prod npx expo config --type public | grep -E 'bundleIdentifier|package'   # vn.doncung.app
APP_ENV=prod EXPO_PUBLIC_APP_ENV=prod EXPO_PUBLIC_BACKEND=fake npx expo config                              # phải lỗi
```

## 6. Build bằng EAS

### 6.1 Khởi tạo và `eas.json` **[Đã có `eas.json`, chưa chạy build]**

`eas.json` ở gốc repo có 4 profile, mỗi profile đặt `env` (bảng mục 5.3): `development` (dev client; Android APK, iOS thiết bị thật; `APP_ENV=dev`), `development-simulator` (iOS simulator), `staging` (APK nội bộ, EAS environment `preview`, Firebase dev, mã app `.dev`, **bật ghi video** cho cổng thiết bị), `production` (AAB, tự tăng số bản, `APP_ENV=prod`, mã app không `.dev`, Firebase production, chưa bật ghi video). Khối `submit.production` có Android `track: internal`, `releaseStatus: draft` và iOS `ascAppId` **giữ chỗ** (`<ID app trên App Store Connect>`): `eas submit` iOS báo lỗi cho tới khi điền ID thật (release-checklist S-6). Bước còn lại là `eas init` (liên kết dự án với tài khoản Expo) và tạo EAS file secret cho hai tệp Firebase (mục 4.5; tên biến `GOOGLE_SERVICE_INFO_PLIST` hoặc `GOOGLE_SERVICES_INFO_PLIST`, `GOOGLE_SERVICES_JSON`): bản `production` trên máy build EAS **dừng** nếu thiếu tệp. Với dev client, JS do Metro trên máy bạn đóng gói nên chọn Firebase thật bằng `EXPO_PUBLIC_BACKEND=firebase npm start`; với `staging`/`production`, JS đóng gói lúc build theo `env` của profile.

```bash
npx eas-cli login
npx eas-cli init                 # liên kết dự án với tài khoản Expo, ghi projectId vào cấu hình
# Không chạy `eas-cli build:configure`: eas.json đã có trong repo, nguồn duy nhất của cấu hình profile.
```

Cấu hình profile xem trực tiếp `eas.json` (không chép mẫu vào đây để khỏi lệch).

Lưu ý: Google Play chỉ nhận **AAB** (`app-bundle`) cho app mới; APK dùng để cài thử trực tiếp. Nếu `staging` dùng bundle id khác bản production (để cài song song), tách bằng biến môi trường trong `app.config.js` (hôm nay `staging` dùng `APP_ENV=dev` nên mang `.dev`, cài song song được với bản production).

### 6.2 Chạy kiểm tra trước khi build

```bash
git checkout main && git pull
npm ci
npm run check
npm run test:rules
```

Không build production từ cây làm việc có thay đổi chưa commit.

### 6.3 Build

```bash
npx eas-cli build --platform android --profile production
npx eas-cli build --platform ios --profile production
# hoặc cả hai: --platform all
```

Lần đầu EAS hỏi để tạo và lưu thông tin ký: keystore Android và chứng chỉ phân phối + provisioning profile iOS (đăng nhập tài khoản Apple Developer khi được hỏi). Kết quả (AAB/IPA) tải ở trang build trên expo.dev.

## 7. Phát hành Android: Google Play

### 7.1 Chuẩn bị Play Console (một lần)

1. Tạo tài khoản Play Console, hoàn tất xác minh danh tính.
2. **Create app**: tên, ngôn ngữ mặc định (Tiếng Việt), loại App, miễn phí/trả phí (không đổi được từ miễn phí sang trả phí).
3. Điền mục **App content** (bắt buộc trước khi phát hành): Chính sách quyền riêng tư (URL), Ads, App access (nếu có đăng nhập, cung cấp tài khoản thử cho người duyệt), Content rating, Target audience, **Data safety**, và các khai báo khác Play yêu cầu (ví dụ quyền camera/video).
4. **Store listing**: mô tả ngắn/dài, icon 512×512, ảnh chụp màn hình điện thoại, ảnh đại diện (feature graphic).
5. Mô tả trung thực (bất biến #11): không viết "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại.

**Data safety** phải khớp thực tế: app thu thập video/ảnh, mã đơn, dữ liệu tài khoản, gửi lên Firebase, và có thể có crash/analytics. Khai báo sai có thể khiến bản bị gỡ.

### 7.2 Khóa ký: dùng Play App Signing

Trong Play Console bật **Play App Signing** (mặc định với app mới). Khóa tải lên (upload key) do EAS quản lý; Google giữ khóa ký phân phối. **Sao lưu thông tin khóa ký** của EAS: `npx eas-cli credentials` → Android → xuất/tải keystore và cất ở nơi an toàn ngoài repo. Mất upload key vẫn khôi phục được qua hỗ trợ Google, nhưng mất thời gian.

### 7.3 Lần tải lên đầu tiên: làm thủ công

API của Google Play **không** cho tạo bản phát hành đầu tiên của app mới. Vì vậy:

1. Tải AAB từ trang build EAS.
2. Play Console → **Testing → Internal testing → Create new release** → tải AAB lên → lưu và phát hành cho nhóm thử nội bộ (thêm email người thử).
3. Cài thử từ liên kết thử nội bộ; chạy ma trận kiểm thử (điều kiện 10).

### 7.4 Tài khoản dịch vụ để tự động gửi (từ bản thứ hai)

1. Google Cloud Console → tạo **service account**, tạo khóa JSON (cất ngoài repo, mẫu `service-account*.json` đã nằm trong `.gitignore`).
2. Play Console → **Users and permissions** → mời email service account, cấp quyền phát hành cho app.
3. Tải khóa lên EAS: `npx eas-cli credentials` → Android → Google Service Account Key for Play Store Submissions.
4. Gửi:

```bash
npx eas-cli submit --platform android --profile production --latest
```

(`track` và `releaseStatus` lấy từ `eas.json`; bản đầu để `internal` + `draft`.)

Nếu dùng Firebase, nhớ thêm **SHA-1/SHA-256 của khóa ký Google Play** (Play Console → App integrity → App signing) vào ứng dụng Android trong Firebase Console, cần cho đăng nhập Google và Play Integrity (App Check).

### 7.5 Lên production

1. Internal testing đạt → (tuỳ yêu cầu của tài khoản) **Closed testing** → **Production**.
2. Production → **Create new release** → chọn bản đã kiểm thử → ghi chú phát hành → tỷ lệ triển khai (khuyến nghị bắt đầu 5–20%, tăng dần theo crash/ANR) → **Review and publish**.
3. Thời gian duyệt khác nhau (vài giờ đến vài ngày); app/tài khoản mới thường lâu hơn.
4. **Yêu cầu `targetSdk`:** Google Play yêu cầu app nhắm đến API level tối thiểu thay đổi hằng năm. Expo SDK 58 / RN 0.88 dùng `targetSdk` 36 (theo `platform-support.md`); xác nhận với yêu cầu hiện hành trong Play Console trước khi gửi.

## 8. Phát hành iOS: App Store

### 8.1 Chuẩn bị Apple (một lần)

1. Đăng ký **Apple Developer Program**; chấp nhận các thỏa thuận mới trong App Store Connect (thiếu thỏa thuận là lỗi hay gặp khi gửi).
2. Tạo **App ID/Bundle ID** chính thức (EAS có thể tạo khi build lần đầu). Bật các capability cần dùng (Sign in with Apple nếu có).
3. App Store Connect → **Apps → New App**: nền tảng iOS, tên, ngôn ngữ chính, bundle ID, SKU. Ghi lại **Apple ID của app** (số) để đặt vào `ascAppId` trong `eas.json`.
4. Tạo khóa **App Store Connect API Key** (Users and Access → Integrations) để EAS Submit không phải đăng nhập tay và không vướng xác thực hai lớp. Tải `.p8` (chỉ tải được một lần) cất ngoài repo; nạp vào EAS qua `npx eas-cli credentials` hoặc khi `eas submit` hỏi.

### 8.2 Hồ sơ cửa hàng và quyền riêng tư

- Ảnh chụp màn hình theo kích thước thiết bị mà App Store Connect yêu cầu hiện hành; mô tả, từ khóa, URL hỗ trợ, URL chính sách quyền riêng tư.
- **App Privacy ("nhãn dinh dưỡng")**: khai báo dữ liệu thu thập (video/ảnh, định danh, dữ liệu liên hệ…) và mục đích. Phải khớp với app và Firebase/SDK bên thứ ba dùng.
- Chuỗi mô tả quyền (`NSCameraUsageDescription` do plugin `expo-camera` sinh ra từ `app.json`) phải nói đúng cho người dùng và phải khớp với tính năng thực tế. Nếu bật micro, bổ sung chuỗi quyền micro.
- Thông tin **App Review**: tài khoản thử và ghi chú cho người duyệt (cách quét mã/quay, nếu cần mã đơn mẫu). Tài khoản demo phải dùng được.
- Mô tả trung thực (bất biến #11).

### 8.3 Quy định của Apple cần kiểm tra trước khi gửi

Xác minh theo App Review Guidelines hiện hành, vì phụ thuộc quyết định chưa chốt:

- **Đăng nhập bên thứ ba:** app đang có nút Apple và Google (cờ `SOCIAL_SIGN_IN_FLAGS`). Nếu có đăng nhập bằng dịch vụ bên thứ ba (Google), Apple có yêu cầu về cung cấp tùy chọn đăng nhập tương đương (thường là Sign in with Apple hoặc lựa chọn bảo vệ quyền riêng tư tương đương). Chốt O-15 rồi đối chiếu.
- **Xóa tài khoản:** app cho tạo tài khoản thì Apple yêu cầu có cách **xóa tài khoản ngay trong app**. Phải xử lý cùng chính sách giữ bằng chứng khi tranh chấp (bất biến #9, docs/06): cần quyết định nghiệp vụ trước, **[Chưa có]**.
- **Thanh toán gói dịch vụ:** nội dung số bán trong app thường phải dùng thanh toán trong ứng dụng của Apple/Google (O-16, chưa kết luận). Không thêm thanh toán khi chưa chốt.
- **Phiên bản Xcode/SDK:** App Store chỉ nhận bản build bằng SDK iOS tối thiểu theo quy định từng năm. EAS Build dùng image phù hợp với Expo SDK; xác nhận với yêu cầu hiện hành.
- **Quản lý dữ liệu người dùng và camera:** chỉ xin quyền khi bắt đầu tác vụ (UI-A05).

### 8.4 Build, gửi và TestFlight

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production --latest
```

`eas submit` tải IPA lên App Store Connect. Sau vài phút đến vài chục phút bản build xuất hiện trong **TestFlight** (Apple xử lý và quét tự động trước).

1. Điền thông tin xuất khẩu/mã hóa nếu được hỏi (app dùng HTTPS tiêu chuẩn thường khai báo ngoại lệ; bạn có thể thêm `ios.config.usesNonExemptEncryption: false` vào `app.json` nếu đúng thực tế để khỏi bị hỏi mỗi lần).
2. **Internal testing** (thành viên App Store Connect) không cần duyệt; **External testing** cần Beta App Review lần đầu.
3. Chạy ma trận kiểm thử trên iPhone thật qua TestFlight.

### 8.5 Gửi duyệt và phát hành

1. App Store Connect → trang phiên bản → chọn bản build từ TestFlight → hoàn tất hồ sơ → **Add for Review → Submit**.
2. Chọn cách phát hành: tự động sau khi duyệt, thủ công, hoặc theo ngày. Khuyến nghị **phát hành theo giai đoạn** (phased release 7 ngày) với bản cập nhật.
3. Nếu bị từ chối (Rejection), đọc lý do ở Resolution Center, sửa và gửi lại; không cần tăng `version`, nhưng cần build mới (tăng `buildNumber`) nếu đổi mã.

## 9. Phát hành bản cập nhật

1. Sửa mã, `npm run check` + `npm run test:rules`, merge vào `main` (CI chạy khi mở PR).
2. Tăng `version` nếu có thay đổi người dùng thấy được (`buildNumber`/`versionCode` do EAS tự tăng nếu cấu hình mục 6.1).
3. Build và gửi như mục 7–8. Thông báo phát hành viết cho người bán: ngắn, không hứa quá.
4. Đánh thẻ Git cho bản phát hành: `git tag v1.0.0 && git push origin v1.0.0`.
5. **Thay đổi Rules/Functions** triển khai riêng bằng Firebase CLI (mục 4) và phải tương thích ngược với các bản app còn lưu hành: người bán không cập nhật ngay.
6. **Cập nhật chỉ JS (EAS Update / OTA)** chưa được cấu hình **[Chưa có]**. Nếu dùng: chỉ cập nhật mã JS tương thích với binary đã phát hành (không đổi native, không đổi quyền), và vẫn phải tuân thủ chính sách của Apple/Google. Không dùng OTA để thay đổi hành vi cốt lõi sau khi đã qua duyệt.

Không bao giờ xóa hoặc đổi nghĩa dữ liệu bằng chứng cục bộ qua migration mà không có kiểm thử (bất biến #3, #4): bản gốc chưa tải lên phải sống sót qua nâng cấp app (QA-02, QA-04).

## 10. Xử lý sự cố

| Triệu chứng                                                  | Hướng xử lý                                                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `npm ci` cảnh báo `EBADENGINE` từ `@firebase/storage-compat` | Đã biết (ADR-010): chỉ ảnh hưởng gói dùng cho test Rules, test vẫn chạy                            |
| `Cannot find module 'node:sqlite'` khi test                  | Node < 22.13: `nvm use`                                                                            |
| `npx expo install` lỗi mạng tới `api.expo.dev`               | Môi trường hạn chế mạng (ADR-013); dùng mạng khác hoặc cài đúng phiên bản theo `package.json`      |
| `test:rules` không chạy                                      | Cần Java 21 và tải được Emulator lần đầu; kiểm tra `java -version`                                 |
| Build Android lỗi SDK/`ANDROID_HOME`                         | Cài Android SDK qua Android Studio; đặt `ANDROID_HOME`; chấp nhận license: `sdkmanager --licenses` |
| `pod install` lỗi                                            | `cd ios && pod repo update && pod install`; kiểm tra CocoaPods/Ruby; `npx expo prebuild --clean`   |
| App dev không kết nối Metro                                  | Cùng mạng Wi-Fi; Android thật: `adb reverse tcp:8081 tcp:8081`; đảm bảo dùng `--dev-client`        |
| Native lỗi sau khi đổi `app.json` hoặc thêm plugin           | `npx expo prebuild --clean` rồi build lại                                                          |
| EAS: lỗi chứng chỉ/provisioning iOS                          | `npx eas-cli credentials` → xem hoặc tạo lại; kiểm tra tài khoản Apple Developer còn hạn           |
| Play từ chối: sai `versionCode`                              | `versionCode` phải lớn hơn mọi bản đã tải lên; dùng `autoIncrement`                                |
| Play từ chối: Data safety không khớp                         | Khai báo lại theo thực tế dữ liệu và SDK                                                           |
| Apple từ chối: thiếu xóa tài khoản / đăng nhập bên thứ ba    | Xem mục 8.3                                                                                        |
| Đăng nhập Google lỗi trên bản Play                           | Thêm SHA-1/SHA-256 của khóa ký Google Play vào Firebase                                            |

## 11. Tài liệu tham khảo và bảo trì tệp này

Tài liệu chính thức (nguồn đúng nhất khi có khác biệt với tệp này):

- Expo: [EAS Build](https://docs.expo.dev/build/introduction/), [EAS Submit](https://docs.expo.dev/submit/introduction/), [Development builds](https://docs.expo.dev/develop/development-builds/introduction/), [Prebuild / CNG](https://docs.expo.dev/workflow/continuous-native-generation/), [Biến môi trường EAS](https://docs.expo.dev/eas/environment-variables/)
- React Native Firebase: <https://rnfirebase.io>; Firebase CLI: <https://firebase.google.com/docs/cli>
- Google Play Console: <https://support.google.com/googleplay/android-developer>
- Apple: [App Store Connect](https://developer.apple.com/help/app-store-connect/), [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

Trong repo: `docs/engineering/platform-support.md` (sàn phiên bản, ma trận thiết bị), `docs/engineering/decisions.md` (ADR-001, 002, 009; Q-06, Q-08, Q-09), `docs/engineering/testing.md`, `docs/08-acceptance-qa-risks.md` (điều kiện bàn giao).

**Khi bạn chạy thật một bước ở đây** (dev build đầu tiên, build EAS đầu tiên, lần gửi đầu): sửa tệp này theo kết quả thực tế, bỏ nhãn **[Chưa có]** tương ứng và cập nhật phần "Trạng thái dự án" trong `CLAUDE.md`. Tệp này chưa được kiểm chứng bằng một lần phát hành thật.
