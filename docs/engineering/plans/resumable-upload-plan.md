# Kế hoạch: tải tiếp được bằng `Content-Range` (hạng mục 1, P0)

> **Đề xuất kỹ thuật, 2026-11-03**, thuộc [reliability-priorities.md](reliability-priorities.md). Chưa duyệt, chưa viết mã, chưa chạy trên thiết bị.

## 1. Hiện trạng đã đọc trong mã

- `src/platform/resumable-upload.ts`: POST tới URL ký để mở phiên GCS, lấy `Location`, rồi `createUploadTask(...).uploadAsync()` PUT **nguyên tệp**. Lỗi giữa chừng thì lượt sau gọi lại từ đầu.
- `src/features/upload/data/device-gateway.ts`: `deviceBytes.send(session, localPath, sizeBytes, signal)` gọi `uploadFileResumable`. Cổng chung `create-upload-gateway.ts` gọi `ports.sessions.create(...)` **mỗi lượt**, rồi `bytes.send`.
- `firebase/functions/src/uploads.ts`: `createUploadSession` ký URL mở phiên với tiêu đề tạo-một-lần (`CREATE_ONLY_HEADERS`) và ghi `auditEvents` `evidence.upload_session_created` mỗi lần gọi.
- `expo-file-system` 58 có `File.open()` → `FileHandle` với `offset` và `readBytes(length)` (đủ để đọc khối tại vị trí bất kỳ). Chưa kiểm chứng hiệu năng, và chưa kiểm chứng `fetch` PUT thân `Uint8Array` 8–16 MB trên RN thật.

## 2. Thiết kế

1. **Hỏi offset trước khi gửi.** `PUT <Location>` với `Content-Length: 0`, `Content-Range: bytes */<tổng>`. Trả `308` kèm `Range: bytes=0-<n>` (thiếu `Range` = chưa nhận byte nào) hoặc `200/201` (đã xong). `404/410` = phiên hết hạn → mở phiên mới.
2. **Gửi theo khối.** Khối là bội số 256 KiB (đề xuất 8 MiB; chỉnh sau khi đo). `Content-Range: bytes <a>-<b>/<tổng>`. Khối cuối mang tổng đúng. `308` = nhận tiếp; `200/201` = xong.
3. **Lưu `Location` bền** để lượt sau (kể cả sau khi app mở lại) hỏi offset thay vì mở phiên mới.
4. **Hết hạn / lệch phiên.** Phiên GCS còn khoảng một tuần. Hết hạn hoặc offset không hợp lý thì bỏ `Location` đã lưu, mở phiên mới, gửi từ đầu.
5. **Lỗi mạng giữa khối:** giữ kết quả `network` (không tốn lượt) như hiện nay; lượt sau hỏi offset và gửi tiếp. `signal` hủy thì dừng khối đang gửi.
6. **Tệp đổi kích thước** so với lúc lưu phiên (`sizeBytes` khác) thì bỏ phiên cũ.
7. Không log `Location`/URL (có chữ ký) hay đường dẫn tệp.

## 3. Quyết định cần người dùng chốt

| # | Câu hỏi | Đề xuất |
|---|---|---|
| Q-A | Lưu `Location` ở đâu? | Cột mới trên bảng tệp bằng chứng hoặc bảng `upload_sessions` (migration v17 trong `sqlite-migrations.ts`). Cột `Location` nhạy cảm (URL có quyền ghi tới khi hết hạn): xóa khi tệp `uploaded`, và nằm trong danh sách xóa của xóa tài khoản (V1-15). |
| Q-B | Lượt sau còn gọi `createUploadSession` không? | Nếu còn phiên lưu: **bỏ qua** gọi để đỡ nhiễu `auditEvents`; nhưng `createUploadSession` đang kiểm quyền người khai báo (V1-07b) và trạng thái "đã nhận". Cần xem lại để không bỏ mất kiểm tra đối soát (412/`already_received`). |
| Q-C | Cỡ khối | 8 MiB, đo trên thiết bị thật (G-3/G-5) rồi chỉnh. |
| Q-D | `fetch` hay module native cho khối | Thử `fetch` + `Uint8Array` trước; nếu RN không gửi được `ArrayBufferView` ổn định thì `createUploadTask` với `uploadType: BINARY_CONTENT` kèm đoạn tệp tạm, hoặc module nhỏ. |

## 4. Các bước thực hiện đề xuất

1. Hàm thuần `parseRangeHeader` / `nextChunk(offset, total, chunk)` + test (không cần thiết bị).
2. `queryUploadOffset(location, total)` và `putChunk(...)` sau cổng `platform`, mock `fetch` + `FileHandle` trong test.
3. `uploadFileResumable` nhận `resume?: { location }` và trả `{ location }` để bên gọi lưu; giữ `classifyUploadStatus`.
4. Migration v17 + kho lưu `Location`; nối vào `BytesUploader`/cổng chung; xóa khi `uploaded` và khi xóa tài khoản.
5. Test đường: đứt giữa khối → lượt sau tiếp từ offset; phiên hết hạn → mở lại; tệp đổi cỡ → bỏ phiên; hủy bằng `signal`.
6. Kiểm chứng thiết bị (G-3): ngắt Wi‑Fi giữa lúc tải video 1 GB, bật lại, đo byte gửi lần hai.

## 5. Rủi ro

- Đọc khối bằng `readBytes` tốn bộ nhớ JS bằng cỡ khối; phải giải phóng giữa các khối.
- `Content-Range` lệch bội số 256 KiB trừ khối cuối → GCS trả `400`.
- Video lớn gửi nhiều request: mỗi khối cần hạn thời gian và `signal`.
- Chưa có tải nền: kế hoạch này không thay đổi điều đó (hạng mục 2).
