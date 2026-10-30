# V1-13 hash-efficiency — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 3.0, 3.3 V1-13 (gồm phần "Thêm từ review V1-11"), 7.5 R-5 = **A tạm**; `release-hardening-plan.md` PR7 (R9) bước 2; review V1-10 (index). Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-13 — hash-efficiency`.

## Mục tiêu

1. **Băm không đứng giao diện lâu:** SHA-256 thuần JS nhường luồng JS định kỳ khi băm tệp lớn.
2. **Không băm lại tệp không đổi ở mỗi lần thử tải:** lưu "dấu tệp đã băm" (kích thước + thời điểm sửa đổi của hệ tệp) sau lần băm lại khớp `sha256Client`; lần thử sau dấu không đổi thì bỏ băm; dấu khác/thiếu thì băm lại để vẫn phát hiện `LOCAL_HASH_CHANGED`.
3. **Index** từ review V1-10: `packing_sessions (shop_id, started_at_device)`, `return_media (shop_id, state)`.
4. **Cờ gián đoạn video mở kiện hàng hoàn lưu bền** (bắt buộc trước khi bật cờ ghi video): ghi NGAY khi phát hiện gián đoạn; khôi phục và đối soát đọc cờ bền thay vì đoán `false`.

## Thiết kế

### Băm nhường luồng
- `core/crypto/cooperative-hash.ts` (thuần TS): `createTimeSliceYielder({ budgetMs, now, wait })` + `updateCooperatively(hash, data, yielder, sliceBytes)`: băm khối 1 MB theo lát 256 KB; sau mỗi lát, đã chạy liên tục quá ngân sách (12 ms) thì `await` một **macrotask** (`setTimeout(0)`) để luồng JS xử lý chạm/vẽ. Lý do macrotask: `readBytes` của `expo-file-system` trả Promise nhưng `await` microtask không cho RN xử lý sự kiện; nhường theo **thời gian** (không phải mỗi khối) để tránh tốn ~1–4 ms mỗi lần nhường × hàng nghìn khối.
- `platform/file-hasher.ts`: `hashFile(uri, options?)` dùng hai hàm trên (tùy chọn `yielder` cho test). Kết quả không đổi (đối chiếu `node:crypto`).
- **Không** chuyển sang `File.digest('SHA-256')` (native, có sẵn trong `expo-file-system` 58.0.12) ở PR này: R-5 = A tạm; chưa kiểm chứng trên máy. Ghi làm phương án B không cần thư viện mới (decisions).

### Dấu tệp đã băm
- Kiểu `FileFingerprint { sizeBytes, modifiedAtMs }` ở `features/evidence` (dùng chung đóng gói + hàng hoàn). `EvidenceFile.hashedFingerprint?`, `ReturnMedia.hashedFingerprint?` (vắng/`null` = chưa có dấu). Không thuộc nhóm trường bất biến (là bộ nhớ đệm, đổi được), nhưng chỉ hàng đợi ghi.
- Cột v16 `hashed_size_bytes INTEGER`, `hashed_mtime_device INTEGER` (nullable) trên `evidence_files` và `return_media`. Inode không có trong `expo-file-system` nên không dùng.
- `platform/file-hasher.ts` thêm `fileFingerprint(uri)` (đọc `File.size` + `File.modificationTime`, làm tròn xuống ms; không có tệp/không có mtime -> `null`). `LocalFileHasher.fingerprint?` (tùy chọn; không có = luôn băm, như cũ).
- `upload-queue.ts` `uploadOne`: đọc dấu TRƯỚC; dấu khớp dấu đã lưu VÀ kích thước khớp `sizeBytes` -> bỏ băm. Ngược lại băm; khác mã -> `LOCAL_HASH_CHANGED` -> `needs_attention` (như cũ, xóa dấu); khớp -> đọc dấu SAU, chỉ lưu khi dấu trước = dấu sau (tệp không đổi trong lúc băm). Dấu ghi cùng sự kiện `UPLOAD_STARTED` (origin `device`), không thêm sự kiện/trạng thái tệp. Mất mạng giữa lúc băm (dừng trước `UPLOAD_STARTED`) thì dấu chưa lưu: lần sau băm lại (chấp nhận, hiếm).
- An toàn: tệp bị đổi mà giữ nguyên kích thước + mtime sẽ lọt kiểm tra cục bộ, nhưng máy chủ băm lại độc lập -> `hash_mismatch`, không bao giờ `verified` sai. Lần thử đầu sau khi đóng tệp luôn băm lại (chưa có dấu).

### Index (v16)
`CREATE INDEX idx_sessions_shop_started ON packing_sessions (shop_id, started_at_device)`; `CREATE INDEX idx_return_media_shop_state ON return_media (shop_id, state)`.

### Cờ gián đoạn bền (hàng hoàn)
- Cột v16 `return_media.interrupted INTEGER NOT NULL DEFAULT 0`; `ReturnMedia.interrupted?: boolean`.
- `ReturnStore.markMediaInterrupted(shopId, id)`: chỉ video, chỉ bật (không bao giờ tắt), idempotent, không đổi trạng thái tệp; ở mọi kho (bộ nhớ, SQLite, kho lười).
- `video-controller.ts`: `ActiveVideo.markInterrupted()` (ghi ngay, nuốt lỗi); trong `finish`, `wasInterrupted()` -> ghi cờ bền TRƯỚC `STOP_RECORDING` (phủ đường camera tự dừng sớm). Kết quả `interrupted` = cờ trong bộ nhớ.
- `ReturnRecordLive.tsx`: vào nền khi đang quay -> `active.markInterrupted()` ngay; vào nền khi đang khởi động -> ghi khi có `active` (như `PackRecordLive`). Đối soát video chưa ghi vào hồ sơ dùng `unrecorded.interrupted === true || <cờ bộ nhớ>`.
- `media-recovery.ts`: cờ cho hồ sơ = `bị app đóng giữa chừng || media.interrupted === true` (đường b). Bộ đếm `interrupted` của kết quả giữ nghĩa cũ (media dở dang do app đóng).

## Migration / Rules
- v16 chỉ thêm: 5 `ALTER TABLE … ADD COLUMN` (nullable hoặc `NOT NULL DEFAULT 0`) + 2 `CREATE INDEX`. Không Rules/Functions, không mã lỗi mới, không chuỗi UI mới.

## Test
- `cooperative-hash.test.ts`: kết quả khớp `node:crypto` qua nhiều lát; có nhường khi quá ngân sách (đồng hồ giả); bộ đếm macrotask chạy xen trong lúc băm (đồng hồ thật, ngân sách 0).
- `file-hasher.test.ts`: vectơ cũ + `fileFingerprint` (có/thiếu mtime, không có tệp).
- `sha256.bench.test.ts`: chỉ chạy khi `HASH_BENCH=1`, in MB/giây trên Node (tham khảo; Hermes đo ở G-5).
- `upload-queue.hash-reuse.test.ts`: lần 1 băm + lưu dấu; lần thử sau không băm; đổi kích thước/mtime -> băm lại; mã khác -> `LOCAL_HASH_CHANGED`, không tải, dấu xóa; thiếu mtime -> luôn băm; tệp đổi trong lúc băm -> không lưu dấu; nguồn hàng hoàn cũng lưu dấu.
- Kho: hợp đồng `evidence-file-store.contract.ts`/`return-store.contract.ts` (bộ nhớ + SQLite): dấu đọc/ghi qua patch; `markMediaInterrupted` (chỉ video, idempotent, shop khác không thấy).
- `sqlite-migration-v16.test.ts`: v15 -> v16 giữ dữ liệu, cột mới mặc định, index tồn tại.
- `video-controller.test.ts`, `media-recovery.test.ts`: (a) kill sau khi video lưu xong, trước khi ghi hồ sơ -> đối soát lần sau `interrupted: true`; (b) vào nền -> lưu lỗi -> khôi phục -> `interrupted: true`. `ReturnRecordScreen.background.test.tsx`: vào nền ghi cờ bền ngay.

## Màn cần chụp
Không có thay đổi giao diện.

## Rủi ro
- Tốc độ băm JS và độ trễ chạm trên Hermes **chưa đo** (G-5); ngân sách 12 ms là ước lượng.
- `modificationTime` trên iOS/Android chưa kiểm chứng trên máy (độ phân giải, thay đổi khi di chuyển tệp). Nghi ngờ -> băm lại; máy chủ băm lại độc lập.
- iOS có thể tạm dừng JS ngay khi vào nền: ghi cờ bền ngay là cố gắng tốt nhất; nếu không kịp thì đường `finish` ghi lại khi app quay lại.

---
Tự review (bất biến 1–11, dữ liệu, cỡ PR):
- B3: không thêm sự kiện/trạng thái; dấu đi cùng `UPLOAD_STARTED` (device). B4: băm/dấu chỉ đọc tệp; không đường xóa. B5/B6: cờ gián đoạn chỉ bật, không bao giờ tự nhận "đầy đủ"; không quay bù. B7: cờ là dữ liệu của tệp, sự kiện hồ sơ vẫn ghi qua `saveOpeningVideoRecorded` có lịch sử. B11: không đổi câu chữ.
- Đã sửa: (1) ban đầu định lưu dấu ngay sau băm khi đóng tệp — bỏ, để lần tải đầu luôn đối chiếu lại (an toàn hơn, ít tệp đụng); (2) thêm điều kiện dấu-trước = dấu-sau để không lưu dấu của tệp đang bị ghi; (3) nhường theo thời gian thay vì mỗi khối (chi phí `setTimeout`).
- Cỡ: ước ~450–600 dòng mã (không tính test/tài liệu), dưới ngân sách 1500 nên KHÔNG tách V1-13b.

Tự review: đã chấp nhận.
