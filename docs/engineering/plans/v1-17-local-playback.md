# V1-17 local-playback — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (Q-24a: xem lại video trên chính máy đưa vào v1), 3.0, 3.3 V1-17, 7.5. Quyết định nhỏ: [decisions.md](../decisions.md) `Q-29 / V1-17`.

## Mục tiêu

Người bán xem lại bằng chứng ĐÃ GHI trên chính máy này (phát video/hiện ảnh từ tệp cục bộ) ở màn UI-E04 thật (trước là khung), mở từ Bằng chứng của đơn (UI-E03). Tra theo `evidenceId` (bất biến 1), chỉ đọc (bất biến 4), nhãn trạng thái tệp thật (docs/09 mục 3), giờ thiết bị ghi rõ (bất biến 11). Tệp không còn trên máy: nói thẳng "Video không còn trên máy này.", không hứa xem từ máy chủ (v1 chưa có URL xem).

## Tệp đổi

| Tệp | Thay đổi |
|---|---|
| `package.json`, `package-lock.json` | `expo-video@~58.0.12` (bản `bundledNativeModules.json` của SDK 58; npm cài 58.0.13) |
| `app.json` | Plugin `expo-video` với `supportsBackgroundPlayback: false`, `supportsPictureInPicture: false` (không phát nền, không thêm `UIBackgroundModes audio`, không dịch vụ nền Android) |
| `src/platform/video-player.tsx` (mới) + test | Adapter `LocalVideoPlayer` trên `useVideoPlayer`/`VideoView`: `{ uri, useCaching: false }`, thanh điều khiển hệ điều hành, không tự phát, không PiP, báo `onError` khi `statusChange` = `error` |
| `src/test-utils/mock-video-player.tsx` (mới), `jest.setup.ts` | Mock chung adapter (expo-video là native) |
| `src/features/evidence/domain/local-playback.ts` (mới) + test | Hàm thuần `localPlaybackOf` (`capturing`/`missing`/`available`), `formatFileSize`, `formatDuration`, `shortHash`, `shortId` |
| `src/features/evidence/ui/EvidenceDetailView.tsx` (mới) | Nội dung UI-E04: khung xem (video/ảnh/trạng thái thay thế), nhãn trạng thái + câu giải thích, thông tin tệp, mã băm rút gọn + câu "chỉ chứng minh tệp không đổi kể từ lúc tính", dòng "Chỉ xem lại" |
| `src/features/evidence/ui/screens.tsx` | Bỏ `EvidenceDetailScreen` khung, xuất `EvidenceDetailView` |
| `src/features/orders/ui/EvidenceDetailScreen.tsx`, `use-evidence-detail.ts` (mới) + test | Màn UI-E04 ở `features/orders` (cần đơn/kiện/phiên; tránh phụ thuộc vòng, giống UI-E03); nạp theo `evidenceId` + shop hiện tại; tệp thuộc đơn khác đơn trên đường dẫn = không tìm thấy |
| `src/features/orders/ui/OrderEvidenceScreen.tsx` + test | Mỗi mục là vùng chạm mở UI-E04 (`ROUTES.evidenceDetail`, `{ orderId, evidenceId }`); nút "Mở trung tâm đồng bộ" của tệp lỗi nằm ngoài vùng chạm |
| `src/app/(tabs)/orders/[orderId]/evidence/[evidenceId].tsx` | Trỏ sang `@/features/orders` |
| i18n `evidence.json` (`detail.*`), `screens.json` (`orderEvidence.openDetail`) | Chuỗi mới (chờ BA) |
| Tài liệu | `decisions.md` Q-29 / V1-17, `layout.md`, `architecture.md`, `testing.md`, `CHANGELOG.md`, ảnh `docs/assets/screens/v1-17-local-playback/` |

## Thiết kế

- **Chỉ đọc:** adapter chỉ nhận URI, `useCaching: false` (không sao bản tạm), không gọi API tệp nào ngoài `recordingExists`/`resolveRecordingUri` (đọc). Màn không có nút xóa/sửa/cắt/chia sẻ.
- **Không mở tệp chưa đóng:** `recording`/`saving_local` -> "Video đang được lưu." (hiện trạng thái pha ghi), không hỏi hệ tệp.
- **Tệp mất:** không có `localPath` hoặc `recordingExists` = false -> "Video không còn trên máy này." + "Ứng dụng chưa hỗ trợ xem lại tệp từ máy chủ." Nhãn trạng thái tệp vẫn là trạng thái thật; câu giải thích nhãn ("Tệp vẫn được giữ trên thiết bị…") bị ẩn khi tệp đã mất, trừ `uploaded`/`verified` (câu nói về máy chủ). Không tự đổi trạng thái tệp (việc đó thuộc hàng đợi/khôi phục).
- **Lỗi phát** (`statusChange: error`, ảnh `onError`): "Không phát được video này." + "Tệp gốc trên máy vẫn được giữ nguyên."
- **Liên kết:** đơn (mã đơn chỉ hiển thị), kiện (số thứ tự theo `packageId` của tệp), phiên (trạng thái + giờ bắt đầu thiết bị + 6 ký tự cuối ID) theo `sessionId` của tệp (bất biến 2). Thiếu -> "Chưa rõ".
- **Cô lập shop:** `evidenceFiles.get(shopId, id)`; tệp shop khác, ID lạ, tệp gắn đơn khác -> không tìm thấy, không lộ mã đơn.
- **Hiệu năng:** lớp native đọc tệp, video không qua bộ nhớ JS. `recordingExists` đồng bộ (expo-file-system `File.exists`), gọi một lần mỗi lần đổi trạng thái/đường dẫn.
- **iOS/Android ngang hàng:** khác biệt nằm trong `expo-video`; không `Platform.OS`.

## Migration / Rules / Functions

Không.

## Phạm vi để sau (V1-17b)

Lối vào từ ảnh/video hàng hoàn (D03/D07) và từ G03 Tranh chấp: dữ liệu nằm ở kho `return_media` khác `evidence_files`, cần route mới ngoài `/orders/...` và màn nạp riêng; `EvidenceDetailView` đã tách để dùng lại. Ảnh hàng hoàn hôm nay đã có ảnh thu nhỏ ở D03.

## Test

- Adapter: nguồn `{ uri, useCaching: false }`, `nativeControls`, không PiP, `onError` chỉ khi `error`.
- Domain: `localPlaybackOf` đủ nhánh, định dạng.
- Màn UI-E04 (adapter giả): tệp có -> trình phát đúng URI + thông tin; 6 trạng thái -> đúng nhãn, không "Đã xác minh" khi chưa `verified`; tệp mất; tệp mất + `verified`; `saving_local`; lỗi phát (không gọi xóa/di chuyển tệp); ảnh; chỉ có 1 nút (Quay lại); tệp đơn khác; shop khác; thiếu tham số; lỗi kho.
- UI-E03: chạm mục -> `evidenceDetail` với `{ orderId, evidenceId }`.
- `npm run check`, `expo export` ios/android, `expo prebuild --no-install` trên bản sao ngoài repo (kiểm Info.plist không có `UIBackgroundModes audio`, manifest không có `FOREGROUND_SERVICE_MEDIA_PLAYBACK`).

## Màn cần chụp

UI-E04: video có tệp (web: thẻ `<video>`, có thể không phát được tệp giả), ảnh, tệp không còn trên máy, đang lưu; UI-E03 có mục bấm được. Bản web cổng giả kho bộ nhớ rỗng -> cần thay đổi tạm (nạp tệp mẫu), ghi trong README ảnh.

## Rủi ro

- Native mới: chỉ biết build được khi EAS/Xcode (cùng lớp rủi ro với các module Expo khác của SDK 58). Gỡ được bằng cách bỏ gói + plugin, UI-E04 hiện "Không phát được video".
- Video dài/tua trên máy yếu, định dạng HEVC từ iPhone trên Android (không áp dụng: tệp phát trên chính máy đã quay) — chỉ biết trên thiết bị (G-6).
- Tệp đổi tên thư mục container iOS: đã xử lý ở `resolveRecordingUri`.
- `FullscreenPlayerActivity` của expo-video khai `supportsPictureInPicture` trong manifest thư viện; nút PiP vẫn tắt ở `VideoView`.

## Tự review

Vòng 1: (1) bất biến 4 — kiểm adapter không cache, màn không nút sửa/xóa, test lỗi phát không gọi `deleteRecording`/`persistRecording`. (2) bất biến 3/11 — nhãn qua `toDisplayStatus`; sửa: câu giải thích "vẫn được giữ trên thiết bị" có thể sai khi tệp mất -> ẩn khi tệp mất (trừ `uploaded`/`verified`). (3) bất biến 1/2/8 — tra theo ID + shop; sửa: thêm kiểm tệp phải thuộc đơn trên đường dẫn. (4) Kích thước: ~550 dòng mã mới + ~130 dòng sửa (< 800); thêm hàng hoàn/tranh chấp sẽ vượt và chạm bảng route -> tách V1-17b. (5) Không tự phát, không phát nền (plugin đặt `false` để không thêm quyền nền).

Vòng 2: không còn điểm vi phạm; câu chữ mới ghi chờ BA ở decisions.

**Tự review: đã chấp nhận** (điểm đã sửa: ẩn câu giải thích khi tệp mất; kiểm tệp thuộc đơn trên đường dẫn; tách V1-17b).
