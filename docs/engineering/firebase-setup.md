# Firebase: thiết lập, chạy thử và deploy

Hướng dẫn nối app với Firebase thật (dự án dev `ghn-test-67b39`, vùng Singapore `asia-southeast1`, Q-08).
Quyết định kỹ thuật và giới hạn: [decisions.md Q-19](decisions.md). Kiến trúc lớp API: [architecture.md mục 3](architecture.md).

**Trạng thái (cập nhật khi thay đổi):** mã đã viết và qua test trên emulator; **chưa deploy lên dự án dev, chưa build native, chưa chạy trên thiết bị** (spike S4/S6 chưa làm). Các bước dưới đây chưa được chạy thật trên dự án dev; khi chạy, ghi lại chỗ lệch vào tài liệu này.

## 1. Tổng quan

```
app (src/features/*) → hợp đồng ApiClient (src/api/contract)
                          ├─ src/api/firebase   ← nơi DUY NHẤT gọi SDK Firebase
                          ├─ src/api/fake       (dev/test)
                          └─ src/api/unavailable (thiếu cấu hình: lỗi trung thực)
Phía máy chủ (chỉ Firebase): firebase/functions (createShop, updateShop), firebase/firestore.rules
```

| Chức năng | Cách làm |
|---|---|
| Đăng ký, đăng nhập email + mật khẩu | Firebase Auth |
| Tạo/sửa shop | Cloud Function callable `createShop` / `updateShop` (client không tự ghi `shops`, `members`) |
| Biết tài khoản đã có shop chưa | Tài liệu `userShops/{uid}` (Function ghi, chủ tài khoản chỉ đọc) |
| Khôi phục phiên khi mở app | `onAuthStateChanged` + `userShops` từ bộ nhớ đệm, không chờ mạng |
| Quên mật khẩu (OTP), Apple/Google | **Chưa làm** (O-22, O-15): trả `AUTH_SERVICE_UNAVAILABLE` |

Chọn backend lúc chạy (`src/api/create-api.ts`):

| Điều kiện | Backend |
|---|---|
| `EXPO_PUBLIC_APP_ENV=prod` (hoặc `production`; bản production, V1-01) | Firebase, **bỏ qua mọi dòng dưới** và không nối emulator; thiếu cấu hình → "chưa kết nối" |
| Chạy test | giả |
| `EXPO_PUBLIC_USE_FAKE_BACKEND=1` hoặc `EXPO_PUBLIC_BACKEND=fake` | giả |
| `EXPO_PUBLIC_BACKEND=firebase` hoặc có `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` | Firebase |
| `__DEV__` (không đặt cờ nào) | giả |
| Bản build thường | Firebase; thiếu tệp cấu hình hoặc SDK không khởi tạo được → "chưa kết nối" |

## 2. Tạo dự án Firebase (làm một lần)

Trên https://console.firebase.google.com:

1. **Create a project**, đặt mã dự án (hiện tại `ghn-test-67b39`; không đổi được sau khi tạo). Google Analytics có thể tắt.
2. **Gói Blaze** (Upgrade ở góc dưới cột trái): bắt buộc cho Cloud Functions. Nên đặt cảnh báo ngân sách.
3. **Authentication → Get started → Sign-in method:** bật **Email/Password** (không bật "Email link").
4. **Authentication → Settings → User actions:** tắt **Email enumeration protection** cho dự án dev. Thông báo "email đã dùng" (Q-13 g2) cần Firebase trả đúng `auth/email-already-in-use`; nếu để bật, lỗi này có thể không bao giờ được trả về.
5. **Firestore Database → Create database:** chọn **Standard edition**, vị trí **`asia-southeast1`** (không đổi được), **Production mode** (Rules của repo ghi đè khi deploy).
6. **Project settings → General → Your apps → Add app:** đăng ký hai app.

   | Nền tảng | Mã | Tệp tải về |
   |---|---|---|
   | iOS | Bundle ID `vn.doncung.app.dev` | `GoogleService-Info.plist` |
   | Android | Package `vn.doncung.app.dev` | `google-services.json` |

Giá trị `vn.doncung.app.dev` lấy từ `app.json`; đổi ở một nơi thì phải đăng ký lại app tương ứng.

## 3. Tệp cấu hình app (không commit)

Hai tệp ở mục 2.6 chứa khóa API phía client (không phải bí mật tuyệt đối) nhưng **không commit** (ADR-009; đã có trong `.gitignore`). Cách đưa vào build (`app.config.js`):

- Đặt ở **gốc repo** với đúng tên `GoogleService-Info.plist`, `google-services.json`; hoặc
- Trỏ bằng biến môi trường `GOOGLE_SERVICES_INFO_PLIST`, `GOOGLE_SERVICES_JSON` (với EAS: tạo **file secret** rồi dùng đường dẫn mà EAS cấp).

Không có tệp thì `expo export`, test và bản giả vẫn chạy; bản build thật thiếu tệp sẽ rơi về "chưa kết nối" (không báo thành công giả). Riêng bản `production` build trên EAS (`APP_ENV=prod`, `EAS_BUILD=true`) thiếu tệp của nền tảng đang build thì **build dừng**; `APP_ENV=prod` kèm bất kỳ cờ cổng giả/emulator nào cũng dừng (`scripts/env/validate-release-env.cjs`, `DEPLOYMENT.md` mục 5.3).

**Không bao giờ** đưa vào repo, chat hay log: mật khẩu tài khoản Google, tệp service account (`private_key`), token của `firebase login`.

## 4. Chạy thử cục bộ bằng Emulator (không đụng dịch vụ thật)

Cần Java 21 và đã cài phụ thuộc: `npm ci && npm --prefix firebase/functions ci`.

**Chỉ test tự động (không cần thiết bị):**

```bash
npm run test:rules   # Rules + logic Function trên Firestore/Storage Emulator
npm test             # unit test, gồm hợp đồng API với SDK mô phỏng
```

**Chạy app với emulator** *(chưa thử trên thiết bị)*:

```bash
npm --prefix firebase/functions run build
npx firebase emulators:start --config firebase/firebase.json --project ghn-test-67b39 \
  --only auth,firestore,functions
EXPO_PUBLIC_BACKEND=firebase EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=10.0.2.2 npm start
```

- Host emulator: Android emulator `10.0.2.2`; iOS simulator `localhost`; máy thật dùng IP LAN của máy chạy emulator.
- Chạy emulator với `--project ghn-test-67b39` (không dùng `demo-doncung`) để trùng mã dự án trong tệp cấu hình app. Emulator không gọi dịch vụ thật.
- Cần dev build có tệp cấu hình Firebase (mục 3); không chạy được trong Expo Go.

**Một lệnh mở máy ảo + chạy theo môi trường (macOS)** *(chưa thử trên máy)*: `scripts/dev-emulator.sh`, môi trường ở `scripts/env/*.env`, tệp Firebase theo môi trường ở `firebase/config/<env>/` (xem `firebase/config/README.md`).

| Lệnh | Việc |
|---|---|
| `npm run dev:ios` / `dev:android` | Mở máy ảo, nối Firebase thật của dự án **dev**, chạy dev client (chưa cài thì build bằng `expo run:*`) |
| `npm run prod:ios` / `prod:android` | Như trên nhưng nối Firebase **prod** (cần điền `FIREBASE_PROJECT_ID` và đặt tệp cấu hình prod) |
| `npm run fake:ios` / `fake:android` | Cổng giả trong Expo Go, không Firebase |

Firebase thật cần dev client nên không chạy trong Expo Go; build native iOS vẫn bị chặn với Xcode 16.4 (CLAUDE.md).

## 5. Deploy lên dự án dev

Chạy ở gốc repo, trên máy của người có quyền với dự án.

```bash
git pull
npm ci
npm --prefix firebase/functions ci
npx firebase login                      # máy không có trình duyệt: thêm --no-localhost
npx firebase projects:list              # phải thấy ghn-test-67b39

npx firebase deploy --config firebase/firebase.json --project ghn-test-67b39 \
  --only functions,firestore:rules,firestore:indexes
```

- **Phải có `--project`:** `.firebaserc` nằm trong `firebase/` nên bí danh `dev` không tự nhận ra từ gốc repo.
- **Trước khi deploy `storage`/bật tải lên bản gốc: bật Object Versioning (hoặc retention policy) cho bucket bằng chứng** (`gcloud storage buckets update gs://<bucket> --versioning`; cân nhắc thêm quy tắc vòng đời để giới hạn chi phí các phiên bản cũ). Header tạo-một-lần (`x-goog-if-generation-match: 0`) là lớp chắn chính chống ghi đè bản gốc; `verifyEvidence` chỉ PHÁT HIỆN sau sự việc và không phục hồi được. Versioning giữ lại bản bị ghi đè (Q-23i, bất biến 4).
- **Không deploy `storage`** lúc này: Storage chưa bật, và bản gốc video sẽ tải lên qua Function ở giai đoạn sau (ADR-006).
- `predeploy` tự chạy `npm run build` trong `firebase/functions`.
- Lần đầu CLI có thể hỏi bật các API (Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc): trả lời `y`; nếu dừng giữa chừng, đợi vài phút rồi chạy lại. Nếu hỏi chính sách xóa ảnh build, đặt một số ngày ngắn để tránh phí lưu trữ.

**Lưu ý khi deploy (R2b, Q-28):** Rules mới thêm `shops/{shopId}/returns/{returnId}` và hình dạng bằng chứng hàng hoàn (`ownerKind: 'return'`); `createUploadSession` ghi thêm `ownerKind`/`returnId` vào kiểm toán và kiểm hồ sơ neo tồn tại. Chưa deploy; deploy Rules và Functions CÙNG LÚC (app bản mới đăng bản neo trước khi khai báo bằng chứng, nên Rules cũ sẽ từ chối).

**Kiểm tra sau deploy:**

1. Terminal liệt kê `createShop` và `updateShop` ở `asia-southeast1`.
2. Console → Functions: hai hàm, runtime Node.js 22. Console → Firestore → Rules: có khối `userShops/{uid}`.
3. Gọi không đăng nhập phải bị từ chối:
   ```bash
   curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"data":{"name":"Thử","sellingSources":[]}}' \
     https://asia-southeast1-ghn-test-67b39.cloudfunctions.net/createShop
   ```
   Kết quả đúng là `UNAUTHENTICATED`. `404` nghĩa là chưa deploy hoặc sai vùng.

## 6. Kiểm chứng trên thiết bị (chưa làm)

Làm sau khi deploy và có dev build (EAS hoặc `expo prebuild` + Xcode/Android Studio) trên **cả iOS và Android**:

1. Đăng ký email mới → tạo shop → vào Tổng quan; kiểm tra Console có người dùng, `shops/{id}`, `members/{uid}`, `userShops/{uid}`, `auditEvents`.
2. Tắt hẳn app và mở lại → Splash vào thẳng Tổng quan (không về Chào mừng).
3. Đăng ký lại cùng email → thông báo "email đã dùng" (cần mục 2.4); sai mật khẩu → "sai thông tin".
4. Bật chế độ máy bay rồi mở app (đã từng đăng nhập) → xem có vào được không. **Giới hạn đã biết:** nếu `userShops` chưa có trong bộ nhớ đệm và đang offline, `restore` lỗi và Splash đưa về Chào mừng (Q-19 e).
5. Bấm tạo shop hai lần liên tiếp/ngắt mạng giữa chừng → chỉ có một shop (idempotent).
6. Ghi lại phiên bản máy/hệ điều hành và kết quả vào [platform-support.md](platform-support.md) và cập nhật "Trạng thái" ở đầu tài liệu này.

## 7. Lỗi thường gặp

| Triệu chứng | Cách xử lý |
|---|---|
| `Failed to get Firebase project` | Sai tài khoản/không có quyền: `npx firebase login:list`, đăng xuất rồi đăng nhập đúng tài khoản |
| `Your project must be on the Blaze plan` | Nâng gói ở Console |
| Lỗi quyền Cloud Build ở lần deploy đầu | Đợi vài phút sau khi bật API, chạy lại cùng lệnh |
| `xcodebuild`: `firebase-ios-sdk ... contains incompatible tools version (6.2.0)` | `@react-native-firebase` 27 dùng firebase-ios-sdk 13.1.1 (Swift tools 6.2): cần **Xcode 26.2 trở lên** (kiểm tra `xcodebuild -version`). Không nâng được Xcode thì build iOS bằng EAS (image Xcode mới) hoặc hạ `@react-native-firebase` xuống ≤ 24.1.1 (firebase-ios-sdk 12.10, còn CocoaPods) — hướng hạ phiên bản chưa kiểm chứng với Expo 58 / RN 0.88 |
| `pod install`: `SPM + static linkage is not supported` | `@react-native-firebase` 27 dùng Swift Package nên iOS phải dùng `useFrameworks: "dynamic"` (đã đặt trong `app.json`, plugin `expo-build-properties`); sau khi đổi chạy lại `npx expo prebuild --platform ios --clean` |
| Lỗi build TypeScript ở predeploy | `npm --prefix firebase/functions run build` để xem lỗi; kiểm tra đã `npm --prefix firebase/functions ci` |
| App báo "Hệ thống đang bận" ngay khi mở | Thiếu tệp cấu hình Firebase (rơi về "chưa kết nối") hoặc SDK chưa khởi tạo được; kiểm tra mục 3 và log dev |
| `npm run typecheck` hoặc `test:rules` báo không thấy `firebase-admin` | Chưa chạy `npm --prefix firebase/functions ci` |
| Gọi Function từ app lỗi `NOT_FOUND` | Sai vùng: app dùng `asia-southeast1` (`src/api/firebase/client.ts`), phải khớp `REGION` trong `firebase/functions/src/index.ts` |

## 8. Đổi backend sau này

Phía app: thêm `src/api/<backend>/` hiện thực `ApiClient`, cho chạy qua `src/api/contract-tests/api.contract.ts`, rồi thêm chế độ ở `create-api.ts`. Feature và màn hình không đổi (ESLint chặn feature import hiện thực). **Phía máy chủ** (`firebase/` ở gốc repo: Rules, Functions, chỉ mục) là phần của hiện thực Firebase và phải làm lại riêng cho backend mới.

## 9. Việc còn lại

Triển khai khôi phục mật khẩu qua OTP (D-14, chờ chọn nhà cung cấp email), đăng nhập Apple/Google (O-15), App Check (ADR-009), môi trường staging/prod, đồng bộ đơn/phiên lên Firestore thay `LOCAL_SHOP_ID` (Q-17d), Storage và tải lên nền. Spike S4 (RNFirebase trên Expo 58/RN 0.88) và S6 (ghi chờ khi offline) quyết định ADR-002.
