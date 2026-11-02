# Ảnh các màn đã làm, có dữ liệu mẫu (UI-E02, UI-C03, UI-C04, UI-C06)

**Ảnh render bản web (react-native-web, Chromium, cổng giả), KHÔNG phải iOS/Android thật.** Font, bóng, vùng an toàn, chữ lớn hệ thống, trình phát video và camera khác thiết bị. Chưa chụp chữ lớn.

**Dữ liệu mẫu giả** (mã `DH-DEMO-…`, mã vận đơn `…-DEMO-…`, video thử 5 giây do `ffmpeg` tạo, cố tình ghi "thời lượng 01:12" ở bản ghi tệp). Mã nạp dữ liệu và các vá tạm adapter web (kho bộ nhớ, `recordingExists`/`resolveRecordingUri` giả, dung lượng trống giả, cờ ghi video bật) chỉ ở **bản sao ngoài repo**, không có trong repo.

Kích thước: `390x844` và `320x568` (đủ cho mỗi ảnh; 360x800 không đưa vào để gọn).

| Ảnh (tiền tố) | Màn | Kịch bản |
|---|---|---|
| `e02-a-chua-quay` | UI-E02 | 2 sản phẩm, có mã vận đơn, chưa có phiên |
| `e02-b-da-quay` | UI-E02 | đã có phiên: hàng Sửa bị tắt kèm lý do |
| `e02-c-chua-khai-bao-sp` | UI-E02 | chưa khai báo sản phẩm, chưa mã vận đơn |
| `e02-d-khong-tim-thay` | UI-E02 | ID lạ |
| `c04-a-da-luu-co-trinh-phat` | UI-C04 | video đã lưu, trình phát + thời lượng |
| `c04-b-dang-luu` | UI-C04 | tệp kẹt "đang lưu" từ lần mở trước → sau khởi động được xử lý thành "chưa lưu được" (xem ghi chú) |
| `c04-c-gian-doan` | UI-C04 | phiên bị gián đoạn: thẻ cảnh báo |
| `c04-d-nhieu-video-mot-phan` | UI-C04 | 1 video lưu + 1 tệp lỗi lưu |
| `c04-e-khong-thay-phien` | UI-C04 | không có phiên |
| `c06-a-cho-tai-len`, `c06-b-da-tai-len`, `c06-c-mot-phan` | UI-C06 | chờ tải lên / đã tải lên / một phần |
| `c03-quay`, `c03-quay-chuan-bi` | UI-C03 | **lỗi thật trên web** (xem dưới) |

## Không chụp được / lưu ý trung thực
- **UI-C03 "Đang quay" (badge + đồng hồ) không chụp được:** `CameraRecorder` không ghi được trên web nên màn báo "Camera dừng đột ngột. Video chưa được lưu." (đây là trạng thái lỗi thật nhưng không phải thứ cần minh họa). Ảnh `c03-*` chỉ chứng minh nhánh lỗi. "Đang quay", nút Dừng tắt lúc chuẩn bị mới có test, chưa có ảnh.
- **UI-C04 "đang lưu" không dựng được:** khởi động app xử lý tệp kẹt `saving_local` (khôi phục sau kill) thành lỗi lưu, nên ảnh `c04-b` là "chưa lưu được".
- Thông báo "Lần quay trước bị gián đoạn" (do phiên mẫu `interrupted` kích hoạt khôi phục khi mở app) đã được ẩn khỏi ảnh bằng script chụp; ở app thật nó hiện dạng toast.
- UI-E02 phiên đã quay vẫn ghi "Chưa có video đóng gói." dù phiên có tệp: nguồn `loadEvidenceItems` của màn đơn hiện luôn rỗng (đã ghi ở `layout.md` mục 2.6), không phải lỗi của ảnh.
