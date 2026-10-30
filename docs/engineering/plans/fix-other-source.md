# fix-other-source — nguồn bán "Khác" bị máy chủ từ chối (lỗi chặn phát hành)

Nguồn: phát hiện ở [decisions.md Q-29 / V1-05](../decisions.md) mục c; quyết định ở `#### Q-29 / fix-other-source`.

## Mục tiêu

App lưu nguồn bán "Khác / chưa xác định" là `other` (`src/core/orders/order-source.ts`), máy chủ chỉ nhận `other_unknown` (`firebase/firestore.rules` `isShopSource`, `firebase/functions/src/shop.ts` `SELLING_SOURCES`). Ở bản Firebase:

- đơn nguồn "Khác" bị Rules từ chối khi đăng -> phiên không đăng -> bằng chứng của đơn đó **không bao giờ tải lên**;
- tạo/sửa cửa hàng có chọn "Khác" bị Function trả `invalid-argument`.

Sửa bằng ánh xạ ở ranh giới app <-> máy chủ; không đổi giá trị trong app (không migration SQLite), không đổi Rules/Functions (chỉ thêm chú thích).

## Rà mọi chỗ gửi/đọc nguồn bán với máy chủ

| Chỗ | Hướng | Xử lý |
|---|---|---|
| `features/orders/domain/remote-documents.ts` `orderWrites` (`orders.source`, Rules kiểm `isShopSource`) | ghi | `toRemoteSource` |
| `remote-documents.ts` `sessionWrite` `orderSnapshot.source` (Rules không kiểm giá trị) | ghi | `toRemoteSource`, để dữ liệu máy chủ dùng một từ vựng |
| `api/firebase/firebase-api.ts` `createShop`/`updateShop` (callable) | ghi + đọc kết quả | gửi `toRemoteSources`, nhận `fromRemoteSources` |
| `firebase-api.ts` `renameShop` (V1-05) | đọc `shops/{id}.sellingSources` rồi ghi lại | gửi lại **nguyên văn** giá trị máy chủ (đã là từ vựng máy chủ), không qua ánh xạ; bỏ ép kiểu sai `as OrderSource[]` |
| `api/firebase/ops.ts` | SDK | kiểu `RemoteShopInput`/`RemoteShopResult` (chuỗi máy chủ), không ánh xạ |
| Bản neo hàng hoàn `returnAnchorWrite`, `readShopDetails`, hydrate danh tính shop, bằng chứng | — | không mang nguồn bán; không đổi |
| Function `audit.ts` (ghi `source` của đơn vào kiểm toán) | máy chủ | đọc giá trị đã qua Rules; không đổi |
| Bản giả (`api/fake`), SQLite, UI, i18n | nội bộ app | giữ `other` |

## Thiết kế

- Một module duy nhất `src/core/orders/remote-source.ts` (TypeScript thuần, `core` dùng được từ `domain` và `api`): `REMOTE_ORDER_SOURCES`, `toRemoteSource(s)`, `fromRemoteSource(s)`.
- `fromRemoteSource`: giá trị lạ (kể cả `other` thô) -> `null`, không đoán thành "Khác" (không đổi nghĩa dữ liệu âm thầm). `fromRemoteSources` bỏ giá trị lạ; chỉ dùng cho kết quả callable (Function luôn trả giá trị hợp lệ).

## Test

- Unit: `remote-source.test.ts` (hai chiều, thứ tự, giá trị lạ); `remote-documents.test.ts` (đơn + ảnh chụp phiên nguồn "Khác" ghi `other_unknown`); `firebase-api.test.ts` (createShop/updateShop gửi `other_unknown`, nhận `other`; renameShop gửi lại nguyên văn; `FirebaseOps` giả kiểm từ vựng như Function thật).
- Rules emulator: `order-sync.rules.test.ts` đăng `orderWrites()` + `sessionWrite()` của đơn nguồn "Khác" qua đường ánh xạ thật -> `assertSucceeds`; `other` thô -> `assertFails`.
- Functions emulator: `shop.test.ts` từ vựng Function == `REMOTE_ORDER_SOURCES`; `parseShopInput` nhận mọi nguồn app sau ánh xạ, từ chối `other`; tạo/sửa shop với `other_unknown` lưu đúng.

## Màn cần chụp

Không có thay đổi giao diện.

## Rủi ro

- Thêm giá trị nguồn bán sau này phải sửa ba nơi (app, `REMOTE_ORDER_SOURCES`, Rules/Function); test Functions so `SELLING_SOURCES` với `REMOTE_ORDER_SOURCES` và test Rules đăng MỌI nguồn của app (`it.each(ORDER_SOURCES)`) qua ánh xạ sẽ báo lệch.
- Đơn nguồn "Khác" tạo trước bản sửa vẫn ở SQLite với `other`: OrderSync lần sau sẽ đăng được (ánh xạ lúc ghi), không cần migration: OrderSync không có trần lượt thử, mục lỗi được thử lại ở lượt sau (`order-sync.ts`).
- Chưa deploy, chưa chạy trên thiết bị.

Tự review: đã chấp nhận. Điểm đã sửa khi tự review: (1) `renameShop` không đi qua ánh xạ app -> máy chủ vì giá trị đọc ra đã là từ vựng máy chủ (ánh xạ hai lần sẽ làm hỏng hoặc phải lọc mất giá trị); (2) `fromRemoteSource` không nhận `other` thô để không che lỗi ghi sai từ vựng; (3) ánh xạ cả `orderSnapshot.source` của phiên dù Rules không kiểm, để dữ liệu máy chủ nhất quán cho xuất hồ sơ/đồng bộ hai chiều sau này; (4) bất biến 1–11 không bị ảnh hưởng (không đổi định danh, không đổi bằng chứng, nguồn vẫn ghi `dataSource: 'user_entered'`).
