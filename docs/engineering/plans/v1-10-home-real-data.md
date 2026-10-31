# V1-10 home-real-data — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 1.2 (dòng "Màn minh họa/khung", Q-24a = A), 2.3, 3.0, 3.3 V1-10, 7.2 (f, j, o), 7.5. Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-10 — home-real-data`.

## Mục tiêu

1. Trang chủ UI-B01 không còn "Shop minh họa", số 12/11/1 và dải "Dữ liệu minh họa…": tên cửa hàng lấy từ phiên (`getShopSummary`), 3 ô thống kê đếm THẬT trên kho cục bộ của shop đang dùng.
2. Máy trống: số 0 thật + một câu "Hôm nay chưa có …" (không số giả), và thẻ thông tin **"Dữ liệu nằm trên máy này"** (Q-24a: một máy/một tài khoản), đóng được, nhớ trạng thái đóng trong `device_settings` (V1-09, qua `@/features/orders`).
3. Thẻ "Dữ liệu bằng chứng" ở Cá nhân (UI-I01) và màn con Dữ liệu bằng chứng có số thật (trên máy / đang chờ / trên đám mây) thay "Chưa có số liệu".
4. Tab Thông báo UI-I07 (D-16, không bỏ tab): trạng thái rỗng trung thực "Chưa có thông báo…" + nút mở Trung tâm đồng bộ, thay khung "Tính năng sắp có".
5. Xóa dữ liệu minh họa: tệp `src/shared/fixtures/illustrative-data.ts`, prop `illustrative` của `Screen`, khóa `common:illustrative`. ESLint cấm import `@/shared/fixtures/illustrative-data` (tái phát).
6. Thành viên UI-I03, Gói, Dung lượng UI-F03: **giữ như hiện tại** (ẩn/không lối vào; mục 2.3), không đổi.

## Định nghĩa số liệu (trung thực, bất biến 3, 11)

"Hôm nay" = từ 0 giờ đến trước 0 giờ hôm sau theo **giờ thiết bị** (múi giờ máy), `[from, to)`.

| Ô | Định nghĩa |
|---|---|
| Trang chủ "Đơn đã đóng gói" | Số **đơn khác nhau** có ít nhất một phiên đóng gói *bắt đầu* hôm nay và đã dừng ghi bình thường (`ended`/`confirmed`, tức có video đã lưu). Phiên `created` (cờ ghi video tắt), `recording`, `interrupted`, `needs_attention` không tính. |
| Trang chủ "Đã tải lên" | Số tệp (bằng chứng đóng gói + ảnh/video hàng hoàn) ở `uploaded`/`verified` (chỉ do máy chủ xác lập) có lần đổi trạng thái cuối trong hôm nay (`updated_at_device`). |
| Trang chủ "Lỗi – cần xử lý" | Số tệp đang ở bộ lọc **Lỗi** của Trung tâm đồng bộ (cùng `loadSyncJobs` + `describeSyncJob` của V1-08, gồm tệp của tài khoản khác), **không giới hạn trong hôm nay** (lỗi cũ vẫn cần xử lý). Bấm mở UI-F01 ở bộ lọc Lỗi. |
| Cá nhân "Trên thiết bị" | Tệp có bản đã lưu trên máy: mọi trạng thái trừ `recording`, `saving_local`, `local_save_failed`, `unrecoverable` (v1 không xóa bản cục bộ sau khi tải, bất biến 4). |
| Cá nhân "Đang chờ đồng bộ" | Tệp máy chủ chưa xác nhận đã nhận: `UNSYNCED_STATES` (cùng định nghĩa đếm chặn đăng xuất). |
| Cá nhân "Trên đám mây" | Chỉ `verified` (máy chủ đã nhận VÀ kiểm tra khớp; khớp câu giải thích có sẵn). |
| Dữ liệu bằng chứng "Tổng số bằng chứng" | Mọi tệp của shop trên máy này (mọi trạng thái). |

Mọi số đều theo `shopId` đang dùng (bất biến 8), chỉ đọc SQLite trên máy, không gọi mạng. Đọc lỗi: ô hiện "–" kèm câu "Không đọc được số liệu trên máy." (không hiện 0).

## Thiết kế

**Kho (đếm bằng SQL, không nạp mọi dòng):**
- `EvidenceFileStore.countByState(shopId, updatedIn?)` (evidence domain; SQLite `GROUP BY state` trên `evidence_files`, bộ nhớ; `create-evidence-file-store`), `ReturnStore.countMediaByState(shopId, updatedIn?)` (returns; `return_media`), `OrderStore.countPackedOrders(shopId, startedIn)` (orders; `COUNT(DISTINCT order_id)` trên `packing_sessions`). Kiểu chung `DeviceTimeRange { fromDevice, toDevice }`, `FileStateCounts` ở `features/evidence`. Không migration (dùng chỉ mục `(shop_id, state)` / `(shop_id, order_id)` sẵn có).

**Domain `upload/domain/evidence-stats.ts` (thuần):** `deviceDayRange(now)`, `sumCounts`, `loadTodayStats(stores, shopId, uid, now)` -> `{ packed, uploaded, needsAction }` (ô Lỗi dùng `loadSyncJobs(PENDING_SYNC_STATES)` + `describeSyncJob(...).filter === 'error'`), `loadEvidenceTotals(stores, shopId)` -> `{ total, onDevice, pending, cloud }`.

**Hook `upload/ui/use-evidence-stats.ts`:** `useTodayEvidenceStats()`, `useEvidenceTotals()`: nạp khi màn được focus và sau mỗi lượt hàng đợi (`useUploadQueueControl().subscribe`), **không định kỳ** (rủi ro kế hoạch). Trạng thái `loading | error | ready`.

**Trang chủ chuyển sang feature mới `features/home`** (`ui/HomeScreen.tsx`, `domain/settings.ts`). Lý do: Trang chủ cần `upload` (phân loại V1-08) và `personal` (tên shop); để ở `orders` tạo vòng `orders -> upload -> orders`. `home` chỉ là lớp ghép, không có domain nghiệp vụ riêng ngoài định nghĩa cài đặt `HOME_DEVICE_DATA_NOTICE_DISMISSED = booleanSetting('home.device_data_notice_dismissed', false)`. Route `src/app/(tabs)/home/index.tsx` đổi import. Bố cục Trang chủ giữ nguyên; thêm thẻ thông tin (chỉ hiện khi đã đọc xong cài đặt và chưa đóng, tránh nháy) và một câu dưới thống kê.

**Tên cửa hàng:** hook `useCurrentShopName()` mới ở `personal/ui` (dùng `useRegion(account.getShopSummary)` + tải lại khi đổi tên shop), xuất qua `@/features/personal`. Đang tải: để trống; không có/lỗi: "Cửa hàng của bạn" (không bịa tên).

**Thống kê:** `StatTile` nhận `value: number | string` để hiện "–" khi đang đọc/lỗi.

**Trung tâm đồng bộ:** đọc tham số route `filter` (một trong `SYNC_FILTERS`) làm bộ lọc ban đầu; ô Lỗi mở `ROUTES.sync` với `{ filter: 'error' }`.

**Cá nhân:** `EvidenceOverviewCard` và `EvidenceDataScreen` dùng `useEvidenceTotals()`.

**Thông báo:** `shop/ui/NotificationListScreen.tsx`: `EmptyState` tiêu đề "Chưa có thông báo", lời "Ứng dụng chưa gửi thông báo. Lỗi tải lên xem ở Trung tâm đồng bộ.", nút "Mở Trung tâm đồng bộ".

**Dọn dẹp:** xóa `illustrative-data.ts`, prop `illustrative` của `Screen`, khóa `common:illustrative`; ESLint `no-restricted-imports` thêm mẫu `@/shared/fixtures/illustrative-data` vào mẫu chung (mọi tệp, kể cả test: tệp đã xóa); test lint âm tính (`eslint-rules/illustrative-import.test.js`, project tooling) dùng `ESLint#lintText`.

**Không đổi:** máy trạng thái tệp, Rules/Functions, `codes.ts`, migration, màn đã khách xác nhận.

## Test

- Hợp đồng kho: `countByState` (theo shop, theo khoảng giờ, rỗng), `countMediaByState`, `countPackedOrders` (chỉ `ended`/`confirmed`, đơn khác nhau, ngoài khoảng giờ, shop khác) cho SQLite (`node:sqlite`) và bộ nhớ.
- `evidence-stats.test.ts`: ranh giới "hôm nay" (23:59:59.999 hôm qua không tính, 0:00 tính, 0:00 hôm sau không tính); ô Đã tải lên chỉ đếm `uploaded`/`verified` (`queued`, `uploading`, `hash_mismatch` không); ô Lỗi khớp bộ lọc Lỗi của V1-08; tổng/trên máy/đang chờ/đám mây.
- `HomeScreen.test.tsx`: tên shop từ cổng; không "minh họa"; số thật từ kho; máy trống có câu rỗng + thẻ thông tin; đóng thẻ ghi `device_settings` và không hiện lại; ô Lỗi mở UI-F01 bộ lọc Lỗi; lỗi đọc hiện "–".
- `NotificationListScreen`: câu rỗng, nút mở UI-F01, không "Tính năng sắp có".
- Cá nhân: thẻ và màn con hiện số thật.
- `SyncCenterScreen`: tham số `filter=error` chọn sẵn bộ lọc Lỗi.
- ESLint: import `@/shared/fixtures/illustrative-data` báo lỗi.

## Màn cần chụp (bản web, cổng giả)

Trang chủ trống (máy mới, thẻ thông tin), Trang chủ có dữ liệu mẫu (thay đổi tạm trong bản sao: nạp sẵn đơn/phiên/tệp vào kho bộ nhớ, không commit), tab Thông báo, Cá nhân (thẻ Dữ liệu bằng chứng có số), màn Dữ liệu bằng chứng. Kèm ảnh "trước" từ `v1-00-baseline` nếu có.

## Rủi ro

- Đếm khi focus + sau mỗi lượt hàng đợi: một vài truy vấn `COUNT` trên SQLite; `packing_sessions` không có chỉ mục theo `started_at_device` nên quét các phiên của shop (chấp nhận cho v1; thêm chỉ mục khi đo thấy chậm).
- "Đã tải lên hôm nay" theo `updated_at_device`: tệp nhận hôm qua mà hôm nay mới về kết quả xác minh sẽ tính vào hôm nay; giờ thiết bị có thể sai. Ghi trong decisions.
- Tên shop ở bản Firebase cần đọc Firestore (`getShop`); offline lần đầu chưa có đệm thì hiện "Cửa hàng của bạn".
- Chưa kiểm chứng trên thiết bị.
- Kích thước ước tính ~600 dòng mã.

## Tự review

Vòng 1: (1) Bản nháp dùng `listByStates` cho mọi trạng thái để đếm (không đổi kho): sau một năm (hàng chục nghìn tệp) mỗi lần mở Trang chủ nạp mọi dòng vào JS. Sửa: thêm hàm đếm SQL ở ba kho. (2) Bản nháp để Trang chủ ở `orders` và import `@/features/upload`: tạo vòng phụ thuộc. Sửa: chuyển sang `features/home`. (3) "Đơn đã đóng gói" ban đầu đếm mọi phiên bắt đầu hôm nay: khi cờ ghi video tắt, phiên `created` không có video sẽ bị tính là "đã đóng gói" (bất biến 6, 11). Sửa: chỉ `ended`/`confirmed`. (4) "Trên đám mây" gồm `uploaded` mâu thuẫn câu giải thích "đã kiểm tra khớp". Sửa: chỉ `verified`. (5) Ô Lỗi chỉ đếm hôm nay sẽ giấu lỗi cũ chưa xử lý. Sửa: đếm mọi lỗi hiện có, ghi rõ. (6) Bất biến 3: không nhãn/trạng thái mới, "Đã tải lên" chỉ từ trạng thái máy chủ xác lập; bất biến 4: không xóa gì; bất biến 8: mọi truy vấn có `shopId`; bất biến 11: câu thẻ thông tin không hứa đồng bộ nhiều máy.

Tự review: đã chấp nhận.
