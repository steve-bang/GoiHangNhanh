# V1-11 recording-hardening — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 1.2 (Q-24b = A, Q-24f = A), 3.0, 3.3 V1-11, 7.5; `release-hardening-plan.md` PR5 (R7). Quyết định tự chốt: `decisions.md` `#### Q-29 / V1-11 — recording-hardening`.

## Mục tiêu

1. Quay trên giá đỡ không bị tắt màn hình giữa chừng (UI-C03 đóng gói và UI-D04 video mở kiện hàng hoàn).
2. App vào nền khi đang quay: dừng ghi có chủ đích qua đường lưu bền sẵn có, đánh dấu gián đoạn (phiên `interrupted` / video mở kiện `interrupted: true`), giữ nguyên ID phiên/kiện/hồ sơ, không tự quay tiếp, không ghép tệp; quay lại app thì báo đúng điều đã xảy ra.
3. Người dùng biết giới hạn Q-24b: video đang ghi có thể mất nếu app bị tắt giữa chừng (một dòng ở màn quay + một bài hỏi đáp ngắn ở Trợ giúp).

## Thiết kế

**Thư viện:** `expo-keep-awake` **58.0.3** (bản `bundledNativeModules.json` của Expo SDK 58, Q-24f). Gói đã có sẵn trong cây phụ thuộc (phụ thuộc của `expo`, trước đây nằm lồng ở `node_modules/expo/node_modules`), nay khai báo trực tiếp nên được đưa lên gốc. Không quyền iOS; Android: kiểm `AndroidManifest.xml` sau `expo prebuild` (thư viện dùng `FLAG_KEEP_SCREEN_ON` của cửa sổ, không cần `WAKE_LOCK`).

**Adapter `src/platform/keep-awake.ts`:** `useKeepScreenAwake(active: boolean)`; mỗi màn một tag riêng (`useId`), bật khi `active` thành `true`, tắt khi `false` hoặc gỡ màn; gọi đúng một lần mỗi lần đổi. Nạp thư viện **lười** trong hàm (như `expo-battery`): thiếu mô-đun native thì không làm gì; lỗi chỉ log mã ngắn, không PII, không chặn quay. Mock Jest toàn cục trong `jest.setup.ts` (`src/test-utils/mock-keep-awake.ts`, đếm lần bật/tắt theo tag).

**Adapter `src/platform/app-state.ts`:** thêm `subscribeAppBackground(onBackground)` (chỉ trạng thái `background`) và `onceAppActive(callback)` (gọi một lần khi app trở lại `active`, trả hàm hủy). **Không** coi `inactive` của iOS là vào nền: iOS báo `inactive` khi kéo Trung tâm điều khiển/thông báo, hộp thoại hệ thống (quyền vị trí), băng báo cuộc gọi; dừng quay ở đó làm hỏng phiên vô cớ. Nếu camera bị hệ thống ngắt trong lúc `inactive` (cuộc gọi toàn màn hình), bộ ghi tự trả kết quả sớm và được nhận là gián đoạn (mục dưới). Android không có `inactive`.

**Bộ điều phối (domain, TypeScript thuần):**
- `recording-controller.ts`: `RecordingPorts.wasInterrupted?: () => boolean`; khi lưu xong (`queued`) phiên về `interrupted` nếu cổng trả `true`, ngược lại `ended` như cũ. Không đổi trình tự tạo bản ghi tệp/phiên trước khi ghi (bất biến 2), không đổi đường lưu/băm, không xóa gì.
- `video-controller.ts` (hàng hoàn): `VideoPorts.wasInterrupted?` -> `saveOpeningVideoRecorded({ interrupted })` (trường đã có, đã gắn nhãn "Hạn chế bằng chứng" `interrupted_opening_video`).
- `packing/domain/camera-end.ts` (mới): `classifyCameraEnd({ stopRequested, elapsedMs, limitSeconds })` -> `'requested' | 'limit' | 'early'` (dời `LIMIT_TOLERANCE_MS` từ `PackRecordLive`). `early` = camera tự trả kết quả trước hạn mà không ai bảo dừng (bị hệ thống ngắt) -> gián đoạn.

**Màn quay (`PackRecordLive.tsx`, `ReturnRecordLive.tsx` `LiveCamera`):**
- `useKeepScreenAwake(phase !== 'failed')`: sáng suốt lúc chuẩn bị, đang quay và đang lưu (băm JS có thể lâu; màn tự khóa sẽ đẩy app vào nền và iOS tạm dừng JS); tắt khi lỗi hoặc rời màn (lưu xong tự chuyển màn).
- `subscribeAppBackground` khi màn mở: đang quay (`phaseRef === 'recording'`, có `active`, người dùng chưa bấm dừng) -> `interrupted = true`, `requestStop()` (dừng đúng một lần), dải báo "Đã dừng quay vì ứng dụng chuyển sang nền. Đang lưu phần đã quay.", hẹn `onceAppActive` hiện toast "Đã dừng quay vì ứng dụng chuyển sang nền. Ứng dụng không tự quay tiếp."; đang khởi động ghi (`started`, chưa có `active`) -> `pendingStop` + `interrupted` như trên; pha khác: không làm gì. Đăng ký hủy khi gỡ màn; toast hẹn trước vẫn hiện (ToastProvider ở gốc) vì có thể màn đã chuyển sang Xác nhận khi app ở nền.
- Camera trả kết quả `early` -> `interrupted = true` (không toast "vào nền" vì không biết nguyên nhân).
- `wasInterrupted: () => interruptedRef.current` vào cổng.
- Dòng chú thích Q-24b dưới nút dừng: prop mới `footnote` của `RecordingFrame` (chữ nhỏ trên nền mờ, token sẵn có). Chỉ màn ghi thật truyền (chế độ xem trước không ghi gì nên không nói "đoạn đang quay có thể mất").
- Hàng hoàn: lưu xong mà hồ sơ chưa ghi nhận (`recordedInCase = false`) thì cờ gián đoạn được giữ trong bộ nhớ của màn cha cho bước đối soát (`recordOpeningVideo(…, interrupted)`).
- `holdSessionGates` (V1-06) nằm ở `SessionGate latch` của route, không đụng.

**Xác nhận UI-C04:** phiên `interrupted` có tệp đã lưu -> thêm một dòng cảnh báo "Video bị gián đoạn giữa chừng, có thể thiếu phần sau." (A06 "thông báo gián đoạn"). Xác nhận vẫn cho phép (bảng chuyển `interrupted -> confirmed` đã có).

**Trợ giúp:** bài hỏi đáp `recordingLimits` (FAQ, không bước): "Đang quay mà ứng dụng bị tắt thì sao?".

**Ngoài phạm vi:** kiểm tra pin/nhiệt độ (UI-C02) cho D04: kế hoạch V1-11 không yêu cầu; giữ ghi chú cũ trong `ReturnRecordLive`. Chia đoạn video (PR8, Q-24b = A), tải nền, tự quay tiếp.

**Migration/Rules/Functions/mã lỗi:** không.

## Tệp

`package.json`, `package-lock.json`, `src/platform/{keep-awake.ts (mới), app-state.ts, index.ts, README.md}`, `jest.setup.ts`, `src/test-utils/{mock-keep-awake.ts, mock-app-state.ts}` (mới), `src/features/packing/domain/{camera-end.ts (mới), recording-controller.ts, index.ts}`, `src/features/packing/ui/{PackRecordLive.tsx, PackConfirmScreen.tsx}`, `src/features/returns/domain/video-controller.ts`, `src/features/returns/ui/ReturnRecordLive.tsx`, `src/shared/ui/RecordingFrame.tsx`, i18n `screens.json`, `personal.json`, `src/features/personal/domain/help-content.ts`, tài liệu.

## Test

- `keep-awake.test.ts` (adapter thật, mock `expo-keep-awake`): bật/tắt theo tag, gỡ màn thì tắt, đổi `active` không đổi thì không gọi lại, lỗi thư viện không ném.
- `app-state.test.ts`: chỉ `background` gọi; `inactive` không; `onceAppActive` gọi một lần rồi tự hủy.
- `camera-end.test.ts`: bảng phân loại.
- `recording-controller.test.ts`, `video-controller.test.ts`: `wasInterrupted` -> `interrupted` / `interrupted: true`; mặc định như cũ.
- `PackRecordScreen.background.test.tsx`, `ReturnRecordScreen.background.test.tsx`: giữ sáng đúng pha và đúng một lần, tắt khi lỗi/gỡ màn; vào nền khi ghi -> dừng đúng một lần, phiên `interrupted`, ID phiên/kiện không đổi, toast khi quay lại; `inactive` không dừng; vào nền khi chuẩn bị chưa ghi -> không làm gì; sau khi gỡ màn không dừng; camera tự dừng sớm -> `interrupted`; dòng Q-24b hiện; vào nền khi đang lưu không đổi trạng thái.
- UI-C04: phiên `interrupted` hiện câu cảnh báo.

## Màn cần chụp (bản web, cổng giả)

UI-C03 với cờ ghi bật (web không có camera: hiện khung "cần camera") có dòng chú thích; dải "đã dừng vì vào nền" (thay đổi tạm trong bản sao); UI-C04 phiên bị gián đoạn (thay đổi tạm); bài Trợ giúp mới.

## Rủi ro

- Hành vi `expo-camera` khi app vào nền lúc đang ghi **chỉ biết trên máy thật** (cổng G-4): iOS có thể đã tự kết thúc tệp trước khi JS nhận `background`; JS có thể bị tạm dừng trước khi lưu/băm xong -> khôi phục bằng `recoverInterruptedRecordings` lúc mở lại (đã có). Thứ tự sự kiện `background` và kết quả camera không bảo đảm: nếu camera trả trước, phiên vẫn `interrupted` (nhánh `early`) nhưng không có toast "vào nền".
- Cập nhật phiên sang `interrupted` lỗi (lỗi kho) -> phiên kẹt `recording`, lần mở app sau đối chiếu về `ended` (mất dấu gián đoạn; hiếm). Hàng hoàn: app bị kill giữa lúc lưu xong và lúc ghi vào hồ sơ thì đối soát ghi `interrupted: false` (cờ chỉ trong bộ nhớ).
- Kích thước ước tính ~350 dòng mã (ngoài test/tài liệu).

## Tự review

Vòng 1: (1) Bản nháp dừng cả khi `inactive` theo kế hoạch tổng: iOS báo `inactive` cho hộp thoại hệ thống và Trung tâm điều khiển -> dừng oan, phiên bị đánh gián đoạn sai (bất biến 11 theo chiều ngược). Sửa: chỉ `background`; cuộc gọi làm camera bị ngắt thì đi nhánh `early`. (2) Bản nháp tắt giữ sáng khi bấm dừng: lúc băm JS nếu màn tự khóa thì iOS đưa app vào nền, việc lưu treo tới khi mở lại. Sửa: giữ sáng tới khi lưu xong (màn tự chuyển). (3) Toast gắn với màn quay sẽ mất nếu lưu xong lúc app ở nền (màn đã chuyển sang Xác nhận). Sửa: hẹn toast qua `onceAppActive` + câu cảnh báo bền ở UI-C04 theo trạng thái phiên. (4) Bất biến 2: không đổi trình tự tạo bản ghi; ID phiên/kiện chụp lúc mở màn. Bất biến 4/6: không ghép, không quay tiếp, không xóa; lưu nốt phần đã ghi qua đúng đường cũ. Bất biến 3: không trạng thái/sự kiện tệp mới; "gián đoạn" là trạng thái phiên đã có. Bất biến 11: câu chữ không hứa "đã lưu" khi vào nền (chỉ "đang lưu phần đã quay"), không hứa tải/quay nền. (5) Dòng Q-24b chỉ ở chế độ ghi thật để không nói sai khi cờ tắt.

Tự review: đã chấp nhận.
