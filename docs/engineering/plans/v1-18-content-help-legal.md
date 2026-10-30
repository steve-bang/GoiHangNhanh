# V1-18 content-help-legal — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 1.2 (Q-24a, Q-24b, O-06/O-16, Tài liệu store), 3.0, 3.3 V1-18, 7.5 (R-6); chỉ đạo thêm của điều phối (2026-10-30). Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-18 — content-help-legal`.

## Mục tiêu

Mọi câu người dùng đọc về dữ liệu, lưu trữ, tải lên, quyền đều đúng với v1 (bất biến 11); liên kết công khai (web, email) khai báo ở **một** chỗ cho app và khớp web.

## Tệp đổi và thiết kế

1. **`src/core/config/public-links.ts` (mới, nguồn duy nhất):** `PUBLIC_SITE_URL` (giữ chỗ `https://don-chung.invalid`, đúng `web/src/config/site.ts` `site.url`), `PUBLIC_LINKS = { terms, privacy, support, accountDeletionRequest, supportEmail }` ghép từ đường dẫn web (`/dieu-khoan/`, `/chinh-sach-quyen-rieng-tu/`, `/ho-tro/`, `/xoa-tai-khoan/`), `supportEmail: null`. Chuyển `isPlaceholderLink`, `getSupportEmail` vào đây. `legal-links.ts`/`support-contact.ts` thành lớp re-export (`LEGAL_LINKS.terms/privacy/accountDeletion` lấy từ `PUBLIC_LINKS`, `SUPPORT_EMAIL = PUBLIC_LINKS.supportEmail`): màn đã khách xác nhận (`WelcomeScreen`) không đổi import; test cũ mock `support-contact` vẫn đúng.
2. **Test tooling `scripts/public-links.test.cjs`:** `require` cả hai tệp TS (babel-jest + `babel-preset-expo`), so từng khóa `PUBLIC_LINKS` với `publicLinks()` của web, và `PUBLIC_SITE_URL === site.url`. Đổi một bên mà quên bên kia -> `npm test` đỏ.
3. **Chuỗi trung thực:** `common.syncBar.hint` (đang nói "Tải nền") -> câu "chỉ tải khi ứng dụng đang mở"; rà toàn bộ `locales/vi` tìm "tải nền", "sao lưu an toàn", "tuyệt đối"; mở rộng `i18n.test.ts` thêm cụm cấm "tải nền", "sao lưu an toàn", "chạy nền" (trừ ngoại lệ Splash đã duyệt).
4. **Thời hạn lưu (route con UI-I01, `RetentionDetailScreen`):** thẻ đầu "Thời hạn lưu bằng chứng: Chưa áp dụng"; thẻ ghi chú = câu 1.2 nguyên văn; thẻ cảnh báo = "Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng." Bỏ ba hàng "Chưa có thông tin" theo loại (v1 không có thời hạn theo loại; "Ảnh giao hàng" không có trong v1).
5. **Trợ giúp (`help-content.ts`, `help-text.ts`, `personal.json`):**
   - Bài mới (hỏi đáp): `uploadWhenOpen` (chỉ tải khi app mở; tắt app thì dừng, mở lại thì tiếp; chưa phải bản sao lưu tới khi máy chủ xác nhận), `wifiOnly` (hướng dẫn 3 bước: công tắc ở Trung tâm đồng bộ hoặc Dữ liệu bằng chứng; điểm phát Wi‑Fi từ điện thoại khác vẫn bị coi là Wi‑Fi và tốn dữ liệu di động của máy kia), `changeDevice` (đổi máy/cài lại/gỡ app: tệp chưa tải mất, máy mới không thấy dữ liệu cũ; câu "Tệp trên máy này sẽ mất nếu bạn gỡ ứng dụng."), `hashMeaning` (mã băm chỉ chứng minh tệp không đổi kể từ lúc tính), `deleteAccount` (đường vào, 30 ngày, tệp chưa tải mất), `retention` (câu 1.2).
   - Sửa bài cũ: `whereData` (một máy một tài khoản, Q-24a), `findOrder` bước 3 (sửa được khi chưa quay; đã quay thì chưa sửa được: R-6/QA-13 một phần); `recordingLimits` giữ nguyên (đã đúng Q-24b: video đang ghi có thể mất nếu app bị tắt giữa chừng).
   - `recordPack` và `unsynced` hiện nói "bản này chưa ghi video": đúng khi cờ ghi video tắt, sai khi v1 bật cờ (V1-21). Thêm biến thể theo `RECORDER_ENABLED`: khóa i18n `articles.<id>` (đã bật) và `articlesPreview.<id>` (đang tắt), cùng số bước; `help-text.ts` chọn khóa qua `helpArticleKey()`; domain đánh dấu `previewVariant: true`.
   - Bài đề xuất: `recordPack`, `uploadWhenOpen`, `unsynced`.
6. **Chuỗi quyền camera `app.json`:** đúng câu kế hoạch. Micro giữ `microphonePermission: false` (O-09; plugin không cần). Cập nhật `docs/store/listing.md` dòng chuỗi camera.
7. **Đăng xuất:** `signOut.dataNote` thêm "Dữ liệu chưa tải lên chỉ còn trên máy này."
8. **Xóa tài khoản, điều kiện "dữ liệu tài khoản khác":** `DeleteConditionList` nhận `actions` theo điều kiện; màn truyền cho `foreign` (khi `attention`) nút "Xóa tài khoản qua trang web" (chỉ khi URL không phải giữ chỗ) và "Liên hệ hỗ trợ" (chỉ khi có email thật). Giữ chỗ -> không hiện gì (như cũ). Nút đặt NGOÀI `View accessible` của hàng để trình đọc màn hình chạm được. `DeleteAccountScreen` lấy URL từ `LEGAL_LINKS.accountDeletion` (đã trỏ về `public-links`), bỏ TODO.
9. **Tràn chữ 320x568:** (a) `SearchField`: `TextInput` thêm `minWidth: 0` (react-native-web: ô nhập có bề rộng nội tại nên đẩy nút quét ra ngoài viền); (b) nhãn thanh tab (`(tabs)/_layout.tsx`): màn dưới 360 pt dùng cỡ caption x 0,85, `numberOfLines={1}`, `adjustsFontSizeToFit` + `minimumFontScale` 0,8 (native); màn rộng giữ nguyên. Bản nháp đặt `tabBarItemStyle.paddingHorizontal: 0` không có tác dụng (đệm 5 nằm ở Pressable bên trong của expo-router) và `numberOfLines` ở mọi cỡ làm web cắt chân chữ ở 390: đã bỏ; (c) gợi ý ô tìm Trợ giúp rút ngắn ("Tìm hướng dẫn, ví dụ: tải lên"). Không màn nào thuộc `design-token-scope.cjs`.

**Migration/Rules/Functions/thư viện:** không.

## Test

- `scripts/public-links.test.cjs` (tooling): khớp từng URL/email app ↔ web; URL hiện tại là giữ chỗ.
- `support-contact.test.ts`: thêm `accountDeletion` là giữ chỗ và cùng giá trị `PUBLIC_LINKS`.
- `i18n.test.ts`: cụm cấm mới.
- `help-content.test.ts`: bài mới có danh mục, biến thể.
- `HelpScreens.test.tsx`: bài mới (Wi‑Fi điểm phát, tải khi app mở, Q-24b, gỡ app, mã băm, 30 ngày), biến thể cờ ghi video bật/tắt, gợi ý tìm mới.
- `EvidenceRetentionScreens.test.tsx`: câu 1.2 nguyên văn, không "theo gói", không "Chưa có thông tin".
- `DeleteAccountScreen.test.tsx`: `foreign` attention + giữ chỗ: không nút; có URL/email thật: nút mở đúng URL / mở Liên hệ hỗ trợ.
- `SyncStatusBar.test.tsx`: câu mới không "nền".

## Màn cần chụp (bản web, cổng giả)

Trợ giúp (danh mục), danh mục Câu hỏi thường gặp, bài `wifiOnly`, bài `uploadWhenOpen`, Thời hạn lưu, Điều khoản và chính sách (liên kết khóa); 320x568 trước/sau: Đơn hàng (ô tìm + thanh tab), Tìm đơn, Trợ giúp.

## Rủi ro

- Câu chữ cần khách/BA duyệt (checklist C-1).
- `adjustsFontSizeToFit` chỉ có hiệu lực trên iOS/Android; web chỉ cắt bằng dấu "…". Chưa kiểm chứng trên thiết bị (Dynamic Type lớn ở máy 320 pt).
- Biến thể trợ giúp theo cờ: khi V1-21 bật cờ, phải chụp lại bài.

## Tự review

Vòng 1: (1) Bản nháp đổi import `WelcomeScreen` sang `public-links`: màn đã khách xác nhận, kế hoạch nói không đổi import -> giữ `legal-links` làm re-export. (2) Bản nháp đặt nút web/hỗ trợ trong `View accessible` của hàng điều kiện: iOS gộp con thành một phần tử, VoiceOver không bấm được nút -> tách ra ngoài. (3) Câu "Xóa tài khoản" trong Trợ giúp có "lý do pháp lý" (giống màn Xóa tài khoản) nhưng test Trợ giúp cấm "pháp lý" (bất biến 11) -> viết "theo quy định của pháp luật hoặc vì tranh chấp đang mở". (4) Bỏ ba hàng theo loại ở Thời hạn lưu là đổi giao diện màn trong phạm vi token (không thuộc màn khách xác nhận) — ghi lệch trong decisions. (5) Bất biến 4/9: không có mã xóa nào thay đổi; câu Trợ giúp không hứa giữ tệp chưa tải. (6) Kích thước: mã ~250 dòng, phần lớn là chuỗi; trong ngân sách.

Tự review: đã chấp nhận (sửa điểm 1–4 trong kế hoạch ở trên).
