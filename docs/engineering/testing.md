# Chiến lược kiểm thử — Đơn Chứng

> Kiểm thử phục vụ các bất biến trong [CLAUDE.md](../../CLAUDE.md) và kịch bản QA-01…QA-14 trong [docs/08](../08-acceptance-qa-risks.md). Nguyên tắc trung thực: **chỉ test tự động mới "xanh" tự động; luồng ghi hình/tải nền chỉ được coi là đạt khi đã chạy trên thiết bị thật iOS và Android.** Đánh dấu trong tài liệu không có nghĩa là đã kiểm thử (docs/08).

## 1. Các tầng và công cụ

| Tầng | Kiểm tra gì | Công cụ | Chạy ở | Lệnh |
|---|---|---|---|---|
| Unit (domain thuần) | Máy trạng thái tệp, hàng đợi (logic), phục hồi phiên, liên kết phiên–kiện, ánh xạ nhãn, mã lỗi, i18n, theme, logger | Jest 30 + `jest-expo` (project `unit`) | Máy dev, CI | `npm test` |
| Security Rules | Cô lập theo shop (QA-11), bất biến bằng chứng/phiên, trường chỉ-máy-chủ, audit | `@firebase/rules-unit-testing` 6 + Firebase Emulator (Firestore, Storage) + Jest (project `rules`) | Máy dev, CI (cần Java 21) | `npm run test:rules` |
| Hợp đồng API (`src/api`) | Cùng một bộ test (`api/contract-tests`) cho mọi hiện thực: bản giả, bản Firebase với SDK mô phỏng; ánh xạ lỗi SDK→`AppError` | Jest project `unit` | Máy dev, CI | `npm test` |
| Hợp đồng Cloud Functions | Đầu vào/đầu ra, quyền, idempotency, audit, hành vi theo cờ giữ. **Đã có** cho `createShop`/`updateShop` (gọi thẳng hàm logic trên Firestore Emulator, `firebase/tests/functions`); `verifyEvidence` (`evidence.ts`, gọi thẳng hàm logic với bộ đọc Storage giả); chưa kiểm lớp callable/Auth, chưa kiểm trigger Storage thật (chưa deploy, chưa chạy với Storage Emulator), chưa có `createUploadSession`/`createReadUrl` | Functions + Firestore + Storage Emulator, `firebase-functions-test` | Máy dev, CI | *(thêm cùng Function đầu tiên)* |
| Component/tích hợp UI | Trạng thái màn hình (loading/empty/offline/error/retry/success), nhãn đúng, điều hướng và thanh tab (router thật trong bộ nhớ) | `@testing-library/react-native` (14.1.0, 2026-10-08) + `expo-router/testing-library` + `jest-expo` | Máy dev, CI | `npm test` (đã có cho khung giao diện, xem `layout.md` mục 8) |
| Ảnh màn hình bản web (cho PR) | Giao diện trên react-native-web + cổng giả, 0 lỗi trang khi mở route; **không** thay kiểm tra trên thiết bị | `scripts/screens` (Node + Playwright/Chromium cài ngoài repo, `expo export --platform web` trên bản sao) | Máy dev (không chạy ở CI) | `node scripts/screens/capture.cjs …` ([README](../../scripts/screens/README.md)) |
| Thiết bị thật | Camera, ghi file, gián đoạn, tải nền, mạng, bộ nhớ, nhiệt, pin | Thủ công theo kịch bản; (tùy chọn) Maestro/Detox cho phần điều hướng | iPhone + Android thật | mục 5 |

Nguyên tắc: đẩy tối đa logic xuống `domain` thuần để kiểm thử nhanh ở tầng 1; tầng thiết bị chỉ còn kiểm tra điều **chỉ thiết bị mới có** (hệ điều hành, phần cứng, hành vi nền).

## 2. Unit test

**Đã có (khung):** 173 test trong 18 tệp (64 test logic/theme/i18n/logger + test giao diện khung: `src/shared/ui/*.test.tsx`, `src/bootstrap/navigation/*.test.ts(x)`, màn Tổng quan và màn quay).

| Tệp | Bảo đảm |
|---|---|
| `src/features/evidence/domain/file-state.test.ts` | Đường thuận 6 bước; **client (origin=device) không bao giờ tới `uploaded`/`verified`/`hash_mismatch`** (quét mọi trạng thái × mọi sự kiện); sự kiện máy chủ giả danh thiết bị bị từ chối và ngược lại; chuyển sai bị từ chối; QA-04 (khôi phục phải qua `saving_local`), QA-05 (đối soát tới `uploaded` không tải lại), QA-09 (`hash_mismatch` cách ly, không lối ra), QA-12 (hết dung lượng → `local_save_failed`); mọi trạng thái đều đạt được; chỉ `verified` đủ điều kiện giải phóng bản cục bộ |
| `…/display-status.test.ts` | Ánh xạ trạng thái → nhãn docs/09 mục 3; mọi lỗi → *Lỗi – cần xử lý*; nhãn `verified` chỉ cho `verified` |
| `src/core/theme/theme.test.ts` | Tương phản WCAG AA 4.5:1 cho cặp màu chữ/nền; 6 nhãn có biểu tượng riêng; *Đã lưu trên máy* không dùng màu/biểu tượng thành công; chỉ lỗi dùng đỏ; cỡ chữ và vùng chạm theo docs/09 |
| `src/core/errors/errors.test.ts` | Mã lỗi dạng `UPPER_SNAKE_CASE`; mỗi mã có thông báo i18n (trừ mã docs chưa có câu thông báo); không thông báo "mồ côi" |
| `src/core/i18n/i18n.test.ts` | Tiếng Việt mặc định; không chuỗi nào chứa cụm hứa quá mức; "an toàn trên máy chủ" chỉ ở *Đã xác minh*; *Đã tải lên* không có "an toàn" |
| `src/core/logging/logger.test.ts` | Che mã đơn/vận đơn/thông tin khách/token kể cả lồng nhau; giữ ID kỹ thuật |

**Phải bổ sung cùng tính năng** (kèm nhánh ngoại lệ — exception-first):

| Mã nghiệp vụ trọng yếu | Cần kiểm thử |
|---|---|
| Liên kết phiên–kiện–đơn | Phiên mang ID đúng; chuyển đơn tiếp theo không đổi liên kết phiên trước (QA-03); không bắt đầu phiên khi chưa xác định shop/đơn/kiện; kiện đã có phiên đang chạy bị từ chối |
| Hàng đợi tải lên | Hàng đợi sống sót khi khởi động lại (đọc lại từ SQLite thật hoặc bản thay thế trong bộ nhớ có cùng hợp đồng); thử lại idempotent không tạo job thứ hai; **đối soát trước khi gửi lại** (QA-05); backoff; mất mạng không tính là lỗi; không bao giờ phát sinh lệnh xóa tệp cục bộ khi chưa `verified`; mã lỗi hết hạn xác thực/hạn mức → `needs_attention` |
| Khôi phục phiên | Tệp `recording`/`saving_local` mồ côi sau khi kill (QA-04); tệp không đọc được → `unrecoverable`, phiên `needs_attention`; không tự xác nhận phiên |
| `releaseLocalCopy` | Chỉ chạy khi `verified` + chính sách + đã thông báo; từ chối với mọi trạng thái khác |
| Phát hiện trùng/đơn | Nhiều kết quả → yêu cầu chọn, không tự lấy kết quả đầu (`ORDER_DUPLICATE`); chuẩn hóa mã; không gộp variant (QA-14) |
| Snapshot đơn | Sửa đơn sau khi bắt đầu phiên không đổi snapshot (QA-13) |

Quy tắc viết test: xác định (không đọc đồng hồ/ngẫu nhiên thật — truyền vào), không mạng, không phụ thuộc thứ tự, tên test nêu hành vi nghiệp vụ (và mã QA khi có). Phần phụ thuộc thiết bị (camera, hệ tệp, tải nền) được che sau giao diện ở `platform/` để thay bằng bản giả có **cùng hợp đồng** trong test. Chưa đặt ngưỡng coverage cố định; người review yêu cầu kiểm thử cho mọi nhánh của mã nghiệp vụ trọng yếu.

## 3. Test Security Rules (Firebase Emulator)

**Chạy:** `npm run test:rules` = `firebase emulators:exec --config firebase/firebase.json --project demo-doncung --only firestore,storage "jest --selectProjects rules --runInBand"`. Yêu cầu Java (đã dùng 21); lần đầu Emulator tải tệp `.jar` (cần mạng). Project id giả `demo-*` nên không đụng dịch vụ thật.

**Cấu trúc:** `firebase/tests/rules/helpers.ts` (tạo môi trường, dữ liệu nền cho hai shop A/B với đủ vai trò — chủ, quản lý, đóng gói, hàng hoàn, chỉ xem, đã thu hồi, shop khác, người lạ), `firestore.rules.test.ts`, `storage.rules.test.ts`, `evidence-declare.rules.test.ts` và `order-sync.rules.test.ts` (hình dạng tài liệu mà app ghi phải qua Rules thật), `return-evidence.rules.test.ts` + `return-sync.rules.test.ts` (bản neo và bằng chứng hàng hoàn, Q-28).

**Đã có (các nhóm chính; tổng số test xem kết quả `npm run test:rules`):**

| Nhóm | Ví dụ |
|---|---|
| **QA-11 cô lập theo shop** | Chưa đăng nhập bị từ chối; đoán đúng ID đơn/kiện/phiên/bằng chứng/thành viên của shop khác (kể cả bằng chủ shop khác) bị từ chối; không liệt kê được collection shop khác; không ghi/sửa/xóa shop khác; mạo `shopId`; người lạ; **thành viên bị thu hồi mất quyền ngay**; không liệt kê được `shops` |
| Mặc định từ chối | `disputes`, `users`… chưa có Rules → từ chối |
| Vai trò | Không tự nâng quyền / tự thêm mình làm thành viên; người chỉ xem không tạo/sửa đơn, phiên, bằng chứng |
| Đơn | Chỉ tạo `dataSource: user_entered`; từ chối thời gian tạo do client đặt, `createdBy` giả, `rev` sai, nguồn bán lạ, trường thừa; cập nhật cần `rev+1` (xung đột bị từ chối); trường bất biến; không xóa; dòng sản phẩm số lượng nguyên ≥ 1, các variant là dòng riêng |
| Phiên | Liên kết kiện–đơn phải khớp (kể cả tạo cùng batch ngoại tuyến); sau khi tạo `orderId`/`packageId`/`orderSnapshot`/`startedAtServer` bất biến; không xóa |
| Bằng chứng | Chỉ tạo `queued`; từ chối `uploaded`/`verified`/`hash_mismatch`/`recording`; từ chối map `server` giả mạo; từ chối liên kết sai phiên/đơn/kiện; chỉ `original_video`/`photo` quay trong app (nhập thư viện chờ O-02, bản dẫn xuất chỉ máy chủ); mã băm đúng độ dài; client chỉ cập nhật trạng thái phía thiết bị; bản gốc bất biến (mã băm, kích thước, liên kết), không xóa |
| Hàng hoàn (Q-28) | Bản neo `returns`: chỉ tạo một lần đúng tập khóa (không đơn gốc/trạng thái/vị trí), `createdBy`/giờ máy chủ ép, không sửa/xóa; chéo shop và đoán ID bị từ chối. Bằng chứng hàng hoàn: bản neo phải có sẵn (cùng shop), hồ sơ chưa liên kết đơn vẫn hợp lệ, ảnh chỉ `image/*` và video chỉ `video/*`, kích thước số nguyên dương, client không đặt được `uploaded`/`verified`/`server.*`, không ghi đè/xóa; Function `createUploadSession` và `verifyEvidence` chạy cho bằng chứng hàng hoàn (cùng đường dẫn Storage) |
| Audit | Chủ shop/quản lý đọc được, người thường không; **không ai** tạo/sửa/xóa từ client |
| Storage | Mọi truy cập client (thành viên đúng shop, chủ shop, người lạ, ẩn danh) bị từ chối ở cả hai shop: tải lên, đọc, lấy URL, xóa, ghi đè |

**Cách bảo đảm test thật sự có tác dụng:** mỗi `assertSucceeds` có phép thử `assertFails` đối ứng (cùng dữ liệu, chỉ khác điều kiện được kiểm tra). Khi dựng khung đã thử *đột biến* thủ công: làm lỏng `isActiveMember` thành `signedIn()` → 9 test thất bại; làm lỏng cập nhật bằng chứng và mở `storage.rules` cho người đăng nhập → 6 test thất bại; sau đó khôi phục Rules. Khi viết Rules mới nên lặp lại kiểm tra đột biến này.

**Phải bổ sung cùng tính năng:** `returnCases` (liên kết đơn gốc qua `linkEvents`, hồ sơ chưa liên kết — QA-06), `discrepancies`, `disputes` (cờ giữ), `exports`, `shipments`; ràng buộc "một phiên hoạt động cho một kiện"; ma trận quyền theo hành động khi O-07 chốt; nếu ADR-006 bị bác bỏ thì Rules Storage cho tải lên trực tiếp + test truy cập chéo shop.

Giới hạn của loại test này: kiểm tra Rules, không kiểm tra Functions hay app; `permission-denied` không cho biết lý do (xem architecture mục 4.1).

## 4. Test hợp đồng Cloud Functions

Mỗi Function có một "hợp đồng" kiểm thử bằng Emulator (Functions + Firestore + Storage + Auth). Chưa có Function nào nên chưa có test; danh sách bắt buộc khi làm:

| Function | Hợp đồng cần kiểm tra | QA |
|---|---|---|
| `createUploadSession` | Chỉ thành viên đúng shop và quyền ghi; bằng chứng phải tồn tại/chưa tải; đường dẫn đích cố định; gọi lại cùng `evidenceId` idempotent; shop khác bị từ chối; hết hạn mức → mã lỗi rõ, không cấp | 11, 05 |
| `verifyEvidence` (khi tệp hoàn tất) | Hash khớp → `server.state = verified` + `verifiedAt` + audit; **không khớp → `hash_mismatch`, không bao giờ `verified`**; tệp thiếu/size lệch; chạy lặp không đổi kết quả; không tin `sha256Client` | 09, 05 |
| Trigger audit | Mỗi thay đổi quan trọng sinh đúng một `auditEvents` (ai, gì, trước/sau); client không tạo được; chạy lại không nhân đôi | — |
| `createReadUrl` | URL có thời hạn; shop khác bị từ chối; ghi audit "đã xem"; không trả URL vĩnh viễn | 11 |
| Dọn theo hạn lưu (lịch) | Hết hạn → xóa có audit; **bằng chứng có `retention.hold` không bị xóa**; gỡ cờ giữ thì tuân theo hạn; hạ cấp gói không xóa ngầm | 10 |
| Cờ giữ tranh chấp | Mở/đóng tranh chấp đặt/gỡ cờ trên đúng bằng chứng; nhiều tranh chấp cùng giữ một bằng chứng | 10 |
| Quản lý thành viên | Chỉ chủ shop; thu hồi có hiệu lực ngay (Rules từ chối ngay sau đó); audit | 11 |
| Xuất hồ sơ | Manifest liệt kê cả tệp thiếu/lỗi/chưa tải; không gắn nhãn "đầy đủ" khi thiếu; audit | — |

Nguyên tắc: kiểm tra cả đường sai (không quyền, dữ liệu sai, gọi lặp), không chỉ đường thuận; dùng giờ giả cho kiểm tra hết hạn.

## 5. Kịch bản thiết bị thật iOS/Android (QA-01…14)

Ma trận thiết bị **đề xuất** — xem thêm các lớp phiên bản/hãng máy ở [platform-support.md](platform-support.md#5-ma-trận-kiểm-thử-đề-xuất-tối-thiểu) (số lượng do đội quyết định, docs/08 chỉ yêu cầu "nhiều phiên bản iOS/Android và dòng máy phổ biến"): ít nhất một Android cấu hình thấp (RAM thấp, bộ nhớ gần đầy), một Android trung cấp, Android 14 và 15 (giới hạn dịch vụ nền khác nhau), một iPhone đời cũ và một đời mới, iOS hiện hành và phiên bản liền trước. Mỗi lần chạy ghi: máy, hệ điều hành, phiên bản app, kết quả.

"Tự động" = phần đã/sẽ có test ở tầng 1–3; "Thiết bị" = phải chạy tay.

| QA | Kịch bản | Tự động hóa được | Phải chạy trên thiết bị |
|---|---|---|---|
| 01 | Đóng gói online bình thường | Máy trạng thái tệp (6 bước); Rules liên kết đúng kiện; Function xác minh (hợp đồng) | Quay thật → tải → `Đã xác minh` trên iOS và Android; truy xuất được video |
| 02 | Đóng gói mất mạng | Hàng đợi giữ job; Rules/ID idempotent không trùng bản ghi | Chế độ máy bay khi quay/dừng, bật lại mạng → tự tải; không bản ghi trùng |
| 03 | Đóng liên tục nhiều đơn | Liên kết phiên–kiện bất biến (unit + Rules) | Quay A → hoàn tất → B ngay, trong lúc A đang tải nền |
| 04 | App bị đóng khi đang quay | Khôi phục: `recording → saving_local` (unit) | **Hai kiểu kill khác nhau**: hệ điều hành dừng (Android `adb shell am kill`; iOS dừng từ Xcode/hết bộ nhớ) và người dùng vuốt tắt. Tệp dở dang đọc được không? Phiên không tự nhận đầy đủ |
| 05 | Mất phản hồi sau khi máy chủ đã nhận | Hàng đợi đối soát trước khi gửi lại (unit); `SERVER_RECEIVED` từ `upload_failed` | Cắt mạng đúng lúc hoàn tất tải thật; thử lại không tạo bản thứ hai (kiểm tra Storage/Firestore) |
| 06 | Hàng hoàn không có đơn gốc | Rules hồ sơ chưa liên kết (khi có) | Luồng B02–B07 thật |
| 07 | Kiện đã mở trước khi quay | Logic nhánh ngoại lệ (unit) | Trải nghiệm B04–B05 |
| 08 | Phát hiện hàng thiếu | Mô hình sai lệch, không tự kết luận (unit) | Nhập số lượng, B06 |
| 09 | Video gốc bị thay đổi | Hợp đồng `verifyEvidence` (hash không khớp → `hash_mismatch`); unit máy trạng thái | Sửa tệp thử trên Storage sau khi tính mã băm rồi quan sát nhãn *Lỗi – cần xử lý* |
| 10 | Tranh chấp sắp hết hạn | Hợp đồng dọn dẹp có `hold`, giờ giả | Quan sát thông báo trong app (UI-J11) |
| 11 | Truy cập chéo shop | **Đã có** (Rules, 49 test) + hợp đồng Function | Kiểm tra bằng hai tài khoản trên thiết bị: mở ID shop khác bị từ chối, không lộ metadata |
| 12 | Hết dung lượng giữa phiên | Lỗi lưu → `local_save_failed`; chặn xóa bản chưa tải | Làm đầy bộ nhớ bằng tệp đệm rồi quay; báo lỗi trung thực, giữ phần đọc được |
| 13 | Quay trước, khai báo sau | Snapshot đơn bất biến (Rules + unit); nhãn *Chưa khai báo sản phẩm* | Luồng quét → tạo nhanh → quay ngay |
| 14 | Nhiều variant | Không gộp dòng (unit + Rules cho phép hai dòng) | Đóng gói → nhận hoàn → kiểm kê cho thấy hai dòng riêng |

**Điều kiện thực tế bổ sung** (docs/08), hầu hết **chỉ làm được trên máy thật**: điện thoại nóng; bộ nhớ gần đầy; Wi-Fi yếu; chuyển Wi-Fi ↔ 4G/5G khi đang tải; quay video dài (≥ 20 phút — ngưỡng chính thức chờ O-05); nhiều video liên tiếp; pin yếu/chế độ tiết kiệm pin (Android có thể hạn chế nền, iOS Low Power Mode); app ở nền hàng giờ rồi mở lại; cuộc gọi/báo thức/Siri/thông báo hệ thống chen vào khi đang quay; xoay màn hình; tháo tai nghe/đổi micro; thu hồi quyền camera/micro trong Cài đặt giữa chừng; đổi múi giờ/giờ thiết bị (kiểm tra thời gian thiết bị ≠ máy chủ được lưu riêng); đăng xuất/xóa app khi còn tệp chưa tải (UI-J15).

## 6. Những gì CHƯA tự động hóa được (và cần người kiểm tra)

1. **Mọi hành vi camera/ghi file/phục hồi sau kill/tải nền** — phụ thuộc phần cứng và hệ điều hành; không có bản giả đáng tin. Chỉ kiểm chứng được trên máy thật (mục 5).
2. **Giới hạn nền của hệ điều hành** (iOS không tiếp tục sau force-quit, Android 15 giới hạn dịch vụ `dataSync`, trình tiết kiệm pin theo hãng máy) — chỉ quan sát bằng thử nghiệm dài trên nhiều dòng máy.
3. **Trải nghiệm một tay, ánh sáng, độ dễ đọc ngoài trời, người bán thật** (docs/09 mục 8) — cần thử nghiệm với người dùng.
4. **Độ tin cậy lâu dài**: rò rỉ bộ nhớ khi quay nhiều video liên tiếp, nhiệt, pin — cần phiên thử nghiệm dài/soak test thủ công.
5. **Hiệu năng Function với video lớn và chi phí thật** (spike S5, giai đoạn beta).
6. **Hành vi Firestore ngoại tuyến bền ở RNFirebase** (ghi chờ sống sót khi kill app; Rules từ chối lúc đồng bộ) — chỉ khẳng định được sau spike S6.
7. **Quyền xin/từ chối của hệ điều hành, popup quyền** — thủ công trên từng nền tảng.
8. **Khôi phục dữ liệu (sao lưu/RTO/RPO)** — kiểm thử vận hành, không phải test mã.
9. **Ngôn ngữ trung thực trong UI** chỉ được quét tự động cho chuỗi i18n đã biết cụm cấm; người review vẫn phải đọc nội dung mới (kể cả ảnh/biểu ngữ).
10. **Phê duyệt App Store/Google Play** (quyền, thanh toán trong ứng dụng O-16, đăng nhập bên thứ ba O-15).

## 7. Trạng thái kiểm chứng của khung (ngày 2026-10-26, Node 22.22, npm 10.9)

| Việc | Kết quả |
|---|---|
| `npm run lint` | Sạch (0 lỗi, 0 cảnh báo). Đã thử vi phạm cố ý: import React Native/Firebase vào `domain`, `data` vào `domain`, import sâu feature, `console`, `any`, JSX hard-code → ESLint báo đúng |
| `npm run typecheck` | Sạch |
| `npm test` | 18 tệp, 173 test xanh |
| `npm run test:rules` | 2 tệp, 49 test xanh với Emulator Firestore + Storage (Java 21); kiểm tra đột biến Rules thất bại đúng |
| `expo export` (iOS và Android) | Metro đóng gói JS thành công (Hermes bytecode) — **không phải** build native |
| Build native (Xcode/Gradle), chạy trên máy ảo hoặc thiết bị | **Chưa làm** (môi trường không có Xcode/Android SDK/thiết bị) |
| CI `.github/workflows/ci.yml` | Viết nhưng **chưa chạy** trên GitHub (chỉ chạy các lệnh tương đương cục bộ) |
