# V1-29 — server-playback

Nguồn: yêu cầu "Xem lại bằng chứng từ máy chủ khi tệp trên máy không còn" (người dùng, 2026-11-01); kế hoạch kỹ thuật được duyệt trong phiên. Quyết định: `decisions.md` `#### Q-29 / V1-29`.

## Mục tiêu

Bằng chứng đã được máy chủ xác nhận (`uploaded`/`verified`) luôn xem lại được. Ưu tiên tệp trên máy; mất hoặc phát lỗi thì dùng URL ký ngắn hạn của máy chủ. Không đổi luồng quay, lưu, tải lên; không tải ngược về máy (bất biến 4); không URL công khai vĩnh viễn (bất biến 8).

## Đường dẫn

| Việc | Tệp |
|---|---|
| Function + logic thuần | `firebase/functions/src/evidence-read.ts`, `index.ts` (`getEvidenceReadUrl`), lý do mới `not_server_confirmed` ở `uploads.ts` |
| Test server (kể cả chéo shop) | `firebase/tests/functions/evidence-read.test.ts` |
| Chọn nguồn phát | `src/features/evidence/domain/local-playback.ts` (`local`/`cloud`/`capturing`/`missing`) |
| Cổng xin URL | `src/features/evidence/data/read-url.tsx` (qua `RemoteDocuments.callFunction`), cấp ở `src/bootstrap/Providers.tsx` |
| Hook | `src/features/evidence/ui/use-evidence-read-url.ts` |
| Giao diện | `src/features/evidence/ui/EvidenceDetailView.tsx`, `src/platform/video-player.tsx` (`VideoPlayer`, nhận https, `useCaching:false`) |
| Ảnh hàng hoàn | `src/features/returns/ui/ReturnPhotosSection.tsx` (nút Xem khi máy chủ đã xác nhận) |

## Việc người dùng phải làm

- Sửa lỗi HTTP 500 của `createUploadSession` (không nằm trong PR; nguyên nhân thường gặp: thiếu IAM Service Account Token Creator, F-5) trước khi có tệp `uploaded` để thử.
- Đồng ý rồi deploy `getEvidenceReadUrl` (dự án dev `ghn-test-67b39`); G-14 trên thiết bị thật.
- Hạn chế đã biết: URL hết hạn giữa chừng khiến phát lại từ đầu (chưa giữ vị trí tua).
