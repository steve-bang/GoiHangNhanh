# V1-14 account-delete-server: kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.1, 1.2 (xóa tài khoản), 3.3 V1-14, 7.2 a/b, 7.5 (R-1 A: lưu `uid`; R-4 A: 30 ngày; purge xóa cả shop gồm `auditEvents`, chỉ giữ `accountDeletions`); [decisions.md](../decisions.md) Q-29 / V1-20 điểm 11 (câu chung "xóa hẳn sau 30 ngày, trừ khi phải giữ lại vì lý do pháp lý hoặc tranh chấp đang mở"). Trang web `web/src/pages/xoa-tai-khoan.astro` và chính sách quyền riêng tư (đã trên `main`) mô tả hành vi; mã phải khớp.

## Mục tiêu

1. Callable `deleteAccount`: người dùng vừa xác thực lại xóa được tài khoản; quyền vào cửa hàng và tài khoản Auth mất **ngay**; dữ liệu cửa hàng do mình sở hữu bị khóa (không ai trong app đọc/ghi được) và hẹn xóa hẳn sau 30 ngày.
2. Function định kỳ `purgeDeletedShops` (hằng ngày): xóa hẳn shop quá hạn, gồm Storage `shops/{shopId}/**` và MỌI collection con (orders, lines, packages, sessions, evidence, returns, members, `evidenceReverify`, `auditEvents`), trừ shop có `legalHold == true`.
3. Nhật ký tối thiểu `accountDeletions` (client không đọc/ghi): uid, `shopIds`, thời điểm, trạng thái, lý do kỹ thuật, số lượng; không email/tên/mã đơn.
4. Script cho nhân viên hỗ trợ xử lý yêu cầu xóa qua email (Admin SDK, mặc định dry-run).

## Không làm

- Giao diện, nối app (V1-15). Không thêm mã lỗi vào `src/core/errors/codes.ts` (V1-15 + BA).
- Không có tranh chấp phía máy chủ ở v1 (tranh chấp chỉ trên máy, V1-15 chặn xóa khi còn hồ sơ mở). Máy chủ chỉ dựa vào `legalHold` của shop (chỉ Admin đặt, chưa có giao diện).
- Không có thao tác khôi phục tài khoản đã xóa (kế hoạch 1.1).

## Thiết kế

### `firebase/functions/src/account.ts` (mới, hàm thuần, test trên Emulator)

- Hằng số: `ACCOUNT_PURGE_AFTER_DAYS = 30` (R-4, khớp `web/src/config/site.ts` `purgeAfterDays`), `RECENT_AUTH_MAX_AGE_SECONDS = 300`.
- `AccountError(code, message, reason)`; `describeCallableError` trả `details: { reason }` (`requires_recent_login`, `shop_has_members`, `account_deleted`) để client phân loại không dựa vào câu chữ.
- `assertRecentAuth(authTimeSeconds, nowMs)`: thiếu `auth_time` hoặc quá 5 phút -> `failed-precondition` / `requires_recent_login`. Lệch đồng hồ: `auth_time` ở tương lai vẫn nhận.
- `deleteAccountForUser(db, auth, uid, { nowMs, channel })` — idempotent, 2 bước:
  1. **Một transaction**: đọc `userShops/{uid}`, `accountDeletions/{uid}`, rồi với mỗi shop (hợp của `userShops.shopId` và `shopIds` đã ghi ở lần trước): shop, `members/{uid}`, `members` (tối đa 20).
     - Là `owner` (hoặc lần chạy trước đã đánh dấu shop này cho chính uid): còn thành viên `active` khác -> từ chối `failed-precondition` / `shop_has_members` (không xảy ra ở v1). Nếu không: `shops/{id}` đặt `status: 'deleting'`, `deletionRequestedAt` (giờ máy chủ), `purgeAfter` (= giờ máy chủ Function + 30 ngày, `Timestamp`), `deletionRecordId: uid`; đã `deleting` thì **giữ nguyên** `purgeAfter` cũ (gọi lại không kéo dài hạn).
     - Không phải owner: chỉ gỡ thành viên.
     - Xóa `members/{uid}`, `userShops/{uid}`; ghi một sự kiện `account.deletion_requested` vào `auditEvents` của shop được xóa (id cố định, ghi lại không nhân đôi; bị purge cùng shop).
     - `accountDeletions/{uid}`: **id tài liệu = uid** (lệch có chủ đích với `autoId` của kế hoạch: idempotent không cần truy vấn, uid Firebase không bao giờ được cấp lại). Tạo lần đầu: `uid`, `shopIds` (shop sẽ purge), `leftShopIds` (shop chỉ rời), `requestedAt`, `purgeAfter` (null nếu không có shop), `status: 'requested'`, `reason: 'owner_request'`, `channel: 'app' | 'support'`, `counts`. Lần sau: chỉ hợp `shopIds`.
  2. Xóa người dùng Auth (Admin SDK; `auth/user-not-found` = đã xóa). Rồi `status` -> `pending_purge` (có shop) hoặc `completed` (không có shop), `authDeletedAt`. Lỗi giữa chừng: gọi lại chạy tiếp (transaction không đổi gì thêm).
- `purgeDeletedShops(db, storage, { nowMs, deadlineMs, pageSize })`: truy vấn `shops where purgeAfter <= now orderBy purgeAfter` theo trang (chỉ mục một trường tự động, không thêm chỉ mục), mỗi shop gọi `purgeShop`; dừng khi gần hết thời gian (phần còn lại chạy ngày sau).
- `purgeShop(db, storage, shopId, { nowMs, deadlineMs })` -> `purged | not_deleting | not_due | legal_hold | incomplete`:
  - Kiểm `status == 'deleting'`, `purgeAfter <= now`, `legalHold != true` (giữ: ghi `lastSkipReason: 'legal_hold_skip'` vào bản ghi một lần, không xóa gì).
  - Thứ tự: (1) Storage theo trang 500 đối tượng tiền tố `shops/{shopId}/` (dấu `/` cuối: không đụng `shops/{shopId}x/`); hết giờ -> `incomplete`. (2) Mọi collection con (`listCollections`) bằng `recursiveDelete`. (3) Cuối cùng một transaction: xóa `shops/{id}` + cập nhật bản ghi (`purgedShopIds`, `counts` cộng dồn, `purgedAt`, `status: 'purged'` khi mọi shop của bản ghi đã purge). Tài liệu shop (dấu `deleting`) bị xóa **sau cùng** nên purge bị ngắt giữa chừng luôn được ngày sau tìm lại.
- Interface `StoragePrefixDeleter { listPage(prefix, pageToken), delete(name) }`; `index.ts` nối bucket thật; test dùng bản giả.

### Trigger kiểm toán không "hồi sinh"

- `recordAuditForWrite` trả `skipped_delete` khi bản sau không tồn tại, trước mọi lần ghi (V1-04, đã kiểm). `reverifyEvidence` chỉ chạy khi `requestedAt` mới (xóa -> không). `verifyEvidence` cập nhật bằng `tx.update` trên bằng chứng phải tồn tại. Thêm test: purge rồi gọi `recordAuditForWrite` với sự kiện xóa -> không có tài liệu nào dưới shop.

### `createShop`

- Từ chối (`permission-denied` / `account_deleted`) khi `accountDeletions/{uid}` có: token cũ còn hạn tới 1 giờ sau khi xóa Auth, không được tạo shop mồ côi.

### Rules (`firebase/firestore.rules`)

- `accountDeletions/{id}`: `allow read, write: if false` (tường minh, có test).
- `isActiveMember` thêm điều kiện shop không ở `deleting` (`get(shops/{id}).data.get('status','active') != 'deleting'`): chặn đọc/ghi cả khi thành viên còn sót (phòng thủ thêm ngoài việc gỡ thành viên). Chi phí: +1 lượt đọc tài liệu trong đánh giá Rules mỗi yêu cầu client (ghi ở architecture.md mục 13).
- Test `evidenceReverify` (nit review V1-04): thành viên cùng shop đọc/ghi, chủ shop khác đọc -> `assertFails`.

### Script hỗ trợ `firebase/functions/src/admin/delete-account-cli.ts`

- `node lib/admin/delete-account-cli.js --project <id> (--email <email> | --uid <uid>) [--execute]`. Mặc định **dry-run**: in uid, shop sẽ khóa/rời, trạng thái bản ghi cũ; không ghi gì. `--execute` gọi `deleteAccountForUser` với `channel: 'support'` (không cần `auth_time`; nhân viên đã xác minh qua email theo trang web). Không in email ra màn hình. Hàm thuần `runDeleteAccountCli(args, deps)` có test.
- Thêm script `npm --prefix firebase/functions run account:delete -- ...` và ghi ở `CLAUDE.md`-đề xuất + firebase-setup.

### Lịch

- `onSchedule({ schedule: 'every day 03:00', timeZone: 'Asia/Ho_Chi_Minh', region: asia-southeast1, timeoutSeconds: 540, memory: '512MiB', retryCount: 0 })`; ngân sách 480 giây/lần. Không thử lại tự động: ngày sau chạy lại idempotent.

## Test (Emulator, `npm run test:rules`)

- `tests/functions/account.test.ts`: chưa xác thực lại / thiếu `auth_time` -> từ chối; chủ duy nhất -> shop `deleting` + `purgeAfter` +30 ngày, thành viên + `userShops` mất, Auth bị xóa, bản ghi không có email/tên; gọi hai lần không lỗi, một bản ghi, `purgeAfter` không đổi; lỗi xóa Auth -> gọi lại hoàn tất; người không phải chủ chỉ rời shop; shop còn thành viên khác -> từ chối, không đổi gì; người khác shop không xóa được shop của người khác (chỉ tác động uid của chính token); `createShop` sau khi xóa -> từ chối; purge trước hạn / `legalHold` / không `deleting` -> không xóa; purge xong: shop + mọi collection con (orders, lines, packages, sessions, evidence, returns, members, evidenceReverify, auditEvents) rỗng, shop khác nguyên vẹn, Storage giả chỉ mất đúng tiền tố, bản ghi `purged` + số lượng; hết giờ giữa Storage -> `incomplete`, lần sau xong; trigger kiểm toán với sự kiện xóa không ghi gì; CLI dry-run không ghi, `--execute` xóa.
- `tests/rules/account-deletion.rules.test.ts`: `accountDeletions` client không đọc/ghi (kể cả chính uid); shop `deleting`: thành viên còn sót đọc/ghi `shops/{id}/**` bị từ chối; `evidenceReverify` từ chối.

## Màn hình

Không có thay đổi giao diện.

## Rủi ro

- Purge shop rất lớn kéo nhiều ngày (theo trang, idempotent); số lượng đếm có thể thiếu nếu `recursiveDelete` bị ngắt giữa collection.
- Mỗi tài liệu bị xóa kích hoạt trigger kiểm toán (bỏ qua ngay): chi phí gọi Function tỉ lệ số tài liệu, một lần.
- `auth_time` sau `reauthenticateWithCredential`: client phải lấy token mới (`getIdToken(true)`) trước khi gọi (V1-15). Chưa kiểm chứng trên dự án thật.
- Lưu `uid` sau xóa (R-1, chờ rà pháp lý C-2). Cloud Scheduler cần bật API khi deploy lần đầu.
- Chưa deploy, chưa chạy trên dự án thật.

## Tự review

Vòng 1 (bất biến 1–11, dữ liệu, kích thước):
- Bất biến 9: shop `legalHold` không bị purge; không có dọn theo hạn lưu. Bất biến 7: `auditEvents` chỉ bị máy chủ xóa khi purge theo yêu cầu của chủ (điều phối chốt). Bất biến 8: tiền tố Storage có `/` cuối để không xóa nhầm shop có id bắt đầu giống; test chéo shop. Bất biến 11: không nói "xóa ngay"; câu 30 ngày khớp web.
- Sửa: ban đầu xóa tài liệu shop trước Storage -> purge bị ngắt sẽ mất dấu và để lại tệp mồ côi; đổi thứ tự (Storage -> collection con -> tài liệu shop sau cùng).
- Sửa: ban đầu dùng `autoId` cho `accountDeletions` -> gọi lại phải truy vấn theo uid và dễ nhân đôi khi chạy đồng thời; đổi sang id = uid trong transaction.
- Sửa: token cũ còn hạn sau khi xóa Auth có thể gọi `createShop` tạo shop mồ côi -> chặn bằng bản ghi.
- Kích thước: ~450 dòng mã + test; một PR.

Vòng 2: truy vấn purge chỉ cần chỉ mục một trường (`purgeAfter`), không đụng `firestore.indexes.json`; Rules thêm một `get()` (tổng ≤ 5 truy cập tài liệu/yêu cầu, dưới trần 10). Không đổi mã app.

Vòng 3 (khi viết tài liệu deploy): bucket bật Object Versioning (Q-23i) thì `delete` chỉ tạo phiên bản cũ; câu "xóa hẳn sau 30 ngày" cần quy tắc vòng đời xóa phiên bản cũ. Ghi vào firebase-setup mục 5, checklist F-4b, decisions Q-29 / V1-14 k (không đổi mã).

Tự review: đã chấp nhận.
