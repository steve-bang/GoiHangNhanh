# Checklist phát hành v1.0 cho con người

> Những bước **không làm được bằng mã trong môi trường agent** (không có tài khoản store, thiết bị thật, quyền deploy Firebase). Đi kèm [v1-release-plan.md](v1-release-plan.md); quy trình chi tiết từng lệnh ở [`DEPLOYMENT.md`](../../DEPLOYMENT.md) và [firebase-setup.md](firebase-setup.md). Mỗi mục: đánh dấu, ghi người làm, ngày, kết quả (đường dẫn ảnh/log). Không đánh dấu mục chưa làm thật.
>
> Trạng thái ngày viết (2026-10-30): **chưa mục nào làm**. Giá trị trong `< >` là chỗ người dùng điền.

## 0. Quyết định phải có trước (không đổi được sau khi phát hành)

- [ ] **D-1. Tên ứng dụng và định danh gói chính thức** (O-11, Q-06). Giữ chỗ hiện tại khi `APP_ENV=prod`: `vn.doncung.app`. Bundle id/applicationId **không đổi được** sau lần tải lên đầu.
- [ ] **D-2. Sàn hệ điều hành** (O-20). Mặc định v1: sàn kỹ thuật của Expo SDK 58/RN 0.88 và thư viện đã chọn (RN: iOS 15.1, Android 7.0/API 24); xác nhận lại sàn thật sau `expo prebuild`.
- [ ] **D-3. Duyệt các câu hỏi R-1…R-8** ở v1-release-plan.md mục 7.3.
- [ ] **D-4. Địa chỉ email hỗ trợ và tên miền web thật**; điền vào `src/core/config/public-links.ts` và `web/src/config/site.ts` (test tooling bắt khác nhau).

## F. Firebase production

- [ ] **F-1.** Tạo dự án Firebase production `<tên dự án>` (khác `ghn-test-67b39`); bật gói **Blaze**; đặt **cảnh báo ngân sách** (Cloud Billing) ở mức `<số tiền>`/tháng.
- [ ] **F-2.** Tạo Firestore và Storage ở **`asia-southeast1` (Singapore)**, cùng khu vực với Functions (`firebase/functions/src/index.ts` `REGION`); không đổi được sau khi tạo.
- [ ] **F-3.** Authentication: bật **Email/Password**; để **bật** "Email enumeration protection"; tắt các nhà cung cấp khác.
- [ ] **F-4.** Deploy theo thứ tự: `npm run test:rules` xanh -> `firestore:rules,firestore:indexes,storage` -> `functions` (`createShop`, `updateShop`, `createUploadSession`, `verifyEvidence`, trigger kiểm toán, `deleteAccount`, `purgeDeletedShops`). Lệnh: `firebase-setup.md` mục 5 với `--project <prod>`.
- [ ] **F-5.** IAM: tài khoản dịch vụ chạy Functions có quyền **Service Account Token Creator** trên chính nó (cần cho `getSignedUrl` v4 trong `createUploadSession`); kiểm bằng một lần tải thử ở G-3.
- [ ] **F-6.** Mẫu thư **đặt lại mật khẩu**: ngôn ngữ tiếng Việt, tên người gửi, kiểm tra thư không vào Thư rác (Gmail, Outlook) ở G-2.
- [ ] **F-7.** Đăng ký app iOS (bundle id D-1) và Android (package D-1, thêm SHA-1/SHA-256 của khóa ký Google Play sau S-5); tải `GoogleService-Info.plist`, `google-services.json` lên **EAS file secret** môi trường `production` (`DEPLOYMENT.md` mục 4.5). Không commit.
- [ ] **F-8.** Bật **Crashlytics** trong Console (nếu V1-16 có trong v1).
- [ ] **F-9.** Tạo **tài khoản demo** cho người duyệt store (email/mật khẩu riêng, một cửa hàng, vài đơn mẫu); ghi vào App Review/Play App access, không ghi vào repo.
- [ ] **F-10.** Kiểm `accountDeletions` và `auditEvents` không đọc được từ client (thử bằng tài khoản demo).

## S. Tài khoản store và build

- [ ] **S-1.** Tài khoản **Expo/EAS**, `npx eas-cli init` (ghi `projectId`).
- [ ] **S-2.** **Apple Developer Program** (tổ chức cần D-U-N-S) và **Google Play Console** (xác minh danh tính; tài khoản cá nhân mới có thể phải chạy kiểm thử kín với số người tối thiểu trong một khoảng thời gian: kiểm yêu cầu hiện hành).
- [ ] **S-3.** Build `staging` (`npx eas-cli build --profile staging --platform all`): Firebase dev, ghi video **bật**, dùng cho cổng G.
- [ ] **S-4.** Build `production` sau V1-21: kiểm `npx expo config` của profile (bundle id không `.dev`, `EXPO_PUBLIC_APP_ENV=prod`), app mở được, đăng nhập vào **dự án production**.
- [ ] **S-5.** Play App Signing; sao lưu thông tin khóa ký EAS ngoài repo; thêm SHA vào Firebase (F-7).
- [ ] **S-6.** App Store Connect: tạo app, `ascAppId` vào `eas.json` `submit.production.ios`; khóa App Store Connect API.
- [ ] **S-7.** Kiểm `PrivacyInfo.xcprivacy` được tổng hợp trong bản build iOS (Expo + RNFirebase) và lý do API bắt buộc (dung lượng đĩa, thời gian tệp, UserDefaults) đủ; App Store Connect không báo thiếu.

## G. Cổng thiết bị (iOS + Android thật, bản `staging`)

Ma trận tối thiểu: 1 iPhone đời cũ ở sàn D-2 + 1 iPhone mới; 1 Android tầm thấp (RAM ≤ 4 GB) + 1 Android phổ biến tại Việt Nam (Samsung/Xiaomi/OPPO). Ghi kết quả vào `docs/engineering/testing.md` và ADR-020.

- [ ] **G-1. QA-01…QA-14** (`docs/08`) trên cả hai hệ điều hành. Ghi chú v1: QA-10 không áp dụng (chưa có dọn theo hạn lưu); QA-13 chỉ đạt phần "quay không bị chặn, nhãn Chưa khai báo sản phẩm" (R-6).
- [ ] **G-2.** Đăng ký, đăng nhập, quên mật khẩu (nhận thư, đặt lại, đăng nhập bằng mật khẩu mới), đổi mật khẩu, sửa họ tên, sửa tên cửa hàng, đăng xuất, đăng nhập lại; tắt app, mở lại: đơn mới vẫn được đăng lên máy chủ.
- [ ] **G-3. Đường tải lên (điều kiện Q-24e):** video 1, 5, 10 phút: Chờ tải lên -> Đang tải lên -> Đã tải lên -> Đã xác minh trên Wi‑Fi và trên 4G/5G; bật "Chỉ tải khi có Wi‑Fi" khi đang dùng 4G: không tải, hiện "Đang chờ Wi‑Fi"; chế độ máy bay giữa lúc tải; đổi Wi‑Fi <-> 4G; mạng có sóng không ra Internet; không có bằng chứng trùng trên Firestore.
- [ ] **G-4. Quay:** máy tự khóa trong 10 phút quay (keep-awake); cuộc gọi đến; chuyển app; kéo thông báo; hết bộ nhớ; kill app khi đang quay (phiên `interrupted`/tệp `unrecoverable`, không tự nhận đầy đủ) và khi đang lưu; nhiều video liên tiếp; nhiệt độ/pin sau 30 phút.
- [ ] **G-5. Băm:** đo MB/giây băm tệp 100 MB và 1 GB (iOS + Android), thời gian giao diện bị đứng; quyết R-5.
- [ ] **G-6. Xem lại:** phát video 10 phút từ UI-E04, tua, xoay máy; ảnh hàng hoàn; tệp đã bị xóa khỏi máy.
- [ ] **G-7. Sao lưu:** iOS Cài đặt > iCloud > Sao lưu: dung lượng của app không tăng theo video; Android `adb shell bmgr` không sao lưu dữ liệu app.
- [ ] **G-8. Xóa tài khoản:** điều kiện chặn (đang quay, tranh chấp mở), cảnh báo tệp chưa tải, sai mật khẩu, mất mạng (không xóa gì), thành công (về Chào mừng, dữ liệu cục bộ mất, đăng nhập lại báo sai thông tin, Firestore shop ở `deleting`).
- [ ] **G-9. Crashlytics:** gây lỗi thử ở bản staging, thấy báo cáo trong Console, **không** chứa mã đơn/mã vận đơn/email; tắt công tắc thì không gửi.
- [ ] **G-10. Truy cập chéo shop** (QA-11) bằng hai tài khoản thật trên dự án dev.
- [ ] **G-11.** Chữ lớn hệ thống, VoiceOver/TalkBack ở UI-F01, UI-E04, màn quay; nút Back phần cứng Android.

## C. Duyệt câu chữ và pháp lý

- [ ] **C-1.** BA/khách duyệt chuỗi mới (Q-29 trong `decisions.md` và các PR V1-xx): thông báo lỗi tải, "Đang chờ Wi‑Fi", câu thời hạn lưu, câu giới hạn khi quay, Kiểm tra hộp thư, Xóa tài khoản, Trợ giúp; xác nhận lệch có chủ đích (ẩn Apple/Google, 4 màn khôi phục mật khẩu thành 2).
- [ ] **C-2.** Luật sư rà **Chính sách quyền riêng tư**, **Điều khoản**, trang **Xóa tài khoản** theo pháp luật bảo vệ dữ liệu cá nhân Việt Nam; R-1 (lưu uid sau xóa), R-8 (báo lỗi mặc định bật).
- [ ] **C-3.** Kiểm tra thương hiệu/pháp lý Splash (D-15: logo sàn, câu "Bảo vệ quyền lợi") và slogan Chào mừng (Q-24e) trước khi công khai.
- [ ] **C-4.** Duyệt mô tả store và khai báo Privacy Labels/Data safety ở `docs/engineering/store-listing.md` (V1-20) khớp app thật.
- [ ] **C-5.** Icon/ảnh splash chính thức (O-23, O-24): icon 1024×1024 không trong suốt (App Store), 512×512 (Play).

## P. Phát hành

- [ ] **P-1.** Commit phát hành: `npm run check`, `npm run test:rules`, CI xanh; thẻ `v1.0.0`.
- [ ] **P-2.** Google Play: Internal testing (tải AAB thủ công lần đầu) -> Closed testing (nếu tài khoản yêu cầu) -> Production với tỷ lệ triển khai 5–20%; điền App content (chính sách URL, Data safety, App access, xếp loại nội dung, **URL yêu cầu xóa tài khoản**).
- [ ] **P-3.** App Store: TestFlight nội bộ -> gửi duyệt với tài khoản demo và ghi chú (không có mua trong app; xóa tài khoản ở Cá nhân > Quyền riêng tư và bảo mật > Xóa tài khoản); phased release.
- [ ] **P-4.** Theo dõi 7 ngày đầu: Crashlytics, chi phí Firebase so với cảnh báo ngân sách, lỗi `verifyEvidence`, phản hồi người dùng; ghi vào `CHANGELOG.md` bản vá nếu có.
- [ ] **P-5.** Cập nhật `CLAUDE.md` mục "Trạng thái dự án" và `DEPLOYMENT.md` theo những gì đã chạy thật.
