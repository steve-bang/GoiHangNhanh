# V1-02 network-retry — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (Q-24f, Q-24h), 3.0, 3.3 V1-02, 7.5; [release-hardening-plan.md](../release-hardening-plan.md) PR2 (R3, R4). Đề xuất kỹ thuật, chưa kiểm chứng trên thiết bị.

## Mục tiêu

- Mất mạng 30 phút (hoặc lâu hơn) không làm tệp nào thành "cần xử lý" (`needs_attention`).
- Không lệnh mạng nào treo hàng đợi tải lên hay đồng bộ đơn/hồ sơ hoàn vô thời hạn (cờ `running` luôn hạ).
- Hàng đợi tạm dừng khi máy báo mất mạng và chạy lại ngay khi có mạng.
- Bất biến 3 giữ nguyên: không thêm sự kiện `origin: 'device'` nào tới `uploaded`/`verified`; `file-state.ts` và test của nó không đổi.

## Thiết kế

1. **Nguồn mạng duy nhất** `src/platform/connectivity.ts` (NetInfo `@react-native-community/netinfo@12.0.1`, đúng `bundledNativeModules.json` của Expo SDK 58, cài `--save-exact`):
   - `getConnectivity()` đồng bộ trả `{ online, type: 'wifi' | 'cellular' | 'other' | 'none' }`; `subscribeConnectivity(listener)`; hook `useConnectivity()`/`useIsOffline()` qua `useSyncExternalStore`.
   - `online = false` chỉ khi NetInfo báo **chắc chắn** không có kết nối (`isConnected === false` hoặc `type === 'none'`). Chưa biết (`null`, trước sự kiện đầu) = coi là có mạng: lỗi thật nếu có là lỗi mạng, không tốn lượt. Không dùng `isInternetReachable` (phép thử tới máy chủ Google có thể sai/bị chặn và làm tải lên dừng oan; hạn chế ghi vào rủi ro).
   - Ethernet/VPN/Bluetooth/không rõ -> `other` (V1-09 coi như không phải di động).
   - Mock Jest `src/test-utils/mock-connectivity.ts`, đăng ký mặc định trong `jest.setup.ts` (giống `mock-location`); test adapter dùng `jest.unmock`.
2. **Hết giờ** `src/core/async/with-timeout.ts` (TypeScript thuần): `withTimeout(promise, ms, signal?)` ném `TimeoutError`/`AbortedError`. Lệnh treo không bị hủy ở SDK (Firestore vẫn giữ lệnh ghi đang chờ) nhưng lượt chạy được giải phóng; mọi lệnh đều idempotent nên lượt sau an toàn.
   - Lớp API: `createFirestoreRemoteDocuments` bọc mọi lệnh (`createMissing`, `updateFields`, `getFields`, `getManyFields`, `callFunction`) bằng hết giờ **30 giây**, ném lỗi mã `deadline-exceeded` (cùng dạng lỗi SDK) -> áp cho cả đồng bộ đơn, hồ sơ hoàn và tải lên (R4).
   - Cổng tải lên (`create-upload-gateway.ts`): khai báo, xin phiên tải, đọc trạng thái máy chủ cũng có hết giờ 30 giây (phòng hiện thực cổng khác) và nhận `AbortSignal` của lượt.
   - Bước gửi tệp **không** có hết giờ cứng (tệp 2 GB trên 4G yếu có thể mất hàng giờ); thay vào đó hàng đợi hủy lượt khi NetInfo báo mất mạng (`AbortController` -> `createUploadTask().cancelAsync()` của `expo-file-system/legacy`). Treo khi "có sóng nhưng không ra Internet" dựa vào hết giờ không hoạt động của lớp mạng native (URLSession/OkHttp), ghi rủi ro.
3. **Phân loại lỗi (Q-24h = A)**: `UploadOutcome` thêm `kind: 'network'`.
   - `network` (không tính lượt): `NETWORK`, `NETWORK_LOST` (mất mạng giữa chừng), `TIMEOUT` (hết giờ), mã Firebase `unavailable`, `deadline-exceeded`, HTTP 408/429/502/503/504 (máy chủ tạm không sẵn sàng, người dùng không làm gì được).
   - `retryable` (lỗi máy chủ từ chối hoặc không rõ, **tính lượt**, tối đa `MAX_UPLOAD_ATTEMPTS = 8` rồi `needs_attention`): HTTP 401/403 (URL ký hết hạn), 412 (đối tượng đã có: lượt sau đối soát, sửa mục 4 PR2), 500 và 5xx khác, `permission-denied` khi khai báo, `not-found`, lỗi không phân loại được (`UPLOAD_EXCEPTION`).
   - `attention` giữ nguyên (đăng nhập, loại tệp, 4xx khác...).
   - Lỗi mạng: trạng thái `upload_failed` (như trước, nhãn hiển thị không đổi), `attemptCount` giữ nguyên, `lastErrorCode` = mã mạng, `nextAttemptAtDevice` theo backoff của **chuỗi lỗi mạng liên tiếp** (bộ đếm trong bộ nhớ theo tệp, 5 giây gấp đôi, trần 15 phút; mất khi app khởi động lại thì bắt đầu lại 5 giây: chấp nhận). Gặp lỗi mạng thì dừng lượt (tệp sau cũng sẽ lỗi, tránh tốn lượt gọi).
   - Có mạng lại (`runOnce(shopId, { networkRestored: true })`): tệp `upload_failed` có mã mạng tới hạn ngay, chuỗi lỗi mạng xóa.
   - Tệp `uploading` bị gián đoạn (app bị tắt) vẫn tính lượt như cũ (`UPLOAD_INTERRUPTED`): giữ giới hạn cho tệp làm app sập mỗi lần tải.
4. **Phụ thuộc chưa đăng không gọi máy chủ**: `UploadSource.isReadyToDeclare?(item)`. Nguồn đóng gói hỏi `OrderStore.isSessionPublished(shopId, sessionId)` (mới; SQLite `remote_status IS NOT NULL`, bộ nhớ: map đã đăng). Phiên chưa đăng -> bỏ qua tệp lượt này, không đổi trạng thái, không tốn lượt, không gọi Firestore. Nguồn hàng hoàn đã lọc theo bản neo (Q-28). Vì vậy `permission-denied` khi khai báo nay là **từ chối thật** -> tính lượt (sửa ghi chú cũ "coi là lỗi tạm" trong `firebase-ports.ts`).
5. **Runner**: `UploadRunner` truyền `subscribeOffline` (hủy lượt khi mất mạng), `networkRestored` khi có mạng lại, nguồn đóng gói nhận `OrderStore`. `OrderSyncRunner` chuyển sang đọc mạng qua ref (như `ReturnSyncRunner`), không tạo lại bộ đồng bộ khi đổi mạng, chạy ngay khi có mạng lại.
6. **ESLint**: thêm `@react-native-community/*` vào `INFRA_PACKAGES` (domain/core không import).

## Tệp đổi

`package.json`/`package-lock.json`, `eslint.config.js`, `jest.setup.ts`, `src/core/async/with-timeout.ts`, `src/platform/{connectivity,resumable-upload,index}.ts`, `src/test-utils/mock-connectivity.ts`, `src/api/firebase/remote-documents.ts`, `src/features/upload/domain/{ports,backoff,upload-queue,create-upload-gateway,upload-sources}.ts`, `src/features/upload/data/{UploadRunner.tsx,firebase-ports.ts,device-gateway.ts}`, `src/features/orders/{domain/order-store.ts,data/{memory-order-store,sqlite-order-store,create-order-store}.ts,data/OrderSyncRunner.tsx}`; tài liệu `decisions.md` (Q-29 / V1-02), `architecture.md` (hàng đợi), `testing.md`, `platform-support.md`, `CHANGELOG.md`.

**Migration:** không (dùng cột `remote_status` sẵn có). **Rules/Functions:** không.

## Test

- `with-timeout.test.ts`: xong trước hạn, hết hạn, hủy.
- `connectivity.test.ts` (NetInfo giả): ánh xạ loại, chưa biết = có mạng, thông báo người nghe, hook.
- `upload-queue.test.ts`: offline không tăng lượt; 50 lỗi mạng liên tiếp vẫn `upload_failed`, `attemptCount` 0; backoff mạng có trần 15 phút; mạng có lại -> tới hạn ngay; 8 lỗi máy chủ -> `needs_attention`; mất mạng giữa lúc gửi -> hủy (signal), `NETWORK_LOST`, không tính lượt; phiên chưa đăng -> không gọi cổng, trạng thái giữ `queued`.
- `create-upload-gateway.test.ts`: lệnh treo -> `TIMEOUT` kiểu `network`, hết giờ thì trả; hủy -> `NETWORK_LOST`.
- `firebase-ports.test.ts`: `unavailable`/`deadline-exceeded` -> `network`; `permission-denied` khi khai báo -> `retryable` (tính lượt).
- `resumable-upload` phân loại HTTP (408/429/502/503/504 mạng, 412/500 tính lượt).
- `remote-documents.test.ts`: lệnh treo -> lỗi `deadline-exceeded` sau 30 giây (đồng hồ giả).
- `pending-remote.contract.ts`: `isSessionPublished` (SQLite + bộ nhớ, cô lập shop).
- `OrderSyncRunner`/`UploadRunner`: có mạng lại thì chạy ngay; đổi mạng không tạo lại hàng đợi.
- `file-state.test.ts`: không đổi.

## Màn cần chụp

Không đổi giao diện màn nào. Dải ngoại tuyến UI-F04 có sẵn nay hiện thật khi mất mạng: chụp Trang chủ và Đơn hàng ở bản web với Playwright `context.setOffline(true)` + phát sự kiện `change` của `navigator.connection` (NetInfo bản web trên Chromium nghe sự kiện này), không cần thay đổi tạm trong mã.

## Rủi ro

- NetInfo báo có mạng nhưng không ra Internet (Wi‑Fi quán cà phê chưa đăng nhập): lệnh khai báo hết giờ 30 giây (không tính lượt); bước gửi tệp dựa vào hết giờ native, chưa đo trên máy.
- NetInfo báo mất mạng sai (một số máy Android tiết kiệm pin): hàng đợi dừng tới khi có sự kiện mới; lượt định kỳ 60 giây vẫn đọc trạng thái mới nhất.
- Lỗi máy chủ kéo dài (503) không bao giờ thành "cần xử lý": tệp vẫn "tải lỗi, sẽ thử lại" mỗi tối đa 15 phút (chi phí nhỏ, một lệnh mỗi lượt vì dừng lượt khi gặp lỗi mạng).
- Hủy `uploadAsync` giữa chừng: phiên tải đã mở trên Storage bị bỏ; URL ký tạo-một-lần nên lần sau xin phiên mới, không ghi đè bản gốc.
- Tệp do tài khoản khác tạo (phiên không do mình đăng) nay đứng yên ở "chờ tải" thay vì thành "cần xử lý" sau 8 lần: V1-07 sẽ báo rõ (Q-24g).

## Tự review

Vòng 1 (theo bất biến 1–11, dữ liệu, kích thước):
- Bất biến 3: chỉ thêm đường `queued -> uploading -> upload_failed` sẵn có; không sự kiện mới. Đạt.
- Bất biến 4: hủy tải không đụng tệp cục bộ; tệp lỗi mạng ở `upload_failed` nên `mayHaveReachedServer` vẫn đúng (ảnh hàng hoàn đã từng gửi không xóa được). Đạt.
- Bất biến 8: không đổi Rules; hết giờ không mở đường mới.
- Bất biến 11: không thêm chữ hứa hẹn; nhãn không đổi.
- Rủi ro đã sửa trong kế hoạch: bản nháp đầu coi `permission-denied` là lỗi mạng (có thể che lỗi Rules thật vô hạn) -> đổi thành chặn trước bằng `isSessionPublished` và đếm lượt khi vẫn bị từ chối. Bản nháp đầu đặt hết giờ cứng cho bước gửi tệp -> bỏ (tệp lớn hỏng oan), thay bằng hủy theo NetInfo. Bản nháp đầu không hạ backoff khi có mạng lại (tệp phải chờ tới 15 phút) -> thêm `networkRestored`.
- Kích thước ước tính ~500 dòng mã (không tính test/tài liệu): dưới ngân sách.

Vòng 2: kiểm phụ thuộc với V1-07/V1-08/V1-09/V1-13 (cùng sửa `upload-queue.ts`): giữ API `runOnce(shopId)` tương thích (tham số thứ hai tùy chọn), `getConnectivity().type` sẵn cho V1-09. Không thấy rủi ro mới.

**Tự review: đã chấp nhận** (điểm đã sửa: phân loại `permission-denied`, bỏ hết giờ cứng bước gửi tệp, thêm `networkRestored`).

## Sửa theo review PR #48

Đọc tồn tại từ máy chủ (`getDocFromServer`) để bản ghi chờ sau khi hết giờ không bị coi là đã đăng; `internal`/`unknown` không `details` là lỗi mạng; POST mở phiên hạn 30 giây; có mạng lại chỉ rút ngắn chờ cho tệp lỗi mạng; bảng hạn theo lệnh. Chi tiết: `decisions.md` Q-29 / V1-02 điểm 8–12; đo mã thật: release-checklist G-13.
