# V1-08 sync-center — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 2.3, 3.0, 3.3 V1-08, 7.5 (R-3 = A); `release-hardening-plan.md` PR4 (R5); Q-24h. Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-08 — sync-center`.

## Mục tiêu

1. Trung tâm đồng bộ UI-F01 và Chi tiết lỗi UI-F02 đọc tệp THẬT trên máy (bằng chứng đóng gói `evidence_files` + ảnh/video hàng hoàn `return_media`) của shop đang dùng; bỏ `ILLUSTRATIVE_SYNC_JOBS` (không còn "DEMO-0002").
2. Bốn bộ lọc theo docs/09 (Đang tải lên, Chờ tải lên, Lỗi, Đã tải lên), nhãn qua `toDisplayStatus` + `EVIDENCE_STATUS_PRESENTATION` (docs/09 mục 3).
3. **Thử lại** (R-3 A): `upload_failed` dùng sự kiện sẵn có `RETRY_UPLOAD`; `needs_attention` dùng sự kiện MỚI `USER_RETRY_ATTENTION` (`origin: 'device'`, chỉ tới `queued`), chỉ khi lỗi không phải lỗi tệp cục bộ. Sau đó gọi hàng đợi chạy một lượt.
4. **Kiểm tra lại** cho tệp kẹt `uploaded` (> 15 phút, của chính tài khoản): gọi `createUploadSession` để máy chủ đặt yêu cầu xác minh lại (V1-04 `evidenceReverify`), rồi đối soát. Client KHÔNG tự đổi trạng thái.
5. Tệp của tài khoản khác (V1-07) hiện thành nhóm riêng với lý do, không có nút Thử lại/Kiểm tra lại.
6. Mạng (V1-02 `useConnectivity`): mất mạng thì dải báo rõ; Thử lại vẫn đưa tệp về hàng chờ và nói sẽ chạy khi có mạng.
7. Ngôn ngữ trung thực: "tải khi app đang mở", không hứa tải nền.

## Thiết kế

**Máy trạng thái (`features/evidence/domain/file-state.ts`):** thêm `USER_RETRY_ATTENTION: { origin: 'device', from: [needs_attention], to: queued }` và điều kiện: `transition(state, event, context?)` với `context.lastErrorCode`; sự kiện này cần `isUserRetryableAttention(code)` = mã khác `null` và không thuộc `NON_RETRYABLE_ATTENTION_CODES` (`LOCAL_HASH_CHANGED`, `FILE_MISSING`, `FILE_UNREADABLE`, `UPLOAD_FILE_TOO_LARGE`, `UNSUPPORTED_FILE_TYPE`), sai thì `NOT_USER_RETRYABLE`. `hash_mismatch` không phải `needs_attention` nên bị loại bởi bảng. `applyEventToFile` và `applyMediaEvent` truyền `lastErrorCode` của bản ghi. `ATTENTION_RESOLVED` giữ nguyên (không ai dùng; ghi chú).

Patch khi người dùng thử lại: `attemptCount: 0`, `nextAttemptAtDevice: null`, **giữ `lastErrorCode`** để `mayHaveReachedServer` vẫn đúng (tệp đã từng gửi máy chủ: đối soát trước khi gửi lại; ảnh hàng hoàn không xóa được — Q-26j/Q-28).

**Hàng đợi (`features/upload/domain`):** `UploadGateway.requestServerCheck?(shopId, id)` (hiện thực: `sessions.create` có hạn 30 giây, bỏ qua kết quả, không gửi tệp); `UploadQueue.requestServerCheck(shopId, id)`: chỉ cho tệp của nguồn (đã lọc uid) đang `uploaded`, offline -> `offline`, lỗi -> `failed`, xong -> `requested` rồi chạy `runOnce` (đối soát). Hàm `retryByUser(source-like apply, job)` dùng chung.

**Phân loại (`features/upload/domain/sync-jobs.ts`, thuần):** `SyncJob` (khóa `pack:<id>`/`return:<id>`, nguồn, trạng thái, kích thước, mã lỗi, nhãn hồ sơ, quan hệ người tạo, `updatedAtDevice`); `describeSyncJob(job, { online, now })` -> `{ bucket, display, foreign, reasonKey, action: 'retry' | 'recheck' | null }`. Bucket theo nhãn hiển thị; tệp tài khoản khác cùng bucket nhưng hiện ở nhóm riêng. Không gồm `recording`/`saving_local` (chưa phải việc đồng bộ).

**Nạp dữ liệu (`features/upload/domain/load-sync-jobs.ts`):** đọc `EvidenceFileStore.listByStates` + `ReturnStore.listMediaByStates` (hàm MỚI, theo shop, mọi người tạo; SQLite + bộ nhớ + hợp đồng), tra phiên (người tạo), đơn (mã đơn + số kiện), hồ sơ hoàn (mã hồ sơ, người tạo, bản neo) có bộ đệm theo id. Nhóm "Đã tải lên" chỉ hiện 50 tệp mới nhất (chỉ nạp khi chọn bộ lọc đó).

**UI (`features/upload/ui`):** `SyncCenterScreen` (bỏ `illustrative`, dải mạng, câu "tải khi app mở", chip bốn bộ lọc kèm số đếm, thẻ tệp, nút Thử lại tất cả cho tệp đủ điều kiện ở bộ lọc Lỗi, nhóm "Do tài khoản khác tạo trên máy này"), `SyncErrorScreen` thật (UI-F02: nguyên nhân, dữ liệu còn ở đâu, hành động; tệp không còn lỗi thì báo), `use-sync-jobs.ts`, `use-sync-actions.ts`, `SyncJobCard.tsx`. `UploadRunner` cung cấp context `useUploadQueueControl()` (`runNow`, `requestServerCheck`), tuần tự hóa lượt chạy (bấm khi đang chạy thì chạy lại một lần sau). Cổng giả/test (không có hàng đợi): `runNow` không làm gì, `requestServerCheck` trả `unavailable`.

**Xóa:** `ILLUSTRATIVE_SYNC_JOBS`, `IllustrativeSyncJob`, `IllustrativeSyncFilter`, `ILLUSTRATIVE_SYNC_COUNTS` (không còn ai dùng). Màn khung `SyncErrorScreen` trong `placeholders.tsx`.

Không migration, không Rules/Functions, không mã lỗi mới trong `codes.ts` (chuỗi mới chờ BA ở decisions).

## Test

- `file-state.test.ts`: `USER_RETRY_ATTENTION` từ `needs_attention` với lỗi máy chủ -> `queued`; từ chối với `LOCAL_HASH_CHANGED`/`FILE_MISSING`/`FILE_UNREADABLE`/`UPLOAD_FILE_TOO_LARGE`/`UNSUPPORTED_FILE_TYPE`/`null`/không ngữ cảnh; từ `hash_mismatch` và trạng thái khác bị từ chối; `origin: 'server'` bị từ chối; không bao giờ tới trạng thái máy chủ.
- `evidence-file`/`media`: patch giữ `lastErrorCode` -> `mayHaveReachedServer` đúng.
- `sync-jobs.test.ts`: bucket, lý do, hành động theo từng trạng thái/mã/mạng/quan hệ; không bao giờ "Đã tải lên" khi chưa `uploaded`/`verified`; kiểm tra lại chỉ sau 15 phút và chỉ tệp của mình.
- `load-sync-jobs.test.ts` (kho bộ nhớ): nhãn hồ sơ, quan hệ người tạo, cô lập shop.
- `upload-queue.test.ts`: `requestServerCheck` (đủ điều kiện, offline, lỗi, không phải `uploaded`, tệp tài khoản khác).
- `create-upload-gateway.test.ts`: `requestServerCheck` gọi `sessions.create`, không gửi tệp.
- Hợp đồng kho hàng hoàn: `listMediaByStates` (SQLite `node:sqlite` + bộ nhớ, cô lập shop).
- UI `SyncCenterScreen.test.tsx`/`SyncErrorScreen.test.tsx`: bốn bộ lọc; rỗng; Thử lại phát đúng sự kiện + `runNow` một lần (bấm đúp); không nút với lỗi cục bộ; nhóm tài khoản khác không nút; offline; Kiểm tra lại.
- `UploadRunner.test.tsx`: context `runNow` chạy hàng đợi, lượt chồng chạy lại một lần.

## Màn cần chụp (bản web, cổng giả, dữ liệu tạm không commit)

UI-F01: trước (mốc V1-00), rỗng, Đang tải lên, Chờ tải lên (có offline), Lỗi (có Thử lại + lỗi cục bộ), nhóm tài khoản khác, Đã tải lên (có Kiểm tra lại). UI-F02: lỗi máy chủ (có Thử lại), lỗi cục bộ (không có).

## Rủi ro

- Chuyển trạng thái mới đụng bất biến 3: chỉ `origin: 'device'` tới `queued`, có test; không tới trạng thái máy chủ.
- Danh sách "Đã tải lên" đọc mọi tệp `uploaded`/`verified` của shop rồi cắt 50 (chi phí đọc SQLite tăng theo số tệp; chỉ khi chọn bộ lọc đó). Có thể thêm `LIMIT` ở kho sau.
- Tra đơn/phiên/hồ sơ theo từng id (có bộ đệm) — số tệp chưa đồng bộ thường nhỏ.
- Chưa có tiến độ % (cổng gửi tệp chưa báo tiến độ): "Đang tải lên" không có %.
- Chưa kiểm chứng trên thiết bị; câu chữ mới chờ BA.
- Kích thước ước tính ~900–1100 dòng mã (không tính test/tài liệu), dưới 1500.

## Tự review

Vòng 1: (1) Bản nháp đặt `lastErrorCode: null` khi thử lại -> tệp `queued` với `attemptCount 0` và không mã lỗi bị coi là "máy chủ chắc chắn chưa có" (`mayHaveReachedServer` false): bỏ đối soát trước khi gửi lại và cho xóa ảnh hàng hoàn có thể đã lên máy chủ (vi phạm bất biến 4, Q-26j). Sửa: giữ `lastErrorCode`. (2) Điều kiện "lỗi máy chủ từ chối": danh sách cho phép dễ sót mã máy chủ mới (tệp kẹt mãi); chọn danh sách CẤM gồm mọi lỗi tệp cục bộ + mã rỗng (bảo thủ khi không biết), ghi decisions. (3) Kiểm tra lại cho tệp tài khoản khác: máy chủ từ chối (`createdBy != uid`) -> không hiện nút. (4) `uploading` của tài khoản khác hiện "Chờ tải lên" (V1-07), không lọt vào bộ lọc "Đang tải lên". (5) Thử lại khi offline: vẫn đặt hàng chờ (đúng yêu cầu), câu nói rõ chạy khi có mạng và app mở. (6) Không thêm trạng thái/nhãn thứ 7; "Đang chờ mạng" là lý do hiển thị. Bất biến 1, 2 (không đổi liên kết), 5 (không gán lại tệp), 8 (mọi truy vấn có `shopId`), 9, 11 giữ.

Tự review: đã chấp nhận.
