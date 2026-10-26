# Nhật ký quyết định kỹ thuật (ADR) và câu hỏi cần duyệt

> **Đây là đề xuất của đội kỹ thuật, CHƯA được người dùng duyệt**, trừ khi một mục ghi rõ "Đã chốt ở D-xx". ADR-xx là quyết định *kỹ thuật*, tách khỏi D-xx (quyết định nghiệp vụ, [docs/README](../README.md#nhật-ký-quyết-định)) và O-xx (câu hỏi mở nghiệp vụ). Không mục nào ở đây chốt O-xx. Ngày kiểm tra thư viện: **2026-10-26**. Chi tiết so sánh: [architecture.md mục 11](architecture.md#11-lựa-chọn-thư-viện-đề-xuất-chờ-duyệt).

Trạng thái dùng trong bảng: **Đã áp dụng trong khung** (có mã/cấu hình, đổi được nếu không duyệt) · **Đề xuất — cần spike** (chưa thể kết luận nếu chưa thử trên thiết bị thật) · **Đề xuất** (chờ duyệt).

## Bảng tóm tắt

| ADR | Quyết định | Trạng thái |
|---|---|---|
| 001 | Expo (SDK 58) dev build + prebuild, không Expo Go | Đã áp dụng trong khung |
| 002 | `@react-native-firebase` (không dùng Firebase JS SDK cho app) | Đề xuất — cần spike S4/S6 |
| 003 | Camera/ghi video: thử `react-native-vision-camera` v5, so với `expo-camera` | Đề xuất — cần spike S1 |
| 004 | Tải nền resumable: thử `@kesha-antonov/react-native-background-downloader`; dự phòng module native tự viết. SQLite (`expo-sqlite`) cho hàng đợi. Mã băm: spike S3 | Đề xuất — cần spike S2/S3 |
| 005 | Phân quyền bằng tài liệu `members` trong Rules, không dùng custom claims | Đã áp dụng trong Rules mẫu |
| 006 | Storage từ chối client; tải lên qua phiên resumable và đọc qua URL có thời hạn do Cloud Function cấp | Đã áp dụng trong `storage.rules` — cần spike S2/S5 |
| 007 | Tài liệu bằng chứng tạo ở `queued`; trạng thái ghi hình chỉ ở thiết bị | Đã áp dụng trong Rules mẫu |
| 008 | State: Zustand; điều hướng: Expo Router; validate: zod; i18n: i18next | i18next và Expo Router đã áp dụng (ADR-013); còn lại Đề xuất |
| 009 | Ba môi trường Firebase + Emulator; bật App Check | Đề xuất |
| 010 | Công cụ: ESLint 9, TypeScript 6.0, Jest 30, Prettier | Đã áp dụng trong khung |
| 011 | Không ép duy nhất cứng cho mã đơn; phát hiện trùng khi truy vấn/đồng bộ | Đề xuất — cần BA (Q-03) |
| 012 | `src/bootstrap` làm composition root (nhường `src/app` cho Expo Router) | Đã áp dụng trong khung |
| 013 | Khung giao diện: Expo Router 58, 4 tab cấu hình ở một nơi, bảng route↔`UI-xx`, adapter điều hướng | Đã áp dụng trong khung (chờ duyệt) |
| 014 | Icon: `@expo/vector-icons` (chỉ Ionicons) sau lớp `Icon`; token qua `useTheme()` | Đã áp dụng trong khung (chờ duyệt) |
| 015 | Test giao diện: `@testing-library/react-native` 14 + `expo-router/testing-library` | Đã áp dụng trong khung |

---

## ADR-001 — Expo dev build + prebuild (CNG), không Expo Go

- **Bối cảnh:** D-03 chốt React Native nhưng chưa chọn Expo hay bare. Cần module native (camera, tải nền, Firebase) nên không dùng Expo Go.
- **Quyết định đề xuất:** Expo SDK 58 (`expo` 58.0.x, React Native 0.88.0, React 19.3.0) với dev build và `expo prebuild`; thư mục `ios/`, `android/` được sinh ra và hiện đang `.gitignore`.
- **Lý do:** ít khóa chặt nhất — nếu thư viện chọn cần mã native tùy biến hoặc cần tinh chỉnh dự án, có thể commit thư mục native và chuyển thành bare bất cứ lúc nào; bộ phiên bản đồng bộ theo SDK giảm rủi ro nâng cấp; config plugin giúp tái lập cấu hình native.
- **Phương án khác:** RN CLI thuần — toàn quyền nhưng tự bảo trì cấu hình và nâng cấp.
- **Hệ quả/chưa kiểm chứng:** chưa build native (không có Xcode/Android SDK). Đã kiểm chứng `expo export` cho iOS và Android (đóng gói JS). `bundleIdentifier`/`package` hiện là chỗ giữ chỗ `vn.doncung.app.dev` (xem Q-06).

## ADR-002 — `@react-native-firebase` cho app

- **Quyết định đề xuất:** dùng `@react-native-firebase/{app,auth,firestore,functions,app-check}` 27.1.0 (2026-10-23). Firebase JS SDK 13.1.0 chỉ dùng cho test Rules ở Node.
- **Lý do:** offline-first là yêu cầu cứng (QA-02). Firebase JS SDK trên React Native không có IndexedDB nên không có bộ nhớ đệm ngoại tuyến bền ([firebase-js-sdk#7947](https://github.com/firebase/firebase-js-sdk/issues/7947)); bản RNFirebase bọc SDK native — theo thiết kế có bộ nhớ đệm bền (cần xác nhận).
- **Phương án khác:** Firebase JS SDK + tự xây lớp lưu ngoại tuyến — nhiều mã tự bảo trì, rủi ro mất ghi.
- **Cần kiểm chứng:** S4 (tương thích RN 0.88/Expo 58, build cả hai nền tảng), S6 (ghi chờ sống sót khi kill app; hành vi khi Rules từ chối lúc đồng bộ). Chưa cài vào khung vì cần tệp cấu hình Firebase và build native.

## ADR-003 — Camera và ghi video

- **Quyết định đề xuất:** spike `react-native-vision-camera` 5.2.3 (2026-08-20; Nitro; `Recorder` ghi ra tệp, có `maxFileSize`, `isPaused`, callback lỗi) so với `expo-camera` 58.0.12 (2026-10-21). Chưa chọn.
- **Điểm cần biết từ mã nguồn thư viện:** VisionCamera v5 ghi vào **tệp tạm** → app phải chuyển sang thư mục bền ngay khi kết thúc và ghi bản ghi `recording` vào SQLite *trước* khi bắt đầu (kiến trúc mục 6). Gói không kèm config plugin Expo → khai báo quyền thủ công.
- **Tiêu chí chọn:** không mất phần đã ghi khi cuộc gọi/thu hồi camera/hết dung lượng/kill app; lỗi báo rõ nguyên nhân; ghi thẳng ra tệp; ổn định khi quay ≥ 20 phút và nhiều video liên tiếp.
- **Quét mã:** theo thư viện camera đã chọn (`react-native-vision-camera-barcode-scanner` 5.2.3 hoặc `CameraView` của expo-camera).

## ADR-004 — Tải nền resumable, hàng đợi bền, mã băm

- **Quyết định đề xuất:**
  - Hàng đợi/phiên cục bộ: bảng SQLite bằng `expo-sqlite` 58.0.14 (giao dịch, truy vấn trạng thái; MMKV 4.3.2 không phù hợp cho hàng đợi có thứ tự).
  - Tải nền: spike `@kesha-antonov/react-native-background-downloader` 4.6.4 (2026-10-21; có tải lên nền iOS+Android, nối lại task sau khi khởi động lại, Expo plugin). `expo-file-system` 58 chỉ hỗ trợ nền iOS (Android bỏ qua), `react-native-background-upload` 6.6.0 bản gốc ngừng từ 2022. Nếu spike thất bại (không hỗ trợ PUT theo khối có `Content-Range` tới session URI của Cloud Storage, hoặc không ổn định trên Android): viết module native tối thiểu bằng Expo Modules (iOS `URLSession` nền, Android WorkManager).
  - Mã băm SHA-256: spike S3 (`expo-file-system` `file.digest('SHA-256')` hay `react-native-quick-crypto` 1.1.8) — không nạp cả video vào bộ nhớ JS.
- **Giới hạn nền tảng phải phản ánh trên UI (bất biến #11):** iOS không tiếp tục sau khi người dùng vuốt tắt app; Android 15 giới hạn dịch vụ foreground `dataSync` 6 giờ/24 giờ ([Android](https://developer.android.com/develop/background-work/services/fg-service-timeout)). UI chỉ nói "Sẽ tiếp tục khi có thể; mở app nếu bị tạm dừng".
- **Hệ quả:** đây là rủi ro kỹ thuật cao nhất; không nên bắt đầu làm tính năng tải lên trước khi có kết quả S2/S3.

## ADR-005 — Phân quyền bằng tài liệu `members`, không custom claims

- **Quyết định:** Rules đọc `shops/{shopId}/members/{uid}` (`status`, `roles[]`) ở mỗi thao tác.
- **Lý do:** (a) thu hồi quyền có hiệu lực ngay — docs/07 yêu cầu; claims chỉ đổi khi làm mới token (khoảng một giờ); (b) trung lập với O-03 (nhiều shop/một tài khoản) vì quyền theo từng shop.
- **Đánh đổi:** thêm một lần đọc tài liệu cho mỗi đánh giá Rules (tính phí đọc; giới hạn 10 truy cập tài liệu cho yêu cầu đơn). Có thể thêm claims làm lớp tối ưu sau, không thay thế kiểm tra thành viên.
- **Cảnh báo:** nhóm vai trò trong Rules là **khung tạm** vì ma trận quyền (O-07) chưa chốt. Không dùng làm căn cứ nghiệp vụ.

## ADR-006 — Storage từ chối client; Function cấp phiên tải và URL đọc

- **Quyết định đề xuất:** `storage.rules` từ chối mọi truy cập client. Tải lên qua phiên resumable do Function cấp; đọc qua URL có thời hạn do Function cấp (+ audit).
- **Lý do:** (1) tải nền cần client PUT thẳng tới một URL có thể tiếp tục bằng trình tải nền của hệ điều hành, không qua SDK Storage; (2) kiểm soát đường dẫn đích, một lần ghi (bản gốc bất biến, #4); (3) `getDownloadURL()` tạo URL kèm token không hết hạn → vi phạm #8.
- **Phương án B:** SDK Firebase Storage từ client + Rules (đơn giản, Rules thực thi trực tiếp, test Rules đầy đủ) nhưng khó đáp ứng tải nền (D-07).
- **Rủi ro:** session URI là bearer capability; Function xác minh có giới hạn thời gian cho video lớn (S5).
- **Hệ quả:** nếu bác bỏ phải viết lại `storage.rules` và test truy cập chéo shop tương ứng.

## ADR-007 — Tài liệu bằng chứng tạo ở `queued`

- **Quyết định:** `recording` và `saving_local` chỉ có ở SQLite thiết bị; tài liệu bằng chứng trên Firestore tạo khi tệp đã đóng, đọc được, đã có mã băm. Phiên thì tạo *trước* khi quay. Rules chỉ cho client tạo ở `queued` và cập nhật trong tập `queued/uploading/upload_failed/needs_attention/unrecoverable`.
- **Lý do:** tiết kiệm ghi Firestore; tránh bản ghi cho tệp chưa tồn tại; giữ `uploaded/verified/hash_mismatch` hoàn toàn thuộc máy chủ (bất biến #3).
- **Đánh đổi:** thiết bị khác không thấy tệp đang ghi/đang lưu — chấp nhận được vì phiên (có trạng thái `recording`) đã hiển thị.

## ADR-008 — State, điều hướng, validate, i18n

- Zustand 5.0.16 cho state UI; không thêm TanStack Query (Firestore đã có luồng realtime + cache). Expo Router 58.0.26 cho điều hướng (route mỏng, màn hình ở `features/*/ui`; màn quay ẩn tab bar). zod 4.6.7 để parse dữ liệu ở biên khi có tài liệu Firestore đầu tiên; chưa thêm react-hook-form. `i18next` 26.5.11 + `react-i18next` 17.1.9 **đã cài** trong khung; tiếng Việt mặc định (O-17 chưa chốt ngôn ngữ khác).
- Chưa cài các gói đề xuất ngoài i18n để khung không kéo phụ thuộc chưa cần.

## ADR-009 — Môi trường Firebase và App Check

- **Đề xuất:** ba dự án (`dev`, `staging`, `prod`) + Emulator cục bộ (`demo-doncung`); tệp cấu hình Firebase của app không commit, nạp lúc build; bật App Check (App Attest/Play Integrity) cho Firestore/Functions để giảm lạm dụng — không thay thế Rules.
- **Chưa làm:** không có dự án Firebase thật nào được tạo hoặc tham chiếu trong khung (`firebase.json` chỉ có emulator, không `.firebaserc`). Cần người dùng cung cấp dự án và **chọn khu vực dữ liệu** (Q-08).

## ADR-010 — Công cụ

- ESLint **9.39.5** (không phải 10.x mới nhất): `eslint-plugin-react` 7.37.5 và `eslint-plugin-import` 2.32.0 (qua `eslint-config-expo` 58.0.4) chưa khai báo hỗ trợ ESLint 10. TypeScript **~6.0.3** theo mẫu Expo SDK 58 (7.0.2 đã phát hành). Jest 30 + `jest-expo` 58.0.12, Prettier 3.9. Node 22 (`.nvmrc`).
- Cảnh báo nhỏ: `npm ci` trên Node 22 in cảnh báo `EBADENGINE` từ `@firebase/storage-compat` (yêu cầu Node ≥ 24.12) — chỉ là gói dùng cho test Rules; các test vẫn chạy. Nâng Node lên 24 khi Expo/RN chấp nhận.
- Nâng cấp ESLint/TypeScript khi hệ sinh thái đồng bộ; ghi lại tại đây.

## ADR-011 — Phát hiện trùng đơn thay vì ép duy nhất (đề xuất, cần BA)

- Firestore Rules không ép duy nhất theo trường; dùng mã đơn làm ID tài liệu mâu thuẫn bất biến #1 và không sửa được mã nhập sai. Đề xuất cho phép trùng tồn tại ở mức dữ liệu và **phát hiện khi truy vấn/đồng bộ** (A02: kiểm tra trùng "mã đơn + nguồn bán" trước khi tạo; `ORDER_DUPLICATE` bắt chọn, không tự gộp). Xem Q-03.

## ADR-012 — `src/bootstrap` thay vì `src/app`

- Expo Router coi `src/app` là thư mục route. Để không xung đột nếu chọn Expo Router (ADR-008), composition root nằm ở `src/bootstrap`.

## ADR-013 — Khung giao diện và điều hướng (Expo Router)

Chi tiết cấu trúc: [layout.md](layout.md). Ngày kiểm tra phiên bản: 2026-10-26.

- **Expo Router 58.0.26** (đúng phiên bản của Expo SDK 58 trong `expo/bundledNativeModules.json`), kèm `react-native-screens` 4.30.0, `react-native-safe-area-context` 5.10.1, `expo-linking` 58.0.14, `expo-constants` 58.0.13, `react-dom` 19.3.0 (peer bắt buộc để cây phụ thuộc của expo-router giải được; chỉ dùng cho web, app không build web). `package.json#main` = `expo-router/entry`; route ở `src/app`; `src/bootstrap/Providers.tsx` là composition root (ADR-012).
- Môi trường tạo khung không gọi được `api.expo.dev`, nên **không chạy được `npx expo install`**; phiên bản lấy từ `bundledNativeModules.json` rồi `npm install` đúng bản đó (cùng nguồn mà `expo install` dùng). Lần cài sau nên dùng `npx expo install` thông thường.
- **Thanh tab: 4 tab theo D-11** (Tổng quan · Đơn hàng · Hàng hoàn · Đồng bộ), cấu hình MỘT nơi ở `src/bootstrap/navigation/tab-config.ts`. Không theo mockup (O-18 chưa chốt). Chuyển sang phương án O-18 = thêm một mục + một thư mục tab (xem layout.md mục 6).
- **Màn quay (UI-C03, UI-D04) nằm ngoài nhóm `(tabs)`** nên thanh tab ẩn; rời màn đi qua `ConfirmDialog` nhờ `usePreventRemove` của Expo Router (bọc trong `useConfirmBeforeLeave` ở `src/platform/navigation.ts`). Đã kiểm chứng bằng router chạy trong bộ nhớ (Jest), **chưa kiểm chứng nút Back phần cứng Android và cử chỉ vuốt iOS trên thiết bị**.
- **Một bảng route ↔ `UI-xx`** ở `src/core/navigation/routes.ts` (TypeScript thuần); test đối chiếu bảng với các tệp thật trong `src/app`. Màn hình chỉ biết `RouteDef`, không rải chuỗi đường dẫn; `src/platform/navigation.ts` là adapter duy nhất gọi Expo Router (đổi thư viện điều hướng chỉ sửa tệp này).
- Header: dùng `Screen`/`ScreenHeader` của design system (`headerShown: false` cho navigator) để iOS và Android giống nhau và tràn viền đúng; không dùng header gốc của navigator.

## ADR-014 — Icon và token giao diện

- **`@expo/vector-icons` 15.1.1, chỉ import `@expo/vector-icons/Ionicons`** (import gốc làm bundle chứa mọi bộ font: kiểm tra `expo export` giảm từ nhiều bộ font xuống một, `Ionicons.ttf` 390 KB), kèm `expo-font` 58.0.10 và `expo-asset` 58.0.18 (phụ thuộc bắt buộc của vector-icons). Là mô-đun native nhẹ có sẵn trong Expo SDK, không phải thư viện native nặng. Mọi nơi dùng icon đi qua `src/shared/ui/Icon.tsx` (bảng tên trừu tượng → glyph) nên đổi bộ icon chỉ sửa một tệp. Font tải bất đồng bộ lần đầu nên icon có thể hiện trễ một nhịp; chưa giữ splash chờ font.
- Token màu/chữ/khoảng cách vẫn ở `src/core/theme`; component lấy qua `useTheme()` (`src/shared/ui/theme.ts`) thay vì import trực tiếp, để khi O-17 (chế độ tối) được chốt chỉ đổi hook này. Chưa làm chế độ tối. Giá trị màu mới (`*Soft`, `scrim`, `cameraBackground`) là **tạm** như các màu cũ (Q-05a), có test tương phản.

## ADR-015 — Kiểm thử giao diện

- `@testing-library/react-native` **14.1.0** (peer `test-renderer`, đã có sẵn qua `jest-expo`; API `render`/`fireEvent` là bất đồng bộ, phải `await`) và `expo-router/testing-library` (chạy router thật trên `src/app` trong bộ nhớ). `jest.setup.ts` thay font icon bằng component hiển thị tên glyph để test biết biểu tượng nào được vẽ.
- Giới hạn: không thay thế kiểm thử trên thiết bị (bố cục thật, bàn phím, vùng an toàn, Back phần cứng, font scale thật).

---

## Câu hỏi cần người dùng / BA duyệt

Mỗi câu có phương án và khuyến nghị. Không có câu nào trong số này chốt O-xx.

### Q-01 — Duyệt các ADR đề xuất và kế hoạch spike
- Phương án A (khuyến nghị): duyệt ADR-001…012 làm *hướng*, và **chưa khóa** thư viện native (002, 003, 004) cho đến khi có kết quả spike S1–S6 trên thiết bị thật; làm spike trước tính năng ghi hình/tải lên.
- Phương án B: khóa ngay các thư viện đề xuất — nhanh hơn, nhưng rủi ro làm lại cao nhất ở camera và tải nền.
- Cần: ai cung cấp thiết bị thật iOS/Android và dự án Firebase dev.

### Q-02 — Nhãn *Đã lưu trên máy* và *Chờ tải lên* ([docs/09 mục 3](../09-ui-ux-design.md#chuẩn-hiển-thị-trạng-thái-bằng-chứng))
Cả hai nhãn cùng ánh xạ vào trạng thái nghiệp vụ "Chờ tải lên". Khung hiện: có *lý do chờ* (ví dụ mất mạng) → *Chờ tải lên*; không có → *Đã lưu trên máy*.
- Phương án A (khuyến nghị): giữ cách phân biệt này và BA ghi vào docs/09.
- Phương án B: chỉ dùng *Đã lưu trên máy* cho khoảnh khắc ngay sau khi lưu và *Chờ tải lên* sau khi đã xếp hàng/thử tải.
- Phương án C: gộp một nhãn — trái docs/09 hiện hành, không đề xuất.

### Q-03 — Trùng đơn khi tạo ngoại tuyến (A02, UI-J02)
A02 cho phép tạo bản nháp cục bộ "khi có cơ chế xử lý trùng và đồng bộ". Firestore không ép duy nhất.
- Phương án A (khuyến nghị, ADR-011): cho phép tạo ngoại tuyến; khi đồng bộ phát hiện trùng thì báo `ORDER_DUPLICATE` và bắt người dùng chọn/hợp nhất có lịch sử; không bao giờ tự gộp.
- Phương án B: chỉ cho tạo đơn *mới* khi có mạng (quét đơn đã có vẫn dùng được ngoại tuyến) — đơn giản hơn nhưng trái "mất mạng vẫn quay được" (A01) với mã chưa có.
- Phương án C: tạo bản nháp, đánh dấu "chưa xác nhận không trùng", cho quay nhưng chặn hoàn tất cho tới khi đồng bộ — phức tạp.

### Q-04 — Mã lỗi/thông báo cho BA bổ sung vào docs 04/05
Hiện docs chỉ có một số mã; nhiều tình huống chỉ có câu chữ mà chưa có mã, hoặc chưa có thông báo ba phần. Đề xuất để BA đặt tên chính thức (khung **chưa** thêm các mã này vào mã):

| Tình huống (nguồn) | Mã đề xuất |
|---|---|
| `RETURN_LIST_UNAVAILABLE`, `RETURN_SESSION_INTERRUPTED`, `RETURN_UPLOAD_PENDING` (docs/05 B01 chỉ mô tả hành vi, chưa có thông báo) | *thiếu câu thông báo ba phần* |
| "Kiện này đã có phiên đang thực hiện" (A03) | `PACKAGE_SESSION_ACTIVE` |
| "Thông tin đơn đã thay đổi ở thiết bị khác" (A03, B06, UI-J13) | `ORDER_CONFLICT` / `RETURN_COUNT_CONFLICT` |
| Tệp không đọc được sau khi ghi (A06) | `LOCAL_FILE_UNREADABLE` |
| Phiên gián đoạn (A05/UI-J14) | `RECORDING_INTERRUPTED` |
| Lỗi xác thực khi tải lên; hết hạn mức; gói không cho lưu thêm (A07) | `UPLOAD_AUTH_REQUIRED`, `STORAGE_QUOTA_EXCEEDED`, `PLAN_STORAGE_BLOCKED` |
| Tải lên thất bại / mã băm không khớp (A07, QA-09) | `UPLOAD_FAILED`, `EVIDENCE_HASH_MISMATCH` |
- Khuyến nghị: BA chốt danh sách và câu chữ; kỹ thuật thêm vào `src/core/errors/codes.ts` và i18n cùng lúc.

### Q-05 — Chỗ spec thiếu/mâu thuẫn phát hiện được
| # | Vấn đề | Đề xuất |
|---|---|---|
| a | docs/09 mô tả màu chỉ bằng lời; chưa có mã màu/Figma. Khung dùng giá trị **tạm** (đạt tương phản 4.5:1) | Thiết kế chốt giá trị; đổi một chỗ ở `core/theme/colors.ts` |
| b | docs/08 mục QA-01…14 nhưng agent `senior-mobile-dev` ghi QA-01…12 | Đã sửa trong agent (cùng đợt này) |
| c | Mốc bắt đầu tính hạn lưu (O-06) ảnh hưởng schema `retention` | Giữ `retention.startedFrom` là dữ liệu cấu hình, không hard-code; chờ O-06 |
| d | O-09 (tiếng khi từ chối micro) là cấu hình theo shop — cần tài liệu cài đặt shop; chưa mô hình hóa | Thêm `shops/{id}/settings` khi chốt O-09 |
| e | A03 yêu cầu "một phiên hoạt động cho một kiện" xuyên tài liệu; Rules mẫu chưa ép | Thiết kế bằng `activeSessionId` + `getAfter` khi làm `packing` |
| f | O-07 (ma trận quyền) chưa chốt; Rules mẫu dùng khung tạm | Cập nhật Rules + test khi chốt |
| g | O-02 (nhập video thư viện) chưa chốt; Rules hiện **từ chối** `origin ≠ in_app_capture` | Mở khi chốt, kèm nhãn nguồn và mức bảo đảm thấp hơn (docs/06) |
| h | docs/06 "Đã tải lên = máy chủ nhận đủ tệp theo giao thức tải lên" — kỹ thuật định nghĩa là thời điểm đối tượng Storage hoàn tất ghi | Xác nhận |

### Q-06 — Tên ứng dụng / định danh gói (liên quan O-11, không chốt O-11)
`bundleIdentifier`/`package` là `vn.doncung.app.dev` (chỗ giữ chỗ) và **không đổi được sau khi đã phát hành trên cửa hàng**.
- Khuyến nghị: chốt tên miền/định danh trước bản build gửi cửa hàng đầu tiên (không cần cho phát triển nội bộ); đến lúc đó cần kiểm tra nhãn hiệu như CLAUDE.md đã ghi.

### Q-07 — Dịch vụ crash/analytics
Chưa chọn. Mọi lựa chọn phải đi qua lọc dữ liệu (không mã đơn/mã vận đơn/thông tin khách).
- Khuyến nghị: chưa tích hợp ở bản đầu; khi cần, chọn một dịch vụ và cấu hình bộ lọc trước, ghi vào ADR.

### Q-08 — Khu vực dữ liệu Firebase (Firestore/Storage/Functions)
Khu vực không đổi được sau khi tạo và liên quan độ trễ, chi phí và yêu cầu pháp lý dữ liệu (D-08: cần rà soát pháp lý).
- Khuyến nghị: người dùng/pháp lý chốt khu vực trước khi tạo dự án `staging`/`prod`; kỹ thuật không tự chọn.

### Q-09 — Bản gốc cục bộ có được sao lưu bởi iCloud/Android Auto Backup?
Video lớn có thể làm đầy bộ nhớ đám mây cá nhân của người dùng; nhưng loại khỏi sao lưu nghĩa là đổi máy sẽ mất video chưa tải.
- Khuyến nghị: loại khỏi sao lưu tự động của hệ điều hành (hàng đợi tải lên là cơ chế bảo vệ chính) — xác nhận sau spike và cân nhắc UX.

### Q-10 — Ngưỡng cấu hình (chờ O-05)
Dung lượng trống tối thiểu để bắt đầu quay (A04), thời lượng video ngắn cảnh báo (A06): khung không đặt số; cần O-05 hoặc giá trị mặc định tạm do BA đề xuất.

### Q-11 — Khung giao diện: chỗ mockup khác tài liệu thiết kế, và quyết định cần duyệt
Khung (layout.md) bám docs/09; không theo mockup ở các điểm dưới. Không điểm nào chốt O-xx.
| # | Vấn đề | Cách xử lý trong khung / đề xuất |
|---|---|---|
| a | **O-18** thanh tab: mockup có nút Quét giữa, Thông báo, Cá nhân; D-11 có 4 tab | Dùng 4 tab D-11, cấu hình một nơi. Khuyến nghị (giữ như docs/09): chốt *Tổng quan · Đơn hàng · Quét · Hàng hoàn · Đồng bộ* khi BA duyệt; chi phí đổi nhỏ (layout.md mục 6) |
| b | **O-19** số màn trước camera | *Lưu và quay video* ở Tạo đơn nhanh đang đi tới Xem nhanh đơn (UI-C01) như đặc tả A02→A03; chỉ đổi hằng số `AFTER_CREATE_ROUTE`. Khuyến nghị: bỏ màn Xem nhanh khi đơn vừa tạo (người dùng vừa nhập xong), giữ cho đơn quét ra có sẵn |
| c | **O-02** nút thư viện ảnh | Không có nút trên màn quay |
| d | **O-14** lối vào Tranh chấp | Đã có route nhóm G nhưng **chưa có nút dẫn tới** (cần hồ sơ đơn/hàng hoàn thật). Khuyến nghị giữ như docs/09: vào từ hồ sơ đơn, hồ sơ hàng hoàn và "việc cần xử lý" |
| e | Nhãn nút tạo đơn: docs/04 A02 ghi *Lưu nhanh và tiếp tục* / *Quay ngay, khai báo sau*, docs/09 ghi *Lưu và quay video* / *Bỏ qua thông tin sản phẩm* | Dùng nhãn docs/09. Khuyến nghị: BA thống nhất một bộ nhãn |
| f | Bộ lọc danh sách hàng hoàn: docs/05 B01 (chưa bắt đầu, đang mở kiện, đang kiểm tra, cần xử lý, chờ tải lên, hoàn tất) khác docs/09 UI-D01 (đang tiếp nhận, đang kiểm tra, đã kiểm tra, có sai lệch, chưa đồng bộ) | Dùng bộ của docs/09. Cần BA thống nhất, vì bộ lọc phụ thuộc máy trạng thái hồ sơ hoàn (docs/02) |
| g | docs/09 UI-F01 cho "thử lại hàng loạt" và "thử lại" từng tệp, nhưng hàng đợi thật chưa có | Khung chỉ có nút *Chi tiết*; không đặt nút thử lại giả. Thêm cùng tính năng upload |
| h | Khuyến nghị O-18 đề cập Đồng bộ "để lỗi tải lên luôn thấy": chưa có huy hiệu số lỗi trên tab | Thêm huy hiệu khi có dữ liệu thật; ở Tổng quan đã có khối đồng bộ |
| i | Nhãn *Chờ tải lên* "ghi lý do": cần danh sách mã lý do (mất mạng, chờ Wi-Fi, hệ điều hành tạm dừng...) | Khung chỉ có `waiting_network`; BA/kỹ thuật chốt danh sách cùng Q-02 |
| j | Quyền thông báo trong menu tài khoản (UI-I04) và Thông báo (chuông ở mockup) | Không có chuông; chỉ mục *Thông báo* trong menu tài khoản theo docs/09 |

## Rủi ro nền tảng phát hiện (tóm tắt)

1. Tải nền không bảo đảm: iOS dừng khi vuốt tắt app; Android 15 giới hạn dịch vụ nền loại `dataSync`. Thư viện tải nền hiện có chưa kiểm chứng với giao thức resumable của Cloud Storage.
2. VisionCamera v5 ghi vào tệp tạm; mất tệp nếu không chuyển sang thư mục bền kịp (khi app bị kill giữa chừng) — cần thiết kế phục hồi và spike.
3. Firebase JS SDK trên React Native không có bộ nhớ đệm ngoại tuyến bền → bắt buộc RNFirebase (cần xác nhận hành vi thật).
4. Rules chỉ trả `permission-denied`, không phân biệt xung đột phiên bản; giới hạn 10 truy cập tài liệu mỗi yêu cầu đơn.
5. Firestore không ép duy nhất mã đơn; trùng đơn tạo ngoại tuyến chỉ phát hiện được sau.
6. Xác minh SHA-256 phía máy chủ cho video lớn bị giới hạn thời gian/chi phí Function.
7. Phiên bản mới nhất của một số công cụ (ESLint 10, TypeScript 7) chưa tương thích hệ sinh thái Expo; đã chọn bản tương thích.
8. Khung giao diện chỉ mới kiểm chứng bằng Jest/router trong bộ nhớ và `expo export`; **chưa chạy trên máy ảo/thiết bị**. Cần xem: tràn viền Android (khoảng trống khi hiện bàn phím, `KeyboardAvoidingView` ở `src/platform/layout.ts`), vùng an toàn, Back phần cứng/cử chỉ ở màn quay, font scale lớn, tải font icon lần đầu.
