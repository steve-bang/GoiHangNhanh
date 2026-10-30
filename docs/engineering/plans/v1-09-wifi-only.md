# V1-09 wifi-only — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 1.2 (Q-24c = B), 3.0, 3.3 V1-09, 7.3 (bất biến 3: "Chờ Wi‑Fi" là lý do hiển thị, không phải trạng thái mới). Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-09 — wifi-only`.

## Mục tiêu

1. Mặc định **luôn tải** (cả 4G/5G). Công tắc **"Chỉ tải khi có Wi‑Fi"** (mặc định tắt) lưu trên máy, sống sót khi app bị tắt.
2. Bật công tắc mà máy không dùng Wi‑Fi: hàng đợi tải lên **không chạy lượt** (không gọi máy chủ, không tính lượt, trạng thái tệp không đổi). Lượt đang gửi khi chuyển sang mạng khác Wi‑Fi (hoặc vừa bật công tắc): hủy như mất mạng (lỗi mạng, không tốn lượt, V1-02).
3. Có Wi‑Fi lại, hoặc tắt công tắc: chạy ngay một lượt, tệp lỗi mạng tới hạn ngay.
4. UI-F01/F02: lý do **"Đang chờ Wi‑Fi."** cạnh nhãn chuẩn (không nhãn/trạng thái mới), câu đầu màn nói rõ đang chờ Wi‑Fi; công tắc ở đầu UI-F01 và một hàng ở màn Dữ liệu bằng chứng (route con UI-I01).
5. Kho cài đặt máy `device_settings` (migration **v15**) dùng chung cho V1-10, V1-16.

## Thiết kế

**Migration v15** (`features/orders/data/sqlite-migrations.ts`, chỉ thêm): `CREATE TABLE device_settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at_device INTEGER NOT NULL)`.

**Kho cài đặt máy** — đặt ở `features/orders` (không ở `features/upload` như bản kế hoạch tổng) vì `orders` sở hữu kết nối SQLite + migration, và V1-10 (Trang chủ nằm ở `features/orders/ui`) sẽ dùng: đặt ở `upload` tạo vòng import `orders -> upload -> orders`.
- `orders/domain/device-settings.ts` (thuần): `DeviceSettingDefinition<T> { key, defaultValue, decode(raw: unknown): T | undefined }`, `booleanSetting(key, default)`, `DeviceSettingsStore { read(key): Promise<unknown | undefined>; write(key, value, atDevice) }`. Lưu **key/value JSON có kiểu qua định nghĩa**: mỗi PR sau thêm khóa mới không cần migration; giá trị lạ/sai kiểu -> mặc định (không ném). Cài đặt **theo máy**, không theo shop/tài khoản (gói cước là của máy; không phải dữ liệu shop, bất biến 8 không áp dụng).
- `orders/data/device-settings-store.ts`: SQLite (`runSerialized` + `migrateLocalDatabase`, `INSERT ... ON CONFLICT(key) DO UPDATE`), bản bộ nhớ (web/test), `createLocalDeviceSettingsStore(open)` lười.
- `orders/data/DeviceSettingsProvider.tsx`: bộ điều khiển có bộ đệm + người nghe theo khóa: `peek(def)` (đồng bộ: `{ loaded, value }`), `load(def)`, `set(def, value)` (ghi SQLite TRƯỚC, thành công mới đổi bộ đệm + báo), `subscribe(key, fn)`. Hook `useDeviceSetting(def)` -> `{ value, loaded, setValue }`; `useDeviceSettings()` cho mã không phải màn (UploadRunner). Đọc lỗi -> dùng mặc định (luôn tải, đúng Q-24c), log không PII.

**Chính sách mạng** (`upload/domain/network-policy.ts`, thuần): `UPLOAD_WIFI_ONLY = booleanSetting('upload.wifi_only', false)`; `uploadNetworkGate({ online, type }, wifiOnly | null)` -> `'allowed' | 'offline' | 'waiting_wifi'`. Bật mà `type !== 'wifi'` (gồm `other`: Ethernet, VPN, Bluetooth, chưa rõ) -> `waiting_wifi` (an toàn với cước: chỉ người đã bật công tắc bị ảnh hưởng, và tự tắt được). `wifiOnly = null` (chưa đọc xong cài đặt) -> `waiting_wifi` để không lỡ tải bằng 4G cho người đã bật (đọc SQLite xong trong mili giây).

**Hàng đợi** (`upload-queue.ts`): dep mới `isWaitingForWifi?: () => boolean`. `runOnce`: sau kiểm offline, nếu chờ Wi‑Fi -> `skipped: 'waiting_wifi'` (không đối soát, không gọi gì). Trong vòng tệp: dừng khi offline/chờ Wi‑Fi; **kiểm lại ngay trước `UPLOAD_STARTED`** (sau khi băm) để không đổi trạng thái khi vừa đổi mạng. `attempt()` hủy ngay nếu chờ Wi‑Fi. `subscribeOffline` đổi nghĩa thành "dừng gửi" (mất mạng hoặc mạng không được phép); UploadRunner phát khi kết nối đổi hoặc công tắc đổi. `requestServerCheck` (Kiểm tra lại, người dùng bấm, không gửi tệp) vẫn cho phép.

**UploadRunner**: đọc cài đặt qua `useDeviceSettings()`; `isWaitingForWifi = gate === 'waiting_wifi'`; nghe kết nối + cài đặt: chuyển sang bị chặn -> báo dừng gửi; chuyển từ bị chặn/offline sang được phép -> `run({ networkRestored: true }, true)`.

**UI**:
- `sync-jobs.ts`: ngữ cảnh `describeSyncJob` thêm `waitingWifi?: boolean`; lý do `waitingWifi` cho tệp của mình ở `queued`, `upload_failed`, `uploading` (không có lần gửi nào khi bị chặn). Nhãn giữ nguyên theo `toDisplayStatus`.
- `SyncCenterScreen`: `Switch` ở đầu màn (sau câu đầu), câu đầu đổi thành `screens:sync.waitingWifi` khi bị chặn; `SyncErrorScreen` truyền cùng ngữ cảnh; `use-sync-actions` toast Thử lại khi chờ Wi‑Fi.
- `EvidenceDataScreen` (personal, trong phạm vi token, không thuộc màn đã khách xác nhận): một `ListGroup` có `Switch` cùng hook.
- Hook dùng chung `useUploadNetworkGate()` + component `WifiOnlySwitch` trong `upload/ui` (export cho personal).

**Không đổi:** máy trạng thái tệp, Rules/Functions, `codes.ts`. OrderSyncRunner/ReturnSyncRunner (vài KB thông tin đơn/bản neo) vẫn chạy trên 4G — công tắc chỉ áp dụng cho tệp ảnh/video (nói rõ trong mô tả công tắc).

## Test

- `sqlite-migration-v15.test.ts`: v14 -> v15 giữ nguyên dữ liệu cũ, chạy lại idempotent, bảng có đúng cột.
- `device-settings-store.test.ts`: hợp đồng SQLite (`node:sqlite`) + bộ nhớ: mặc định khi chưa có, ghi/đọc, ghi đè, giá trị sai kiểu -> mặc định, sống qua kho mới cùng CSDL.
- `network-policy.test.ts`: bảng gate (wifi/cellular/other/none × bật/tắt/chưa biết).
- `upload-queue.test.ts`: bật + di động -> `skipped: 'waiting_wifi'`, không `fetchServerStates`/`upload`, trạng thái + `attemptCount` không đổi; tắt -> chạy; chuyển mạng giữa lượt -> hủy, `upload_failed` không tốn lượt; đổi mạng sau khi băm -> không `UPLOAD_STARTED`.
- `UploadRunner.test.tsx`: bật công tắc + di động -> không gọi cổng; sang Wi‑Fi -> chạy ngay; tắt công tắc -> chạy ngay; mặc định (chưa lưu gì) tải trên di động.
- `sync-jobs.test.ts`: lý do `waitingWifi`; nhãn không đổi.
- `SyncCenterScreen.test.tsx`: công tắc hiện, bật lưu vào kho, câu đầu + lý do "Đang chờ Wi‑Fi."; `EvidenceDataScreen` có công tắc.

## Màn cần chụp (bản web, cổng giả)

UI-F01 công tắc tắt; UI-F01 công tắc bật + đang dùng di động (tệp "Đang chờ Wi‑Fi"); Dữ liệu bằng chứng có công tắc. Thay đổi tạm trong bản sao (không commit): mạng giả `cellular`, tệp mẫu ở hàng chờ.

## Rủi ro

- `type` NetInfo không phân biệt được điểm phát Wi‑Fi từ điện thoại khác (vẫn là Wi‑Fi) hay VPN trên iOS (báo theo giao diện thật). Android VPN báo `vpn` -> `other` -> chờ Wi‑Fi khi bật công tắc (người dùng tắt công tắc nếu cần).
- Lượt bị hủy giữa chừng đã tiêu một phần dung lượng di động (không tránh được).
- Chưa kiểm chứng trên thiết bị (chuyển Wi‑Fi <-> 4G/5G, QA-04).
- Kích thước ước tính ~450 dòng mã.

## Tự review

Vòng 1: (1) Bản nháp đặt kho ở `features/upload` theo kế hoạch tổng: V1-10 (Trang chủ ở `orders`) import `upload` -> vòng `orders <-> upload`. Sửa: đặt ở `orders` (chủ CSDL). (2) Bản nháp cho `other` = được tải theo dòng rủi ro của kế hoạch tổng: VPN Android trên 4G và chia sẻ qua Bluetooth sẽ tốn cước dù người dùng đã bật công tắc. Điều phối yêu cầu "chọn an toàn": chỉ `wifi` mới tải khi bật; ghi lệch. (3) Chưa đọc xong cài đặt mà cho tải -> lượt đầu khi mở app có thể dùng 4G với người đã bật. Sửa: chưa biết = chờ. (4) Bị hủy sau `UPLOAD_STARTED` làm tệp thành `upload_failed` (lỗi mạng, không tốn lượt) — chấp nhận (đúng V1-02); thêm kiểm tra trước `UPLOAD_STARTED` để trường hợp thường không đổi trạng thái. (5) Bất biến 3: không trạng thái mới, không sự kiện mới; bất biến 4: không xóa gì; bất biến 11: câu chữ "khi ứng dụng đang mở", không hứa tải nền. Đối soát cũng bị dừng khi chờ Wi‑Fi (không gọi máy chủ): tệp `uploading` bị kẹt từ lần tắt app trước hiện "Đang tải lên" + lý do "Đang chờ Wi‑Fi." tới khi có Wi‑Fi — trung thực về việc đang chờ.

Tự review: đã chấp nhận.
