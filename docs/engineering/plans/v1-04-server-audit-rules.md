# V1-04 server-audit-rules: kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (Q-24c), 3.0, 3.3 V1-04; [release-hardening-plan.md](../release-hardening-plan.md) PR6 (R10, phần máy chủ; phần EAS/`APP_ENV` thuộc V1-01); [decisions.md](../decisions.md) Q-23k.

## Mục tiêu

1. Thực thi bất biến 7 phía máy chủ: mọi lần tạo/sửa tài liệu do client ghi được (đơn, dòng, kiện, phiên, bằng chứng, bản neo hàng hoàn) có đúng một sự kiện `auditEvents`, do trigger Admin SDK ghi, client không sửa/xóa được.
2. Giảm bề mặt ghi tùy ý: kiểu/độ dài trường văn bản trong Rules (`orderCode`, `trackingCode*`, `note`, `lastError`, `interruptions`, tên/variant dòng, nhãn kiện).
3. Trần dung lượng cho MỌI bằng chứng (Q-24c, thống nhất Q-28b): ảnh ≤ 25 000 000 byte, video ≤ 2 000 000 000 byte, ở Rules + `createUploadSession` + `verifyEvidence`.
4. Sửa Function: `updateShop` kiểm `shopId` bằng `ID_PATTERN`; `createUploadSession` kiểm `evidence.createdBy == uid` và `sizeBytes` trong trần; `verifyEvidence` không thử lại vô hạn.

## Không làm (ràng buộc đã sửa ở kế hoạch v1, dòng 207)

- **Không** chặn khai báo bằng chứng theo trạng thái phiên: app đăng phiên với trạng thái mới nhất (`remote-order-writer.ts` `publishSession`), nên luồng quay -> xác nhận -> tải sau thường có phiên `confirmed` trên máy chủ TRƯỚC khi bằng chứng được khai báo.
- **Không** so giờ thiết bị với giờ máy chủ (`capturedAtDevice`, `startedAtDevice` chỉ là thông tin, bất biến 11).
- Không đổi mã app (hình dạng tài liệu app ghi giữ nguyên; app không cập nhật bằng chứng/ghi chú phiên).

## Thiết kế

### Trigger kiểm toán (`firebase/functions/src/audit.ts`, mới)

- Hàm thuần `recordAuditForWrite(db, input)` (test trực tiếp trên Firestore Emulator như `evidence.ts`), lớp `index.ts` chỉ nối `onDocumentWrittenWithAuthContext` cho 6 đường dẫn: `shops/{s}/orders/{o}`, `.../orders/{o}/lines/{l}`, `.../orders/{o}/packages/{p}`, `.../sessions/{x}`, `.../evidence/{e}`, `.../returns/{r}`. Dòng và kiện thêm so với kế hoạch tổng vì Rules cho client sửa chúng (Q-23k), trigger ở `orders/{o}` không bắt thay đổi collection con.
- **Idempotent:** id sự kiện = `write-` + SHA-256 của `(đường dẫn tương đối trong shop, updateTime của bản sau)`; ghi bằng `create()`, đã có thì bỏ qua (giao lặp at-least-once không nhân đôi).
- **Nội dung:** `type` (`order.created`, `session.updated`...), `entity`, `entityId`, `entityPath`, `changedFields` (tên trường cấp một đổi), `before`/`after` CHỈ của trường không nhạy cảm theo danh sách cho phép từng loại (trạng thái, số, enum, ID nội bộ, mốc thời gian; với `server` chỉ `server.state`). **Không** ghi `orderCode`, `trackingCode*`, `note`, `orderSnapshot`, tên/variant dòng, nhãn kiện, `lastError`, `interruptions` (chỉ tên trường đổi). `actorUid`: `createdBy` khi tạo, `updatedBy` khi sửa đơn (Rules ép bằng `auth.uid`), còn lại `null`; kèm `auth: { type, id }` thô từ sự kiện nếu có. `at` = giờ máy chủ.
- **Xóa:** bỏ qua (client không xóa được; chỉ máy chủ xóa khi purge V1-14, ghi kiểm toán riêng ở `accountDeletions`; ghi sự kiện lúc purge sẽ làm sống lại `auditEvents` của shop đã xóa). Không có thay đổi trường nào (ghi lặp y nguyên): bỏ qua.
- **Thử lại:** `retry: true` + trần tuổi sự kiện 24 giờ (sau review; ban đầu 6 giờ) (quá trần: log lỗi không PII rồi kết thúc). Không ghi mã đơn/mã vận đơn vào log Function.

### `verifyEvidence`

- `evidence.ts` thêm `handleEvidenceFinalized(db, reader, object, eventTime, nowMs)`:
  - Sự kiện quá 24 giờ (sau review; ban đầu 6 giờ): ghi kiểm toán `evidence.verify_abandoned` (id cố định theo generation), kết thúc, không ném.
  - Đối tượng không còn (Storage 404): kiểm toán `evidence.verify_failed` lý do `object_missing`, kết thúc. Trạng thái máy chủ giữ `uploaded` (không bao giờ `verified`).
  - Lỗi khác (đọc tạm, Firestore): ném để thử lại.
- `verifyEvidenceObject` nhận thêm `objectSizeBytes` (kích thước từ sự kiện finalize): vượt trần theo loại khai báo thì chốt `hash_mismatch` lý do `size_exceeds_limit` KHÔNG băm (không tốn CPU cho tệp quá cỡ), có kiểm toán như hiện tại.

### `createUploadSession`, `updateShop`

- `limits.ts` (mới): `PHOTO_MAX_BYTES`, `VIDEO_MAX_BYTES`, `maxBytesFor(kind)`; `ids.ts` (mới): `ID_PATTERN` dùng chung.
- `createUploadSession`: sau kiểm thành viên và tồn tại, `createdBy !== uid` -> `permission-denied` (Q-24g: không tải hộ); `sizeBytes` không phải số nguyên dương hoặc vượt trần -> `failed-precondition`, không ký.
- `updateShop`: `parseShopId` dùng `ID_PATTERN` (`invalid-argument`).

### Rules (`firebase/firestore.rules`)

- Hàm `optionalText(data, key, max)`; `withinEvidenceLimits(data)` (loại + mime + trần + `durationMs`) dùng chung cho bằng chứng đóng gói và hàng hoàn.
- Đơn: tạo và sửa kiểm `orderCode` 1–64, `orderCodeNormalized` 1–128 (viết hoa có thể dài hơn), `trackingCode` 1–64, `trackingCodeNormalized` ≤ 128, `note` ≤ 500 (tùy chọn).
- Dòng: tạo/sửa `name` 1–200, `variant` ≤ 200, `quantity` 1–99 999 (khớp `MAX_QUANTITY` của app). Kiện: `label` ≤ 100.
- Phiên: sửa kiểm `endedAtDevice` là timestamp, `interruptions` là list ≤ 100, `note` ≤ 500. Không đổi tập trạng thái, không ràng buộc chuyển trạng thái (thứ tự đồng bộ).
- Bằng chứng: đóng gói thêm trần + loại/mime khớp; sửa kiểm `lastError` (chuỗi ≤ 200 hoặc null), `retryCount` (0–1000).

## Migration

Không (không đổi SQLite, không đổi index Firestore: không có truy vấn mới).

## Test (`npm run test:rules`)

- `firebase/tests/functions/audit.test.ts`: tạo/sửa mỗi loại tạo đúng một sự kiện; chạy lại cùng `updateTime` không nhân đôi; không lộ `orderCode`/`trackingCode`/`note`/`orderSnapshot`/tên dòng; xóa và ghi y nguyên bỏ qua; `server.state` được ghi; cô lập theo shop.
- `firebase/tests/rules/audit-hardening.rules.test.ts`: client không ghi/sửa/xóa `auditEvents` (`assertFails`, cả chủ shop và shop khác); kiểu/độ dài sai bị từ chối (đơn, dòng, kiện, phiên, bằng chứng); trần biên 25 000 000 qua / 25 000 001 từ chối (ảnh), 2 000 000 000 / 2 000 000 001 (video), cho cả đóng gói và hàng hoàn; loại/mime lệch bị từ chối; **phiên `confirmed`/`ended`/`interrupted` đăng trước, bằng chứng khai báo sau vẫn qua**; **`capturedAtDevice` sau `request.time` vẫn qua** (và `startedAtDevice` tương lai cho phiên); phiên không tồn tại hoặc chỉ có ở shop khác bị từ chối; chéo shop cho mọi luật mới (QA-11).
- `uploads.test.ts`: `createdBy` khác uid -> `permission-denied`; trần dung lượng; `evidence.test.ts`: `size_exceeds_limit`, `handleEvidenceFinalized` quá tuổi/404/lỗi tạm; `shop.test.ts`: `parseShopId`.

## Màn cần chụp

Không có thay đổi giao diện.

## Rủi ro

- Chi phí: mỗi lần ghi tài liệu theo dõi thêm 1 lần gọi Function + 1 lần ghi Firestore (ước tính ở architecture.md mục 13).
- Siết Rules làm bản app cũ lỗi: chỉ có bản dev, chấp nhận; app hôm nay không ghi trường bị siết ngoài hình dạng đã có.
- Video đóng gói > 2 GB (quay dài ở bitrate cao) bị từ chối khai báo: app chưa chặn trước (giới hạn 10 phút hiện có giữ dưới trần ở bitrate thường); ghi vào rủi ro.
- `authType`/`authId` của sự kiện Firestore chỉ có trên môi trường thật; emulator không kiểm chứng phần nối trigger (chỉ kiểm logic thuần). Trigger có hiệu lực sau deploy (checklist F-4).

## Tự review

Vòng 1 (bất biến 1–11, rủi ro dữ liệu, kích thước):
- Bất biến 2/3: không đổi liên kết, không cho client tới `uploaded`/`verified`; `size_exceeds_limit` chỉ tới `hash_mismatch` (không bao giờ `verified`). Đạt.
- Bất biến 4: không xóa/ghi đè bản gốc; `object_missing` không đổi trạng thái sang `verified`, chỉ kiểm toán. Đạt.
- Bất biến 7: trigger cho mọi collection client ghi được; ban đầu chỉ có `orders/sessions/evidence/returns` -> **đã sửa**: thêm `lines` và `packages` (Rules cho sửa, Q-23k).
- Bất biến 8: id sự kiện và đường dẫn ghi theo `shopId` của chính tài liệu; test chéo shop.
- Bất biến 11: không so giờ thiết bị; test bắt buộc thêm cả cho `startedAtDevice`.
- Rủi ro: ban đầu định ghi sự kiện cả khi xóa -> **đã sửa**: bỏ qua xóa (xung đột với purge V1-14, client không xóa được).
- Rủi ro: ban đầu định bắt buộc `session.createdBy == auth.uid` khi khai báo bằng chứng -> **bỏ**: không phụ thuộc thứ tự nhưng chặn trường hợp nhiều thành viên (O-07) mà kế hoạch không yêu cầu; `evidence.createdBy == auth.uid` đã có.
- Kích thước: ước tính ~450 dòng mã (không tính test/tài liệu), dưới ngân sách 1500.

Vòng 2: kiểm lại test cũ bị ảnh hưởng: `evidence-declare.rules.test.ts` dùng `kind: 'photo'` với `video/mp4` -> sửa test sang `image/jpeg` (luật loại/mime mới; app không bao giờ tạo bằng chứng đóng gói kiểu ảnh). `uploads.test.ts` seed không có `createdBy` -> seed đặt `createdBy: uid`. Không còn điểm mở.

**Tự review: đã chấp nhận.** Điểm đã sửa: thêm trigger dòng/kiện; bỏ ghi sự kiện khi xóa; bỏ ràng buộc người tạo phiên; thêm test giờ thiết bị tương lai cho phiên.

## Cập nhật sau review PR #44

1. 🔴 Rules chặn giá trị dài mà app cho nhập (đơn không bao giờ đăng được): thêm CÙNG trần vào app (`codes.ts`, `build-order.ts`, `update-order.ts`, `maxLength = trần + 1` ở UI-B04 và Sửa đơn, lời nhắc đúng ô); bản chuẩn hóa ≤ 192 trong Rules; hàng đợi chặn trước tệp vượt trần (`UPLOAD_FILE_TOO_LARGE`). Test Rules đăng `orderWrites()` với giá trị dài nhất (qua) và dài hơn 1 (bị từ chối); unit test domain và màn.
2. 🟡 Trần tuổi sự kiện 24 giờ (nguồn Cloud Run functions/Eventarc); `createUploadSession` xác minh lại bằng chứng kẹt `uploaded` > 15 phút; test emulator.
3. 🟡 `occurredAt` = `updateTime`.
4. 🟡 Tiêu đề decisions `#### Q-29 / V1-04 — server-audit-rules`.

Màn đổi hiển thị (lời nhắc lỗi mới ở UI-B04 Tạo đơn nhanh và Sửa đơn): chụp ảnh ở `docs/assets/screens/v1-04-server-audit-rules/`.
