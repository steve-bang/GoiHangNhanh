# Kế hoạch gia cố trước phát hành (mức "Chặn phát hành" và "Cao")

> **Đề xuất của đội kỹ thuật, chờ người dùng duyệt.** Nguồn: báo cáo review "người dùng thật" (HEAD `2f5a43a`, 2026-10-29, người dùng đã duyệt báo cáo). Phạm vi: 2 mục *Chặn phát hành* và 8 mục *Cao*. Mục *Trung bình/Thấp* của báo cáo nằm ngoài tài liệu này (xem "Việc để sau" cuối tệp). Câu hỏi cần quyết: [Q-24 trong decisions.md](decisions.md#q-24--gia-cố-trước-phát-hành-phạm-vi-phát-hành-và-các-lựa-chọn-chờ-quyết-định). Điều kiện phát hành tổng thể: `DEPLOYMENT.md` mục 1.
>
> Mã trong tài liệu này CHƯA được sửa. Các số dòng là của HEAD `2f5a43a` và có thể lệch sau khi có PR khác hợp nhất.

## 1. Tổng quan

| Mã | Mức | Vấn đề | PR | Bị chặn bởi quyết định |
|---|---|---|---|---|
| R1 | Chặn | `shopId`/`uid` của phiên luôn `null` ở bản Firebase thật; không đăng xuất được | PR1 | – |
| R2 | Chặn | Đồng bộ chỉ một chiều; máy mới/nhiều máy không thấy dữ liệu; chưa có URL xem video | PR9 | **Q-24a** |
| R3 | Cao | `useIsOffline` luôn `false`; mọi lỗi tạm tốn lượt thử, ~10 phút mất mạng là `needs_attention` | PR2 | Q-24f (thư viện), Q-24c (chỉ Wi-Fi) |
| R4 | Cao | `createMissing`/`upload` có thể treo vĩnh viễn khi offline, làm kẹt hàng đợi | PR2 | – |
| R5 | Cao | Trung tâm đồng bộ (UI-F01) là dữ liệu minh họa, không có nút thử lại | PR4 | PR2 |
| R6 | Cao | Truy vấn `withoutVideo` bậc hai (30.000 đơn: 14 giây) và thiếu index phiên | PR3 | – |
| R7 | Cao | Không giữ màn hình sáng, không xử lý nền/cuộc gọi khi đang quay | PR5 | Q-24f (thư viện) |
| R8 | Cao | Video đang ghi mất trắng khi app bị kill | PR8 | **Q-24b** |
| R9 | Cao | Băm SHA-256 bằng JS: treo JS thread; băm lại toàn tệp mỗi lần thử; gửi lại từ đầu | PR7 | cần đo trên thiết bị |
| R10 | Cao | Không có trigger kiểm toán cho orders/sessions/evidence (bất biến 7) | PR6 | – |

## 2. Thứ tự đề xuất và phụ thuộc

```
PR1 (phiên Firebase) ──┬─> PR2 (mạng, thử lại, timeout) ──> PR4 (Trung tâm đồng bộ thật)
PR3 (index, danh sách)─┘ (song song với PR1)
PR5 (keep-awake, nền)      độc lập, cần máy thật
PR6 (trigger kiểm toán, siết Rules, APP_ENV/EAS)   độc lập
PR7 (đo + băm native)      sau khi có máy thật; ưu tiên sau PR2
        ───── CỔNG KIỂM CHỨNG TRÊN THIẾT BỊ (mục 5) ─────
PR8 (chia đoạn video)      chờ Q-24b
PR9 (đồng bộ kéo xuống)    chờ Q-24a
```

Thứ tự thực hiện: **PR1 và PR3 song song -> PR2 -> PR4 -> PR6 -> PR5 -> PR7 -> cổng thiết bị -> PR8/PR9 theo quyết định.** PR6 và PR3 không đổi hành vi người dùng nên có thể chen vào lúc chờ duyệt PR khác. Không bật `EXPO_PUBLIC_RECORDER_ENABLED=1` cho người dùng thật trước khi PR1, PR2, PR4, PR5 xong và cổng thiết bị đạt.

Mỗi PR: nhánh riêng, `npm run check` xanh, thêm test theo mục; PR đụng Rules/Functions chạy `npm run test:rules`. Không hợp nhất khi CI chưa xanh (conventions.md).

## 3. Đối chiếu bất biến CLAUDE.md

| Bất biến | Kế hoạch có nguy cơ? | Cách giữ |
|---|---|---|
| 1, 2 (không "đơn = video"; ID phiên + kiện trước khi quay) | Không đổi mô hình. PR8 (chia đoạn) tạo NHIỀU tệp cho một phiên | Mỗi đoạn là một bằng chứng riêng gắn đúng `sessionId`/`packageId`, tạo bản ghi trước khi ghi đoạn; không ghép/nối ngầm |
| 3 (trạng thái tệp tách; chỉ máy chủ tới `uploaded`/`verified`) | PR2/PR4 sửa hàng đợi và UI | Không thêm sự kiện `origin: 'device'` nào tới `uploaded`/`verified`; "Thử lại" chỉ phát `RETRY_UPLOAD`; test `file-state.test.ts` giữ nguyên |
| 4 (bản gốc bất biến; không xóa bản cục bộ khi tải đã bắt đầu) | PR7 đổi cách băm; PR8 đổi cách ghi | Băm chỉ đọc; không có đường xóa tệp; PR8 không sửa/ghép tệp đã ghi |
| 5, 6 (không tự liên kết; không dữ liệu giả) | PR8, PR1 (người tạo) | Tệp ghi dở vẫn `unrecoverable`/`interrupted` trừ khi có quyết định Q-24b; không đoán tệp tạm thuộc phiên nào |
| 7 (lịch sử, kiểm toán bất biến) | PR6 là để thực thi bất biến này | Trigger chỉ ghi `auditEvents` bằng Admin SDK; Rules vẫn `allow write: if false` cho `auditEvents` |
| 8 (cô lập shop; không URL công khai) | PR1 đổi nguồn `shopId`; PR9 thêm đọc | `shopId` từ `userShops/{uid}` + `members`; mọi đọc mới đi qua Rules và có test chéo shop; URL xem video có thời hạn qua Function |
| 9 (không xóa bằng chứng đang giữ) | Không đụng | – |
| 10 (dữ liệu tối giản, nguồn rõ ràng) | Không đụng | – |
| 11 (ngôn ngữ trung thực) | PR2/PR4 thêm chữ | Mọi chữ mới qua i18n, không nói "đã sao lưu" trước `verified`; không hứa tải nền; câu mới chờ BA |

---

## 4. Chi tiết từng PR

### PR1. Phiên Firebase: uid, shopId, đăng xuất thật (R1)

- **Mục tiêu:** ở bản Firebase thật, phiên trong bộ nhớ biết đúng `uid`, `email`, `shopId`; "Đăng xuất" thật sự thoát Firebase Auth; đồng bộ đơn và tải bằng chứng chạy.
- **Nguyên nhân gốc đã xác minh:**
  - `src/features/personal/data/unavailable-personal-gateways.ts:12-22`: ở chế độ `firebase` mọi `account.*` (gồm `getProfile`, `getShopSummary`, `signOut`) trả `AUTH_SERVICE_UNAVAILABLE`; `personal-gateways.ts` chọn cổng này khi `resolveBackendMode` khác `fake`.
  - `src/features/personal/ui/SessionHydrator.tsx:31-39`: dựa vào `getProfile`/`getShopSummary` nên không nạp được gì; `statusRef` vẫn `signed_out`.
  - `src/features/shop/ui/SignInScreen.tsx:113`: `beginSession(..., null)` (không truyền `shopId`); `CreateShopScreen.tsx:169-177` không gọi `beginSession`/`changeShop` sau khi tạo shop.
  - Hệ quả: `useCurrentShopId()` (`current-shop.tsx:41-43`) trả `LOCAL_SHOP_ID`, nên `OrderSyncRunner.tsx:41` và `UploadRunner.tsx:46` return sớm; sau khi khởi động lại `state.user = null` nên `created_by = NULL` (bản ghi không bao giờ được đăng, migration v5).
- **Cách sửa đề xuất (không đổi giao diện Splash/đăng nhập đã được khách xác nhận, chỉ tầng logic):**
  1. Mở rộng hợp đồng `ApiClient` (`src/api/contract`): `session.identity(): Promise<{uid, email, displayName, shopId} | null>` (đọc `auth.currentUser` + `userShops/{uid}`, ưu tiên bộ nhớ đệm như `readShopIdForRestore`), `auth.signOut()`, và `signInWithPassword` trả thêm `shopId`. Cập nhật bản giả (`src/api/fake`) và `unavailable`; test hợp đồng ở `src/api/contract-tests`.
  2. Hiện thực Firebase ở `src/api/firebase/ops.ts` và `firebase-api.ts` (`auth.signOut`, `identity`); `shopId` lấy từ `userShops/{uid}`.
  3. Cổng cá nhân ở chế độ Firebase: nối **tối thiểu** `getProfile` (uid/email/displayName từ Auth), `getShopSummary` (đọc `shops/{id}`; Rules cho thành viên đọc), `signOut`. Các cổng còn lại (đổi mật khẩu, danh sách/chuyển shop, cài đặt) GIỮ "chưa kết nối" (Q-20t) cho tới PR riêng.
  4. `SessionHydrator`: dùng `session.identity()` (đúng ý Q-20m); `SignInScreen` truyền `shopId` trả về; `CreateShopScreen` gọi `beginSession`/`changeShop` với `shop.id` mới.
  5. `signOut`: gọi `auth.signOut()` rồi mới xả state (giữ luồng an toàn hiện có: chặn khi đang quay, cảnh báo tệp chưa đồng bộ, không xóa dữ liệu cục bộ, Q-20h).
- **Tệp:** `src/api/contract/*`, `src/api/fake/*`, `src/api/unavailable/*`, `src/api/firebase/{ops,firebase-api}.ts`, `src/features/personal/data/{personal-gateways,unavailable-personal-gateways}.ts` (hoặc tệp mới `firebase-personal-gateways.ts`), `SessionHydrator.tsx`, `SignInScreen.tsx`, `CreateShopScreen.tsx`. Không migration, không đổi Rules/Functions.
- **Kiểm thử thêm:**
  - Unit: hợp đồng API cho `identity`/`signOut` (bản giả và `firebase-api` với `FirebaseOps` giả); `SessionHydrator` ở chế độ Firebase có `shopId`; `SignIn`/`CreateShop` gọi `beginSession` với `shopId`; sau `signOut` thật `OrderSyncRunner`/`UploadRunner` dừng (test với `docs` giả); lỗi `signOut` giữ nguyên phiên.
  - Emulator: đăng ký -> tạo shop -> đăng xuất -> đăng nhập lại -> `identity` đúng shop (chạy với Auth + Functions emulator, `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`).
  - Thiết bị: đăng nhập, tắt app, mở lại: đơn tạo sau đó có `created_by` đúng và được đăng; đăng xuất/đăng nhập tài khoản khác không lộ đơn.
- **Tiêu chí xong:** ở bản Firebase (emulator), đơn có phiên được đăng lên `shops/{shopId}/orders`; sau khởi động lại `created_by` không `NULL`; đăng xuất thoát Auth; `npm run check` xanh.
- **Phụ thuộc:** không. **Rủi ro:** (a) đọc `userShops` khi offline lần đầu không có bộ nhớ đệm: phải rơi về "chưa biết shop" trung thực, không `LOCAL_SHOP_ID` âm thầm (xem việc để sau, chặn tạo đơn khi chưa có shop thật); (b) máy dùng chung: `evidenceWrite` ghi `createdBy` = uid HIỆN TẠI chứ không phải người quay (`firebase-ports.ts:32`, `evidence-document.ts:30`); nên lưu người tạo tệp ở `evidence_files` (migration v8, thêm cột nullable) nếu hỗ trợ nhiều tài khoản trên một máy: **chờ Q-24g**.
- **Công sức:** M.

### PR2. Mạng thật, chính sách thử lại, timeout (R3, R4)

- **Mục tiêu:** mất mạng ngắn không biến video thành `needs_attention`; không có lệnh nào làm treo hàng đợi vĩnh viễn.
- **Nguyên nhân gốc đã xác minh:**
  - `src/platform/connectivity.ts:7-9`: `useIsOffline()` luôn `false`, nên `isOnline()` ở `UploadRunner.tsx:52` và `OrderSyncRunner.tsx` luôn đúng.
  - `src/features/upload/domain/upload-queue.ts:134-150` (`failAttempt`): mọi lỗi `retryable` (gồm `NETWORK`, `PERMISSION_DENIED` do phiên chưa kịp đăng) cộng `attemptCount`; `backoff.ts` `MAX_UPLOAD_ATTEMPTS = 8` với trễ 5s…15 phút, lượt chạy mỗi 60 giây: khoảng 10 phút mất mạng là `needs_attention`, không có nút thử lại.
  - `src/api/firebase/remote-documents.ts:36-44`: `batch.commit()` khi offline chỉ hoàn tất sau khi máy chủ xác nhận; `upload-queue.ts:169-181` không có timeout; cờ `running` (`upload-queue.ts:206`) kẹt, mọi lượt sau trả `busy`.
- **Cách sửa đề xuất:**
  1. `platform/connectivity.ts`: hiện thực bằng NetInfo (thư viện: **Q-24f**), có `getIsOnline()` đồng bộ cho hàng đợi và hook; thêm loại kết nối (wifi/cellular) để PR dùng cho Q-24c nếu được duyệt.
  2. Phân loại lỗi: lỗi mạng (`NETWORK`, `UNAVAILABLE`, `DEADLINE_EXCEEDED`) và `PERMISSION_DENIED` do phụ thuộc chưa đăng KHÔNG tăng `attemptCount`, chỉ đặt `nextAttemptAtDevice` theo backoff (có trần). Lỗi do máy chủ từ chối (4xx khác) vẫn đếm; sau `MAX_UPLOAD_ATTEMPTS` mới `needs_attention`.
  3. Bọc `declare`, `sessions.create` và `bytes.send` bằng `withTimeout` (khai báo/phiên: ~30 giây; gửi tệp: tính theo kích thước hoặc không timeout nhưng có phát hiện mất mạng bằng NetInfo để hủy lượt). Hết thời gian = lỗi mạng tạm. Hạ `running` bằng `finally` (đã có) nên không kẹt.
  4. `classifyUploadStatus(412)` -> `retryable` (khớp comment của `BytesUploader`, để vòng sau đối soát bằng `fetchServerStates`) (`resumable-upload.ts:19-24`). Đây là việc nhỏ mức Trung bình đi kèm vì cùng tệp.
  5. Đồng bộ đơn (`OrderSyncRunner`) dùng cùng nguồn mạng; sắp thứ tự: tải bằng chứng chỉ khai báo khi đơn/phiên của nó đã đăng (đọc `remote_synced_at_device`/`remote_status`), thay vì chạy `declare` rồi đợi `PERMISSION_DENIED`.
- **Tệp:** `src/platform/connectivity.ts`, `src/features/upload/domain/{upload-queue,backoff,create-upload-gateway}.ts`, `src/features/upload/data/{UploadRunner,firebase-ports}.tsx`, `src/platform/resumable-upload.ts`, `package.json` (thư viện NetInfo, sau khi duyệt). Không migration.
- **Kiểm thử thêm:** unit `upload-queue.test.ts` (offline không tăng lượt; sau N lỗi mạng liên tiếp vẫn `upload_failed`, không `needs_attention`; lỗi 4xx đếm lượt; timeout trả về `running = false`); `firebase-ports.test.ts` (phân loại mới); test hợp đồng backoff có trần; thiết bị: bật chế độ máy bay giữa lúc tải, bật lại: tải tiếp, không mất, không tạo bằng chứng trùng.
- **Tiêu chí xong:** mất mạng 30 phút không làm tệp nào thành `needs_attention`; một lệnh treo không chặn hàng đợi quá thời hạn; test mới xanh.
- **Phụ thuộc:** PR1 (để chạy thật), **Q-24f** (thư viện); **Q-24c** nếu muốn "chỉ Wi-Fi". **Rủi ro:** timeout quá ngắn với tệp lớn trên mạng yếu (đặt riêng cho bước gửi tệp); thư viện NetInfo báo "có mạng" nhưng không ra Internet (vẫn dựa vào lỗi thật). **Công sức:** M.

### PR3. Migration v7: index và tối ưu danh sách (R6)

- **Mục tiêu:** bộ lọc "Chưa có video" và danh sách đơn không chậm khi dữ liệu tăng.
- **Nguyên nhân gốc đã xác minh:**
  - `sqlite-order-store.ts:92-98`: `NOT EXISTS (SELECT 1 FROM evidence_files ev WHERE ev.order_id = o.id AND ev.kind = 'video')`; index duy nhất liên quan là `(shop_id, order_id, created_at_device)` (`sqlite-migrations.ts:84`) nhưng truy vấn không có `shop_id`, nên `EXPLAIN QUERY PLAN` ra `SCAN ev` cho mỗi đơn. Đo trên `node:sqlite` với 30.000 đơn: **14,0 giây**.
  - `packing_sessions` chỉ có khóa chính (`sqlite-migrations.ts:41-49`); `updateOrder`/`saveSession`/`sessionsOfOrder` tra theo `order_id`; truy vấn danh sách dùng "AUTOMATIC COVERING INDEX" tạm mỗi lần gọi (38 ms ở 30.000 đơn, trên máy tính).
- **Cách sửa đề xuất:**
  1. **Migration v7** (chỉ thêm, không sửa v1–v6): `CREATE INDEX idx_evidence_files_order_kind ON evidence_files (order_id, kind);` và `CREATE INDEX idx_sessions_shop_order ON packing_sessions (shop_id, order_id);`. Thêm `idx_orders_shop_activity` chỉ khi có bước 2.
  2. (Tùy chọn, cùng PR hoặc PR3b) cột `orders.last_activity_device` được cập nhật khi tạo/đổi phiên (trong cùng giao dịch `saveSession`/`updateSessionStatus`), backfill trong migration, keyset theo `(shop_id, last_activity_device, id)`; bỏ `GROUP BY` toàn bảng phiên. Chỉ làm khi đo cho thấy cần; đổi hợp đồng `OrderListCursor` thì cập nhật contract test.
  3. `use-order-list.ts`: không gọi `countOrders` ở mỗi lần lấy lại focus khi bộ lọc không đổi và không có ghi nào (chỉ khi đổi lọc hoặc sau thao tác tạo).
- **Tệp:** `src/features/orders/data/sqlite-migrations.ts` (thêm phần tử cuối), `sqlite-order-store.ts` (bước 2), `use-order-list.ts`. Không Rules/Functions.
- **Kiểm thử thêm:** test migration (từ `user_version` 6 lên 7, dữ liệu cũ nguyên vẹn; chạy lại idempotent); test kế hoạch truy vấn: `EXPLAIN QUERY PLAN` của `withoutVideo` không chứa `SCAN ev` (dùng SQLite thật của Node, như `node-sqlite.ts`); test benchmark nhỏ có ngưỡng rộng (ví dụ 5.000 đơn, `withoutVideo` dưới 500 ms) đặt ở project riêng hoặc `it.skip` mặc định để CI không flaky; thiết bị: tạo 5.000 đơn mẫu, đo thời gian mở tab Đơn hàng.
- **Tiêu chí xong:** `withoutVideo` ở 30.000 đơn dưới 200 ms trên máy tính (so với 14 giây); migration v7 chạy được từ v6 trên SQLite thật; không đổi hành vi nghiệp vụ.
- **Phụ thuộc:** không. **Rủi ro:** migration trên máy đã có dữ liệu lớn khóa DB vài giây khi tạo index (chạy trong giao dịch lúc mở, chấp nhận; đo trên thiết bị); bước 2 đụng keyset nên cần test phân trang kỹ. **Công sức:** S (bước 1, 3); M (bước 2).

### PR4. Trung tâm đồng bộ thật và "Thử lại" (R5)

- **Mục tiêu:** UI-F01 hiển thị tệp thật; người dùng thử lại được tệp `needs_attention`/`upload_failed`.
- **Nguyên nhân gốc đã xác minh:** `src/features/upload/ui/SyncCenterScreen.tsx:20-25, 41-43` dùng `ILLUSTRATIVE_SYNC_JOBS` và dải "minh họa"; không có hành động thử lại (comment dòng 28-29); cảnh báo đăng xuất (`use-sign-out.ts:openSyncCenter`) và đếm `countUnsynced` đều dẫn tới màn này.
- **Cách sửa đề xuất:**
  1. Hook `useSyncJobs(shopId)` đọc `EvidenceFileStore.listByStates` theo bốn nhóm bộ lọc docs/09 (Đang tải lên, Chờ tải lên, Lỗi, Đã tải lên); nhãn qua `toDisplayStatus` + `EVIDENCE_STATUS_PRESENTATION`; tên hồ sơ lấy từ đơn (mã đơn, kiện) qua `OrderStore`, không dùng dữ liệu minh họa; bỏ `illustrative`.
  2. Hành động: `RETRY_UPLOAD` từng tệp và "Thử lại tất cả lỗi"; với `needs_attention` do `LOCAL_HASH_CHANGED`/`FILE_MISSING` không có nút thử lại (không có gì để thử), chỉ giải thích (bất biến 4, 6). Thử lại phát sự kiện máy trạng thái rồi gọi `queue.runOnce`; cần đưa `runOnce` ra qua context (`UploadQueueProvider`), vì hiện chỉ `UploadRunner` giữ hàng đợi (`UploadRunner.tsx:54-58`).
  3. Màn chi tiết lỗi (`/sync/[jobId]`) hiện mã lỗi thân thiện từ `errors.json`; mã mới đề xuất ở decisions.md thay vì đặt rời rạc.
  4. Giữ ghi chú trung thực về tải nền (docs/09 5.5): chỉ tải khi app mở.
- **Tệp:** `src/features/upload/ui/SyncCenterScreen.tsx` + hook mới, `src/features/upload/data/UploadRunner.tsx` (cấp hàng đợi qua context), `src/app/sync/[jobId].tsx` và màn lỗi, i18n `screens.json`/`errors.json`. Không migration/Rules.
- **Kiểm thử thêm:** unit/UI (kho bộ nhớ): bốn bộ lọc, nhãn đúng bảng docs/09, không bao giờ hiện "Đã tải lên" khi trạng thái chưa là `uploaded`/`verified`, thử lại phát đúng sự kiện, nút bị ẩn với lỗi cục bộ; test nút bấm đúp; thiết bị: tắt mạng, quay, bật mạng, xem trạng thái chuyển đúng.
- **Tiêu chí xong:** không còn `ILLUSTRATIVE_SYNC_JOBS` trong UI-F01; người dùng thử lại được; test xanh; BA duyệt câu chữ.
- **Phụ thuộc:** PR2 (chính sách thử lại, mạng). **Rủi ro:** thiếu mã lỗi/thông báo trong docs/04–05 cho một số lỗi tải: phải đề xuất BA. **Công sức:** M.

### PR5. Giữ màn hình sáng và xử lý nền/cuộc gọi khi quay (R7)

- **Mục tiêu:** quay trên giá đỡ không bị tắt màn hình giữa chừng; app vào nền/ngắt quãng được xử lý có chủ đích và nói đúng sự thật.
- **Nguyên nhân gốc đã xác minh:** `PackRecordLive.tsx` chỉ dùng `useScreenFocused` và `usePreventRemove`; không có `AppState` hay keep-awake (grep `keepAwake|idleTimer` không có kết quả); `package.json` không có `expo-keep-awake`; `camera-recorder.tsx:49` gọi `recordAsync()` không `maxDuration`. Hành vi `expo-camera` khi app vào nền lúc đang ghi: **chưa xác minh** (cần máy thật; ADR-020 R-12).
- **Cách sửa đề xuất:**
  1. Adapter `platform/keep-awake.ts` (thư viện: **Q-24f**), bật khi `phase === 'recording'`/`'preparing'` đã bắt đầu, tắt khi rời màn/lỗi/xong; không rải gọi thư viện trong màn hình.
  2. `subscribeAppState` (đã có `platform/app-state.ts`, mở rộng bắt `background`/`inactive`) trong `PackRecordLive`: khi vào nền lúc đang ghi, dừng ghi có kiểm soát (`requestStop`) để đi qua đường lưu bền sẵn có, đánh phiên `interrupted` theo cách đã có; khi quay lại, báo đúng điều đã xảy ra (câu mới chờ BA). Không tự tiếp tục ghi (không dựng video liền mạch giả).
  3. Cuộc gọi đến: nếu `recordAsync` kết thúc bất thường, luồng `RECORDER_FAILED`/`interrupted` hiện có xử lý; bổ sung thông báo rõ nguyên nhân khi biết được. Đo trên máy thật để biết `done` có hoàn tất với tệp hợp lệ không.
  4. Giữ cờ `RECORDER_ENABLED` TẮT cho tới khi các kịch bản dưới đạt.
- **Tệp:** `src/platform/keep-awake.ts` (mới), `src/platform/app-state.ts`, `src/platform/index.ts`, `PackRecordLive.tsx`, `package.json`, i18n `screens.json`.
- **Kiểm thử thêm:** unit/UI với adapter giả: bật/tắt keep-awake đúng pha; vào nền khi đang ghi gọi dừng đúng một lần và phiên thành `interrupted`; không gọi sau khi màn bị gỡ; **thiết bị (QA-03/04/05/06 trong docs/08)**: quay 10 phút để máy tự khóa; cuộc gọi đến; chuyển app; thông báo kéo xuống; iOS và Android.
- **Tiêu chí xong:** quay 10 phút trên giá không tắt màn hình (cả hai hệ điều hành); vào nền khi ghi cho ra tệp hợp lệ hoặc `unrecoverable`/`interrupted` trung thực; không có `Platform.OS` rải trong màn hình.
- **Phụ thuộc:** **Q-24f**; cần máy thật iOS + Android. **Rủi ro:** khi dừng ghi do vào nền, iOS có thể không còn thời gian để lưu/băm tệp (JS bị treo): phải dựa vào `recoverInterruptedRecordings` lúc mở lại, đã có. **Công sức:** S-M.

### PR6. Trigger kiểm toán, siết Rules, APP_ENV/EAS (R10 và 2 mục Trung bình liên quan)

- **Mục tiêu:** thực thi bất biến 7 ở phía máy chủ; giảm bề mặt ghi tùy ý của client; tránh phát hành bản store với cấu hình dev.
- **Nguyên nhân gốc đã xác minh:**
  - `firebase/functions/src/index.ts` chỉ export `createShop`, `updateShop`, `verifyEvidence`, `createUploadSession`; không có `onDocumentUpdated`. `firestore.rules` (khối `allow update` của `orders`, `sessions`, `evidence`) nói lịch sử do trigger ghi nhưng không có trigger (decisions.md Q-23k đã ghi nhận). Hôm nay app đẩy `status` phiên bằng `updateFields` (`remote-order-writer.ts:publishSession`), tức là đã có thay đổi không dấu vết.
  - Rules `update` của `orders` không kiểm kiểu/độ dài `orderCode`, `orderCodeNormalized`, `trackingCode*`, `note`; `sessions` không kiểm `interruptions`, `note`; `evidence` không kiểm `lastError`, `sizeBytes` (trên) và cho tạo bằng chứng cho phiên đã `ended`/`confirmed`.
  - `eas.json` (`production`) không đặt `APP_ENV`; `app.config.js:21-34` chỉ bỏ hậu tố `.dev` khi `APP_ENV=prod`; `app.json` mang `vn.doncung.app.dev`. **Chưa xác minh** biến EAS thực tế.
- **Cách sửa đề xuất:**
  1. Function `auditOrderChanges` (`onDocumentWritten` cho `shops/{s}/orders/{o}`, `sessions/{x}`, `evidence/{e}`): ghi `auditEvents` với id cố định theo `(đường dẫn, rev|updateTime)` để idempotent, chỉ ghi tên trường đổi và `before/after` của trường không nhạy cảm (đã che theo conventions; không đưa mã đơn vào log của Function). Region `asia-southeast1`.
  2. Siết Rules: kiểu và độ dài trường (`orderCode` <= 64 ... như create), `note`/`lastError` có trần, `sizeBytes` có trần (giá trị trần là **vận hành, chờ O-05/Q-24c**), cấm tạo bằng chứng mới khi phiên đã `confirmed`. Mỗi thay đổi Rules kèm test có `assertFails` và truy cập chéo shop (`firebase/tests/rules`).
  3. `updateShop` dùng `ID_PATTERN` của `uploads.ts` cho `shopId`; `verifyEvidence` giới hạn thử lại (bỏ `retry: true` sang chiến lược có trần hoặc chuyển lỗi bền sang kiểm toán); `createUploadSession` kiểm thêm `evidence.createdBy`.
  4. EAS: đặt `APP_ENV` theo từng profile (`staging`, `production`), thêm kiểm tra ở bước build/CI từ chối `EXPO_PUBLIC_BACKEND=fake`/`EXPO_PUBLIC_USE_FAKE_BACKEND=1` khi `APP_ENV=prod`; ghi vào `DEPLOYMENT.md`.
- **Tệp:** `firebase/functions/src/{audit.ts (mới),index.ts,shop.ts,uploads.ts}`, `firebase/firestore.rules`, `firebase/tests/rules/*`, `eas.json`, `app.config.js` (kiểm tra), `DEPLOYMENT.md`, có thể `.github/workflows/ci.yml`.
- **Kiểm thử thêm:** test logic Function với Firestore Emulator (cùng cách `evidence.ts` đang test): mỗi cập nhật tạo đúng một `auditEvents`, chạy lại không nhân đôi, client không ghi/xóa được `auditEvents`; rules: kiểu/độ dài sai bị từ chối, cập nhật hợp lệ vẫn qua, chéo shop bị từ chối; script kiểm tra EAS (unit cho hàm kiểm cấu hình).
- **Tiêu chí xong:** `npm run test:rules` xanh với test mới; mọi thay đổi `status`/`rev` có dấu vết kiểm toán trong emulator; build `production` cấu hình đúng `APP_ENV=prod` (kiểm tra bằng `npx expo config`).
- **Phụ thuộc:** không (có thể song song). **Rủi ro:** trigger tăng chi phí Functions/Firestore (mỗi thay đổi một lần ghi); siết Rules làm lỗi các bản app cũ đang chạy: triển khai Rules sau khi app mới có mặt, hoặc chỉ siết các trường app hiện không ghi. **Công sức:** M.

### PR7. Băm: đo, rồi băm native/không băm lại (R9)

- **Mục tiêu:** băm không làm treo ứng dụng và không tốn pin vô ích; mã băm vẫn đúng.
- **Nguyên nhân gốc đã xác minh:** `src/platform/file-hasher.ts` đọc khối 1 MB và `Sha256.update` bằng JS (ADR-020 R-5: tốc độ trên Hermes chưa đo); `upload-queue.ts:155` băm lại toàn tệp ở MỖI lần thử tải; `resumable-upload.ts:26-29` gửi lại từ đầu mỗi lần thử.
- **Cách sửa đề xuất (hai bước):**
  1. **Đo trước** (không đổi mã nghiệp vụ): script/màn gỡ lỗi chỉ ở dev để băm tệp 100 MB, 500 MB trên iOS và Android thật; ghi số MB/giây, nhiệt độ, thời gian JS bị chặn.
  2. Nếu dưới ngưỡng chấp nhận được (đề xuất >= 50 MB/giây; **ngưỡng chờ quyết định kỹ thuật cùng người dùng**): giữ JS nhưng chia nhỏ để nhả JS thread (`await` nhường giữa các khối) và bỏ băm lại khi `size` + `mtime` của tệp không đổi kể từ lần băm hợp lệ gần nhất (lưu `mtime` trong `evidence_files`, migration thêm cột nullable). Nếu dưới ngưỡng: module native (CommonCrypto/`MessageDigest`) sau adapter `platform/file-hasher.ts`, giữ nguyên giao diện; spike S3 theo architecture.md mục 11-12.
  3. Gửi tiếp giữa chừng (`Content-Range`) chỉ làm nếu đo cho thấy mất mạng giữa chừng là phổ biến; ngoài phạm vi PR này, ghi vào việc để sau.
- **Tệp:** `src/platform/file-hasher.ts` (+ module native nếu cần), `src/features/upload/domain/upload-queue.ts`, `sqlite-migrations.ts` (cột `hashed_mtime_device`, nullable), `evidence-file-store` hợp đồng, test.
- **Kiểm thử thêm:** vectơ chuẩn SHA-256 (đã có `sha256.test.ts`) chạy lại với bộ băm native qua cùng test; test hàng đợi: tệp không đổi không băm lại, tệp đổi (size/mtime) bị `LOCAL_HASH_CHANGED` -> `needs_attention`; tuyệt đối không tải tệp đã đổi (bất biến 4); thiết bị: số liệu đo ghi vào `testing.md`.
- **Tiêu chí xong:** có số liệu đo trên iOS và Android; băm 500 MB không làm giao diện đứng quá ngưỡng đã chốt; mã băm giống `node:crypto` trên cùng tệp mẫu.
- **Phụ thuộc:** máy thật; nên sau PR2. Nếu chọn module native thì cần duyệt thư viện/mã native. **Rủi ro:** `mtime` không đáng tin (khôi phục từ backup) nên bỏ băm lại phải kèm kiểm tra kích thước, và vẫn băm lại khi nghi ngờ; mã native phải được kiểm trên cả hai hệ điều hành (D-12). **Công sức:** S (đo) + M (JS nhường thread, bỏ băm lại) hoặc L (native).

### PR8. Chia đoạn video / giảm mất mát khi app bị kill (R8) — **chờ Q-24b**

- **Mục tiêu:** sự cố (kill, crash, hết pin) không làm mất toàn bộ một video dài.
- **Nguyên nhân gốc đã xác minh:** `camera-recorder.tsx:49` `recordAsync()` ghi vào thư mục tạm do `expo-camera` đặt tên; `recording-controller.ts:331-335` (`recoverInterruptedRecordings`) cố ý coi tệp `recording` bị kill là `unrecoverable` vì không biết đường dẫn tệp tạm (ADR-020 R-4, tránh tự liên kết, bất biến 5). Không có `maxDuration` hay chia đoạn.
- **Phương án (không tự chốt, xem Q-24b):**
  - **A. Giữ nguyên, ghi rõ giới hạn** trong sản phẩm/hướng dẫn; ghi nhận thiếu bằng chứng khi gián đoạn. Rẻ nhất; mất trắng một lần quay khi kill.
  - **B. Chia đoạn bằng JS:** `recordAsync({ maxDuration })` lặp, mỗi đoạn là một bằng chứng riêng (bản ghi tệp tạo trước khi ghi đoạn, bất biến 2). Rủi ro: khoảng trống giữa hai đoạn (camera dừng/khởi động lại), chưa kiểm chứng trên thiết bị; phải nói rõ với người dùng đây là "nhiều đoạn" chứ không phải một video liền mạch (bất biến 6, 11).
  - **C. Module native ghi theo đoạn** (AVAssetWriter/MediaRecorder) với tệp tên biết trước để khôi phục được: tin cậy nhất, công sức lớn, cần spike S1 và mã native cả hai nền tảng.
  - **Khuyến nghị:** làm A ngay (không chặn phát hành thử nghiệm kín), và spike C/B trên máy thật trước khi mở rộng người dùng; quyết định sau số liệu từ PR5.
- **Kiểm thử thêm (nếu B/C):** unit điều phối nhiều đoạn (mỗi đoạn có `evidenceId`, kiện, phiên đúng; lỗi đoạn giữa không mất đoạn trước); khôi phục khi kill giữa đoạn; thiết bị: QA-04/05.
- **Phụ thuộc:** **Q-24b**; PR5 (số liệu). **Công sức:** A: S; B: M-L; C: L.

### PR9. Đồng bộ kéo xuống và xem video đã tải (R2) — **chờ Q-24a**

- **Mục tiêu:** tùy phạm vi phát hành: hoặc ghi rõ "một thiết bị" và cảnh báo trong sản phẩm; hoặc hỗ trợ máy mới/nhiều người cùng shop.
- **Nguyên nhân gốc đã xác minh:** `OrderSyncRunner.tsx` và `remote-order-writer.ts` chỉ ghi (`createMissing`, `updateFields`); không có `onSnapshot`/`getDocs` đọc đơn về SQLite (grep không thấy); `functions/src/index.ts` không có Function cấp URL đọc video có thời hạn (storage.rules từ chối đọc trực tiếp, ADR-006); ADR-019 Q-23b ghi rõ "một chiều". Hệ quả: danh sách đơn trống trên máy mới, hai người cùng shop không thấy đơn của nhau (không có cảnh báo trùng giữa máy).
- **Phương án (xem Q-24a):**
  - **A. Phạm vi phát hành đầu: một thiết bị, một tài khoản.** PR9 chỉ gồm giải thích trong sản phẩm (hướng dẫn, màn Cá nhân/Trợ giúp nói rõ dữ liệu nằm trên máy này, đã tải thì máy chủ giữ) + cảnh báo khi cài lại/đăng xuất (đã có phần đăng xuất); công sức S.
  - **B. Kéo xuống một chiều theo shop:** nạp đơn/phiên/bằng chứng từ Firestore vào SQLite (theo `rev`/`updateTime`, phân trang, không "last write wins" với bằng chứng), gắn nguồn "từ máy chủ"; kiểm trùng đơn sau khi nạp; Function `createEvidenceReadUrl` (thành viên shop, URL có thời hạn ngắn, kiểm toán) để xem video. Công sức L, đụng Rules (đọc đã có), Functions, SQLite (migration v8+), chi phí đọc Firestore (phải cân nhắc, architecture.md).
  - **C. Chỉ khôi phục sau cài lại (đọc đơn của chính mình)**: nhỏ hơn B, vẫn cần URL xem video.
  - **Khuyến nghị:** A cho thử nghiệm kín; B cho bản phát hành rộng hoặc khi có nhiều người đóng hàng chung shop. Không bật tính năng nhiều người trước khi có B.
- **Kiểm thử thêm (nếu B):** rules (đọc chéo shop bị từ chối, thành viên bị thu hồi mất quyền ngay); unit giải xung đột (đơn trùng mã giữa máy: không gộp tự động, bất biến 5); Function URL (chỉ thành viên, hết hạn, không log URL); thiết bị: cài lại app, đăng nhập, thấy đơn cũ.
- **Phụ thuộc:** **Q-24a**; PR1, PR3, PR6. **Công sức:** A: S; B: L.

---

## 5. Cần kiểm chứng trên thiết bị

Chưa chạy được ở môi trường hiện tại (chỉ unit test và emulator). Làm trên iOS và Android thật (D-12), ghi kết quả vào `testing.md` và ADR-020:

1. **Phiên (PR1):** đăng nhập -> tắt app -> mở lại: `uid`/`shopId` còn; đơn được đăng; đăng xuất thật; đổi tài khoản không lộ dữ liệu (QA-11).
2. **Mạng (PR2):** chế độ máy bay giữa lúc tải; đổi Wi-Fi <-> 4G/5G; mạng "có sóng nhưng không ra Internet"; Firestore ngoại tuyến không làm treo hàng đợi (R4 là giả thuyết chưa xác minh trên thiết bị).
3. **Danh sách (PR3):** 5.000-30.000 đơn mẫu: thời gian mở tab, lọc "Chưa có video", cuộn; migration v6 -> v7 trên SQLite thật (`expo-sqlite`, không chỉ `node:sqlite`).
4. **Quay (PR5, PR8):** 5-10 phút liên tục; màn hình tự khóa; cuộc gọi đến; chuyển app; thông báo; hết bộ nhớ; kill app khi quay và khi lưu; nhiệt độ/pin; nhiều video liên tiếp (QA-03…06).
5. **Băm và tải (PR7):** tốc độ băm 100/500 MB; gửi tệp 100 MB+ trên mạng yếu; mất mạng giữa chừng; tiết kiệm pin/dữ liệu.
6. **Trung tâm đồng bộ (PR4):** trạng thái đúng từng bước, thử lại, chữ lớn hệ thống, trình đọc màn hình (VoiceOver/TalkBack), nút Back phần cứng Android.
7. **Môi trường (PR6):** bản `production` dùng đúng bundle id, đúng dự án Firebase, không có cổng giả.

## 6. Việc để sau (ngoài phạm vi tài liệu này, từ báo cáo mức Trung bình/Thấp)

Ghi nhận để xếp lịch: chặn tạo đơn khi chưa có shop thật và đường chuyển dữ liệu `LOCAL_SHOP_ID` (cô lập shop); loại thư mục `evidence`/CSDL khỏi backup iCloud/Android (**Q-24d**); chọn mã khi nhãn có nhiều mã vạch; câu slogan màn Chào mừng "Lưu trữ an toàn" (**Q-24e**); nhắc người dùng giới hạn dung lượng tối thiểu (O-05); `React.memo` cho hàng danh sách; theo dõi `npm audit`; lưu người quay trên `evidence_files` (**Q-24g**).
