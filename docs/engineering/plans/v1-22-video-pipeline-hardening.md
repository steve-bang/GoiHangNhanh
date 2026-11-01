# V1-22…V1-27 video-pipeline-hardening — kế hoạch chi tiết (nhóm PR, CHƯA làm)

Nguồn: review xử lý video (2026-11-01, người review khác, chưa kiểm chứng trên thiết bị) + đối chiếu mã ở HEAD `12aa19d`. Bám khuôn [v1-13-hash-efficiency.md](v1-13-hash-efficiency.md), [v1-11-recording-hardening.md](v1-11-recording-hardening.md). **Thiết kế kỹ thuật là đề xuất, chờ người dùng duyệt**; các câu hỏi Q-30a…Q-30h ở mục 8 **chưa ai chốt**. Trạng thái PR: **V1-27 đã code** (nhánh `feat/v1-27-capture-metrics`), **V1-23 đã code** phần 3.1 (nhánh `feat/v1-23-temp-file-safety`), **V1-22 đã code** (nhánh `feat/v1-22-recorder-profile`); cả ba chờ hợp nhất; các PR còn lại xem bên dưới.

## 0. Kết quả xác minh từng phát hiện của review

| # | Phát hiện | Kết luận | Bằng chứng |
|---|---|---|---|
| 1 | Chưa đặt `videoQuality`/`videoBitrate`/codec; mặc định có thể vượt 2 GB | **Đúng một nửa.** Chưa đặt gì (`camera-recorder.tsx` chỉ có `facing/mode/mute`) là đúng. Nhưng "vượt 2 GB" **bị phóng đại**: mặc định `expo-camera` 58.0.12 là 1080p (Android `VIDEO1080P`, iOS preset `hd1920x1080`), 30 fps; 10 phút 1080p ở 8–17 Mbps ≈ 0,6–1,3 GB. Vượt 2 GB cần > 27 Mbps hoặc rơi về 4K (Android `FallbackStrategy.higherQualityOrLowerThan` ưu tiên chất lượng CAO hơn nếu máy không có 1080p: hiếm). **Rủi ro thật là hai điều khác:** (a) `ESTIMATED_BYTES_PER_MINUTE` = 60 MB/phút (≈ 8 Mbps) có thể THẤP hơn bitrate thật của Android/H.264 (~90–130 MB/phút) nên ngưỡng "đủ chỗ quay 10 phút" của A04 có thể thiếu; (b) iOS mặc định `AVCaptureMovieFileOutput` thường ra **HEVC `.mov`** trên máy đời mới, Android ra H.264 `.mp4`: hai nền tảng khác codec/đuôi (`create-upload-gateway.ts` đã có `mov -> video/quicktime`, Function cho phép). | `node_modules/expo-camera/{build/Camera.types.d.ts,android/.../ExpoCameraView.kt,ios/Current/CameraVideoRecording.swift}` |
| 1b | (bổ sung, review bỏ sót) Tham số nằm ở hai chỗ khác nhau và **không phải mọi thứ có trên cả hai nền tảng** | `videoQuality`, `videoBitrate` là **prop của `CameraView`**, không phải tùy chọn `recordAsync`. `codec` là tùy chọn `recordAsync`, **chỉ iOS**; iOS chỉ áp `videoBitrate` khi đã truyền `codec`. Android không có `codec` (CameraX Recorder, thực tế H.264). `maxFileSize` là tùy chọn `recordAsync` **có trên cả hai** (Android `setFileSizeLimit`, iOS `maxRecordedFileSize`), mặc định không giới hạn: đây là **lưới cứng chống 2 GB** mà review không nhắc. | như trên |
| 1c | (bổ sung) Tệp > 2 GB không tải được | `VIDEO_MAX_BYTES = 2_000_000_000` (thập phân, `limits.ts`); `uploadOne` đánh `needs_attention` `UPLOAD_FILE_TOO_LARGE`, không thử lại được, tệp kẹt trên máy. Nên vượt trần là **bằng chứng không tải được**, nặng hơn "tốn dung lượng". | `upload-queue.ts:322` |
| 2 | Controller không truyền `hashedFingerprint` ở `LOCAL_FILE_READABLE` nên `checkLocalFile` băm lại ở lần tải đầu | **Đúng về hành vi, nhưng là LỰA CHỌN CÓ CHỦ ĐÍCH của V1-13** ("lần tải đầu luôn băm lại; ban đầu định lưu dấu ngay sau băm — bỏ, an toàn hơn"). Không phải lỗi; là đánh đổi thời gian băm JS (chưa đo, G-5) lấy việc đối chiếu lại tệp ngay trước khi tải. Máy chủ vẫn băm độc lập. Có thể đổi, nhưng phải thành quyết định có ghi (Q-30e), không "sửa lỗi". | `recording-controller.ts:261-271`, `upload-queue.ts:292-316`, plans/v1-13 mục "Dấu tệp đã băm" |
| 3 | Chưa kiểm video sau khi lưu; `durationMs` không bao giờ được ghi | **Đúng.** Không nơi nào đặt `durationMs` ở luồng quay thật (chỉ test hợp đồng; `upload-sources.ts` hàng hoàn gửi `null`). Tệp "đọc được" hiện chỉ có nghĩa là băm được. `durationMs` là trường bất biến chỉ đặt được ở `LOCAL_FILE_READABLE` (`evidence-file.ts:151`) nên phải đo TRƯỚC sự kiện đó. | `recording-controller.ts`, `evidence-file.ts` |
| 4 | Camera báo lỗi giữa chừng thì mất dấu tệp tạm | **Đúng, và rộng hơn review nêu**, ba chỗ khác nhau (mục 3 V1-23): (i) `recordAsync` reject (Android `Finalize` lỗi khác `NONE/SIZE/DURATION/SOURCE_INACTIVE`, ví dụ `ERROR_INSUFFICIENT_STORAGE`; iOS `AVErrorRecordingSuccessfullyFinishedKey` không true): API **không trả đường dẫn**, `RecorderResult` không có chỗ chứa, nên controller không thể giữ; (ii) `finish` nhánh `!recorded.ok` gọi `markFailed` **không `localPath`** (đúng vì không có), và `recoverInterruptedRecordings` coi `recording` luôn `unrecoverable`; (iii) **lỗi SQLite lúc `STOP_RECORDING`**: hiện biết `tempUri` nhưng `if (!stopped.ok) return fail('SAVE_FAILED')` (dòng 233) **không `markFailed`, không `persist`**, còn nhánh `catch` (dòng 284) gọi `markFailed` không `localPath` vì `savedUri` còn `null`: tệp tạm còn nguyên, không còn ai biết nó ở đâu, và trạng thái DB còn `recording` nên recovery đánh `unrecoverable`. Nhánh (iii) **sửa được hoàn toàn bằng mã, không phải câu hỏi nghiệp vụ**. | `recording-controller.ts:225-240,284-294,477-480`; `camera-recorder.tsx:58-64` |
| 4b | Thư mục tạm không được dọn | **Đúng, và đang là hành vi mong muốn** (bất biến 4: có thể là bản duy nhất). Không có mã nào xóa `cache/Camera/`. Hệ điều hành tự dọn cache khi thiếu chỗ. Chỉ cần ĐO số tệp mồ côi (G-15), chưa cần dọn. | grep `Paths.cache`: 0 |
| 5 | Cảnh báo sớm sắp đầy + giải phóng bản cục bộ đã verified | Cảnh báo: thiếu thật (A04 chỉ chặn lúc bắt đầu; **giữa lúc quay không ai theo dõi**; Android hết chỗ giữa chừng làm `recordAsync` reject = kịch bản (4i) mất đường dẫn). Giải phóng: **không có mã nào**, UI-F03 là khung không lối vào (v1-release-plan mục 2.3). Đụng bất biến 4 (ngoại lệ thứ ba) nên là câu hỏi người dùng (Q-30g), không làm trong nhóm này. | `precheck.ts`, `recording-policy.ts`, `v1-release-plan.md` |

Thêm (không có trong review): `RECOVERY_FOUND_FILE` (`recording -> saving_local`) có trong máy trạng thái nhưng **không nơi nào phát ra** — đúng thứ V1-23 cần.

**Đánh giá "lỗi SQLite lúc STOP_RECORDING có gộp vào hạng mục 4 không?" Nên GỘP** vào V1-23: cùng triệu chứng (mất đường dẫn tạm), cùng tệp sửa (`recording-controller.ts`, `media`/`video-controller.ts` tương ứng), cùng test. Phần chắc chắn sửa được (iii) làm trước; phần phải hỏi người dùng (i) làm sau cổng quyết định.

## 1. Đánh số, thứ tự, độ phức tạp

Đề xuất đánh số **V1-22…V1-27**, chạy **trước V1-21** (V1-21 vẫn là bản 1.0.0; đổi phụ thuộc của nó thành "V1-22…V1-26 + cổng thiết bị"). Không đổi số V1-21 để không phá liên kết hiện có.

| PR | Tên | Mục tiêu một dòng | Hạng mục | Cỡ | Phụ thuộc | Cần quyết định trước |
|---|---|---|---|---|---|---|
| V1-22 | recorder-profile | Đặt rõ 1080p/bitrate/codec/`maxFileSize`, nối ước lượng dung lượng với bitrate | 1 | M | – | Q-30a, Q-30b (có thể làm phần không phụ thuộc trước) |
| V1-23 | temp-file-safety | Không mất dấu tệp tạm khi SQLite/camera lỗi; recovery tìm tệp theo ID | 4 + lỗi STOP | M | – | phần (i) cần Q-30c; phần (iii) không |
| V1-24 | playback-check | Đọc cấu trúc MP4/MOV, ghi `durationMs`, gắn cờ khi không đọc được | 3 | M | V1-23 (cùng `finish`) | Q-30f (chọn cách đo), chuỗi UI chờ BA |
| V1-25 | hash-at-close | Lưu dấu tệp ngay khi đóng để bỏ lần băm thứ hai (nếu được duyệt) | 2 | S | G-5 (số đo), V1-23 | Q-30e |
| V1-26 | storage-early-warning | Cảnh báo sớm, tự dừng khi sắp hết chỗ giữa lúc quay; KHÔNG xóa gì | 5 (phần an toàn) | S-M | V1-22 (hằng dung lượng) | Q-30d (ngưỡng) |
| V1-27 | capture-metrics | Ghi số đo không PII (bytes/phút, MB/giây băm, thời lượng) để G-3/G-4/G-5/G-14 đọc được | 6 | S | V1-22 | – |

Thứ tự khuyến nghị (làm song song được ở làn A: V1-22, V1-23(iii), V1-27; làn B sau đó):

```
Làn A:  V1-27 (metrics)   V1-23 (iii: lỗi STOP, recovery theo ID)   V1-22 (profile, sau Q-30a/b)
Làn B:  V1-24 (sau V1-23)   V1-26 (sau V1-22)
Sau số đo G-5:  V1-25
Build staging -> cổng thiết bị (G-1…G-5, G-14, G-15) -> [PR sửa theo số đo] -> V1-21
```

Lý do: V1-27 đi đầu để build staging đầu tiên đã in được số đo; V1-23(iii) là lỗi mất dữ liệu chắc chắn, không cần ai duyệt; V1-22 cần quyết định chất lượng hình (Q-30a) nhưng `maxFileSize` + tách hằng số làm được ngay. V1-25 CHỈ làm sau khi G-5 có tốc độ băm (đang không biết nên không tối ưu mù).

Độ phức tạp tổng: ~6 PR, mỗi PR ≤ ~600 dòng mã (ngân sách 1500 không bị chạm; V1-24 có migration v17). Rủi ro lớn nhất không nằm ở mã mà ở **số đo trên máy thật**: không có số đo thì V1-22 (bitrate) và V1-25 (băm) chỉ là phỏng đoán có căn cứ.

## 2. V1-22 recorder-profile

**Trạng thái: đã code (nhánh `feat/v1-22-recorder-profile`, xếp chồng trên V1-23).** Người dùng đã chốt **Q-30a = A** (1080p30, ~6 Mbps) và **Q-30b = A** (H.264 cả hai nền tảng). Triển khai: `VIDEO_PROFILE`, `BITRATE_HEADROOM`, `ESTIMATED_BYTES_PER_MINUTE` suy từ bitrate ở `recording-policy.ts`; prop `profile` ở `platform/camera-recorder.tsx` (`videoQuality`/`videoBitrate` vào `CameraView`; `maxFileSize`/`codec` vào `recordAsync`); cả `PackRecordLive` và `ReturnRecordLive` truyền `VIDEO_PROFILE`. Test đối chiếu `maxFileBytes < VIDEO_MAX_BYTES` đặt ở `recording-policy.test.ts` (import qua `@/features/upload`). Đã đọc mã nguồn `expo-camera` 58.0.12: Android `maxFileSize` là `Int` (1,9 GB vừa), `0` = không giới hạn; iOS chỉ áp `videoBitrate` khi có `codec`, codec không hỗ trợ thì ném `CameraRecordingException`; Android không có trường `codec` (chưa xác nhận bỏ qua im lặng, G-14d). **Chưa chạy trên thiết bị**; G-14 vẫn phải đo bytes/phút, codec thật, hành vi chạm `maxFileSize` và độ đọc được của nhãn. Không thêm chuỗi/mã lỗi mới (chạm trần dung lượng = `early`, phiên `interrupted`).

**Mục tiêu.** (1) Thông số quay tường minh và giống nhau trên hai nền tảng; (2) bất kỳ lần quay nào cũng không thể sinh tệp > trần tải lên 2 GB; (3) `ESTIMATED_BYTES_PER_MINUTE` suy ra từ bitrate đã đặt, không phải số "ước".

**Phạm vi tệp.** `src/platform/camera-recorder.tsx`, `src/features/packing/domain/recording-policy.ts` (+ test), `src/features/packing/domain/camera-end.ts` (+ test), `src/features/packing/ui/PackRecordLive.tsx`, `src/features/returns/ui/ReturnRecordLive.tsx` (truyền hồ sơ cấu hình; chỉ nếu video hàng hoàn dùng cùng `CameraRecorder`: có), `src/test-utils/mock-camera-recorder.tsx` nếu đổi kiểu, `src/platform/camera-recorder.test.tsx` (mới, theo mẫu `camera-preview.test.tsx`).

**Thiết kế.**
- `recording-policy.ts` thêm `VIDEO_PROFILE` (hằng thuần, không import SDK): `{ quality: '1080p', bitrateBps, codec: 'avc1', maxFileBytes }`. `ESTIMATED_BYTES_PER_MINUTE = ceil(bitrateBps / 8 * 60 * HEADROOM)` với `HEADROOM = 1.3` (bộ mã hóa vượt mục tiêu 20–30% khi cảnh động). `maxFileBytes = 1_900_000_000` (< `VIDEO_MAX_BYTES` 2_000_000_000, chừa ~5% cho khối container); test khẳng định `maxFileBytes < VIDEO_MAX_BYTES` (hai hằng ở hai feature: test ở `features/upload` hoặc test tooling đối chiếu, vì `packing` không import `upload`).
- Giá trị `bitrateBps`: **chờ Q-30a**; đề xuất khởi điểm 6 Mbps cho 1080p30 H.264 (≈ 45 MB/phút, 10 phút ≈ 450 MB; ước lượng dung lượng ≈ 58 MB/phút sau headroom, **gần với 60 MB/phút hiện tại**). Phải kiểm chữ trên nhãn/mã vận đơn còn đọc được ở G-14.
- `CameraRecorder` nhận prop `profile?: { quality, bitrateBps, codec, maxFileBytes }` (kiểu định nghĩa trong `platform`, không import từ `features`; UI truyền hằng từ domain xuống, đúng chiều phụ thuộc):
  - `<CameraView videoQuality={profile.quality} videoBitrate={profile.bitrateBps} …/>`;
  - `recordAsync({ maxDuration?, maxFileSize: profile.maxFileBytes, codec: profile.codec })`. `codec` bị Android bỏ qua (cần xác nhận không lỗi: G-14); trên iOS **bắt buộc truyền `codec`** thì `videoBitrate` mới có tác dụng. Nếu thiết bị iOS không hỗ trợ `avc1`, expo ném `CameraRecordingException` -> hiện là `RECORDER_FAILED` (kiểm ở G-14, hiếm vì mọi iPhone hỗ trợ H.264).
  - Giữ `mute`, không đụng micro (O-09).
- `maxFileSize` chạm trần: Android `ERROR_FILE_SIZE_LIMIT_REACHED` và iOS `AVErrorMaximumFileSizeReached` (kèm `RecordingSuccessfullyFinishedKey = true`) đều **resolve** như dừng thành công (đã đọc mã). `classifyCameraEnd` hiện sẽ gọi đó là `early` (chưa tới giờ, không ai bấm dừng) -> phiên `interrupted`, video giữ nguyên. Đó là hành vi **an toàn và chấp nhận được không cần chuỗi mới**. Cải tiến tùy chọn: thêm kết quả `'size_limit'` nếu `sizeBytes >= maxFileBytes - 2%` (cần chuỗi UI "đã tự dừng vì đạt dung lượng tối đa": chờ BA, C-1). Nhóm này chỉ làm bản không chuỗi mới.
- Không thêm `fps` (expo-camera không có; mặc định 30 trên cả hai).

**Test (Jest).** (a) `recording-policy.test.ts`: `ESTIMATED_BYTES_PER_MINUTE` khớp công thức từ `VIDEO_PROFILE`; `requiredFreeBytes()` cho 10 phút >= `bitrate*600/8`; (b) test đối chiếu `VIDEO_PROFILE.maxFileBytes < VIDEO_MAX_BYTES` (tooling hoặc test `upload`); (c) `camera-recorder.test.tsx` mock `expo-camera`: `CameraView` nhận `videoQuality/videoBitrate`, `recordAsync` nhận `maxFileSize` và `codec`; (d) `camera-end.test.ts`: tệp chạm trần dung lượng không bị coi `requested`; (e) test `PackRecordLive` hiện có không vỡ.

**Ca ngoại lệ.** iOS không có `avc1`; máy Android không hỗ trợ 1080p (CameraX rơi về chất lượng khác: cần `maxFileSize` bảo vệ); bitrate đặt nhưng bộ mã hóa phớt lờ (đo ở G-14, hằng ước lượng có headroom); máy trống chỗ < ước lượng -> A04 chặn như cũ.

**Nghiệm thu.** Hai nền tảng đều ra H.264 1080p30; 10 phút cảnh tĩnh và cảnh động đều < 1 GB (mục tiêu, đo G-14); không tệp nào > `maxFileBytes`; ước lượng dung lượng >= bytes/phút đo được tối đa của cảnh động (G-14); `npm run check` xanh.

**Rủi ro.** Chất lượng hình giảm so với mặc định (đặc biệt cảnh động/thiếu sáng) -> nhãn khó đọc; HEVC -> H.264 làm tệp iOS to hơn nếu bitrate đặt cao; thư viện thay đổi hành vi giữa bản SDK (ghim 58.0.12, đã đọc mã).

**Bất biến.** Không đụng liên kết phiên–kiện (2); không xóa/ghi đè (4); không đổi câu chữ (11).

## 3. V1-23 temp-file-safety (gồm lỗi SQLite lúc STOP_RECORDING)

**Trạng thái: đã code phần 3.1 (nhánh `feat/v1-23-temp-file-safety`, xếp chồng trên V1-27).** Áp dụng cho cả đóng gói (`recording-controller.ts`) và video hàng hoàn (`video-controller.ts`, `media-recovery.ts`; media ảnh ở trạng thái `recording` cũng được cứu nếu đã có tệp bền theo ID). Cổng `sleep?` tiêm được cho test. **Q-30c đã chốt = A (người dùng)**: phần 3.2 (cứu tệp khi `recordAsync` bị từ chối) KHÔNG làm ở 1.0, không có `camera-temp-files.ts`; chỉ ĐO bằng G-15. Chưa chạy trên thiết bị. Lệch kế hoạch: nhánh `catch` ngoài cùng và `persist` lỗi giữ đường dẫn tạm (không có đường dẫn bền); `RECOVERY_FOUND_FILE` còn thử `LOCAL_FILE_MOVED` khi STOP thật ra đã ghi xong dù báo lỗi.

**Mục tiêu.** Mọi tệp tạm mà camera đã giao cho app phải đi tiếp tới `evidence/<id>.<đuôi>` hoặc ít nhất để lại dấu vết tìm lại được, kể cả khi kho SQLite lỗi; không còn nhánh nào giữ tệp mà không ai biết nó ở đâu.

**Phạm vi tệp.** `src/features/packing/domain/recording-controller.ts` (+ `recording-controller.test.ts`), `src/features/returns/domain/video-controller.ts` và `media-recovery.ts` (+ test, cùng khuôn), `src/features/evidence/domain/file-state.ts` (chỉ thêm test dùng `RECOVERY_FOUND_FILE`, không đổi luật), sau Q-30c: `src/platform/camera-temp-files.ts` (mới) và `camera-recorder.tsx`.

### 3.1 Phần chắc chắn (không cần quyết định): lỗi kho lúc `STOP_RECORDING`

- `finish`: giữ `knownPath = recorded.tempUri` ngay khi `recorded.ok`; mọi nhánh lỗi sau đó (`!stopped.ok`, `catch`) truyền `localPath: savedUri ?? knownPath` cho `markFailed`.
- **Không dừng ở lỗi ghi `STOP_RECORDING`**: vẫn `persist(tempUri → evidence/<id>.<đuôi>)` (tên suy ra từ ID bằng chứng đã tạo TRƯỚC khi quay, không đoán). Sau khi tệp đã ở thư mục bền, tên tệp tự mang ID: `findPersistedRecording(id)` tìm được dù DB không có đường dẫn. Rồi thử ghi lại DB theo thứ tự: nếu trạng thái còn `recording` (STOP chưa ghi được) dùng `RECOVERY_FOUND_FILE` (`recording → saving_local`, nằm trong `RELOCATION_EVENTS`, kèm `localPath`) thay cho `STOP_RECORDING` + `LOCAL_FILE_MOVED`; thử lại tối đa 3 lần có chờ ngắn (200/400/800 ms) vì lỗi SQLite thường là kẹt tạm (`db-queue`).
- `recoverInterruptedRecordings`: nhánh `file.state === 'recording'` **trước khi** `markUnrecoverable`, gọi `findPersisted(file.id)`; có tệp -> `RECOVERY_FOUND_FILE` rồi `completeLocalSave` (băm, vào hàng đợi) như `saving_local`; phiên vẫn `interrupted` (không tự nhận đầy đủ). Không có -> `lost` như cũ (app bị kill GIỮA lúc quay vẫn mất, đúng Q-24b A). Đây **không phải tự liên kết**: tên tệp mang ID đã gắn phiên/kiện từ trước (bất biến 2), không quét thư mục tạm.
- Cập nhật chú thích đầu hàm `recoverInterruptedRecordings` ("recording: KHÔNG biết tệp tạm ở đâu") cho khớp.

### 3.2 Phần phải hỏi (Q-30c): `recordAsync` bị từ chối, API không trả đường dẫn

Hiện `RecorderResult` chỉ có `RECORDER_FAILED`. Tệp một phần thường vẫn nằm ở `cache/Camera/` (Android `Camera*.mp4`, iOS `Camera*.mov`; **chưa xác nhận trên máy**). Cứu nó đòi hỏi suy ra tệp nào thuộc lần quay nào. `recording-controller.ts` hiện ghi rõ việc quét thư mục tạm là tự liên kết, trái bất biến 5. Phương án ở Q-30c; khuyến nghị: A cho 1.0 (không cứu, nhưng ĐO bằng G-15 xem tần suất), B chỉ khi người dùng duyệt.

**Test (Jest, kho `node:sqlite` hoặc bộ nhớ có tiêm lỗi).**
- `files.applyEvent` ném/trả `ok:false` lúc `STOP_RECORDING`: tệp VẪN được `persist`, kết quả `failed` với `evidenceId`, tệp bền tồn tại, DB (sau lần thử lại thành công) ở `saving_local → queued`; nếu mọi lần thử đều lỗi: `local_save_failed` hoặc `recording` với tệp bền theo ID.
- Recovery: bản ghi `recording` + `findPersisted` trả đường dẫn -> thành `queued`, `lost = 0`, phiên `interrupted`; `findPersisted = null` -> `unrecoverable` như cũ (hồi quy).
- `markFailed` nhận `localPath` ở mọi nhánh sau `recorded.ok` (bảng ca: `stopped` lỗi, `persist` lỗi, `moved` lỗi, `hash` lỗi, ném ngoại lệ).
- Hàng hoàn: bản sao của hai ca đầu cho `video-controller`/`media-recovery`.
- Không có test nào cho phép xóa tệp: giữ khẳng định "không gọi xóa".

**Ca ngoại lệ.** Đích `evidence/<id>.<đuôi>` đã tồn tại (`persist` trả `FAILED`): không ghi đè (giữ hành vi), tệp tạm giữ, `local_save_failed` kèm đường dẫn tạm; hết chỗ lúc `move` (`STORAGE_FULL`) giữ nguyên.

**Nghiệm thu.** Không còn nhánh `finish` nào để tệp tạm không đường dẫn khi `tempUri` đã biết; recovery cứu được tệp theo ID cho cả `recording`; mọi test cũ xanh.

**Rủi ro.** Đổi luồng nóng của ghi hình (kiểm kỹ hồi quy `markInterrupted`, `wasInterrupted`); `RECOVERY_FOUND_FILE` lần đầu có người phát nên cần test hợp đồng cả hai kho (bộ nhớ + SQLite). Cẩn thận đua luồng: recovery chạy lúc mở app trong khi một lần quay mới đã bắt đầu (đã có kiểm `file.state !== listed.state`).

**Việc thiết bị.** G-15 (mục 9).

## 4. V1-24 playback-check

**Mục tiêu.** Biết video vừa lưu có cấu trúc hợp lệ và độ dài > 0; ghi `durationMs` (hiện luôn `null`); gắn cờ khi nghi lỗi. **Chỉ gắn cờ**: không xóa, không chặn tải, không đổi trạng thái tệp (bất biến 4, 6).

**Thiết kế đo (đề xuất, Q-30f).** Hai cách; khuyến nghị **A**:
- **A. Đọc khối `moov/mvhd` bằng JS** (`core/media/iso-bmff.ts`, TypeScript thuần): đọc từng tiêu đề khối cấp cao qua `FileHandle` (đọc 8–16 byte rồi nhảy theo kích thước; tệp vài trăm MB chỉ cần vài chục lần đọc), tìm `moov` → `mvhd` (timescale, duration) và ít nhất một `trak` có `hdlr` loại `vide` và `mdat` kích thước > 0. Cùng định dạng ISO BMFF cho Android `.mp4` và iOS `.mov`; chạy y hệt hai nền tảng; **kiểm thử hoàn toàn bằng Jest với byte giả** (cả tệp tốt lẫn cắt cụt, thiếu `moov`). Giới hạn: chứng minh cấu trúc và độ dài, **không chứng minh giải mã được** (kiểm giải mã vẫn là G-6).
- B. `expo-video` tạo player ẩn rồi đọc `duration` khi `readyToPlay`: giải mã thật hơn nhưng tạo tài nguyên native nặng ngay lúc camera còn giữ, khó test, phụ thuộc thiết bị.
- Bổ sung độc lập: nếu A cho độ dài và đồng hồ đơn điệu quanh `recordAsync` lệch quá nhiều (ví dụ > 20% hoặc > 5 giây) thì cũng gắn cờ (gợi ý tệp thiếu phần cuối).

**Phạm vi tệp.** `src/core/media/iso-bmff.ts` (+ test), adapter `src/platform/media-probe.ts` (đọc byte từ `File.open`, như `file-hasher.ts`), `recording-controller.ts` (gọi probe giữa `LOCAL_FILE_MOVED` và `LOCAL_FILE_READABLE`, đưa `durationMs` vào cùng patch với `sha256Client`; **phải trước** vì `durationMs` chỉ đặt một lần ở sự kiện đóng), `recoverInterruptedRecordings/completeLocalSave` (cùng), `video-controller.ts`/`media-recovery.ts` (hàng hoàn, tùy ngân sách: nếu vượt ~1500 dòng thì tách V1-24b), `sqlite-migrations.ts` v17.

**Dữ liệu.** Migration v17 (chỉ thêm): `evidence_files.media_check TEXT NULL`, `return_media.media_check TEXT NULL`; giá trị `ok | no_moov | zero_duration | unreadable | length_mismatch`; `NULL` = chưa kiểm (dữ liệu cũ, ảnh). `EvidenceFile.mediaCheck?`. Không gửi lên máy chủ (không đổi Rules/Functions); `durationMs` đã gửi sẵn qua `evidence-document.ts` và Rules đã cho phép.

**Giao diện.** Chỉ HIỂN THỊ cờ, không thêm màn: UI-C04 (xác nhận) một dòng cảnh báo nếu phiên có video cờ khác `ok`/`NULL`; chi tiết bằng chứng (UI-E04) đã có hàng "Thời lượng". Chuỗi mới qua i18n và **chờ BA** (đề xuất nháp để BA sửa: "Video này có thể bị lỗi. Nếu còn kịp, hãy quay lại."; thêm mã lỗi nếu cần, ghi `decisions.md` Q-30, không tự thêm vào `codes.ts`). Không quảng cáo "đã kiểm tra tính toàn vẹn hình ảnh" (bất biến 11).

**Test.** `iso-bmff.test.ts` (khối hợp lệ; `moov` ở cuối tệp; `moov` ở đầu; kích thước khối 64-bit `largesize`; `mdat` rỗng; tệp cụt giữa khối; timescale 0; rác ngẫu nhiên); `media-probe.test.ts` (tệp thật tạm bằng `node:fs` giả `File`); controller: probe trả `zero_duration` -> tệp vẫn `queued`, `mediaCheck` ghi, `durationMs` đặt, không lệnh xóa; probe ném lỗi -> `unreadable`/`NULL`, KHÔNG làm hỏng lưu; `sqlite-migration-v17.test.ts`; hợp đồng kho bộ nhớ + SQLite; `PackConfirmScreen` hiện dòng cảnh báo.

**Ca ngoại lệ.** Probe chậm/treo (đặt hạn 5 giây, quá hạn -> `NULL` không cờ); video gián đoạn (`interrupted`) vẫn đo bình thường; tệp cụt do kill -> đã `unrecoverable` từ trước, không tới đây; tệp rất lớn với `moov` ở cuối (chỉ nhảy theo khối, không đọc `mdat`).

**Nghiệm thu.** `durationMs` có giá trị trên mọi video mới; cờ đúng với bộ tệp lỗi mẫu; không tệp nào bị xóa/chặn; V1-17 phát được tệp cờ `ok` ở G-6 (đối chiếu độ dài player với `durationMs`).

**Rủi ro.** Một số bộ mã hóa ghi `moov` dạng phân mảnh (fMP4, `moof`): CameraX mặc định không, nhưng nếu gặp thì `mvhd` có `duration = 0` -> phải coi `moof/mfra` hợp lệ, không gắn cờ oan (kiểm ở G-14 với tệp thật hai nền tảng; nếu cần thì thêm cộng dồn `tfhd/trun`). Cờ sai oan làm người dùng hoang mang: chuỗi trung tính, chỉ `no_moov`/`unreadable` mới hiện.

## 5. V1-25 hash-at-close (chờ G-5 và Q-30e)

**Hiện trạng đã xác minh.** Mỗi video được băm **hai lần bằng JS**: lúc đóng (`recording-controller.ts:254`) và lần tải đầu (`checkLocalFile`, vì chưa có dấu). Với tệp ~450 MB–1,9 GB, nếu Hermes băm ~20 MB/s (chưa đo) thì mỗi lần ≈ 25–95 giây, và lần thứ hai chặn cả hàng đợi (tuần tự).

**Thiết kế (nếu Q-30e chọn B).** `RecordingPorts.fingerprint?: (path) => FileFingerprint | null` (nối `fileFingerprint` có sẵn ở `platform/file-hasher.ts`); trong `finish` và `completeLocalSave`: đọc dấu TRƯỚC `hash`, băm, đọc dấu SAU; chỉ khi trước = sau và `sizeBytes` khớp thì thêm `hashedFingerprint` vào patch của `LOCAL_FILE_READABLE` (đã được `evidence-file.ts` cho phép, không đổi luật bất biến). Lần tải đầu sẽ khớp dấu và bỏ băm; dấu lệch/thiếu -> băm lại (như hiện nay, an toàn). Không thêm trạng thái/sự kiện. Chỉ áp cho **video** (ảnh nhỏ, băm rẻ, giữ nguyên).

**Chấp nhận được không?** Mất đi: phát hiện tệp đổi trong khoảng đóng-tải mà vẫn giữ nguyên kích thước + mtime (rất hiếm: thư mục bền là của riêng app) và hỏng bit âm thầm của bộ nhớ. Vẫn còn: máy chủ băm lại độc lập -> `hash_mismatch` (không bao giờ `verified` sai); tệp cục bộ vẫn còn. Giữ lại: trường hợp mtime không đáng tin trên một nền tảng -> dấu không khớp -> băm lại (tự suy giảm về hành vi cũ).

**Phương án khác (V1-13 đã nêu, không cần thư viện mới):** `File.digest('SHA-256')` native của `expo-file-system` 58.0.12; nếu G-5 cho thấy nhanh hơn JS nhiều lần thì có thể loại luôn vấn đề (vẫn cần so với `node:crypto`/sha256 thuần JS trên cùng tệp thật).

**Test.** Mở rộng `upload-queue.hash-reuse.test.ts`: video vừa đóng có dấu -> lần tải đầu không gọi `hasher.sha256`; tệp bị ghi thêm trong lúc băm (dấu trước ≠ sau) -> không lưu dấu, lần tải đầu băm lại; mtime thiếu -> băm lại; `completeLocalSave` (recovery) cũng lưu dấu; hợp đồng kho không đổi.

**Nghiệm thu.** Số lần băm JS cho một video bình thường từ 2 xuống 1 (đếm bằng V1-27); `LOCAL_HASH_CHANGED` vẫn bắt được tệp bị sửa đổi kích thước.

**Rủi ro.** Lệch mtime trên iOS khi di chuyển tệp (đọc dấu SAU `move`, không trước); độ phân giải mtime Android (làm tròn ms đã có). Cả hai chưa kiểm chứng trên máy (G-5 ghi thêm).

## 6. V1-26 storage-early-warning (không xóa gì)

**Mục tiêu.** Người dùng biết sớm máy sắp đầy, và việc hết chỗ GIỮA lúc quay không còn dẫn tới mất đường dẫn tệp (Android reject như 3.2).

**Thiết kế.**
- `precheck.ts`: thêm mức **cảnh báo mềm** `lowStorage` (không chặn): `requiredFreeBytes <= free < 2 * requiredFreeBytes` (hệ số trong `recording-policy.ts`, Q-30d). Hiển thị ở UI-C02 như dòng lưu ý, không phải lỗi. Chuỗi mới qua i18n, chờ BA.
- Theo dõi khi đang quay: `useRecordingStorageGuard` (hook ở `features/packing/ui`, đọc `getAvailableDiskBytes` qua `platform/recording-files` mỗi 10–15 giây — không để vòng `setInterval` trần trong màn); `free < RESERVE_BYTES` (đề xuất 300 MB, Q-30d) -> `requestStop()` có chủ đích, đánh dấu `interrupted = true` (video lưu phần đã quay, phiên `interrupted`), toast nói đúng "máy sắp hết chỗ nên đã dừng, video đã lưu phần đến lúc này". Dừng CHỦ ĐỘNG khi còn chỗ để tệp được đóng sạch (còn chỗ cho `move`/băm) thay vì chờ hệ điều hành cắt ngang.
- Thẻ "Dữ liệu bằng chứng" (V1-10, Cá nhân) hiện thêm một dòng "dung lượng video trên máy này" nếu rẻ (tổng `sizeBytes` từ kho đã có). **Không thêm lối vào UI-F03, không thêm nút xóa** (v1-release-plan mục 2.3 giữ khung).

**Phạm vi tệp.** `precheck.ts`, `recording-policy.ts`, `PackPrecheckScreen.tsx`, `PackRecordLive.tsx`, `ReturnRecordLive.tsx` (video mở kiện), hook mới, i18n `vi`, test tương ứng.

**Test.** `precheck.test.ts` (ba vùng: đủ / mềm / chặn; `null` không cảnh báo); hook với bộ đếm giả (hết chỗ -> gọi stop đúng một lần, không gọi lại); `PackRecordScreen` toast + phiên `interrupted`; không có lời gọi xóa nào.

**Ca ngoại lệ.** Không đọc được dung lượng (`null`): không cảnh báo, không dừng; iOS `availableDiskSpace` có thể là dung lượng "quan trọng" khác dung lượng thô (đo ở G-4); bộ đệm hệ điều hành rút bất ngờ.

**Nghiệm thu.** Quay tới ngưỡng dự trữ thì app tự dừng, tệp lưu được và vào hàng đợi, phiên `interrupted`; cảnh báo mềm xuất hiện đúng vùng.

**Tách riêng, KHÔNG nằm trong nhóm: giải phóng bản cục bộ đã `verified`** (Q-30g). Lý do cần người dùng: là ngoại lệ thứ ba của bất biến 4, và v1 **chưa có đường xem video từ máy chủ**, nên xóa bản cục bộ = người dùng không còn xem lại được bằng chứng trong app.

## 7. V1-27 capture-metrics

**Trạng thái: đã code (nhánh `feat/v1-27-capture-metrics`).** Triển khai: `core/diagnostics/media-metrics.ts` (hàm thuần + danh sách khóa), adapter `platform/media-metrics-log.ts` (thêm `platform` rồi `logger.info('media.metrics')`), cổng tùy chọn `metrics` ở `RecordingPorts`/`RecoveryPorts`/`UploadQueueDeps` (domain không import platform), bản ghi `record_save`, `recovery_save`, `upload` (thêm `uploadMs`/`uploadMBps` và `hashCount` 0/1 để đếm số lần băm cho V1-25). Chưa chạy trên thiết bị.

**Mục tiêu.** Biến các điểm "chưa chắc" thành số đo đọc được ở G-3/G-4/G-5/G-14, không cần build riêng.

**Thiết kế.** Hàm thuần `core/diagnostics/media-metrics.ts` dựng bản ghi chỉ có số: `{ kind, durationMsWall, sizeBytes, bytesPerMinute, hashMs, hashMBps, persistMs, platform }`; ghi qua `logger.info('media.metrics', …)` ở `finish`/`completeLocalSave`/`uploadOne` (thời gian băm, thời gian PUT, byte). **Không** ID, đường dẫn, mã đơn, shopId, không `error.message` (khớp danh sách cho phép của `crash-safe.ts`; logger che PII và `console` chỉ ở logger). Ở bản `staging` đọc bằng Xcode console / `adb logcat`; không gửi Crashlytics, không màn chẩn đoán mới (ngoài phạm vi, có thể xin sau).

**Test.** Hàm dựng số (chia cho 0, thời lượng thiếu), kiểm khóa của bản ghi nằm trong danh sách cho phép và không chứa khóa nhạy cảm; test logger không in đường dẫn.

**Nghiệm thu.** Một lượt quay 1 phút trên máy ảo/test sinh đúng một bản ghi số; `check` xanh.

## 8. Câu hỏi cho người dùng / BA (đề xuất Q-30a…h, ghi vào `decisions.md` khi duyệt; CHƯA ai chốt)

| # | Câu hỏi | Phương án | Khuyến nghị | Chặn |
|---|---|---|---|---|
| Q-30a | **Chất lượng hình đặt cố định cho video đóng gói** (đánh đổi nhãn đọc được ↔ dung lượng/thời gian tải) | A. 1080p30, H.264, ~6 Mbps (≈ 45 MB/phút). B. 1080p30, ~10 Mbps (≈ 75 MB/phút, rõ hơn, tải lâu hơn, tốn lưu trữ). C. 720p ~3 Mbps (nhẹ, chữ nhỏ khó đọc) | A, **xác nhận bằng ảnh chụp khung hình thật ở G-14** (nhãn vận đơn đọc được ở khoảng cách đóng hàng); chi phí lưu trữ/băng thông tỉ lệ bitrate | V1-22 |
| Q-30b | **Codec iOS** | A. H.264 (`avc1`) ép cả hai nền tảng (cùng codec, phát được ở mọi nơi, tệp lớn hơn HEVC ~30–40%). B. Để mặc định (iOS thường HEVC `.mov`, Android H.264 `.mp4`). | A (D-12 ngang hàng, xem lại/xuất hồ sơ sau này không vướng giải mã HEVC); chấp nhận tệp iOS lớn hơn | V1-22 |
| Q-30c | **Tệp một phần khi `recordAsync` bị từ chối** (API không trả đường dẫn): có cứu không, và nếu cứu thì suy ra tệp bằng cách nào mà không vi phạm bất biến 5? | A. Không cứu: ghi nhận thiếu, ĐO tần suất ở G-15. B. Chụp danh sách `cache/Camera/` trước `record()`; sau lỗi, nếu đúng **một** tệp mới, thời gian sửa nằm trong cửa sổ quay, kích thước > 0 thì chuyển vào `evidence/<id>.<đuôi>`, trạng thái `local_save_failed`, phiên `interrupted`, gắn cờ `media_check`; hơn một ứng viên hoặc không chắc thì không đụng. Chỉ cho lỗi trong tiến trình, không áp lúc app bị kill. C. Cho người dùng xem danh sách tệp tạm và tự gắn (nặng, trái "cực kỳ đơn giản") | A cho 1.0; B nếu G-15 cho thấy lỗi này xảy ra thật (chỉ B sau khi người dùng xác nhận rằng đây không phải "tự liên kết": ID bằng chứng đã tạo trước, chỉ cửa sổ thời gian quyết định tệp) | V1-23 phần (i) |
| Q-30d | **Ngưỡng cảnh báo dung lượng**: vùng cảnh báo mềm (A04) và mức dự trữ để tự dừng giữa lúc quay | A. Mềm = dưới 2× ngưỡng quay đủ 10 phút; tự dừng khi trống < 300 MB. B. Mềm = dưới 3×; dự trữ 500 MB. | A; chỉnh sau G-4 (iOS báo dung lượng khác Android) | V1-26 |
| Q-30e | **Băm một lần hay hai lần cho video** | A. Giữ hai lần (hành vi V1-13, an toàn tối đa, chậm). B. Lưu dấu tệp lúc đóng, bỏ băm lần tải đầu khi dấu khớp (V1-25). C. Chờ G-5; nếu có digest native thì dùng cho cả hai | **C rồi quyết**: không tối ưu mù; nếu JS ≥ ~40 MB/s thì A là chấp nhận được, nếu thấp hơn thì B (hoặc digest native) | V1-25 |
| Q-30f | **Cách đo "video phát được"** | A. Đọc cấu trúc ISO-BMFF bằng JS (chứng minh cấu trúc/độ dài, không chứng minh giải mã). B. Player ẩn `expo-video` (giải mã thật, nặng). C. A ở v1, B chỉ nếu G-6 thấy tệp qua A mà không phát được | C | V1-24 |
| Q-30g | **Giải phóng bản cục bộ đã `verified`** (ngoại lệ thứ ba của bất biến 4) | A. Không có ở 1.0; chỉ cảnh báo sớm (V1-26). B. Nút "Giải phóng" thủ công ở UI-F03, từng tệp, chỉ khi `verified` + không thuộc tranh chấp mở + không `legalHold` + có xác nhận rõ nội dung bị xóa và bản còn lại ở đâu; giữ siêu dữ liệu, xóa tệp, đánh dấu `localRemovedAt`. C. Tự động theo tuổi (ví dụ 30 ngày) | **A cho 1.0** vì chưa có xem video từ máy chủ (sau khi giải phóng người dùng không xem lại được gì) và Q-24a mới là một chiều; xem lại B **sau** khi có xem từ máy chủ. **Không khuyến nghị C** ở mọi giai đoạn nếu chưa có thông báo + gói + giữ do tranh chấp phía máy chủ | không (ngoài nhóm) |
| Q-30h | **Chuỗi/mã lỗi mới** (cảnh báo sắp đầy, tự dừng vì hết chỗ, video nghi lỗi, đạt dung lượng tối đa) | BA đưa vào docs/04, 05, 09; app dùng khóa i18n tạm | – | C-1 |

## 9. Đo trên thiết bị: bổ sung cho `release-checklist.md` (ĐỀ XUẤT, chưa sửa checklist)

Dòng mới đề xuất (đặt sau G-5 mục G): 

- **G-14. Thông số quay thật (V1-22, V1-27):** trên 1 iPhone đời cũ + 1 mới, 1 Android tầm thấp + 1 phổ biến: (a) ghi `bytesPerMinute` của 1 phút / 10 phút **cảnh tĩnh** (đặt đồ trên bàn) và **cảnh động** (cầm hộp xoay, đèn yếu); so với `ESTIMATED_BYTES_PER_MINUTE`; (b) mặc định `expo-camera` TRƯỚC khi đặt thông số (build thử không truyền gì) để biết mặc định thật (kiểm chứng giả định 1080p/HEVC mục 0); (c) tệp ra có đuôi/codec gì (`.mov` HEVC? `.mp4`?), `ffprobe` hoặc Tệp > Thông tin; (d) có `codec` trên Android có gây lỗi không; (e) quay tới khi chạm `maxFileSize` (đặt tạm trần nhỏ như 50 MB): Android và iOS có resolve tệp hợp lệ, phiên `interrupted`; (f) khung hình chụp nhãn vận đơn để duyệt Q-30a; (g) tệp có `moov` ở đâu / có phân mảnh không (V1-24).
- **G-15. Khi camera lỗi và thư mục tạm (V1-23):** (a) gây hết chỗ giữa chừng (lấp đầy bộ nhớ bằng tệp lớn), (b) cuộc gọi đến, (c) mở app camera khác giữa lúc quay, (d) khóa máy: với mỗi ca ghi `recordAsync` resolve hay reject, tệp có còn ở `cache/Camera/` không, kích thước, có phát được; đếm tệp `cache/Camera/` sau 1 tuần dùng thử (tần suất mồ côi); thử ngắt SQLite (làm đầy đĩa nhưng cho phép camera) và xem recovery cứu tệp theo ID.
- **G-3 (bổ sung):** đo thời gian PUT/byte theo mạng, và **`sessionType` của `uploadAsync` trên iOS**: `createUploadTask` hiện không đặt `sessionType` (mặc định foreground của `expo-file-system`); kiểm tệp 450 MB khi app vào nền: có tiếp tục trong lúc còn được cấp thời gian nền không, hay dừng ngay. Kết quả quyết liệu có cần tải nền (ngoài v1, không hứa).
- **G-4 (bổ sung):** `recordAsync` khi bị ngắt (cuộc gọi, vào nền, thu hồi camera) thật sự resolve hay reject, tệp có phát được, `classifyCameraEnd` có ra `early` đúng; nhiệt độ/pin sau 30 phút quay + băm.
- **G-5 (bổ sung):** MB/giây băm JS trên Hermes (nêu cả máy yếu), thời gian chạm không phản hồi; so với `File.digest` native nếu thử được; xác nhận `File.modificationTime` ổn định qua `move()` và qua lần mở lại app (V1-25); số lần băm mỗi video (V1-27).

Không dòng nào ở trên đã được chạy; kết quả ghi vào `testing.md` và ADR-020.

## 10. Dòng đề xuất thêm vào `v1-release-plan.md` (KHÔNG sửa trong PR kế hoạch này)

Bảng 3.1, trước dòng V1-21:

```
| V1-22 | recorder-profile | 1080p/bitrate/codec/`maxFileSize` tường minh, ước lượng dung lượng nối với bitrate | review video 2026-11-01 (Q-30a/b) | – | V1-23, V1-27 | M | Chưa làm |
| V1-23 | temp-file-safety | Không mất dấu tệp tạm khi SQLite/camera lỗi; recovery `recording` tìm tệp theo ID | review (Q-30c) | – | V1-22, V1-27 | M | Chưa làm |
| V1-24 | playback-check | Đọc ISO-BMFF, ghi `durationMs`, cờ `media_check` (migration v17) | review (Q-30f) | V1-23 | V1-26 | M | Chưa làm |
| V1-25 | hash-at-close | Dấu tệp lúc đóng, bỏ băm lần hai (nếu Q-30e = B) | review R-5 | G-5 | – | S | Chờ số đo G-5 |
| V1-26 | storage-early-warning | Cảnh báo mềm A04, tự dừng khi sắp hết chỗ, không xóa gì | review (Q-30d) | V1-22 | V1-24 | S-M | Chưa làm |
| V1-27 | capture-metrics | Số đo không PII cho G-3/4/5/14 | review | – | tất cả | S | Chưa làm |
```

Và đổi cột "Phụ thuộc" của V1-21 thành "cổng thiết bị đạt; V1-22, V1-23, V1-24, V1-26, V1-27 đã hợp nhất (V1-25 tùy G-5)". Quyết định Q-30 ghi ở `decisions.md` mục `Q-30 — Gia cố xử lý video` khi người dùng duyệt (không tạo sớm).

## 11. Tiêu chí "xong" cho cả nhóm

1. V1-22, 23, 24, 26, 27 đã hợp nhất (V1-25 hợp nhất hoặc ghi rõ "không làm" theo Q-30e); `npm run check` xanh, `npm run test:rules` xanh (nhóm không đụng Rules/Functions; chạy để chắc).
2. Không đường nào trong luồng ghi/khôi phục còn giữ tệp tạm mà không có đường dẫn trong DB hoặc tên theo ID ở `evidence/` (bảng ca của V1-23 xanh).
3. Không video nào do app tạo ra có thể vượt `VIDEO_MAX_BYTES` (test đối chiếu hằng + G-14e).
4. Mọi video mới có `durationMs`; cờ `media_check` chỉ ghi, không có đường xóa/chặn (grep không có lời gọi xóa mới ngoài các ngoại lệ đã duyệt).
5. G-14 và G-15 đã chạy trên cả iOS và Android; số đo thật được ghi vào `testing.md`; `ESTIMATED_BYTES_PER_MINUTE`, ngưỡng pin/dung lượng và quyết định Q-30a/e được xác nhận hoặc chỉnh theo số đo.
6. Chuỗi UI mới đã qua BA (C-1); mã lỗi mới ghi `decisions.md`, không thêm rời vào `codes.ts`.
7. Q-30g (giải phóng bản cục bộ) vẫn **chưa làm** nếu người dùng chưa duyệt; bất biến 4 không có ngoại lệ thứ ba trong v1.0.

## 12. Tự review (bất biến 1–11)

- B1/B2: không đổi liên kết phiên–kiện; V1-23 cứu tệp bằng ID tạo trước khi quay, không bằng mã đơn. B3: thêm `media_check` là thuộc tính tệp, không đổi máy trạng thái; `RECOVERY_FOUND_FILE` đã có sẵn trong luật. B4: không PR nào xóa tệp tạm hay tệp bền (test khẳng định "không gọi xóa"); ngoại lệ thứ ba chỉ là câu hỏi Q-30g. B5: Q-30c-B được cô lập thành câu hỏi, mặc định A. B6: không dựng video giả, phiên vẫn `interrupted`. B7: không đổi lịch sử. B9/B10: không liên quan. B11: không câu nào hứa "bằng chứng pháp lý"; cờ `media_check` được mô tả là kiểm cấu trúc, không phải kiểm tính chân thực; mã băm giữ nghĩa cũ.
- Quy ước: logic ở `domain`/`core` thuần TS; SDK chỉ trong `platform/` (`media-probe`, `camera-recorder`, `camera-temp-files`); không `Platform.OS` trong màn hình; chuỗi qua i18n; log chỉ qua `logger`, không PII; không màu/số thiết kế thô (chỉ cảnh báo dòng chữ, dùng thành phần/token sẵn có).
- Phát hiện cần báo người dùng: (1) "vượt 2 GB" của review bị phóng đại nhưng ngưỡng 60 MB/phút có thể thấp thật; (2) băm hai lần là chủ ý V1-13; (3) `maxFileSize` là lưới chống 2 GB mà review bỏ sót; (4) `videoBitrate` trên iOS vô hiệu nếu không truyền `codec`; (5) lỗi `STOP_RECORDING` làm mất đường dẫn là lỗi mã có thật, sửa không cần nghiệp vụ.
- Chưa kiểm chứng trên thiết bị: mọi khẳng định về hành vi `expo-camera` ở trên dựa trên ĐỌC MÃ nguồn thư viện 58.0.12 (Kotlin/Swift), không phải chạy máy.
