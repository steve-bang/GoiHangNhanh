# V1-28 pause-upload-while-recording — kế hoạch và ghi chú triển khai

**Trạng thái: đã code (nhánh `feat/v1-28-pause-upload-while-recording`, xếp chồng trên V1-22).** Người dùng đã duyệt phương án A (tạm dừng khi quay, chạy lại sau). Chưa chạy trên thiết bị.

## Vấn đề
`UploadRunner` (gốc app) chạy khi gắn, mỗi 60 giây, khi foreground, khi có mạng lại và KHÔNG biết đang quay. Quay đơn B trong lúc đơn A đang tải/băm làm CPU, radio và pin chạy cùng bộ mã hóa video: nóng máy, tăng nguy cơ ngắt quay.

## Thiết kế
- **Tín hiệu**: `src/core/recording/recording-activity.ts` (TypeScript thuần, trong bộ nhớ). `beginRecordingActivity()` trả hàm `release` idempotent; `isRecordingActive()`, `subscribeRecordingActivity()`. Nhiều phiếu chồng nhau, tắt khi phiếu cuối trả. Lưới an toàn: phiếu tự hết hạn sau 15 phút (10 phút giới hạn video + dư).
- **Nơi bật**: `platform/camera-recorder.tsx` `record()` là đường ghi CHUNG của quay đóng gói và video hàng hoàn. Bật ngay trước `recordAsync`.
- **Mọi đường tắt**: `done` settle (dừng thường, lỗi, tệp chạm trần, ngắt do nền/gián đoạn: `.finally`); `recordAsync` ném đồng bộ (catch, tắt, ném lại); camera bị gỡ/unmount (cleanup trả mọi phiếu còn mở); app bị kill (cờ chỉ trong bộ nhớ, mất theo tiến trình; sau khôi phục không có cờ); lưới 15 phút.
- **Hàng đợi**: `UploadQueueDeps.isPaused`. Khi đang quay: `runOnce` trả `skipped: 'recording'` TRƯỚC khi đối soát/băm (không gọi máy chủ, không băm `checkLocalFile`, không đổi trạng thái); sau băm vẫn kiểm `mayUseNetwork()` (gồm `!paused`) nên băm dở xong thì dừng trước `UPLOAD_STARTED`, tệp giữ `queued`. Lượt bị bỏ vẫn nhớ `networkRestored`.
- **UploadRunner**: bắt đầu quay -> gọi `stopListeners` (hủy lần gửi đang chạy, đường mất mạng: lỗi mạng KHÔNG tốn lượt); quay xong -> `run({ networkRestored: true }, true)` (tệp bị hủy tới hạn ngay).
- **Không đụng đường lưu**: băm/lưu video vừa quay nằm ở `packing/recording-controller`, không đọc cờ.
- **Không chuỗi UI/mã lỗi mới.** Tệp bị hủy giữa lần gửi hiện là `upload_failed` kèm mã mạng (Trung tâm đồng bộ gọi là "chờ mạng", không phải lỗi, không tính lượt), giống mất mạng; tệp còn `queued` hiện "chờ tải lên". Nhãn "tạm dừng khi đang quay" riêng nếu muốn thì chờ BA (C-1).

## Giới hạn đã biết
- Lần băm JS đang chạy dở một tệp không bị hủy giữa chừng (`LocalFileHasher` không nhận tín hiệu hủy); nó tự nhường luồng định kỳ và dừng ngay sau khi xong, trước khi gửi. Cần số đo G-5.
- Nếu `recordAsync` thật sự bắt đầu ghi trước khi nó trả lời, vài mili giây đầu vẫn có thể chồng với lượt đang chạy.
- Chưa đo trên thiết bị: nhiệt/pin có và không có tệp chờ tải trong lúc quay (G-4, G-14).

## Test
`recording-activity.test.ts` (cờ, nhiều phiếu, lưới thời gian, người nghe lỗi), `camera-recorder.test.tsx` (tắt ở dừng thường, từ chối, ném đồng bộ, gỡ camera), `upload-queue.test.ts` (không đối soát/băm/gửi, dừng sau băm, hủy lần gửi không tốn lượt, nhớ `networkRestored`), `UploadRunner.test.tsx` (không chạy khi quay, hủy rồi tự chạy lại, gỡ khi đang quay). Không test nào xóa tệp.
