# Khai báo quyền riêng tư cho App Store và Google Play (v1.0)

> **Trạng thái:** bản nháp để điền **Apple App Privacy** (App Store Connect > App Privacy) và **Google Play Data safety** (Play Console > App content > Data safety), chờ duyệt (release-checklist [C-4](../engineering/release-checklist.md#c-duyệt-câu-chữ-và-pháp-lý), [S-8](../engineering/release-checklist.md#s-tài-khoản-store-và-build)). Soạn 2026-10-30 (PR V1-20). Không phải quyết định D-xx.
>
> **Nguồn sự thật:** bảng "Dữ liệu lưu trên máy chủ" và các mục "Dữ liệu chỉ nằm trên điện thoại", "Báo lỗi ứng dụng" của trang chính sách quyền riêng tư `web/src/pages/chinh-sach-quyen-rieng-tu.astro` (PR V1-19, nhánh `claude/v1-19-web-legal-pages`, bản nháp chờ pháp lý C-2), đối chiếu với mã ở `main`. Nếu trang chính sách đổi, sửa tệp này cùng lúc; hai nơi phải nói cùng một điều.
>
> Tài liệu cùng bộ: [Nội dung trang ứng dụng](listing.md) · [Ghi chú cho người duyệt](review-notes.md).

## 1. Nguyên tắc khai báo

1. **"Thu thập" theo định nghĩa của store**, không theo cảm nhận:
   - Apple: "thu thập" là truyền dữ liệu ra khỏi thiết bị và lưu ở dạng đọc được lâu hơn thời gian cần để phục vụ yêu cầu; dữ liệu **chỉ xử lý trên thiết bị** thì không phải "thu thập" ([App privacy details][apple-privacy]).
   - Google: dữ liệu chỉ truy cập trên thiết bị và không gửi ra ngoài thì không phải khai là thu thập; chuyển cho **bên cung cấp dịch vụ** xử lý thay nhà phát triển không tính là "chia sẻ" ([Data safety, Play Console Help 10787469][gp-datasafety], *chưa đọc trực tiếp*, xem mục 7).
2. **Khai cả dữ liệu do SDK bên thứ ba thu thập** (Apple yêu cầu rõ; Google cũng vậy). App dùng `@react-native-firebase` 27.1.0: `app`, `auth`, `firestore`, `functions` (đã có), `crashlytics` (**[theo V1-16]**). Không có Firebase Analytics, không có SDK quảng cáo (`package.json`).
3. **Khi phân vân giữa khai và không khai, khai** (bất biến 11: không để người dùng tưởng app thu ít hơn thực tế). Ngoại lệ duy nhất: vị trí, vì chắc chắn không rời máy (mục 4).
4. Mọi dòng phụ thuộc PR chưa hợp nhất ghi **[theo V1-xx]**. Nếu V1-16 (Crashlytics) bị tách khỏi v1: **bỏ** các dòng Crash, Device ID, Product Interaction/App interactions và phần chẩn đoán từ báo lỗi (v1-release-plan mục 3.3 V1-16, 7.2 k).

## 2. Bảng dữ liệu của app (nguồn chung cho hai store)

| # | Dữ liệu cụ thể | Rời máy khi nào | Nơi lưu | Gắn với tài khoản | Xóa được? | Nguồn kiểm |
|---|---|---|---|---|---|---|
| D1 | Email đăng nhập | Đăng ký, đăng nhập, đặt lại mật khẩu | Firebase Authentication | Có | Có: xóa tài khoản (ngay) | `src/api/firebase/ops.ts` |
| D2 | Mật khẩu | Đăng ký, đăng nhập | Firebase Authentication (băm, bên vận hành không xem được) | Có | Có: cùng D1 | – |
| D3 | Họ tên (nếu người dùng tự nhập ở Sửa họ tên) | Khi lưu | Firebase Authentication `displayName` | Có | Có: cùng D1 | **[theo V1-05]** nối Firebase; đăng ký không hỏi tên |
| D4 | Mã tài khoản nội bộ (uid) đi kèm mỗi bản ghi (`createdBy`), thành viên cửa hàng | Khi tạo bản ghi trên máy chủ | Firestore | Là định danh tài khoản | Có, trừ bản ghi xóa tài khoản `accountDeletions` (giữ uid, không email/tên; R-1) | `remote-documents.ts`, `evidence-document.ts` |
| D5 | Tên cửa hàng, nguồn bán, vai trò | Tạo/sửa cửa hàng | Firestore `shops` | Có | Có: sau 30 ngày kể từ khi xóa tài khoản (R-4) | `firebase/functions/src/shop.ts` |
| D6 | Mã đơn, nguồn bán, mã vận đơn, tên/phân loại/số lượng sản phẩm, số kiện, bản chụp thông tin đơn lúc quay, trạng thái phiên | Khi đơn đã có phiên quay (Q-23) | Firestore `orders`, `sessions` | Có | Có: sau 30 ngày | `features/orders/domain/remote-documents.ts` |
| D7 | Video đóng gói, video mở kiện, ảnh kiện hàng hoàn | Khi hàng đợi tải lên chạy (app đang mở) | Cloud Storage `shops/{shopId}/evidence/{id}/original` | Có | Có: sau 30 ngày | `features/upload` |
| D8 | Thông tin tệp: loại, mime, dung lượng, thời lượng, mã băm máy tính + mã băm máy chủ, giờ thiết bị lúc ghi, giờ máy chủ | Khi khai báo/tải tệp | Firestore `evidence` | Có | Có: sau 30 ngày | `evidence-document.ts` |
| D9 | Bản neo hồ sơ hàng hoàn: ID + nhãn (ví dụ RH-00001), không có nội dung hồ sơ | Khi tải ảnh/video hàng hoàn | Firestore `returns` | Có | Có: sau 30 ngày | `features/returns/domain/remote-documents.ts` |
| D10 | Phiên bản ứng dụng đi kèm bản ghi | Cùng D6–D9 | Firestore | Có | Có: sau 30 ngày | `appVersion` trong các `*Write` |
| D11 | Nhật ký thao tác của cửa hàng (loại thao tác, uid, thời điểm, giá trị trước/sau) | Khi máy chủ ghi nhận thay đổi | Firestore `auditEvents` (chỉ máy chủ ghi) | Có | Có: sau 30 ngày (điều phối chốt sau review PR #40) | **[theo V1-04]** trigger kiểm toán |
| D12 | Báo cáo lỗi: mã lỗi, stack (nhật ký thao tác trước lỗi tách ra D14), đời máy, phiên bản hệ điều hành, bộ nhớ trống, pin, hướng màn hình, phiên bản app | Khi app gặp lỗi, nếu công tắc bật (mặc định bật, R-8) | Firebase Crashlytics | **Không** (không `setUserId`; bộ che PII bỏ mã đơn/mã vận đơn/email/đường dẫn tệp) | Không theo tài khoản; tự xóa theo thời hạn của Crashlytics | **[theo V1-16]** |
| D13 | ID cài đặt Firebase (Firebase installation ID / UUID cài đặt của Crashlytics) | Cùng D12 | Firebase | **Không** | Đổi khi cài lại app; không xóa theo tài khoản | **[theo V1-16]** |
| D14 | Nhật ký thao tác kỹ thuật ngay trước lỗi (breadcrumb: màn đang mở, tên module, mã thao tác; không mã đơn/mã vận đơn/email/đường dẫn tệp) | Gửi kèm D12, cùng công tắc | Firebase Crashlytics | **Không** | Như D12 | **[theo V1-16]**; trang chính sách mục "Báo lỗi ứng dụng" |

**Không rời máy** (không khai là thu thập; nêu ở trang chính sách mục "Dữ liệu chỉ nằm trên điện thoại"):

| Dữ liệu | Vì sao chắc chắn không rời máy |
|---|---|
| Vị trí thiết bị lúc chụp ảnh kiện hàng hoàn (Q-26k) | Lưu ở bảng `return_media` trên SQLite; tài liệu khai báo bằng chứng không có trường vị trí (`src/features/upload/domain/evidence-document.ts`, Q-28a); ảnh chụp với `exif: false` (`src/platform/camera-photo.tsx`) và app không nhồi GPS vào tệp. **Chưa kiểm chứng trên thiết bị** rằng tệp ảnh do hệ điều hành ghi không mang GPS: release-checklist G-12 |
| Nội dung hồ sơ hàng hoàn (tình trạng, kiểm hàng, ghi chú) | Q-26c: chỉ bản neo D9 lên máy chủ |
| Hồ sơ tranh chấp, văn bản tóm tắt | Q-27: chỉ trên máy. Chia sẻ văn bản là hành động người dùng chủ động qua bảng chia sẻ của hệ điều hành (mục 5) |
| Lịch sử tìm kiếm trong app | Bảng `search_history` SQLite |
| Video/ảnh chưa tải lên; CSDL đơn | Thư mục tài liệu của app. Android: **đã có** `android.allowBackup: false` (V1-01, PR #43) nên không vào Auto Backup. iOS: **đã có** (V1-12, PR #46) đặt `isExcludedFromBackup` cho `Documents/evidence` và `Documents/SQLite` (Q-24d); chưa kiểm chứng trên máy (G-7) |
| Âm thanh | Không ghi âm, không xin micro (O-09, `app.json`) |

## 3. Apple App Privacy (App Store Connect)

Định nghĩa loại dữ liệu và mục đích theo [App privacy details][apple-privacy] (truy cập 2026-10-30). Mục đích "App Functionality" của Apple gồm xác thực người dùng, bật tính năng, bảo mật, **giảm crash**, hỗ trợ khách hàng; "Analytics" là đánh giá hành vi người dùng, nên báo lỗi xếp vào App Functionality.

### 3.1 Trả lời từng loại

| Loại dữ liệu Apple | Dữ liệu app (mục 2) | Thu thập | Gắn với danh tính (Linked to You) | Dùng để theo dõi (Tracking) | Mục đích |
|---|---|---|---|---|---|
| Contact Info > Email Address | D1 | Có | Có | Không | App Functionality |
| Contact Info > Name | D3 | Có | Có | Không | App Functionality |
| Identifiers > User ID | D4 | Có | Có | Không | App Functionality |
| User Content > Photos or Videos | D7 | Có | Có | Không | App Functionality |
| User Content > Other User Content | D5, D6, D8, D9, D11 | Có | Có | Không | App Functionality |
| Diagnostics > Other Diagnostic Data | D10; D12 phần trạng thái máy **[theo V1-16]** | Có | **Có** (D10 đi kèm bản ghi có uid) | Không | App Functionality |
| Diagnostics > Crash Data | D12 **[theo V1-16]** | Có | Không (xem 3.2) | Không | App Functionality |
| Identifiers > Device ID | D13 **[theo V1-16]** | Có | Không (xem 3.2) | Không | App Functionality |
| Usage Data > Product Interaction | D14 **[theo V1-16]** | Có | Không (cùng điều kiện 3.2) | Không | App Functionality (chẩn đoán lỗi) |

Mọi loại khác: **không thu thập** — Location (Precise, Coarse), Audio Data, Contacts, Health & Fitness, Financial Info, Purchases, Browsing History, Search History, Sensitive Info, Phone Number, Physical Address, Other Contact Info, Advertising Data, Performance Data (*kiểm lại với trang Firebase*, mục 6), Other Data.

**Tracking: không.** App không liên kết dữ liệu với dữ liệu bên thứ ba cho quảng cáo, không chia sẻ cho data broker; không cần App Tracking Transparency và không có `NSUserTrackingUsageDescription`.

### 3.2 Vì sao Crash Data, Device ID và Product Interaction khai "không gắn danh tính" (Q-29 / V1-20)

Apple coi dữ liệu là không gắn khi đã bỏ định danh trực tiếp trước khi thu thập và không tìm cách nối lại ([App privacy details][apple-privacy]). V1-16 thiết kế: không gọi `setUserId`, chỉ gửi mã lỗi + tên module + stack qua bộ che PII, không mã đơn/mã vận đơn/email/đường dẫn tệp; ID cài đặt là ngẫu nhiên, đổi khi cài lại, không lưu cạnh uid ở Firestore. Trang chính sách cũng viết "Chúng tôi không gắn báo cáo với tài khoản của bạn".

**Điều kiện giữ câu trả lời này** (nếu một điều không đúng thì đổi thành "Gắn với danh tính: Có"):

1. V1-16 hợp nhất đúng thiết kế (test logger không gửi PII, không `setUserId`, không `setCustomKey` chứa uid/shopId).
2. Trang công bố dữ liệu của Firebase cho Apple (mục 6) không ghi Crashlytics/Installations là "linked" theo mặc định.
3. Bên vận hành không bao giờ đối chiếu báo cáo lỗi với tài khoản (kể cả khi hỗ trợ khách).

Lưu ý: Apple ghi "Personal Information/Personal Data theo luật về quyền riêng tư được coi là gắn với người dùng". Nếu luật sư (C-2) xếp ID cài đặt là dữ liệu cá nhân theo pháp luật Việt Nam, khai "Có".

## 4. Google Play Data safety (Play Console)

*Không đọc trực tiếp được trang trợ giúp của Google trong môi trường soạn* (mục 7); tên loại dữ liệu, mục đích và câu hỏi dưới đây theo hiểu biết về biểu mẫu hiện hành: **đối chiếu từng tên với Console khi điền**.

### 4.1 Phần tổng quát

| Câu hỏi | Trả lời | Ghi chú |
|---|---|---|
| App có thu thập hoặc chia sẻ loại dữ liệu bắt buộc khai không? | Có | |
| Mọi dữ liệu thu thập có được mã hóa khi truyền không? | Có | Firebase SDK dùng TLS; tệp gửi bằng URL ký HTTPS (`createUploadSession`, `src/platform/resumable-upload.ts`). **Kiểm trên bản build** (G-3) rằng URL ký là `https://` |
| Cách tạo tài khoản | Tên người dùng và mật khẩu (email + mật khẩu) | Không có Apple/Google (O-15) |
| URL yêu cầu xóa tài khoản | `https://<tên miền thật>/xoa-tai-khoan/` | Giữ chỗ `don-chung.invalid` (D-4). Trang đã có: tên app, cách xóa trong app và qua email, dữ liệu xóa/giữ, thời hạn |
| Người dùng yêu cầu xóa một phần dữ liệu mà không xóa tài khoản được không? | Không (v1) | Xóa ảnh chụp nhầm (Q-26j) chỉ áp dụng ảnh chưa lên máy chủ, không phải yêu cầu xóa dữ liệu máy chủ |
| Đã có đánh giá bảo mật độc lập? | Không | |
| Cam kết chính sách Gia đình | Không áp dụng (đối tượng 18+, [listing.md](listing.md#53-google-play-đối-tượng-mục-tiêu-target-audience-and-content)) | |

### 4.2 Từng loại dữ liệu

"Chia sẻ" đều là **Không**: Firebase (Google) xử lý thay bên vận hành với vai trò bên cung cấp dịch vụ. "Xử lý tạm thời (ephemeral)": **Không** cho mọi loại (dữ liệu được lưu).

| Nhóm > loại Google | Dữ liệu app | Thu thập | Bắt buộc / Tùy chọn | Mục đích |
|---|---|---|---|---|
| Personal info > Email address | D1 | Có | Bắt buộc | App functionality; Account management |
| Personal info > Name | D3 | Có | Tùy chọn | Account management |
| Personal info > User IDs | D4 | Có | Bắt buộc | App functionality; Account management |
| Photos and videos > Photos | D7 (ảnh kiện hàng hoàn) | Có | Bắt buộc (xem dưới) | App functionality |
| Photos and videos > Videos | D7 (video đóng gói, mở kiện) | Có | Bắt buộc (xem dưới) | App functionality |
| App activity > Other user-generated content | D5, D6, D8, D9, D11 | Có | Bắt buộc | App functionality |
| App info and performance > Diagnostics | D10; D12 phần trạng thái máy **[theo V1-16]** | Có | Bắt buộc (D10 luôn đi kèm bản ghi) | App functionality; Analytics (*kiểm định nghĩa Analytics của Google có gồm chẩn đoán lỗi không*) |
| App info and performance > Crash logs | D12 **[theo V1-16]** | Có | Tùy chọn (công tắc ở Cá nhân > Quyền riêng tư và bảo mật) | Analytics hoặc App functionality (*kiểm định nghĩa*) |
| Device or other IDs | D13 **[theo V1-16]** | Có | Tùy chọn (đi cùng công tắc báo lỗi) | Analytics hoặc App functionality (*kiểm*) |
| App activity > App interactions | D14 **[theo V1-16]** | Có | Tùy chọn (đi cùng công tắc báo lỗi) | Analytics (phân tích, chẩn đoán lỗi) |

Hai store khai **nhất quán**: D14 là Product Interaction (Apple) / App interactions (Google), chỉ dùng để chẩn đoán lỗi, không gắn tài khoản. Nếu V1-16 bị tách khỏi v1, bỏ cả hai dòng.

- **Ảnh/video "Bắt buộc":** người dùng chọn có quay/chụp hay không, nhưng khi đã quay thì app tự tải lên (công tắc "Chỉ tải khi có Wi‑Fi" **[theo V1-09]** chỉ hoãn, không tắt). Khai "Tùy chọn" sẽ làm người dùng tưởng tắt được việc tải lên. Chọn "Bắt buộc" (Q-29 / V1-20).
- **Không thu thập:** Location (Approximate, Precise) — chỉ xử lý trên máy (mục 2); Audio; Files and docs; Messages; Contacts; Calendar; Health and fitness; Financial info; Web browsing; App activity > In-app search history (chỉ trên máy), Installed apps; Personal info > Phone number, Address, Race/ethnicity, Political/religious beliefs, Sexual orientation, Other info.
- **Địa chỉ IP:** máy chủ Firebase nhận IP khi kết nối. Google/Apple không coi IP chỉ dùng để phục vụ yêu cầu rồi bỏ là "thu thập"; nhưng nếu dịch vụ Firebase lưu IP (ví dụ nhật ký Auth) và trang công bố của Firebase ghi điều đó, phải khai theo hướng dẫn của Firebase. **Chưa chắc**: kiểm ở mục 6.

## 5. Hành vi cần giải thích nếu người duyệt hỏi

- **Chia sẻ văn bản tóm tắt tranh chấp (G04):** người dùng bấm Chia sẻ, chọn ứng dụng nhận trong bảng chia sẻ của hệ điều hành. Đây là hành động người dùng chủ động và thấy rõ nội dung. Google có ngoại lệ cho chuyển dữ liệu do người dùng chủ động khởi tạo khi người dùng hiểu dữ liệu sẽ được gửi; *chưa đọc trực tiếp điều khoản ngoại lệ*, nếu Console không chấp nhận thì khai "App activity > Other user-generated content: Chia sẻ" với mục đích App functionality.
- **Liên hệ hỗ trợ (UI-I06):** app chỉ soạn liên kết `mailto:` (`src/features/personal/domain/support-request.ts`); người dùng tự gửi bằng ứng dụng email của mình. App không truyền dữ liệu đi, nên không khai là app thu thập. Email người dùng gửi tới hộp thư hỗ trợ được xử lý theo chính sách quyền riêng tư.
- **Mở trang chính sách/hỗ trợ:** mở trình duyệt hệ điều hành (`src/platform/external-link.ts`); trang web không dùng cookie, không công cụ phân tích (trang chính sách, mục "Trang web này").

## 6. Privacy Manifest iOS (`PrivacyInfo.xcprivacy`)

Apple yêu cầu app và từng SDK bên thứ ba tự khai **API cần lý do** (required reason API) trong manifest của mình; SDK không dựa được vào manifest của app ([Describing use of required reason API][apple-rr]). Mã lý do lấy từ [NSPrivacyAccessedAPITypeReasons][apple-rr-codes] (truy cập 2026-10-30).

### 6.1 API cần lý do mà app (mã JS qua module Expo/RN) dùng

| Loại API | Ai dùng | Mã lý do | Lý do (trích Apple, rút gọn) |
|---|---|---|---|
| `NSPrivacyAccessedAPICategoryDiskSpace` | Kiểm tra trước khi quay đọc dung lượng trống (`src/platform/recording-files.ts` `Paths.availableDiskSpace`, gọi từ `PackPrecheckScreen.tsx`, `ReturnRecordLive.tsx`); thiếu chỗ thì báo "Máy cần đủ chỗ cho N phút quay" (`screens:precheck.storageMinutes`), không hiện số dung lượng | `E174.1` | Kiểm tra có đủ dung lượng để ghi tệp. Thêm `85F4.1` (hiển thị dung lượng cho người dùng) chỉ khi màn Dung lượng UI-F03 hiện số thật |
| `NSPrivacyAccessedAPICategoryFileTimestamp` | Đọc kích thước/thời gian sửa tệp trong thư mục của app (`expo-file-system`, `expo-sqlite`; **[theo V1-13]** dùng mtime để không băm lại) | `C617.1` | Truy cập thời gian, kích thước, metadata của tệp trong vùng chứa của app |
| `NSPrivacyAccessedAPICategoryUserDefaults` | React Native, Expo, Firebase đọc/ghi `NSUserDefaults` của chính app | `CA92.1` | Đọc/ghi thông tin chỉ app truy cập được |
| `NSPrivacyAccessedAPICategorySystemBootTime` | React Native (đo thời gian giữa sự kiện) | `35F9.1` | Đo thời gian trôi qua giữa các sự kiện trong app |

`ActiveKeyboards`: không dùng.

Thư viện tự mang manifest (cần xác nhận trong bản build, không chép vào manifest của app): Firebase iOS SDK (Auth, Firestore, Functions, Crashlytics, Installations), các module Expo (`expo-file-system`, `expo-sqlite`, `expo-camera`, `expo-location`, `expo-constants`…), React Native. Với thư viện liên kết tĩnh qua CocoaPods, manifest của thư viện có thể **không** được Xcode gộp; cách an toàn là khai thêm các mục trên ở cấp app.

### 6.2 Đề xuất cấu hình (chưa áp dụng; PR này chỉ tài liệu)

Expo cho khai manifest cấp app ở `app.json` `expo.ios.privacyManifests` (*kiểm tên khóa với tài liệu Expo SDK 58 khi làm*; `docs.expo.dev` bị chặn trong môi trường soạn). Đề xuất (để PR mã sau, ví dụ cùng V1-16 hoặc một PR riêng trước S-7):

```json
{
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyAccessedAPITypes": [
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace", "NSPrivacyAccessedAPITypeReasons": ["E174.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPITypeReasons": ["C617.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults", "NSPrivacyAccessedAPITypeReasons": ["CA92.1"] },
    { "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime", "NSPrivacyAccessedAPITypeReasons": ["35F9.1"] }
  ],
  "NSPrivacyCollectedDataTypes": "<khớp bảng 3.1, xem dưới>"
}
```

`NSPrivacyCollectedDataTypes`: mỗi dòng của bảng 3.1 thành một mục với `NSPrivacyCollectedDataType` (`NSPrivacyCollectedDataTypeEmailAddress`, `…Name`, `…UserID`, `…PhotosorVideos` (chữ "or" viết thường), `…OtherUserContent`, `…OtherDiagnosticData`, và **[theo V1-16]** `…CrashData`, `…DeviceID`, `NSPrivacyCollectedDataTypeProductInteraction` (Linked: false)), `NSPrivacyCollectedDataTypeLinked` đúng cột "Gắn với danh tính", `NSPrivacyCollectedDataTypeTracking: false`, `NSPrivacyCollectedDataTypePurposes: ["NSPrivacyCollectedDataTypePurposeAppFunctionality"]` (*hằng mục đích chưa đọc được trên trang Apple; kiểm khi viết mã*).

### 6.3 Kiểm trên bản build (release-checklist S-7, S-8)

1. Mở bản lưu trữ (archive) iOS của bản build EAS trong Xcode Organizer > **Generate Privacy Report**; so báo cáo với bảng 3.1. Mục nào báo cáo có mà bảng không có (ví dụ SDK Firebase khai thêm loại dữ liệu) thì cập nhật bảng 3.1, 4.2 **và** trang chính sách.
2. Tìm trong `Podfile.lock`/báo cáo: **không** có `GoogleAppMeasurement`/`FirebaseAnalytics` (nếu có, app đang mang Analytics ngoài ý muốn: dừng nộp, gỡ).
3. App Store Connect không gửi thư báo thiếu lý do API sau khi tải bản build.

## 7. Việc phải làm trước khi điền (người làm: chủ app/BA)

1. Đọc trang công bố dữ liệu chính thức của Firebase và so từng SDK (Auth, Firestore, Functions, Crashlytics, Installations) với bảng 3.1 và 4.2:
   - Google Play: <https://firebase.google.com/docs/android/play-data-disclosure>
   - Apple: <https://firebase.google.com/docs/ios/app-store-data-collection>
   - *Hai trang này bị chặn trong môi trường soạn (tên miền `firebase.google.com`), chưa đọc*. Nếu trang ghi khác bảng ở đây, **theo trang Firebase** và sửa tệp này + trang chính sách.
2. Đọc [Data safety, Play Console Help 10787469][gp-datasafety] và [yêu cầu xóa tài khoản 13327111][gp-delete] (bị chặn trong môi trường soạn) để kiểm tên loại dữ liệu, định nghĩa mục đích, ngoại lệ "người dùng chủ động".
3. Xác nhận V1-16 có/không trong v1; nếu không: bỏ D12, D13, D14 và các dòng tương ứng; trang chính sách bỏ mục "Báo lỗi ứng dụng".
4. Chạy kiểm 6.3 trên bản build ứng viên.
5. Đối chiếu câu "30 ngày" (R-4) khớp app (**[theo V1-15]**), web (`site.legal.purgeAfterDays`) và Function `purgeDeletedShops` (**[theo V1-14]**).

## 8. Nguồn

Truy cập 2026-10-30.

| Nguồn | Đọc trực tiếp? |
|---|---|
| [Apple: App privacy details on the App Store][apple-privacy] | Có (định nghĩa "thu thập", loại dữ liệu, mục đích, "gắn với danh tính", tracking, SDK bên thứ ba) |
| [Apple: Describing use of required reason API][apple-rr] | Có (cấu trúc; mỗi SDK tự khai) |
| [Apple: NSPrivacyAccessedAPITypeReasons][apple-rr-codes] | Có (mã lý do) |
| [Apple: NSPrivacyCollectedDataType][apple-collected] | Có (hằng loại dữ liệu; không có hằng mục đích) |
| [App Review Guidelines 5.1.1][guidelines] | Có |
| [Google Play Console Help: Data safety 10787469][gp-datasafety] | **Không** (chỉ đoạn trích kết quả tìm kiếm: định nghĩa bên cung cấp dịch vụ, xử lý tạm thời, dữ liệu chỉ trên máy) |
| [Google Play Console Help: yêu cầu xóa tài khoản 13327111][gp-delete] | **Không** (đoạn trích: phải có liên kết web yêu cầu xóa tài khoản và dữ liệu, kể cả khi đã có xóa trong app) |
| Trang công bố dữ liệu Firebase cho Google Play và Apple | **Không** (bị chặn) |

[apple-privacy]: https://developer.apple.com/app-store/app-privacy-details/
[apple-rr]: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
[apple-rr-codes]: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacyaccessedapitypes/nsprivacyaccessedapitypereasons
[apple-collected]: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype
[guidelines]: https://developer.apple.com/app-store/review/guidelines/
[gp-datasafety]: https://support.google.com/googleplay/android-developer/answer/10787469
[gp-delete]: https://support.google.com/googleplay/android-developer/answer/13327111
