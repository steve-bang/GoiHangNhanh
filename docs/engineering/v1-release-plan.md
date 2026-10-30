# Kế hoạch tổng phát hành v1.0 (Google Play + App Store)

> **Đề xuất kỹ thuật, 2026-10-30.** Viết trên nhánh `claude/v1-release-plan` tách từ `main` `42f6a3c`. Các quyết định ở mục 1.2 do **agent điều phối chốt thay người dùng** theo ủy quyền mà điều phối báo lại; **chưa có xác nhận trực tiếp của người dùng** trong phiên này, nên mọi chỗ ghi "đã chốt" ở đây nghĩa là "điều phối chốt", không phải D-xx. Câu chữ tiếng Việt mới và mã lỗi mới vẫn cần BA/khách rà (mục 6.2).
>
> Tài liệu này **thay thế thứ tự thực hiện** ở [release-hardening-plan.md](release-hardening-plan.md) mục 2 (PR1…PR9 vẫn là nguồn phân tích nguyên nhân gốc; bảng đối chiếu ở mục 3.1). Checklist cho con người: [release-checklist.md](release-checklist.md). Thay đổi theo PR ghi ở [`CHANGELOG.md`](../../CHANGELOG.md).

## Mục lục

1. [Phạm vi v1 và quyết định](#1-phạm-vi-v1-và-quyết-định)
2. [Hiện trạng đã xác minh bằng mã](#2-hiện-trạng-đã-xác-minh-bằng-mã-main-42f6a3c)
3. [Danh sách PR](#3-danh-sách-pr)
4. [Chụp ảnh màn hình cho PR khi không có thiết bị](#4-chụp-ảnh-màn-hình-cho-pr-khi-không-có-thiết-bị)
5. [Quy ước CHANGELOG](#5-quy-ước-changelog)
6. [Định nghĩa "xong" cho v1](#6-định-nghĩa-xong-cho-v1)
7. [Tự review kế hoạch](#7-tự-review-kế-hoạch)

---

## 1. Phạm vi v1 và quyết định

### 1.1 Có / không có trong v1

| Có trong v1 | Không có trong v1 (nói rõ trong sản phẩm khi người dùng có thể tưởng là có) |
|---|---|
| Đăng ký/đăng nhập **email + mật khẩu**; quên mật khẩu bằng **email đặt lại của Firebase Auth** | Apple/Google (ẩn), số điện thoại, OTP tự xây (D-14 hoãn) |
| Một tài khoản = một cửa hàng = **một thiết bị** (Q-24a A); dữ liệu nằm trên máy này, máy chủ giữ bản đã tải lên | Kéo dữ liệu xuống máy mới/cài lại, nhiều người cùng shop, xem video từ máy chủ, thành viên/vai trò (O-03, O-07) |
| Đơn hàng: quét/nhập tay, tạo nhanh, danh sách, chi tiết, sửa khi chưa có phiên | Sửa sản phẩm sau khi đã quay (QA-13 chỉ đạt một phần, mục 7) |
| **Quay video đóng gói thật** (bật `EXPO_PUBLIC_RECORDER_ENABLED=1` ở bản production **chỉ sau cổng thiết bị**), không thu tiếng (O-09) | Video có tiếng, quyền micro; quay theo lô (UI-B05 vẫn khung, không có lối vào) |
| Hàng hoàn R1/R2a/R2b (ảnh, video mở kiện), Tranh chấp cục bộ, chia sẻ văn bản tóm tắt | Đồng bộ nội dung hồ sơ hoàn/tranh chấp lên máy chủ (Q-26c, Q-27e), gói xuất tệp (O-08) |
| Tải lên khi app mở, đối soát, xác minh mã băm phía máy chủ; mất mạng không tốn lượt; "Chỉ tải khi có Wi‑Fi" (Q-24c B) | Tải nền khi app đã bị đóng (không hứa, bất biến 11) |
| Trung tâm đồng bộ thật + Thử lại; Trang chủ số liệu thật; Thông báo là trạng thái rỗng trung thực | Thông báo đẩy, dữ liệu minh họa ở bất kỳ màn nào của bản production |
| **Xem lại video/ảnh đã ghi trên chính máy** (phát tệp cục bộ, `expo-video`) | Xem trên máy khác |
| **Xóa tài khoản thật trong app** (Function, xác thực lại, xóa hẳn dữ liệu cửa hàng trên máy chủ sau 30 ngày, kể cả nhật ký kiểm toán của cửa hàng; chỉ giữ bản ghi tối thiểu `accountDeletions`) | Khôi phục tài khoản đã xóa |
| Loại video/CSDL khỏi iCloud Backup/Android Auto Backup (Q-24d A) | Sao lưu/chuyển dữ liệu chưa tải sang máy mới |
| Báo lỗi ứng dụng (Crashlytics) có che PII, tắt được | Analytics hành vi |
| Miễn phí, **ẩn Gói dịch vụ**, không mua trong app (O-06, O-16) | Gói, thanh toán, thời hạn lưu theo gói, tự động xóa khi hết hạn |
| Chính sách quyền riêng tư, điều khoản, trang hỗ trợ, trang yêu cầu xóa tài khoản trên web `web/` | |

### 1.2 Quyết định (điều phối chốt thay người dùng, 2026-10-30)

| Mã | Quyết định | Hệ quả kỹ thuật | PR |
|---|---|---|---|
| Q-24a | **A.** Một thiết bị/một tài khoản; nói rõ trong Trợ giúp, Cá nhân, thẻ thông tin ở Trang chủ; cảnh báo khi đăng xuất/xóa tài khoản. Kéo xuống nhiều máy và URL xem video từ máy chủ để sau v1. **Xem lại video trên chính máy: đưa vào v1** (đánh giá ở mục 3, V1-17) | Không có Function URL đọc; không đọc Firestore về SQLite | V1-10, V1-17, V1-18 |
| Q-24b | **A.** Giữ nguyên; ghi giới hạn "video đang ghi có thể mất nếu app bị tắt giữa chừng" trong UI màn quay (một dòng) và Trợ giúp | Không chia đoạn; `recording` bị kill vẫn `unrecoverable` | V1-11, V1-18 |
| Q-24c | **B.** Mặc định luôn tải (cả 4G/5G), công tắc "Chỉ tải khi có Wi‑Fi". Trần: ảnh ≤ 25 MB, video ≤ 2 GB cho **mọi** bằng chứng (thống nhất Q-28b) trong Rules + Function, có test | Migration v15 (cài đặt máy) | V1-04, V1-09 |
| Q-24d | **A.** Loại video bằng chứng và CSDL khỏi iCloud Backup/Android Auto Backup; ghi vào chính sách quyền riêng tư | Android `allowBackup: false`; iOS module cục bộ đặt `isExcludedFromBackup` | V1-01, V1-12, V1-19 |
| Q-24e | **B.** Giữ slogan màn Chào mừng; điều kiện phát hành: đường tải lên đã kiểm chứng trên thiết bị | Mục cổng thiết bị G-3 | release-checklist |
| Q-24f | **A.** `@react-native-community/netinfo` **12.0.1** (đúng bản `bundledNativeModules.json` của Expo SDK 58 trong `node_modules/expo`, cũng là bản mới nhất trên npm ngày 2026-10-30) và `expo-keep-awake` **~58.0.3** (cùng nguồn), sau adapter `src/platform/` | `npx expo install` bị proxy chặn (ADR-013): cài bằng `npm install <gói>@<bản trong bundledNativeModules>` | V1-02, V1-11 |
| Q-24g | **A (một máy một tài khoản) + lọc theo `created_by` như Q-23g:** tệp do uid khác tạo không tải hộ, báo rõ | Nguồn tải bằng chứng đóng gói lọc theo `packing_sessions.created_by` (không cần migration) | V1-07 |
| Q-24h | **A.** Lỗi mạng không tính lượt (backoff, trần 15 phút); lỗi máy chủ từ chối tối đa 8 lần rồi "cần xử lý", có nút Thử lại | Thêm sự kiện người dùng `needs_attention -> queued` có điều kiện (mục 7, điểm R-3) | V1-02, V1-08 |
| O-09 | Không thu tiếng, không xin quyền micro | Giữ `microphonePermission: false`, `recordAudioAndroid: false`; V1-01 kiểm tra manifest sinh ra không có `RECORD_AUDIO` | V1-01 |
| O-15 | Chỉ email + mật khẩu. Ẩn nút Apple/Google bằng **cờ cấu hình sẵn có** `SOCIAL_SIGN_IN_FLAGS` (`src/core/config/feature-flags.ts:13-16`) đặt `false`. Ba màn đã dựng sẵn nhánh `providers.length > 0` (`WelcomeScreen.tsx:123`, `SignInScreen.tsx:250`, `SignUpScreen.tsx:311`) nên **không sửa tệp màn đã khách xác nhận**. **Lệch có chủ đích:** màn Chào mừng/Đăng nhập/Đăng ký mất khối nút mạng xã hội so với ảnh đã duyệt | Không cần duyệt Sign in with Apple (Guideline 4.8 không áp dụng khi không có đăng nhập bên thứ ba) | V1-03 |
| D-14 | v1 dùng `sendPasswordResetEmail` của Firebase Auth; OTP tự xây để sau. Nối vào luồng hiện có: màn Quên mật khẩu (UI-A07) giữ nguyên giao diện, chỉ đổi **đích điều hướng** sau khi gửi thành công sang màn mới "Kiểm tra hộp thư" (route con `/forgot-password/sent`, mã UI-A07, trong phạm vi token). UI-A08/A09 giữ mã nhưng không còn lối vào ở chế độ `email_link` (deep link chuyển về Đăng nhập). **Lệch có chủ đích:** 4 màn thành 2 màn; mật khẩu mới đặt trên trang web của Firebase | Cờ `PASSWORD_RECOVERY_MODE: 'email_link' \| 'otp'` một chỗ | V1-03 |
| Xóa tài khoản | Bắt buộc (App Store 5.1.1(v), Google Play). Thiết kế ở V1-14/V1-15 | Function `deleteAccount` + Function định kỳ `purgeDeletedShops` + nhật ký `accountDeletions` | V1-14, V1-15, V1-19 |
| O-06, O-16 | Miễn phí, ẩn Gói (như hiện tại, `account-menu.ts`), không mua trong app. Câu thời hạn lưu v1 (đề xuất, chờ khách duyệt): **"Hiện ứng dụng chưa tự động xóa bằng chứng đã tải lên và chưa áp dụng thời hạn lưu. Nếu có thay đổi, bạn sẽ được báo trước trong ứng dụng."** và **"Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng."** | Không có Function dọn theo hạn lưu; QA-10 không áp dụng cho v1 | V1-18 |
| Màn minh họa/khung | Không dữ liệu minh họa ở bản production. Bảng từng màn ở mục 2.3 | ESLint cấm import `@/shared/fixtures/illustrative-data` ngoài test | V1-08, V1-10 |
| Crash reporting | `@react-native-firebase/crashlytics` **27.1.0** (cùng bản với `app`/`auth`/`firestore`/`functions` đang dùng; `npm view` 2026-10-30: `latest` = 27.1.0), sau adapter, chỉ nhận dữ liệu đã qua bộ che PII của logger; không `setUserId`; công tắc tắt trong "Quyền riêng tư và bảo mật". Đánh giá rủi ro native ở V1-16 | Thêm plugin config; iOS đang `useFrameworks: "dynamic"` (firebase-setup.md mục 7) nên phải thử build sớm | V1-16 |
| Build/phát hành | EAS Build iOS + Android; profile `production` đặt `APP_ENV=prod` (giá trị sẵn có của `app.config.js` và `scripts/env/prod.env`; nhận thêm bí danh `production`), bundle id không `.dev`, dự án Firebase production riêng (người dùng tạo sau); **chốt chặn** cờ cổng giả ở cả lúc build lẫn lúc chạy | Store, thiết bị, deploy: checklist con người | V1-01, release-checklist |
| Tài liệu store | Chính sách quyền riêng tư, điều khoản, hỗ trợ, yêu cầu xóa tài khoản (web), khai báo Privacy Labels/Data safety, chuỗi quyền, mô tả store. URL/email thật chưa có: placeholder ở **một** chỗ cho app (`src/core/config/public-links.ts`) và một chỗ cho web (`web/src/config/site.ts`), có test đối chiếu hai chỗ khớp nhau | | V1-18, V1-19, V1-20 |

**Không tự chốt (vẫn mở, cần người/điều phối):** tên thương hiệu và bundle id chính thức (O-11; không đổi được sau lần tải đầu, giá trị giữ chỗ `vn.doncung.app`); sàn hệ điều hành (O-20; v1 dùng sàn kỹ thuật của framework/thư viện, không tự nâng); câu chữ mới (BA); rà soát pháp lý chính sách quyền riêng tư theo luật Việt Nam. Các điểm R-1…R-8 (mục 7.3) **đã được điều phối chốt ở mục 7.5**.

---

## 2. Hiện trạng đã xác minh bằng mã (`main` `42f6a3c`)

### 2.1 Gia cố đã có

| Việc | Có trong `main`? | Bằng chứng |
|---|---|---|
| **PR1** phiên Firebase có `uid`/`shopId`, đăng xuất thật | **Có** (commit `1097a3c`, PR #35) | `src/api/contract/session.ts` có `identity()`; `src/api/contract/auth.ts` có `signOut()` và `SignedInAccount.shopId`; `src/features/personal/data/firebase-personal-gateways.ts:13-55` nối `getSessionIdentity`, `getProfile`, `getShopSummary`, `signOut`; `personal-gateways.ts:31` chọn cổng này khi `mode === 'firebase'` |
| **PR3** migration v7 (index, `last_activity_device`) | **Có** (commit `89584ce`, PR #36) | `src/features/orders/data/sqlite-migrations.ts:109-117` (`idx_evidence_files_order_kind`…); test `sqlite-migration-v7.test.ts` |
| PR2 mạng thật, thử lại, timeout | **Chưa** | `src/platform/connectivity.ts:7-9` `useIsOffline()` luôn `false`; `backoff.ts:2` `MAX_UPLOAD_ATTEMPTS = 8` cho mọi lỗi |
| PR4 Trung tâm đồng bộ thật | **Chưa** | `SyncCenterScreen.tsx:46` dùng `ILLUSTRATIVE_SYNC_JOBS`; `file-state.ts:103` `RETRY_UPLOAD` chỉ từ `upload_failed` |
| PR5 keep-awake, nền | **Chưa** | `package.json` không có `expo-keep-awake` |
| PR6 trigger kiểm toán, siết Rules, APP_ENV | **Chưa** | `firebase/functions/src/index.ts` chỉ có `createShop`, `updateShop`, `verifyEvidence` (`retry: true`), `createUploadSession`; `firestore.rules:308,311` chỉ có trần dung lượng cho bằng chứng **hàng hoàn**; `eas.json` không có `env`; `app.json` mang `vn.doncung.app.dev` |
| PR7 băm | **Chưa** | `src/platform/file-hasher.ts` băm JS; `upload-queue.ts` băm lại mỗi lần thử |
| Nguồn tải lọc theo người tạo (Q-24g) | Hàng hoàn **có**, đóng gói **chưa** | `upload-sources.ts:59-80` lọc uid cho `returnMediaSource`; `evidenceFileSource` (`:29-41`) không lọc |

### 2.2 Tab Cá nhân ở chế độ Firebase: phần còn "chưa kết nối"

`firebase-personal-gateways.ts:25` trải `...unavailable.account` rồi chỉ ghi đè 4 hàm; `:53` `settings: unavailable.settings`. Vậy ở bản Firebase thật các hàm sau vẫn ném `AUTH_SERVICE_UNAVAILABLE` (`unavailable-personal-gateways.ts:65-84`):

| Hàm | Màn bị ảnh hưởng | Hướng v1 (V1-05) |
|---|---|---|
| `listShops` | Cài đặt cửa hàng (UI-I02), Xóa tài khoản (đếm shop là chủ) | Đọc `userShops/{uid}` + `shops/{id}`; server chỉ cho **một** shop/tài khoản (`shop.ts:59-67`) nên trả một phần tử |
| `updateShopName` | Sửa tên cửa hàng | Gọi `api.shop.updateShop` (Function `updateShop` đã có, `src/api/contract/shop.ts:30`) |
| `switchShop` | Chuyển cửa hàng | Giữ "chưa kết nối"; màn chỉ mời khi có ≥ 2 shop nên không có lối vào ở v1 |
| `updateProfile` | Sửa họ tên | Auth `updateProfile({ displayName })` |
| `changePassword` | Đổi mật khẩu | Auth xác thực lại bằng mật khẩu hiện tại rồi `updatePassword` |
| `getNotificationPreferences` / `update…` | Cài đặt thông báo (UI-I04) | v1 không gửi thông báo: **ẩn mục menu** (`account-menu.ts`, `availability: 'hidden'`) thay vì lưu lựa chọn không dùng tới |

Ngoài tab Cá nhân, `src/api/firebase/firebase-api.ts:68-71`: `signInWithProvider`, `requestPasswordRecovery`, `verifyRecoveryCode`, `resetPassword` đều `unavailable` (V1-03).

### 2.3 Màn minh họa/khung và lựa chọn cho v1

| Màn | Hiện trạng (mã) | Lối vào ở bản production | Chọn cho v1 | PR |
|---|---|---|---|---|
| Trang chủ UI-B01 | `HomeScreen.tsx:7-9,52,80,154-170` dùng `ILLUSTRATIVE_SHOP_NAME`, `ILLUSTRATIVE_TODAY_STATS`, dải "minh họa" | Tab đầu | **Nối thật**: tên shop từ phiên; 3 ô = số phiên đóng gói hôm nay (giờ thiết bị), số tệp đã được máy chủ nhận hôm nay, số tệp cần xử lý; bỏ dải minh họa; thêm thẻ "Dữ liệu nằm trên máy này" (Q-24a) | V1-10 |
| Trung tâm đồng bộ UI-F01 | `SyncCenterScreen.tsx:46` dữ liệu minh họa | Trang chủ (lối tắt Bằng chứng, ô Lỗi), Cá nhân, cảnh báo đăng xuất | **Nối thật** + Thử lại | V1-08 |
| Chi tiết lỗi tải UI-F02 | `upload/ui/placeholders.tsx:5` khung | Từ UI-F01 | **Nối thật** (mã lỗi thân thiện, hành động) | V1-08 |
| Dung lượng UI-F03 | `placeholders.tsx:6` khung | Không có lối vào (grep `ROUTES.storage`: 0) | **Giữ khung**, không thêm lối vào; route guard chặn deep link khi chưa đăng nhập | – |
| Thông báo UI-I07 (tab) | `shop/ui/screens.tsx:25` khung "Tính năng sắp có" | Tab Thông báo (D-16, không bỏ tab) | **Trạng thái rỗng trung thực**: "Chưa có thông báo. Ứng dụng chưa gửi thông báo; lỗi tải lên xem ở Trung tâm đồng bộ." + nút mở UI-F01 | V1-10 |
| Cài đặt thông báo UI-I04 | Màn thật, cổng Firebase "chưa kết nối" | Menu Cá nhân | **Ẩn mục menu** ở v1 | V1-05 |
| Thành viên UI-I03, Gói UI-H01…H04 | Khung/ẩn | Đã ẩn (`account-menu.ts`) | **Giữ ẩn** | – |
| Dữ liệu bằng chứng (thẻ UI-I01 + màn con) | Hiện "Chưa có số liệu" (ảnh chụp thử mục 4) | Cá nhân | **Nối thật** (trên máy / đang chờ / máy chủ đã xác nhận) | V1-10 |
| Thời hạn lưu (màn con UI-I01) | Câu "theo gói", "Chưa có thông tin" | Cá nhân | **Câu v1 trung thực** (mục 1.2) | V1-18 |
| Chi tiết bằng chứng UI-E04 | `evidence/ui/screens.tsx:4` khung | Chưa có lối vào | **Nối thật**: thông tin tệp + phát video/xem ảnh cục bộ | V1-17 |
| Đóng theo lô UI-B05, Quyền UI-A05 | Khung | Không có lối vào | **Giữ khung**, không thêm lối vào | – |
| Xóa tài khoản | Màn thật, nút luôn khóa (`DeleteAccountScreen.tsx`), điều kiện tranh chấp luôn "chưa kiểm tra được" (`delete-account-conditions.ts:54`) | Bảo mật | **Nối luồng xóa thật** + điều kiện tranh chấp từ kho tranh chấp cục bộ | V1-15 |

---

## 3. Danh sách PR

### 3.0 Quy tắc chung cho mọi PR

- Nhánh riêng `claude/v1-<số>-<tên>` tách từ `main` mới nhất; Conventional Commits; mô tả theo `.github/pull_request_template.md`; một dòng `CHANGELOG.md` (mục 5); ảnh màn hình nếu đổi giao diện (mục 4) commit vào `docs/assets/screens/v1-<số>-<tên>/` kèm `README.md` ghi "ảnh bản web, không phải thiết bị".
- Ngân sách: **≤ ~1500 dòng diff mã** (không tính test, tài liệu, `package-lock.json`, ảnh). PR vượt ngân sách khi làm thì tách, không gộp.
- Trước khi mở PR: `npm run check`; PR đụng `firebase/` thêm `npm run test:rules`; PR thêm thư viện native thêm `npx expo export --platform ios|android` và `npx expo prebuild --no-install` trên bản sao ngoài repo để kiểm `Info.plist`/`AndroidManifest.xml`.
- Màn đã khách xác nhận (`scripts/design-token-scope.cjs`) **không đổi giao diện**; chỉ được đổi logic/điều hướng và phải ghi "lệch có chủ đích" nếu người dùng thấy khác.
- Chuỗi mới qua i18n; mã lỗi mới chỉ đề xuất ở `decisions.md` Q-29 (đã tạo cùng kế hoạch này; mỗi PR bổ sung), không tự thêm vào `codes.ts` khi chưa có BA, theo tiền lệ Q-28.
- Tệp "nóng" dễ xung đột: `package.json`/`package-lock.json` (V1-02, V1-11, V1-16, V1-17), `src/core/i18n/locales/vi/*.json`, `sqlite-migrations.ts`, `firebase/functions/src/index.ts`, `firebase/firestore.rules`. PR sau rebase rồi chạy lại `npm install`/test; số migration theo thứ tự hợp nhất đã định ở đây (v15 = V1-09, v16 = V1-13).

### 3.1 Bảng tổng và đối chiếu với release-hardening-plan

| PR | Tên ngắn | Mục tiêu một dòng | Nguồn | Phụ thuộc | Song song được với | Cỡ mã |
|---|---|---|---|---|---|---|
| V1-00 | screens-tooling | Script chụp ảnh bản web ngoài repo, không đổi `package.json` | mục 4 | – | tất cả | S |
| V1-01 | env-guard | `eas.json`/`app.config.js` đúng môi trường, chặn cổng giả ở production, `allowBackup: false` | PR6 (phần EAS), Q-24d | – | tất cả trừ V1-16 (cùng `app.json`) | S |
| V1-02 | network-retry | NetInfo thật, lỗi mạng không tốn lượt, timeout, không treo hàng đợi | PR2, Q-24f/h | – | V1-00/01/03/04/11/12/19/20 | M |
| V1-03 | auth-email-reset | Quên mật khẩu bằng email Firebase, ẩn Apple/Google | O-15, D-14 | – | V1-00/01/02/04/11/12/19/20 | S-M |
| V1-04 | server-audit-rules | Trigger kiểm toán, siết Rules + trần dung lượng mọi bằng chứng, sửa Function | PR6, Q-24c | – | mọi PR không đụng `firebase/` | M |
| V1-05 | personal-firebase | Đổi mật khẩu, họ tên, danh sách/đổi tên shop thật; ẩn Cài đặt thông báo | Q-20t | V1-03 | V1-06, V1-07, V1-14, V1-17 | M |
| V1-06 | session-guard | Chặn route khi chưa đăng nhập; không tạo đơn khi chưa biết shop thật | release-hardening mục 6 | – (hợp nhất sau V1-02 nếu dùng `useIsOffline`) | V1-05, V1-07 | S-M |
| V1-07 | uploader-identity | Không tải hộ tệp do tài khoản khác tạo trên máy | Q-24g | V1-02 (hợp nhất sau) | V1-05, V1-06 | S |
| V1-08 | sync-center | UI-F01/F02 dữ liệu thật, Thử lại, "Cần xử lý" thử lại được có điều kiện | PR4, Q-24h | V1-02, V1-07 | V1-15, V1-17 | M-L |
| V1-09 | wifi-only | Công tắc "Chỉ tải khi có Wi‑Fi" (migration v15, bảng `device_settings`) | Q-24c | V1-02, V1-08 | V1-14…V1-20 | S-M |
| V1-10 | home-real-data | Trang chủ, thẻ Dữ liệu bằng chứng thật, Thông báo rỗng trung thực, cấm dữ liệu minh họa | mục 2.3, Q-24a | V1-08, V1-09 | V1-13…V1-20 | M |
| V1-11 | recording-hardening | Giữ màn hình sáng, xử lý vào nền khi quay, câu giới hạn Q-24b | PR5, Q-24b | – | làn A | S-M |
| V1-12 | backup-exclusion-ios | Module Expo cục bộ đặt `isExcludedFromBackup` cho `evidence/` và CSDL | Q-24d | – (bổ sung cho V1-01, khác tệp) | làn A | S (native) |
| V1-13 | hash-efficiency | Băm nhường luồng JS, không băm lại tệp không đổi (migration v16) | PR7 bước 2 | V1-02, V1-09 | V1-14…V1-20 | S-M |
| V1-14 | account-delete-server | Function `deleteAccount` + `purgeDeletedShops` + nhật ký | xóa tài khoản | V1-04 | V1-05…V1-13 | M |
| V1-15 | account-delete-client | Luồng xóa trong app, xóa dữ liệu cục bộ sau khi máy chủ xác nhận | xóa tài khoản | V1-05, V1-14 | V1-16, V1-17 | M |
| V1-16 | crashlytics | Báo lỗi ứng dụng sau adapter, che PII, có công tắc (lưu ở `device_settings`) | Q-07 | V1-01, V1-09 | V1-14, V1-15, V1-17 | S-M (native) |
| V1-17 | local-playback | UI-E04 thật: phát video/xem ảnh từ tệp trên máy | Q-24a | – (sau V1-16 về lockfile) | V1-14, V1-15 | M (native) |
| V1-18 | content-help-legal | Trợ giúp, câu thời hạn lưu, chuỗi quyền, `public-links.ts` một chỗ | Q-24a/b, store | V1-03, V1-11 (i18n) | V1-19, V1-20 | S-M |
| V1-19 | web-legal-pages | Trang web quyền riêng tư, điều khoản, hỗ trợ, yêu cầu xóa tài khoản | store | – | tất cả | S (web) |
| V1-20 | store-listing-docs | Mô tả store, Privacy Labels, Data safety, ghi chú duyệt (chỉ tài liệu) | store | – | tất cả | tài liệu |
| — | **Cổng thiết bị** (con người) | Build `staging` EAS, QA-01…14 iOS + Android | release-checklist G | V1-00…V1-20 | – | – |
| V1-21 | release-1.0.0 | Phiên bản 1.0.0, bật ghi video ở production, CHANGELOG `[1.0.0]` | – | cổng thiết bị đạt | – | S |

PR8 (chia đoạn video) và PR9 (kéo xuống) của release-hardening-plan **không làm ở v1** (Q-24a A, Q-24b A). PR7 bước 1 (đo) và module băm native chỉ làm nếu cổng thiết bị cho thấy V1-13 chưa đủ (mục 7, R-5).

### 3.2 Thứ tự và làn song song

```
Làn A (bắt đầu ngay, khác tệp):  V1-00  V1-01  V1-02  V1-03  V1-04  V1-11  V1-12  V1-19  V1-20
Làn B (sau phụ thuộc):           V1-05 (sau 03)   V1-06   V1-07 (sau 02)   V1-14 (sau 04)   V1-17
Làn C:                           V1-08 (sau 02, 07)        V1-15 (sau 05, 14)
Làn D:                           V1-09 (sau 08)
Làn D2:                          V1-16 (sau 01, 09)
Làn E:                           V1-10 (sau 08, 09)        V1-13 (sau 02, 09)        V1-18 (sau 03, 11)
Build staging EAS -> CỔNG THIẾT BỊ (QA-01…14, iOS + Android) -> PR sửa lỗi nếu có -> V1-21 -> build production
```

Thứ tự hợp nhất thư viện native để tránh xung đột lockfile: V1-02 (NetInfo) -> V1-11 (keep-awake) -> V1-16 (Crashlytics) -> V1-17 (expo-video). V1-12 không đổi `package.json` (module cục bộ tự liên kết).

### 3.3 Chi tiết từng PR

Mỗi PR liệt kê: **Mục tiêu · Tệp chính · Thư viện · Migration · Rules/Functions · Test · Ảnh · Rủi ro · Phụ thuộc**.

#### V1-00 screens-tooling
- **Mục tiêu:** một lệnh chụp ảnh bản web cổng giả cho PR, dựa trên quy trình đã chạy được (mục 4), không đổi phụ thuộc của repo.
- **Tệp:** `scripts/screens/capture.cjs` (sao cây làm việc hoặc `git archive <ref>` ra thư mục làm việc ngoài repo, chép `node_modules`, `npm i --no-save react-native-web@~0.21.4 @expo/metro-runtime@~58.0.15`, `expo export --platform web` cho từng phiên giả, máy chủ tĩnh Node nội bộ, gọi `shoot.cjs`), `scripts/screens/shoot.cjs` (Playwright ngoài repo, danh sách route + cỡ `390x844` mặc định hoặc `all` = 320x568/360x800/390x844, hệ số 2, ghi lỗi trang), `scripts/screens/README.md`; thêm dòng vào mục "Lệnh" của `CLAUDE.md` (điều phối duyệt). *Đã làm (2026-10-30): dùng Node `.cjs` thay `capture.sh` để qua lint/test; xem [plans/v1-00-screens-tooling.md](plans/v1-00-screens-tooling.md).*
- **Thư viện:** không thêm vào repo. **Migration/Rules:** không.
- **Test:** chạy thật một lần, đính ảnh màn Trang chủ/Cá nhân/Đồng bộ vào PR. **Ảnh:** 3 ảnh đó (làm mốc "trước" cho V1-08/V1-10).
- **Rủi ro:** Playwright/Chromium toàn cục có thể không có ở môi trường khác: script báo lỗi rõ, README ghi cách cài. **Phụ thuộc:** không.

#### V1-01 env-guard
- **Mục tiêu:** bản production không bao giờ chạy cổng giả, không mang bundle id `.dev`, không lẫn Firebase dev; không vào backup Android.
- **Tệp:** `eas.json` (thêm `env` cho từng profile: `development`/`development-simulator` `APP_ENV=dev`; `staging` `APP_ENV=dev`, `EXPO_PUBLIC_BACKEND=firebase`, `EXPO_PUBLIC_RECORDER_ENABLED=1` để QA thiết bị; `production` `APP_ENV=prod`, `EXPO_PUBLIC_APP_ENV=prod`, `EXPO_PUBLIC_BACKEND=firebase`, **không** bật ghi video cho tới V1-21; khối `submit.production` với `track: internal`, `releaseStatus: draft`, `ascAppId` giữ chỗ), `app.config.js` (hàm thuần `validateReleaseEnv(env)` tách ra `scripts/env/validate-release-env.cjs`: khi `APP_ENV` là `prod`/`production` thì ném lỗi nếu có `EXPO_PUBLIC_USE_FAKE_BACKEND`, `EXPO_PUBLIC_BACKEND=fake`, `EXPO_PUBLIC_FAKE_SESSION`, `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`; ném lỗi nếu thiếu tệp cấu hình Firebase ở bản build EAS production), `src/api/create-api.ts` (`resolveBackendMode`: `EXPO_PUBLIC_APP_ENV=prod` luôn trả `firebase`, bỏ qua cờ giả và emulator; phòng thủ lớp hai), `app.json` (`android.allowBackup: false`; `ios.config.usesNonExemptEncryption: false`), `DEPLOYMENT.md` mục 5–6.
- **Thư viện:** không. **Migration/Rules:** không.
- **Test:** project `tooling` của Jest: `validateReleaseEnv` (mọi tổ hợp cờ); `create-api.test.ts` thêm ca `prod` + cờ giả -> `firebase`; chạy `APP_ENV=prod npx expo config --type public` trên bản sao để in bundle id; `npx expo prebuild --no-install` trên bản sao: kiểm `AndroidManifest.xml` có `allowBackup="false"`, không `RECORD_AUDIO`, không quyền ngoài dự kiến (ghi danh sách quyền vào mô tả PR).
- **Ảnh:** không (không đổi giao diện).
- **Rủi ro:** `allowBackup: false` cũng bỏ backup của phiên Auth Android: sau khi đổi máy phải đăng nhập lại (chấp nhận, khớp Q-24a). Tên biến `GOOGLE_SERVICE_INFO_PLIST` có hai cách viết (`app.config.js:3`): giữ cả hai. **Phụ thuộc:** không.

#### V1-02 network-retry
- **Mục tiêu:** mất mạng 30 phút không làm tệp nào thành "cần xử lý"; không lệnh nào treo hàng đợi.
- **Tệp:** `src/platform/connectivity.ts` (NetInfo: `useIsOffline`, `getConnectivity()` đồng bộ trả `{ online, type: 'wifi' | 'cellular' | 'other' | 'none' }`, `subscribeConnectivity`), `src/platform/index.ts`, `src/test-utils/mock-connectivity.ts`, `src/features/upload/domain/{upload-queue,backoff,create-upload-gateway}.ts` (phân loại lỗi `network` không tăng `attemptCount`, trễ theo backoff có trần 15 phút; lỗi máy chủ từ chối vẫn đếm, 8 lần -> `needs_attention`; `withTimeout` 30 giây cho khai báo/xin phiên tải; bước gửi tệp không đặt timeout cứng mà hủy lượt khi NetInfo báo mất mạng), `src/features/upload/data/{UploadRunner.tsx,firebase-ports.ts}`, `src/platform/resumable-upload.ts` (412 -> thử lại để đối soát), `OrderSyncRunner`/`ReturnSyncRunner` (dùng cùng nguồn mạng; bằng chứng chỉ khai báo khi đơn/phiên hoặc neo hồ sơ đã đăng), `decisions.md` Q-29 (bổ sung mã lỗi đề xuất: `UPLOAD_WAITING_NETWORK`, `UPLOAD_INTERRUPTED`, `UPLOAD_EXCEPTION` cho BA).
- **Thư viện:** `@react-native-community/netinfo@12.0.1`.
- **Migration/Rules:** không.
- **Test:** `upload-queue.test.ts` (offline không tăng lượt; 50 lỗi mạng liên tiếp vẫn `upload_failed`; 8 lỗi 4xx -> `needs_attention`; lệnh treo -> hết giờ, `running` hạ); `backoff.test.ts` (trần 15 phút); `firebase-ports.test.ts` (phân loại mã Firebase `unavailable`/`deadline-exceeded`/`permission-denied` do phụ thuộc chưa đăng); hook mạng với NetInfo giả; `file-state.test.ts` không đổi.
- **Ảnh:** không (giao diện không đổi; banner ngoại tuyến UI-F04 đã có sẵn sẽ hiện: chụp nếu có thể giả lập bằng tham số tạm trong bản sao).
- **Rủi ro:** NetInfo báo "có mạng" nhưng không ra Internet: vẫn dựa vào lỗi thật, và lỗi đó không tốn lượt; `permission-denied` có thể là từ chối thật (sai Rules) bị coi là chờ phụ thuộc: chỉ coi là chờ khi nguồn báo đơn/phiên chưa đăng, còn lại đếm lượt. **Phụ thuộc:** không.

#### V1-03 auth-email-reset
- **Mục tiêu:** quên mật khẩu chạy thật ở bản Firebase; không còn nút đăng nhập không hoạt động.
- **Tệp:** `src/core/config/feature-flags.ts` (`SOCIAL_SIGN_IN_FLAGS` = `false` cả hai; thêm `PASSWORD_RECOVERY_MODE = 'email_link'`), `src/api/firebase/{ops,firebase-api}.ts` (`requestPasswordRecovery` -> `sendPasswordResetEmail`, đặt `languageCode = 'vi'`; lỗi `auth/invalid-email` -> mã sẵn có, `auth/too-many-requests` -> `AUTH_TOO_MANY_REQUESTS`, `auth/user-not-found` nuốt để trung tính), `src/api/fake/fake-api.ts` (chế độ email), `ForgotPasswordScreen.tsx` (**chỉ** đổi `navigation.push(ROUTES.verifyOtp)` ở dòng 103 thành chọn đích theo cờ; không đổi hiển thị), màn mới `features/shop/ui/RecoveryEmailSentScreen.tsx` + route `src/app/forgot-password/sent.tsx` hoặc tương đương (trong phạm vi token: "Kiểm tra hộp thư", email đã che một phần, nút Mở lại Đăng nhập, Gửi lại có đếm ngược theo `retryAfterSeconds` sẵn có, câu "Không thấy thư? Xem mục Thư rác."), chặn deep link `verify-otp`/`new-password` khi chế độ `email_link`, `routes.ts`, `layout.md`, `decisions.md` Q-14 (ghi lệch có chủ đích).
- **Thư viện:** không (Auth đã có). **Migration/Rules:** không.
- **Test:** `ops.test.ts`/`firebase-api.test.ts` với `FirebaseOps` giả (trung tính, ánh xạ lỗi); contract test `requestPasswordRecovery`; màn Quên mật khẩu điều hướng đúng theo cờ; màn mới (đếm ngược, không lộ email đầy đủ); Chào mừng/Đăng nhập/Đăng ký không còn nút xã hội (test cấu trúc hiện có cập nhật kỳ vọng); `check:tokens` (màn mới dùng token).
- **Ảnh:** Chào mừng, Đăng nhập, Đăng ký (sau khi ẩn nút: bằng chứng "lệch có chủ đích"), Quên mật khẩu, Kiểm tra hộp thư (3 cỡ).
- **Rủi ro:** thư Firebase mặc định có thể vào Thư rác, mẫu thư tiếng Anh nếu chưa chỉnh trong Console (checklist F-6); trang đặt mật khẩu mới là trang của Firebase (giao diện không theo thương hiệu). **Phụ thuộc:** không.

#### V1-04 server-audit-rules
- **Mục tiêu:** thực thi bất biến 7 phía máy chủ; giảm bề mặt ghi tùy ý; trần dung lượng cho mọi bằng chứng.
- **Tệp:** `firebase/functions/src/audit.ts` (mới: `onDocumentWritten` cho `shops/{s}/orders/{o}`, `.../sessions/{x}`, `.../evidence/{e}`, `.../returns/{r}`; id sự kiện cố định từ `(đường dẫn, updateTime)` để idempotent; chỉ tên trường đổi và `before/after` của trường không nhạy cảm; không ghi mã đơn/mã vận đơn vào log Function), `index.ts`, `shop.ts` (`updateShop` dùng `ID_PATTERN`), `uploads.ts` (`createUploadSession` kiểm `evidence.createdBy == uid` và `sizeBytes` trong trần), `index.ts` `verifyEvidence` (thay `retry: true` vô hạn bằng: lỗi tạm ném để thử lại, lỗi bền (đối tượng không còn, kích thước vượt trần) ghi kiểm toán rồi kết thúc, có trần theo tuổi sự kiện), `firebase/firestore.rules` (kiểu/độ dài `orderCode`, `trackingCode*`, `note`, `lastError`, `interruptions`; `sizeBytes` ảnh ≤ 25 000 000, video ≤ 2 000 000 000 cho bằng chứng đóng gói như hàng hoàn); **không** chặn tạo bằng chứng theo trạng thái phiên: phiên được đăng với trạng thái mới nhất (`order-sync.ts:108`, `remote-order-writer.ts:51-56`), nên luồng quay -> xác nhận -> tải sau thường có phiên `confirmed` trên máy chủ TRƯỚC khi bằng chứng được khai báo. Ràng buộc chỉ dựa trên điều không phụ thuộc thứ tự đồng bộ: phiên tồn tại cùng shop, `createdBy == auth.uid`; không thêm điều kiện trạng thái phiên và **không so giờ thiết bị với giờ máy chủ** (`capturedAtDevice` chỉ là thông tin, bất biến 11; đồng hồ máy chạy nhanh không được làm bằng chứng bị từ chối). Test emulator bắt buộc: `capturedAtDevice` sau `request.time` vẫn qua), `firebase/firestore.indexes.json` nếu truy vấn mới cần.
- **Thư viện:** không. **Migration:** không.
- **Test (`firebase/tests/rules`, `npm run test:rules`):** mỗi cập nhật tạo đúng một `auditEvents`, chạy lại không nhân đôi; client không ghi/xóa `auditEvents` (`assertFails`); kiểu/độ dài sai bị từ chối; trần dung lượng: 25 000 000 qua, 25 000 001 bị từ chối (ảnh), tương tự video; **bắt buộc:** phiên đăng ở `confirmed` trước, bằng chứng khai báo sau vẫn qua (`assertSucceeds`), và tương tự với phiên `ended`/`interrupted`; bằng chứng cho phiên không tồn tại hoặc phiên của shop khác bị từ chối; truy cập chéo shop ở mọi luật mới (QA-11); `verifyEvidence` lỗi bền không thử lại vô hạn.
- **Ảnh:** không.
- **Rủi ro:** chi phí: mỗi thay đổi thêm một lần ghi Firestore + một lần gọi Function (ước tính và ghi vào `architecture.md` mục chi phí); siết Rules làm hỏng bản app cũ: v1 là bản phát hành đầu, chỉ có bản dev, chấp nhận. Trigger chỉ có hiệu lực sau deploy (checklist F-4). **Phụ thuộc:** không.

#### V1-05 personal-firebase
- **Mục tiêu:** tab Cá nhân ở bản Firebase không còn hàng nào báo "chưa kết nối" mà người dùng chạm tới được.
- **Tệp:** `src/api/contract/{auth,shop}.ts` (`auth.changePassword({ current, next })`, `auth.updateDisplayName(name)`, `shop.listMyShops()`), `src/api/{fake,unavailable,firebase}/*`, `src/api/contract-tests/api.contract.ts`, `src/features/personal/data/firebase-personal-gateways.ts` (nối `listShops`, `updateShopName`, `updateProfile`, `changePassword`; `switchShop` giữ chưa kết nối), `src/features/personal/ui/account-menu.ts` (mục `notifications` -> `hidden`, ghi lý do v1).
- **Thư viện/Migration/Rules:** không (Rules cho thành viên đọc `shops/{id}` đã có test).
- **Test:** contract test cả ba hiện thực; `firebase-personal-gateways.test.tsx` (mỗi hàm mới, lỗi `auth/wrong-password` -> mã sẵn có của Đổi mật khẩu, `auth/requires-recent-login`); menu Cá nhân không còn Cài đặt thông báo.
- **Ảnh:** Cá nhân (menu sau khi ẩn), Cài đặt cửa hàng, Sửa tên cửa hàng, Đổi mật khẩu (lỗi mật khẩu hiện tại sai), Sửa họ tên.
- **Rủi ro:** đổi mật khẩu không thu hồi phiên ở máy khác (Firebase thu hồi refresh token khi đổi mật khẩu; v1 một máy nên chấp nhận). **Phụ thuộc:** V1-03 (cùng `firebase-api.ts`, `ops.ts`).

#### V1-06 session-guard
- **Mục tiêu:** không vào màn nghiệp vụ khi chưa đăng nhập (deep link `doncung://`); không tạo đơn rơi vào `LOCAL_SHOP_ID` ở bản Firebase.
- **Tệp:** `src/app/(tabs)/_layout.tsx` và các route modal nghiệp vụ (`quick-order`, `record-pack`, `record-return`, `returns/*`, `disputes/*`, `sync/*`) qua một hook `useRequireSession()` trong `features/personal` (không đụng Splash/Chào mừng); `features/orders` (Tạo đơn nhanh, Quét: khi chế độ Firebase và `useCurrentShopId()` là `LOCAL_SHOP_ID` thì hiện trạng thái "Đang nạp thông tin cửa hàng" + Thử lại, không lưu đơn); `features/returns` tương tự cho tạo hồ sơ hoàn.
- **Thư viện/Migration/Rules:** không.
- **Test:** chưa đăng nhập mở route con -> về Chào mừng; ở chế độ Firebase chưa biết shop -> không gọi `saveNewOrder`; cổng giả/dev giữ hành vi cũ; đang quay thì guard không cắt ngang màn quay (phiên chỉ đổi khi đăng xuất, mà đăng xuất đã bị chặn khi đang quay).
- **Ảnh:** Tạo đơn nhanh ở trạng thái "đang nạp cửa hàng".
- **Rủi ro:** offline lần đầu chưa có đệm `userShops`: người dùng không tạo đơn được tới khi có mạng (đánh đổi đúng với bất biến 8; câu chữ chờ BA). Đơn `LOCAL_SHOP_ID` đã có trên máy dev: không chuyển (không có ở người dùng thật). **Phụ thuộc:** không; hợp nhất sau V1-02 để dùng "mạng có lại".

#### V1-07 uploader-identity
- **Mục tiêu:** Q-24g A: chỉ tải bằng chứng đóng gói thuộc phiên do chính uid đang đăng nhập tạo.
- **Tệp:** `src/features/orders/data/sqlite-evidence-file-store.ts` (+ bản bộ nhớ) thêm `listForUpload(shopId, states, uid)` nối `packing_sessions.created_by`; `src/features/upload/domain/upload-sources.ts` (`evidenceFileSource(files, currentUid)`); `UploadRunner.tsx`; hàm đếm `countForeignUnsynced(shopId, uid)` cho UI-F01.
- **Migration:** không (dùng cột `created_by` của v5). **Rules:** không (Rules đã ép `createdBy == auth.uid`).
- **Test:** hợp đồng kho (SQLite `node:sqlite` + bộ nhớ): tệp của uid khác không vào danh sách; phiên `created_by` NULL không bao giờ tải; test hàng đợi hai uid.
- **Ảnh:** ~~không (hiển thị ở V1-08)~~ có: khi làm, nhãn "Chờ tải lên" + lý do cho tệp của tài khoản khác ở UI-E03/E04 và ảnh/video hàng hoàn (điều phối yêu cầu báo rõ, không im lặng; decisions Q-29 / V1-07). Đăng xuất/chuyển cửa hàng chỉ đếm tệp của chính tài khoản. `countForeignUnsynced` thành `OrderStore.countUnsyncedByOwner(scope, uid)` (`own`/`foreign`). Migration: không (v15/v16 giữ nguyên cho V1-09/V1-13).
- **Rủi ro:** tệp cũ có phiên `created_by` NULL (tạo trước v5 trên máy dev) không bao giờ tải: chỉ máy dev. **Phụ thuộc:** hợp nhất sau V1-02.

#### V1-08 sync-center
- **Mục tiêu:** UI-F01/F02 phản ánh tệp thật; người dùng thử lại được.
- **Tệp:** `src/features/upload/ui/SyncCenterScreen.tsx` + hook `useSyncJobs(shopId)` (bốn nhóm docs/09: Đang tải lên, Chờ tải lên, Lỗi, Đã tải lên; nguồn: `EvidenceFileStore` + media hàng hoàn; nhãn qua `toDisplayStatus`/`EVIDENCE_STATUS_PRESENTATION`; tên hồ sơ = mã đơn + kiện hoặc mã hồ sơ hoàn; nhóm riêng "Do tài khoản khác tạo trên máy này" từ V1-07), màn UI-F02 thật (`upload/ui/SyncErrorScreen.tsx`), `UploadQueueProvider` đưa `runOnce` ra context (`UploadRunner.tsx`), `src/features/evidence/domain/file-state.ts` (sự kiện mới `USER_RETRY_ATTENTION`: `origin: 'device'`, `needs_attention -> queued`, chỉ khi `lastErrorCode` thuộc nhóm máy chủ từ chối; đặt lại `attemptCount`; **không** cho `LOCAL_HASH_CHANGED`, `FILE_MISSING`, `FILE_UNREADABLE`, `hash_mismatch`), `docs/02` hoặc `docs/09` (đề xuất BA ghi chuyển trạng thái mới), xóa `ILLUSTRATIVE_SYNC_JOBS` khỏi `illustrative-data.ts`.
- **Thư viện/Migration/Rules:** không.
- **Test:** `file-state.test.ts` (sự kiện mới: từ đúng trạng thái, từ chối với lỗi cục bộ và `hash_mismatch`, không bao giờ tới `uploaded`/`verified`); UI: bốn bộ lọc, không bao giờ "Đã tải lên" khi chưa `uploaded`/`verified`, nút Thử lại phát đúng sự kiện rồi gọi `runOnce` một lần (bấm đúp), nút ẩn với lỗi cục bộ, nhóm tài khoản khác không có nút; dòng giải thích tải chỉ khi app mở giữ nguyên.
- **Ảnh:** UI-F01 bốn bộ lọc (có dữ liệu: tạo đơn + tệp giả trong bản sao), trạng thái rỗng, nhóm "tài khoản khác"; UI-F02 lỗi máy chủ (có Thử lại) và lỗi cục bộ (không có Thử lại).
- **Rủi ro:** chuyển trạng thái mới đụng bất biến 3 (mục 7, R-3). Thiếu mã/thông báo lỗi tải trong docs/04–05: đề xuất ở Q-29. **Phụ thuộc:** V1-02, V1-07.
- *Đã làm (2026-10-30): xem [plans/v1-08-sync-center.md](plans/v1-08-sync-center.md) và decisions.md Q-29 / V1-08. Thêm so với kế hoạch: nút "Kiểm tra lại" cho tệp kẹt `uploaded` (gọi `createUploadSession`, V1-04), `ReturnStore.listMediaByStates`; Thử lại giữ `lastErrorCode` (không xóa) để vẫn đối soát trước khi gửi lại.*

#### V1-09 wifi-only
- **Mục tiêu:** Q-24c B.
- **Tệp:** `sqlite-migrations.ts` **v15** (`device_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at_device INTEGER NOT NULL)`, chỉ thêm), kho cài đặt máy (`features/upload/data/device-settings-store.ts`, SQLite + bộ nhớ), `upload-queue.ts`/`UploadRunner.tsx` (khi bật và `getConnectivity().type !== 'wifi'`: không bắt đầu lượt mới, tệp ở "Chờ tải lên" kèm lý do "Đang chờ Wi‑Fi"; lượt đang gửi khi chuyển sang di động: hủy lượt, lỗi mạng, không tốn lượt), công tắc ở đầu UI-F01 và một hàng ở màn Dữ liệu bằng chứng.
- **Thư viện:** không (NetInfo từ V1-02). **Rules:** không.
- **Test:** migration v14 -> v15 (dữ liệu cũ nguyên, chạy lại idempotent); hàng đợi: bật Wi‑Fi‑only + di động -> không gọi `declare`; tắt -> chạy; chuyển mạng giữa lượt -> hủy không tốn lượt; giá trị mặc định = tắt (luôn tải).
- **Ảnh:** UI-F01 có công tắc (bật/tắt), tệp "Đang chờ Wi‑Fi", màn Dữ liệu bằng chứng.
- **Rủi ro:** `type` NetInfo `other`/`unknown` (Ethernet, VPN): coi như không phải di động (tải); điểm phát Wi‑Fi từ điện thoại khác vẫn là Wi‑Fi (không phát hiện được gói cước, ghi trong Trợ giúp). **Phụ thuộc:** V1-02, V1-08.
- *Đã làm (2026-10-30): xem [plans/v1-09-wifi-only.md](plans/v1-09-wifi-only.md) và decisions.md Q-29 / V1-09. Lệch so với dòng trên: (1) `other` (Ethernet, VPN, Bluetooth, chưa rõ) khi đã bật công tắc thì **chờ Wi‑Fi**, không tải (an toàn với cước; người dùng tắt công tắc được); (2) kho cài đặt máy đặt ở `features/orders/data/device-settings-store.ts` (chủ CSDL; tránh vòng `orders -> upload` khi V1-10 dùng ở Trang chủ), xuất qua `@/features/orders` (`DeviceSettingsProvider`, `useDeviceSetting`, `booleanSetting`). Câu Trợ giúp về điểm phát Wi‑Fi để V1-18.*

#### V1-10 home-real-data
- **Mục tiêu:** không còn dữ liệu minh họa ở Trang chủ và thẻ Dữ liệu bằng chứng; Thông báo nói đúng sự thật.
- **Tệp:** `HomeScreen.tsx` (tên shop từ `getShopSummary` của phiên; 3 ô từ hook `useTodayEvidenceStats(shopId)` dùng chung phân loại của V1-08; ô "Lỗi – cần xử lý" mở UI-F01 bộ lọc Lỗi; bỏ `illustrative`; thẻ "Dữ liệu nằm trên máy này" đóng được, nhớ trạng thái đóng trong `device_settings` của V1-09), `features/personal/ui/ProfileCards.tsx`/`EvidenceDataScreen.tsx` (số trên máy / đang chờ / máy chủ đã xác nhận), `shop/ui/screens.tsx` `NotificationListScreen` -> màn rỗng trung thực, xóa `ILLUSTRATIVE_*` còn lại và tệp `illustrative-data.ts` nếu hết người dùng, bỏ prop `illustrative` của `src/shared/ui/Screen.tsx` và khóa `common:illustrative`, ESLint `no-restricted-imports` cấm `@/shared/fixtures/illustrative-data` ngoài `*.test.*` và `src/test-utils`.
- **Thư viện/Migration/Rules:** không (dùng bảng v15).
- **Test:** hook số liệu với kho bộ nhớ (ranh giới "hôm nay" theo giờ thiết bị, ô Đã tải lên chỉ đếm `uploaded`/`verified`); Trang chủ không có chuỗi `common:illustrative`; ESLint rule có test trong `eslint-rules` hoặc ca lint âm tính.
- **Ảnh:** Trang chủ (rỗng: máy mới; có dữ liệu), thẻ thông tin một thiết bị, Cá nhân (thẻ Dữ liệu bằng chứng có số), tab Thông báo.
- **Rủi ro:** đếm mỗi lần focus tốn đọc SQLite: chỉ đếm khi focus và sau khi hàng đợi đổi trạng thái (không định kỳ). **Phụ thuộc:** V1-08 (phân loại dùng chung), V1-09 (kho `device_settings`; hợp nhất sau V1-09).
- *Đã làm (2026-10-30): xem [plans/v1-10-home-real-data.md](plans/v1-10-home-real-data.md) và decisions.md Q-29 / V1-10. Lệch so với dòng trên: (1) Trang chủ chuyển sang feature mới `features/home` (tránh vòng `orders -> upload -> orders`); (2) thêm hàm đếm SQL ở ba kho thay vì nạp mọi dòng; (3) ô Lỗi đếm mọi lỗi hiện có, không chỉ hôm nay; (4) ESLint cấm import dữ liệu minh họa ở mọi tệp, kể cả test (tệp đã xóa).*

#### V1-11 recording-hardening
- **Mục tiêu:** quay trên giá không tắt màn hình; vào nền khi đang quay được xử lý có chủ đích; người dùng biết giới hạn Q-24b.
- **Tệp:** `src/platform/keep-awake.ts` (mới, `activateKeepAwakeAsync`/`deactivateKeepAwake` theo tag), `src/platform/app-state.ts` (bắt `background`/`inactive`), `src/platform/index.ts`, `PackRecordLive.tsx` và màn quay hàng hoàn D04 (bật khi đang chuẩn bị/ghi, tắt khi rời/lỗi/xong; vào nền khi đang ghi -> `requestStop` đi qua đường lưu bền sẵn có, phiên `interrupted`; quay lại thì báo điều đã xảy ra; không tự ghi tiếp), một dòng chú thích dưới nút quay "Giữ ứng dụng mở trong lúc quay. Nếu ứng dụng bị tắt, đoạn đang quay có thể mất." (chờ BA).
- **Thư viện:** `expo-keep-awake@~58.0.3`. **Migration/Rules:** không.
- **Test:** adapter giả: bật/tắt đúng pha, đúng một lần; vào nền khi ghi gọi dừng một lần và phiên `interrupted`; không gọi sau khi màn bị gỡ; không có `Platform.OS` trong màn.
- **Ảnh:** màn quay (xem trước, cờ ghi tắt trên web) với dòng chú thích; hộp báo "đã dừng vì ứng dụng vào nền" (tham số tạm trong bản sao).
- **Rủi ro:** iOS có thể không cho đủ thời gian lưu/băm khi vào nền: dựa vào `recoverInterruptedRecordings` lúc mở lại (đã có); hành vi `expo-camera` khi vào nền **chỉ biết trên máy thật** (cổng G-4). **Phụ thuộc:** không.

#### V1-12 backup-exclusion-ios
- **Mục tiêu:** Q-24d A cho iOS (Android đã xong ở V1-01).
- **Tệp:** `modules/backup-exclusion/` (Expo Module cục bộ, autolinking: `ios/BackupExclusionModule.swift` đặt `URLResourceValues.isExcludedFromBackup = true` cho thư mục; `android/` no-op trả `true`; `expo-module.config.json`), `src/platform/backup-exclusion.ts` (adapter, gọi khi mở app cho `Paths.document/evidence` và thư mục CSDL của `expo-sqlite`; lỗi chỉ log không PII, không chặn app), mock cho test, `docs/06` mục "Hệ quả với Firebase" (đổi máy/cài lại mất tệp chưa tải).
- **Thư viện:** không (dùng `expo-modules-core` có sẵn). **Migration/Rules:** không.
- **Test:** adapter gọi đúng hai thư mục, gọi lại sau khi tạo thư mục mới; lỗi không ném.
- **Ảnh:** không.
- **Rủi ro:** **mã native đầu tiên của repo** (Swift ~30 dòng): chỉ kiểm được bằng build thật; Apple coi cờ là gợi ý; xác nhận trên máy bằng dung lượng sao lưu iCloud của app (checklist G-7). Phương án dự phòng nếu module cục bộ gây lỗi build: tạm bỏ PR này, ghi rủi ro "video có thể vào iCloud Backup" trong chính sách. **Phụ thuộc:** không (bổ sung cho V1-01, khác tệp).

#### V1-13 hash-efficiency
- **Mục tiêu:** băm không đứng giao diện lâu; không băm lại toàn tệp ở mỗi lần thử.
- **Tệp:** `src/platform/file-hasher.ts` (nhường luồng JS giữa các khối 1 MB bằng `await` một nhịp), `sqlite-migrations.ts` **v16** (`evidence_files.hashed_size_bytes`, `hashed_mtime_device`; `return_media` tương tự; chỉ `ADD COLUMN` nullable), `upload-queue.ts` (bỏ băm lại khi kích thước + mtime không đổi kể từ lần băm hợp lệ; nghi ngờ (thiếu mtime, khác) thì băm lại; khác mã băm -> `LOCAL_HASH_CHANGED` -> `needs_attention` như cũ), hợp đồng kho tệp.
- **Thư viện:** không. **Rules:** không.
- **Test:** vectơ SHA-256 hiện có vẫn qua; tệp không đổi không băm lại; đổi kích thước/mtime -> băm lại; mã khác -> không tải (bất biến 4); migration v15 -> v16.
- **Ảnh:** không.
- **Rủi ro:** mtime không đáng tin sau khôi phục backup (đã loại khỏi backup ở V1-12/V1-01); máy chủ vẫn băm lại độc lập nên một tệp lọt kiểm tra cục bộ sẽ thành `hash_mismatch`, không thành `verified` sai. Tốc độ băm JS trên Hermes **chưa đo** (cổng G-5). **Phụ thuộc:** V1-02 (`upload-queue.ts`), V1-09 (số migration).

#### V1-14 account-delete-server
- **Mục tiêu:** máy chủ xóa tài khoản đúng chính sách, có dấu vết, không đụng bằng chứng bị giữ.
- **Thiết kế:**
  1. Callable `deleteAccount` (region `asia-southeast1`): yêu cầu `request.auth`, `auth_time` trong vòng 5 phút (client vừa xác thực lại), nếu không `failed-precondition` (`requires-recent-login`).
  2. Với mỗi shop của uid (`userShops/{uid}`): nếu uid là **chủ duy nhất và không còn thành viên hoạt động khác** -> đặt `shops/{id}.status = 'deleting'`, `deletionRequestedAt` (giờ máy chủ), `purgeAfter = +30 ngày`; nếu shop còn thành viên khác (không xảy ra ở v1) -> từ chối, mã đề xuất `ACCOUNT_DELETE_SHOP_HAS_MEMBERS`; nếu uid không phải chủ -> chỉ gỡ thành viên.
  3. Xóa `shops/{id}/members/{uid}` và `userShops/{uid}` ngay (Rules hiện có từ chối mọi truy cập khi không còn là thành viên, nên dữ liệu không còn đọc được từ app).
  4. Ghi `accountDeletions/{autoId}` (cấp gốc, Rules `allow read, write: if false`): `uid`, `shopIds`, `requestedAt`, `purgeAfter`, `status`, `reason` (lý do kỹ thuật); **không** email, không tên, không mã đơn. Đây là bản ghi DUY NHẤT còn lại sau purge.
  5. Xóa người dùng Auth bằng Admin SDK (bước cuối; lỗi giữa chừng -> chạy lại idempotent).
  6. Scheduled `purgeDeletedShops` (hằng ngày): shop `deleting` quá `purgeAfter` và **không** có `legalHold == true` (trường chỉ Admin đặt; v1 chưa có giao diện đặt) -> xóa đối tượng Storage `shops/{id}/` theo trang, `recursiveDelete` Firestore `shops/{id}` **gồm cả `auditEvents` của shop** (điều phối chốt: xóa theo yêu cầu của chủ, sau 30 ngày, trừ khi có `legalHold`/tranh chấp), cập nhật `accountDeletions.status = 'purged'` + số lượng. Sau purge, thứ duy nhất còn lại là `accountDeletions` (uid, thời điểm yêu cầu/purge, `shopIds`, lý do kỹ thuật như `owner_request`/`legal_hold_skip`, số lượng; không email, không tên, không mã đơn). Bằng chứng đang bị giữ do tranh chấp: v1 tranh chấp **chỉ ở trên máy**, máy chủ không có hồ sơ giữ nào; client chặn xóa khi còn tranh chấp mở (V1-15). Trường `legalHold` là chỗ để yêu cầu pháp lý/hỗ trợ dừng việc dọn (bất biến 9).
  7. Script hỗ trợ `firebase/functions/src/admin/delete-account-cli.ts` dùng chung hàm thuần để nhân viên hỗ trợ xử lý yêu cầu xóa gửi qua web (Google Play yêu cầu kênh web).
- **Tệp:** `firebase/functions/src/account.ts` (mới, hàm thuần `deleteAccountForUser`, `purgeShop`), `index.ts`, `firebase/firestore.rules` (`accountDeletions` từ chối client; shop `deleting` từ chối ghi), test.
- **Thư viện/Migration:** không.
- **Test (Emulator):** chưa xác thực lại -> từ chối; chủ duy nhất -> shop `deleting`, thành viên + `userShops` mất, Auth bị xóa, nhật ký có; gọi hai lần không lỗi, không nhân đôi nhật ký; sau khi xóa, client cũ đọc/ghi `shops/{id}/**` bị từ chối (`assertFails`); người khác shop không gọi thay được; purge bỏ qua shop `legalHold`; purge trước `purgeAfter` không làm gì; purge xong thì `shops/{id}` và MỌI collection con (orders, sessions, evidence, returns, members, **auditEvents**) không còn tài liệu nào, `accountDeletions` vẫn còn với `status = 'purged'` và không có trường email/tên; Storage giả bị xóa đúng tiền tố, không đụng shop khác (QA-11).
- **Ảnh:** không.
- **Rủi ro:** Function dài khi nhiều tệp: purge chạy theo trang, có thể kéo nhiều ngày; chi phí xóa thấp. Lưu `uid` trong `accountDeletions` sau khi xóa là dữ liệu cá nhân còn lại: cần rà pháp lý (mục 7, R-1). **Phụ thuộc:** V1-04 (cùng `index.ts`, `firestore.rules`).

#### V1-15 account-delete-client
- **Mục tiêu:** người dùng xóa được tài khoản trong app, an toàn và trung thực.
- **Luồng:** màn Xóa tài khoản (đã có) -> điều kiện thật: **đang quay: chặn**; **còn hồ sơ tranh chấp mở trên máy: chặn** (đóng hồ sơ không xóa dữ liệu, Q-27); **tệp chưa lên máy chủ: cảnh báo rõ "N tệp chưa tải lên sẽ bị xóa khỏi máy này và không thể khôi phục" + bắt buộc tích xác nhận riêng**; là chủ cửa hàng: thông tin "cửa hàng và dữ liệu trên máy chủ sẽ bị xóa hẳn sau 30 ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở" (câu chung app/web/store, decisions Q-29 / V1-20). -> "Tôi hiểu và đồng ý" -> nhập mật khẩu (xác thực lại) -> gọi `deleteAccount` -> **chỉ khi máy chủ trả thành công**: dừng `UploadRunner`/`OrderSyncRunner`/`ReturnSyncRunner`, xóa dữ liệu cục bộ, thoát phiên, về Chào mừng với thông báo đã xóa. Lỗi mạng/máy chủ: giữ nguyên mọi thứ, báo thử lại.
- **Xóa dữ liệu cục bộ:** hàm `wipeLocalData()` trong `features/orders/data` (chạy trong hàng đợi CSDL: `DELETE` mọi bảng nghiệp vụ trong một giao dịch, giữ `user_version`), và xóa thư mục `evidence/` qua `platform/recording-files.ts`. Dấu `pending_local_wipe` lưu **ngoài CSDL sắp bị xóa**: tệp đánh dấu riêng `Paths.document/.pending-local-wipe` (adapter `platform/`, ghi bằng `expo-file-system`, không chứa PII). Thứ tự cố định: (1) đặt dấu, (2) xóa tệp trong `evidence/`, (3) xóa dữ liệu CSDL, (4) gỡ dấu. Khi khởi động, nếu thấy dấu thì chạy lại TỪ ĐẦU bước 2–4 trước khi mở bất kỳ runner nào (mọi bước idempotent: tệp/hàng đã mất thì bỏ qua).
- **Tệp:** `src/api/contract` (`account.deleteAccount(password)`), ba hiện thực API, `firebase-personal-gateways.ts`, `DeleteAccountScreen.tsx`, `delete-account-conditions.ts` (điều kiện `disputes` đọc `DisputeStore` cục bộ: số hồ sơ mở; điều kiện `unsynced` đổi từ chặn sang cảnh báo có xác nhận), `read-device-facts.ts`, `features/orders/data/wipe-local-data.ts`, `platform/recording-files.ts`, `SessionProvider` (xả phiên sau xóa), i18n, `decisions.md` (ghi ngoại lệ bất biến 4, mục 7 R-2).
- **Xóa dở dang (bổ sung từ review PR #53, V1-14):** nếu máy chủ đã khóa cửa hàng nhưng chưa xóa được tài khoản Auth (bản ghi `requested`), người dùng vẫn đăng nhập được nhưng `createShop` trả `permission-denied` + `details.reason: 'account_deleted'` và `userShops` không còn. Client gặp `account_deleted` (ở `createShop` hay bất kỳ callable nào) -> màn **"Đang hoàn tất xóa tài khoản"** (không phải màn Tạo cửa hàng): nút gọi lại `deleteAccount` (cần nhập mật khẩu lại vì `auth_time`) và nút Đăng xuất; gọi lại thành công thì chạy tiếp các bước xóa cục bộ như luồng thường. Máy chủ cũng tự hoàn tất trong lượt chạy hằng ngày (bản ghi `requested` quá 1 giờ). Chuỗi mới chờ BA (C-1).
- **Thư viện/Migration/Rules:** không.
- **Test:** điều kiện (tranh chấp mở chặn, đang quay chặn, tệp chưa tải cần tích thêm); thất bại máy chủ không xóa gì cục bộ; thành công gọi theo đúng thứ tự (dừng runner -> đặt dấu -> xóa tệp -> xóa CSDL -> gỡ dấu -> thoát); dấu nằm ngoài CSDL (xóa CSDL không làm mất dấu); thứ tự đặt dấu -> xóa `evidence/` -> xóa CSDL -> gỡ dấu (adapter giả ghi nhật ký gọi); giả lập kill sau từng bước (1, 2, 3) rồi khởi động lại: thấy dấu, chạy lại từ đầu, kết quả cuối giống chạy một lần, dấu bị gỡ; khởi động không có dấu thì không xóa gì; runner chỉ chạy sau khi xóa xong; `wipeLocalData` trên `node:sqlite` xóa hết bảng nghiệp vụ, giữ schema; contract test `deleteAccount`.
- **Ảnh:** màn Xóa tài khoản: các điều kiện (đạt, chặn tranh chấp, cảnh báo tệp chưa tải), bước nhập mật khẩu, lỗi mật khẩu sai, lỗi mạng, màn Chào mừng sau khi xóa (thông báo).
- **Rủi ro:** xóa tệp cục bộ là **xóa bằng chứng theo yêu cầu người dùng**: ngoại lệ có chủ đích với bất biến 4 (mục 7, R-2). **Phụ thuộc:** V1-05, V1-14.

#### V1-16 crashlytics
- **Mục tiêu:** biết app lỗi ở đâu trên máy người dùng mà không gửi PII.
- **Đánh giá rủi ro native:** cùng họ RNFirebase 27.1.0 đã dùng (không thêm SDK mới về bản chất), nhưng: (1) thêm config plugin và bước tải dSYM/mapping vào build; (2) repo đặt iOS `useFrameworks: "dynamic"` vì RNFirebase 27 dùng Swift Package (`firebase-setup.md` mục 7), trong khi tài liệu RNFirebase cho Expo khuyến nghị `static`: tổ hợp dynamic + Crashlytics **chưa được kiểm chứng**; (3) không ảnh hưởng luồng ghi/tải. **Quyết định:** làm trong v1 vì báo lỗi là cách duy nhất thấy lỗi trên thiết bị người dùng thật, nhưng hợp nhất **trước** build staging đầu tiên để lỗi build lộ sớm; nếu build iOS hỏng mà không sửa được trong một ngày: tách PR ra khỏi v1, ghi "không có báo lỗi" vào khai báo store.
- **Tệp:** `app.json` (plugin `@react-native-firebase/crashlytics`), `firebase.json` gốc (`crashlytics_debug_enabled: false`, `crashlytics_auto_collection_enabled: false` để chỉ bật sau khi đọc công tắc), `src/platform/crash-reporter.ts` (adapter: `setEnabled`, `recordError(code, stack)`, `log(breadcrumb)`), `src/core/logging/logger.ts` (thêm sink nhận bản đã che PII; không gửi thông điệp tự do, chỉ mã lỗi + tên module), `ErrorBoundary` gốc gọi `recordError`, công tắc "Gửi báo cáo lỗi ứng dụng" ở UI-I05 (lưu `device_settings`), `docs/engineering/decisions.md` Q-07 (đóng).
- **Thư viện:** `@react-native-firebase/crashlytics@27.1.0`. **Migration/Rules:** không.
- **Test:** logger: sink không bao giờ nhận mã đơn/mã vận đơn/email/đường dẫn tệp (test với chuỗi mẫu); không gọi `setUserId`; công tắc tắt -> `setEnabled(false)`; bản test/dev không bật.
- **Ảnh:** UI-I05 có công tắc.
- **Rủi ro:** như trên; khai báo Data safety/App Privacy thêm "Crash logs/Diagnostics" (V1-20). **Phụ thuộc:** V1-01 (cùng `app.json`), V1-09 (kho `device_settings`, migration v15, cho công tắc); hợp nhất sau V1-11 (lockfile).

#### V1-17 local-playback
- **Đánh giá đưa vào v1:** **nên đưa.** Lý do: không có URL máy chủ, đây là cách duy nhất người bán xem lại bằng chứng của chính mình (đối chiếu khi khiếu nại); `expo-video` là thư viện Expo chính chủ, bản `~58.0.12` theo SDK, chạy cả iOS và Android, phát từ `file://` ở lớp native (không nạp video vào bộ nhớ JS), chỉ đọc (không sửa bản gốc). Chi phí: một màn (UI-E04 đang là khung) + lối vào từ UI-E03/G03/D07. Rủi ro native thấp hơn camera/tải; nếu có lỗi build thì là PR tách được.
- **Tệp:** `src/platform/video-player.tsx` (adapter `expo-video`), `features/evidence/ui/EvidenceDetailScreen.tsx` (thông tin: loại, giờ thiết bị, kích thước, trạng thái tệp qua `toDisplayStatus`, mã băm rút gọn kèm câu "mã băm chỉ chứng minh tệp không đổi kể từ lúc tính", liên kết phiên/kiện; phát video hoặc hiện ảnh; tệp mất -> thông báo, không đoán), lối vào từ danh sách bằng chứng đơn UI-E03 (và ảnh/video hàng hoàn nếu không vượt ngân sách, nếu vượt thì PR V1-17b), i18n.
- **Thư viện:** `expo-video@~58.0.12`. **Migration/Rules:** không.
- **Test:** màn với adapter giả: tệp có/không có, video/ảnh, trạng thái hiển thị đúng bảng docs/09 (không "đã xác minh" khi chưa `verified`); không có thao tác xóa/sửa.
- **Ảnh:** UI-E04 (video: trên web `expo-video` dùng thẻ `<video>`; ảnh; tệp không còn trên máy), UI-E03 có lối vào.
- **Rủi ro:** tệp đang ghi dở/`saving_local` không phát (ẩn nút); video dài tua trên máy yếu: chỉ biết trên thiết bị (G-6). **Phụ thuộc:** không; hợp nhất sau V1-16 (lockfile).

#### V1-18 content-help-legal
- **Mục tiêu:** mọi câu người dùng đọc về dữ liệu, lưu trữ, quyền đều đúng với v1.
- **Tệp:** `src/core/config/public-links.ts` (MỘT chỗ: `terms`, `privacy`, `support`, `accountDeletionRequest`, `supportEmail`, đều giữ chỗ `.invalid`/`null`), `legal-links.ts` và `support-contact.ts` chuyển thành re-export (màn đã khách xác nhận không đổi import), test `tooling` so `public-links.ts` với `web/src/config/site.ts` (khớp từng URL/email), bài Trợ giúp mới (`help-text.ts`/i18n: dữ liệu nằm trên máy này; đổi máy/cài lại/gỡ app mất tệp chưa tải; video đang ghi có thể mất nếu app bị tắt; chỉ tải khi app mở; Chỉ tải khi có Wi‑Fi; mã băm nghĩa là gì; xóa tài khoản), câu Thời hạn lưu v1 (mục 1.2) ở `personal.json`, chuỗi quyền `app.json` (camera: "Đơn Chứng dùng camera để quét mã đơn hàng, quay video đóng gói và mở kiện, chụp ảnh kiện hàng hoàn. Ứng dụng không ghi âm."; vị trí giữ nguyên), cảnh báo đăng xuất bổ sung câu "dữ liệu chưa tải lên chỉ còn trên máy này" nếu chưa có.
- **Thư viện/Migration/Rules:** không.
- **Test:** test chuỗi (không có "tuyệt đối", "đảm bảo thắng", "sao lưu an toàn" trước khi xác minh) mở rộng test có sẵn; test tooling khớp URL app/web; ảnh.
- **Ảnh:** Trợ giúp (danh mục + 2 bài mới), Thời hạn lưu, Điều khoản và chính sách (liên kết còn khóa khi giữ chỗ).
- **Rủi ro:** câu chữ cần khách/BA duyệt (checklist C-1). **Phụ thuộc:** V1-03 (feature-flags/legal), V1-11 (i18n màn quay).

#### V1-19 web-legal-pages
- **Mục tiêu:** có URL công khai cho store: Chính sách quyền riêng tư, Điều khoản, Hỗ trợ, Yêu cầu xóa tài khoản (Google Play yêu cầu kênh web).
- **Tệp:** `web/src/pages/{chinh-sach-quyen-rieng-tu,dieu-khoan,ho-tro,xoa-tai-khoan}.astro`, `web/src/config/site.ts` (giữ chỗ URL/email cùng giá trị với app), liên kết chân trang, `web/README.md`.
- **Nội dung chính sách (bản nháp, chờ pháp lý):** dữ liệu thu thập: email, họ tên (nếu nhập), tên cửa hàng, mã đơn/mã vận đơn/sản phẩm do người dùng nhập, video/ảnh bằng chứng và mã băm khi tải lên, thời gian thiết bị/máy chủ, báo lỗi ứng dụng (nếu bật); **vị trí lúc chụp ảnh hàng hoàn chỉ lưu trên máy, không gửi lên** (Q-28a); video/CSDL không vào sao lưu iCloud/Android (Q-24d); máy chủ Firebase khu vực Singapore (Q-08); không quảng cáo, không bán dữ liệu; xóa tài khoản trong app hoặc qua trang web: tài khoản bị xóa ngay, dữ liệu cửa hàng trên máy chủ (đơn, phiên, bằng chứng, hồ sơ neo, **nhật ký kiểm toán của cửa hàng**) xóa hẳn sau 30 ngày, trừ khi có yêu cầu giữ lại vì pháp lý/tranh chấp; sau đó chỉ còn một bản ghi tối thiểu gồm mã tài khoản nội bộ (uid), thời điểm, mã cửa hàng và lý do kỹ thuật (không email, không tên) để chứng minh đã xử lý yêu cầu; chưa tự động xóa theo thời hạn; liên hệ.
- **Test:** `npm --prefix web run check` (SEO, liên kết hỏng). **Ảnh:** 4 trang (360x800).
- **Rủi ro:** nội dung pháp lý cần luật sư rà theo luật bảo vệ dữ liệu cá nhân Việt Nam (checklist C-2). **Phụ thuộc:** không.

#### V1-20 store-listing-docs
- **Mục tiêu:** soạn sẵn mọi nội dung con người sẽ dán vào Play Console/App Store Connect.
- **Tệp:** `docs/engineering/store-listing.md`: tên, mô tả ngắn/dài tiếng Việt trung thực (bất biến 11), từ khóa, danh mục; **Apple App Privacy** và **Google Data safety** theo bảng dữ liệu ở V1-19 (vị trí: xử lý trên máy, không "thu thập" theo định nghĩa của cả hai store vì không rời máy; ảnh/video, email, user ID, nội dung người dùng: thu thập, gắn tài khoản, mục đích chức năng app; crash: chẩn đoán, không gắn tài khoản; **"Device or other IDs"** (Google) / "Device ID" (Apple): ID cài đặt Firebase (Firebase installation ID) do Crashlytics và các SDK Firebase dùng, mục đích phân tích lỗi/chức năng app, không gắn tài khoản; không theo dõi/ATT; **đối chiếu từng mục với trang công bố dữ liệu chính thức của Firebase cho Google Play Data safety và Apple App Privacy** (Auth, Firestore, Functions, Crashlytics, Installations) trước khi điền); ghi chú cho người duyệt (tài khoản demo **không có sẵn đơn mẫu** vì dữ liệu đơn/bằng chứng chỉ nằm trên máy: hướng dẫn người duyệt tự tạo đơn bằng Tạo đơn nhanh hoặc quét mã vạch mẫu **đính kèm trong ghi chú** (ảnh mã vạch Code 128 của một mã đơn giả, ví dụ `DH-DEMO-0001`), rồi quay video đóng gói; app không có mua trong app; cách xóa tài khoản); danh sách ảnh chụp store cần có; chuỗi quyền.
- **Test:** không (tài liệu). **Phụ thuộc:** không; cập nhật lại sau V1-16 nếu Crashlytics bị tách khỏi v1.
- **Đã làm (PR V1-20):** tách thành ba tệp ở `docs/store/` theo yêu cầu điều phối thay cho `docs/engineering/store-listing.md`: [listing.md](../store/listing.md), [privacy-declarations.md](../store/privacy-declarations.md), [review-notes.md](../store/review-notes.md); quyết định tự chốt ở `decisions.md` "Q-29 / V1-20".

#### V1-21 release-1.0.0 (sau cổng thiết bị)
- **Tệp:** `app.json`/`package.json` `version: 1.0.0`; `eas.json` profile `production` thêm `EXPO_PUBLIC_RECORDER_ENABLED=1`; `CHANGELOG.md` chuyển `[Unreleased]` thành `[1.0.0] - <ngày>`; `CLAUDE.md` mục trạng thái; `DEPLOYMENT.md` bỏ nhãn **[Chưa có]** đã làm; `bundleIdentifier`/`package` chính thức nếu O-11 đã chốt.
- **Điều kiện mở PR:** cổng thiết bị G đạt, checklist con người mục F/S/C xong. **Ảnh:** không.

---

## 4. Chụp ảnh màn hình cho PR khi không có thiết bị

### 4.1 Đã thử thật (2026-10-30): **chạy được**

Repo không có `react-native-web` trong `package.json` nên làm trên **bản sao ngoài repo** (không đổi `package.json`/lockfile). Lệnh đã chạy thành công trong môi trường này (Node 22, Playwright 1.63.0 cài toàn cục ở `/opt/node-tools/node_modules`):

```bash
S=/tmp/<thư-mục-tạm>/web                       # ngoài repo
mkdir -p $S/repo $S/shots
git -C /home/user/GoiHangNhanh archive HEAD | tar -x -C $S/repo
cp -a /home/user/GoiHangNhanh/node_modules $S/repo/      # bản sao thật, KHÔNG hardlink (npm sẽ ghi vào)
(cd $S/repo && npm i --no-save react-native-web@~0.21.4 @expo/metro-runtime@~58.0.15)
(cd $S/repo && EXPO_PUBLIC_USE_FAKE_BACKEND=1 EXPO_PUBLIC_FAKE_SESSION=signed_in CI=1 \
   npx expo export --platform web --output-dir $S/dist)  # thoát mã 0
(cd $S && npx --yes serve -s dist -l 5173 &)               # -s: mọi route trả index.html
NODE_PATH=/opt/node-tools/node_modules node shoot.js http://localhost:5173 $S/shots
```

`shoot.js` (đã dùng): `chromium.launch()`, `newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })`, với mỗi route `page.goto(url, { waitUntil: 'networkidle' })`, chờ 3,5 giây (cổng giả trễ ~450 ms), `page.screenshot`, gom `pageerror`. Kết quả: 3 ảnh `/`, `/account`, `/sync` render đúng, **0 lỗi trang**. Ảnh xác nhận hiện trạng ở mục 2.3: Trang chủ hiện "Shop minh họa", số 12/11/1 và dải "Dữ liệu minh họa…"; `/sync` hiện "DEMO-0002 · Kiện 1"; thẻ Dữ liệu bằng chứng ở `/account` hiện "Chưa có số liệu".

V1-00 đóng gói các lệnh này vào `node scripts/screens/capture.cjs` (cách dùng: [scripts/screens/README.md](../../scripts/screens/README.md)). Mặc định một cỡ 390x844, `--sizes all` cho 320x568, 360x800, 390x844; chữ lớn chưa có tham số trong công cụ, vẫn mô phỏng như tiền lệ `personal-tab-v3` (thay đổi tạm trên nhánh nháp, `--source <nhánh>`). Ảnh mốc "trước": `docs/assets/screens/v1-00-baseline/`.

### 4.2 Giới hạn (ghi vào README ảnh của mỗi PR)

- Là **react-native-web trong Chromium**, không phải iOS/Android: font, bóng, vùng an toàn, bàn phím, Back phần cứng, chữ lớn hệ thống khác thiết bị.
- Web không có camera, SQLite thật (kho bộ nhớ), Firebase, NetInfo thật: trạng thái cần dữ liệu (tệp lỗi, đang tải, tài khoản khác) dựng bằng **thay đổi tạm trong bản sao** (tham số URL đọc ở cổng giả/kho bộ nhớ) như tiền lệ `docs/assets/screens/orders-v2/README.md`, **không commit**, và README ảnh phải liệt kê thay đổi tạm đó.
- Màn quay: chỉ chụp được khung xem trước "cần camera".

### 4.3 Commit và nhúng vào PR

- Ảnh: `docs/assets/screens/v1-<số>-<tên>/<NN>-<trạng-thái>-<WxH>.png` + `README.md` (cách chụp, thay đổi tạm, "chưa kiểm chứng trên thiết bị").
- Mô tả PR nhúng bằng `https://raw.githubusercontent.com/steve-bang/GoiHangNhanh/<nhánh-PR>/docs/assets/screens/v1-<số>-<tên>/<tệp>.png` (dùng tên nhánh khi PR còn mở; sau khi hợp nhất link theo `main` vẫn đúng vì ảnh nằm trong repo). Repo private thì ảnh raw cần đăng nhập: khi đó dùng đường dẫn tương đối trong tệp README ảnh và liên kết tới tệp đó.
- Không dùng dữ liệu khách thật trong ảnh (mã mẫu `DH-…`, `SPX0123…` như tiền lệ).

---

## 5. Quy ước CHANGELOG

- Tệp `CHANGELOG.md` ở gốc repo theo [Keep a Changelog 1.1.0](https://keepachangelog.com/vi/1.1.0/), phiên bản theo SemVer (`1.0.0` = bản store đầu).
- Mục `[Unreleased]` có các nhóm `Added`, `Changed`, `Fixed`, `Security`, `Removed` (tiêu đề nhóm giữ tiếng Anh theo chuẩn, nội dung tiếng Việt).
- **Mỗi PR thêm đúng một dòng** (hoặc vài dòng nếu PR đổi nhiều nhóm) dạng: `- <mô tả cho người đọc phát hành, không chép diff> (V1-xx, #<số PR>)`. Thay đổi chỉ tài liệu/công cụ nội bộ ghi ở nhóm `Changed` với tiền tố "Nội bộ:" hoặc bỏ qua nếu không ảnh hưởng bản phát hành (ghi rõ trong mô tả PR).
- Không ghi điều chưa kiểm chứng như đã chạy: ví dụ "Thêm giữ màn hình sáng khi quay (chưa kiểm chứng trên thiết bị)".
- V1-21 đổi `[Unreleased]` thành `[1.0.0] - YYYY-MM-DD` và mở `[Unreleased]` mới.
- Nội dung khởi tạo: tóm tắt những gì đã có đến `42f6a3c` (đã tạo kèm kế hoạch này).

---

## 6. Định nghĩa "xong" cho v1

### 6.1 Phần làm được bằng mã (điều kiện để mở cổng thiết bị)

1. V1-00…V1-20 đã hợp nhất (hoặc PR nào bị tách khỏi v1 có ghi lý do ở đây và trong CHANGELOG).
2. Trên commit ứng viên: `npm run check` xanh; `npm run test:rules` xanh; `npx expo export --platform ios` và `--platform android` xanh; `npm --prefix web run check` xanh; CI xanh.
3. `git grep -n -e ILLUSTRATIVE -e 'common:illustrative' -- src ':!*.test.*' ':!src/test-utils'` không còn kết quả; ESLint chặn tái phát.
4. `APP_ENV=prod` + bất kỳ cờ giả nào -> build cấu hình ném lỗi (test tooling); `APP_ENV=prod npx expo config` ra bundle id không `.dev`.
5. `npx expo prebuild --no-install` (bản sao, `APP_ENV=prod`): `AndroidManifest.xml` `allowBackup="false"`, không `RECORD_AUDIO`; `Info.plist` có `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription` đúng chuỗi, không `NSMicrophoneUsageDescription`, không quyền thư viện ảnh; `ITSAppUsesNonExemptEncryption = false`.
6. Không còn đường nào ở bản Firebase mà người dùng chạm tới rồi gặp `AUTH_SERVICE_UNAVAILABLE` (danh sách mục 2.2 đã nối hoặc ẩn), trừ khi thật sự mất kết nối.
7. Mọi chuỗi mới qua i18n; mã lỗi mới đã liệt kê ở Q-29 chờ BA.
8. `CHANGELOG.md` có dòng cho từng PR.

### 6.2 Checklist con người

Chi tiết từng bước, người chịu trách nhiệm và cách ghi kết quả: [release-checklist.md](release-checklist.md). Tóm tắt nhóm: **F** Firebase production (tạo dự án, khu vực Singapore, Blaze + cảnh báo ngân sách, Auth email, mẫu thư tiếng Việt, IAM ký URL, deploy Rules/Indexes/Functions, tài khoản demo), **S** tài khoản store và build EAS, **G** cổng thiết bị (QA-01…14 trên iOS + Android thật, các mục đo), **C** duyệt câu chữ/pháp lý với khách, **P** phát hành (internal -> closed -> production, phased release).

---

## 7. Tự review kế hoạch

### 7.1 Vòng 1: rủi ro và chỗ có thể vi phạm bất biến

| # | Phát hiện | Bất biến | Mức |
|---|---|---|---|
| a | Xóa tài khoản xóa tệp bằng chứng cục bộ, kể cả tệp chưa tải lên | 4 | Cao |
| b | Xóa tài khoản trong khi bằng chứng đang được giữ do tranh chấp: máy chủ không biết tranh chấp (chỉ ở máy) | 9 | Cao |
| c | Bản nháp đầu cho "Thử lại" UI-F01 chỉ dùng `RETRY_UPLOAD`, nhưng `file-state.ts:103` chỉ cho từ `upload_failed`: tệp "cần xử lý" không bao giờ thử lại được, mâu thuẫn Q-24h | 3 | Cao |
| d | Lỗi mạng không tính lượt -> thử vô hạn; nếu "lỗi mạng" thật ra là lỗi cấu hình kéo dài, người dùng thấy "đang chờ" mãi | 11 | Trung bình |
| e | Bản nháp đầu đặt Wi‑Fi‑only ở V1-02 cùng NetInfo: PR quá lớn (~1700 dòng ước tính) và đụng UI-F01 trước khi UI-F01 thật tồn tại | – | Trung bình |
| f | Bản nháp đầu gộp Trang chủ thật vào V1-08: vượt ngân sách và đụng hai feature (`orders`, `upload`) | – | Trung bình |
| g | Bật ghi video ở production ngay trong V1-01 sẽ phát hành tính năng chưa qua thiết bị | 11 | Cao |
| h | Ẩn nút Apple/Google bằng cách sửa màn đã khách xác nhận | – (D-17) | Trung bình |
| i | Crashlytics nhận chuỗi lỗi tự do có thể chứa mã đơn/mã vận đơn | Quyền riêng tư | Cao |
| j | Đếm "Đã tải lên" ở Trang chủ dễ bị đếm từ `uploading` | 3 | Trung bình |
| k | Khai báo store ghi "vị trí: thu thập" sai thực tế, hoặc bỏ sót crash | 11 | Trung bình |
| l | Thiếu test cho: trần dung lượng biên, xóa tài khoản lặp lại, `wipeLocalData` bị kill giữa chừng, guard khi đang quay | – | Trung bình |
| m | QA-10 (dọn khi tranh chấp hết hạn) và QA-13 (bổ sung sản phẩm sau khi quay) không đạt đủ ở v1 | 9, 10 | Trung bình |
| n | Migration v15/v16 bị đổi số nếu hợp nhất sai thứ tự | – | Thấp |
| o | Firebase Auth iOS lưu phiên trong Keychain, còn sau khi gỡ app: cài lại sẽ tự đăng nhập với máy trống | Q-24a | Thấp |

### 7.2 Đã sửa trong kế hoạch theo vòng 1

- **a, b:** V1-15 chặn khi còn tranh chấp mở trên máy (đóng hồ sơ không xóa gì), chặn khi đang quay, tệp chưa tải phải tích xác nhận riêng; xóa cục bộ **chỉ sau** khi máy chủ xác nhận; V1-14 thêm `legalHold` và hạn 30 ngày trước khi dọn máy chủ (dọn cả `auditEvents` của shop, chỉ giữ `accountDeletions`, điều phối chốt); ghi ngoại lệ ở R-2 dưới đây để điều phối/người dùng duyệt.
- **c:** V1-08 thêm sự kiện `USER_RETRY_ATTENTION` có điều kiện, `origin: 'device'`, chỉ tới `queued`; test cấm với lỗi cục bộ và `hash_mismatch`; đề xuất BA ghi vào docs (R-3).
- **d:** V1-02 hiển thị "Đang chờ mạng/đang thử lại, lần thử gần nhất lúc …" ở UI-F01 (V1-08); phân loại `permission-denied` chỉ là "chờ" khi phụ thuộc chưa đăng, còn lại đếm lượt.
- **e:** tách Wi‑Fi‑only thành V1-09 sau V1-08.
- **f:** tách Trang chủ thành V1-10, dùng chung hook phân loại của V1-08.
- **g:** V1-01 chỉ bật ghi video ở `staging` (QA nội bộ); production bật ở V1-21 sau cổng thiết bị.
- **h:** dùng cờ `SOCIAL_SIGN_IN_FLAGS` sẵn có; ba màn đã có nhánh `providers.length > 0` nên không sửa tệp màn; ghi "lệch có chủ đích" và chụp ảnh.
- **i:** V1-16 chỉ gửi mã lỗi + tên module + stack, qua bộ che của logger; test với chuỗi mẫu có mã đơn/vận đơn/email; không `setUserId`; mặc định tắt cho tới khi đọc công tắc.
- **j:** V1-10 test "Đã tải lên chỉ đếm `uploaded`/`verified`".
- **k:** V1-20 ghi rõ vị trí xử lý trên máy (không thu thập theo định nghĩa store), crash là chẩn đoán; cập nhật lại nếu V1-16 bị tách.
- **l:** đã bổ sung các test đó vào V1-04, V1-14, V1-15, V1-06.
- **m:** ghi rõ ở mục 1.1 và R-6 dưới đây.
- **n:** mục 3.0 cố định số migration theo thứ tự hợp nhất; V1-13 phụ thuộc V1-09.
- **o:** ghi rủi ro, chấp nhận: Hydrator và Trang chủ (V1-10) hiển thị đúng trạng thái máy trống; thẻ thông tin một thiết bị giải thích.

### 7.3 Vòng 2: kiểm lại kích thước, phụ thuộc, test, và điểm cần duyệt

Kích thước ước tính (dòng mã, không tính test/tài liệu): V1-08 ~800 (lớn nhất: hook + 2 màn + máy trạng thái), V1-15 ~650, V1-14 ~500, V1-10 ~600, V1-02 ~550, các PR khác < 400. Không PR nào vượt ~1500. Nếu V1-17 thêm cả lối vào hàng hoàn/tranh chấp mà vượt 800 thì tách V1-17b (đã ghi).

Phụ thuộc vòng: không có (V1-05 -> V1-03; V1-16 -> V1-01, V1-09; V1-15 -> V1-05, V1-14; V1-13 -> V1-09 -> V1-08 -> V1-07 -> V1-02). Hai PR cùng làn mà đụng cùng tệp: V1-09 và V1-10 cùng dùng `device_settings` nhưng V1-10 chỉ đọc/ghi qua kho của V1-09, nên V1-10 phải hợp nhất **sau** V1-09 (đã sửa bảng 3.1: V1-10 phụ thuộc V1-09).

Đối chiếu bất biến 1–11 lần cuối:

| Bất biến | Kế hoạch đụng ở | Giữ thế nào |
|---|---|---|
| 1 không "đơn = video", ID ổn định | V1-17 (UI-E04 theo `evidenceId`) | Tra theo ID, không theo mã đơn |
| 2 ID phiên/kiện trước khi quay | V1-11 | Không đổi trình tự tạo bản ghi; dừng khi vào nền đi qua đường lưu sẵn có |
| 3 trạng thái tệp tách, chỉ máy chủ tới `uploaded`/`verified` | V1-02, V1-08, V1-09, V1-10, V1-13 | Sự kiện mới chỉ `origin: 'device'` tới `queued`; "Chờ Wi‑Fi" là lý do hiển thị, không phải trạng thái mới; test giữ nguyên `file-state.test.ts` |
| 4 bản gốc bất biến | V1-13, V1-15, V1-17 | Băm/phát chỉ đọc; xóa chỉ ở V1-15 theo yêu cầu xóa tài khoản (R-2) |
| 5 không tự liên kết | V1-07 | Tệp của uid khác không bị gán lại cho uid hiện tại |
| 6 không dữ liệu giả | V1-08, V1-10, V1-11 | Bỏ dữ liệu minh họa; gián đoạn ghi `interrupted`, không ghép |
| 7 lịch sử, kiểm toán bất biến | V1-04, V1-14 | Trigger chỉ Admin SDK ghi; `accountDeletions` client không đọc/ghi. Người dùng thường vẫn không sửa/xóa được nhật ký; `auditEvents` của shop chỉ bị máy chủ xóa khi purge theo yêu cầu xóa tài khoản của chủ, sau 30 ngày, không có `legalHold`/tranh chấp (điều phối chốt, mục 7.5) |
| 8 cô lập shop, không URL công khai | V1-04, V1-06, V1-14 | Test chéo shop cho mọi luật mới; không thêm URL đọc |
| 9 không xóa bằng chứng bị giữ | V1-14, V1-15 | Chặn khi tranh chấp mở; `legalHold`; không có dọn theo hạn lưu |
| 10 dữ liệu tối giản | – | Không đổi mô hình đơn |
| 11 ngôn ngữ trung thực | V1-03, V1-11, V1-18, V1-19, V1-20 | Câu v1 về thời hạn, tải khi app mở, mã băm, vị trí; test chuỗi |

**Điểm cần điều phối/người dùng duyệt (chưa tự chốt):**

| # | Câu hỏi | Phương án | Khuyến nghị |
|---|---|---|---|
| R-1 | Lưu `uid` trong `accountDeletions` sau khi đã xóa tài khoản | A. Lưu uid (định danh giả danh, không email). B. Lưu băm uid có "pepper" bí mật. C. Không lưu gì định danh | A cho v1, rà pháp lý (C-2); B nếu luật sư yêu cầu |
| R-2 | **Ngoại lệ bất biến 4:** xóa tài khoản xóa tệp bằng chứng trên máy (kể cả chưa tải) sau khi máy chủ xác nhận | A. Xóa (người dùng yêu cầu, có cảnh báo + tích xác nhận riêng). B. Chặn xóa khi còn tệp chưa tải. C. Không xóa tệp cục bộ, chỉ thoát | A (điều phối đã định hướng "xóa dữ liệu cục bộ sau khi thành công"); ghi ngoại lệ vào CLAUDE.md bất biến 4 như Q-26j sau khi duyệt |
| R-3 | Chuyển trạng thái mới `needs_attention -> queued` do người dùng bấm Thử lại (chỉ lỗi máy chủ từ chối) | A. Thêm như V1-08. B. Không cho, chỉ hiện hướng dẫn liên hệ hỗ trợ | A (Q-24h yêu cầu nút thử lại); BA ghi vào docs/02 |
| R-4 | Hạn dọn dữ liệu máy chủ sau khi xóa tài khoản | A. 30 ngày. B. Ngay lập tức. C. 7 ngày | A; câu "sau 30 ngày" ở app, web, store phải khớp (câu chung: decisions Q-29 / V1-20) |
| R-5 | Nếu cổng thiết bị đo băm JS quá chậm (ví dụ < 20 MB/giây, 1 GB > 50 giây) | A. Chấp nhận cho v1, ghi Trợ giúp. B. Module băm native trước khi phát hành | Quyết sau số liệu G-5; chuẩn bị B như PR dự phòng |
| R-6 | QA-13 (bổ sung sản phẩm sau khi quay) chỉ đạt một phần: sửa đơn khóa khi đã có phiên (Q-22ah) | A. Chấp nhận v1, ghi vào checklist và Trợ giúp. B. Làm sửa đơn có lịch sử sau khi quay trước v1 (PR L) | A; B là việc đầu tiên sau v1 |
| R-7 | Sàn hệ điều hành (O-20) và bundle id chính thức (O-11) cho bản store đầu | – | Người dùng chốt trước khi tải bản đầu (S-2); kế hoạch dùng sàn kỹ thuật và giữ chỗ `vn.doncung.app` |
| R-8 | Công tắc báo lỗi ứng dụng mặc định bật hay tắt | A. Bật, có công tắc tắt và nêu trong chính sách. B. Tắt, người dùng tự bật | A, rà pháp lý (C-2) |

### 7.4 Vòng 3: kết luận

Sau hai lượt sửa, không còn PR vượt ngân sách, không có phụ thuộc vòng, mỗi chỗ chạm bất biến đều có cách giữ hoặc được nêu thành câu hỏi R-x. Rủi ro còn lại chủ yếu nằm ở **phần chỉ kiểm được trên thiết bị** (camera khi vào nền, tốc độ băm, tải tệp lớn trên 4G, build iOS với `useFrameworks: "dynamic"` + Crashlytics + module cục bộ): đều nằm trong cổng G của release-checklist và có phương án tách PR nếu hỏng. Kế hoạch ổn để bắt đầu làn A.

### 7.5 Điều phối duyệt kế hoạch (2026-10-30)

Kế hoạch **được chấp nhận**. Các điểm R-x được điều phối chốt thay người dùng (người dùng đã giao toàn quyền quyết định cho điều phối, chế độ tự động):

| # | Chốt | Ghi chú |
|---|---|---|
| R-1 | **A** — lưu `uid` (không email, không tên) trong `accountDeletions` | Nêu trong chính sách quyền riêng tư (V1-19); B nếu rà pháp lý C-2 yêu cầu |
| R-2 | **A** — xóa tệp cục bộ sau khi máy chủ xác nhận xóa tài khoản, có cảnh báo + tích xác nhận riêng khi còn tệp chưa tải | V1-15 ghi ngoại lệ vào bất biến 4 trong `CLAUDE.md` (giống Q-26j); vẫn chặn khi còn tranh chấp mở (bất biến 9) |
| R-3 | **A** — thêm `needs_attention -> queued` do người dùng bấm Thử lại, chỉ cho lỗi máy chủ từ chối | V1-08 cập nhật docs/02 cùng PR |
| R-4 | **A** — 30 ngày | Một hằng số; câu chữ app/web/store khớp |
| R-5 | **A tạm** — v1 dùng băm JS có nhường luồng; quyết lại theo số đo G-5 | PR native dự phòng chỉ làm nếu đo chậm |
| R-6 | **A** — chấp nhận QA-13 một phần cho v1, ghi Trợ giúp + checklist | Sửa đơn có lịch sử sau khi quay là việc đầu tiên sau v1 |
| R-7 | Sàn kỹ thuật của Expo SDK 58/RN (O-20); bundle id giữ chỗ `vn.doncung.app` | Người dùng xác nhận ở S-2 trước lần tải đầu (không đổi được sau đó) |
| R-8 | **A** — báo lỗi ứng dụng mặc định bật, có công tắc tắt, nêu trong chính sách | |

**Purge dữ liệu shop khi xóa tài khoản (điều phối chốt sau review PR #40):** xóa cả shop gồm `auditEvents` theo yêu cầu xóa của chủ, sau 30 ngày, trừ khi có `legalHold`/tranh chấp; chỉ giữ `accountDeletions` (uid, thời điểm, `shopIds`, lý do kỹ thuật; không email/tên). Áp dụng ở V1-14 (test purge), V1-19 (chính sách).

`APP_ENV`: giữ giá trị `prod` đang dùng, nhận thêm bí danh `production` (đúng như kế hoạch).
