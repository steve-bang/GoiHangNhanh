# V1-30 storage-screen — kế hoạch và ghi chú triển khai

**Trạng thái: đã code (nhánh `feat/v1-30-storage-screen`, từ `main` `837b880`).** Người dùng giao điều phối tự quyết các điểm mở (lối vào, dòng tài khoản khác, khai báo riêng tư); các quyết định dưới đây do điều phối chốt thay người dùng, chưa có xác nhận trực tiếp. Chưa chạy trên thiết bị.

## Vấn đề
UI-F03 (`/sync/storage`) chỉ là `PlaceholderScreen`, không lối vào. Người dùng không có chỗ nào biết đã đồng bộ lên máy chủ bao nhiêu dung lượng; Trung tâm đồng bộ chỉ nêu số tệp (chủ ý, bất biến 11), thẻ Dữ liệu bằng chứng chỉ đếm tệp.

## Quyết định
- **Phạm vi đếm (người dùng chốt):** chỉ tệp của shop đang dùng VÀ do chính tài khoản đang đăng nhập tạo. Tệp tài khoản khác/không rõ người tạo (`other`, `unknown`) không cộng, chỉ đếm một dòng "Máy còn có N tệp của tài khoản khác, không tính ở đây". Ảnh hàng hoàn do chính tài khoản chụp trong hồ sơ của người khác chưa đăng (`case_owner`) vẫn tính là của mình (tệp do mình tạo, nằm trên máy).
- **Ba nhóm theo trạng thái tệp** (bất biến 3): Đã lên máy chủ = `uploaded`/`verified`; Chưa lên máy chủ = chờ, đang tải, lỗi, `hash_mismatch`...; Chưa có bản lưu trên máy = `recording`, `saving_local`, `local_save_failed`, `unrecoverable` (chỉ số tệp, không byte).
- **Trung thực:** tệp chưa biết cỡ không cộng như 0 byte mà báo "có N tệp chưa rõ dung lượng, nên tổng có thể thấp hơn thực tế". Không "an toàn", không phần trăm, không hạn mức/hạn lưu (D-4), không nút xóa/giải phóng (Q-30g A cho 1.0). Câu nhắc: tệp chưa lên máy chủ có thể mất nếu gỡ app hoặc đổi máy (Q-24a, V1-01, V1-12).
- **Lối vào:** hàng "Dung lượng trên máy" ở màn Dữ liệu bằng chứng (Cá nhân), cạnh Thời hạn lưu. Kế hoạch gốc (mục 2.3) giữ khung không lối vào; V1-30 đổi điều đó có chủ đích.
- **Quyền riêng tư store:** màn chỉ cộng `size_bytes` từ SQLite, không gọi API dung lượng ổ đĩa, nên không thêm lý do `85F4.1`; nếu sau này hiện dung lượng trống/tổng của máy thì phải thêm (C-4).

## Thiết kế
- `core/format/format-bytes.ts`: `formatBytes` (cơ số 1024, dấu phẩy thập phân).
- `upload/domain/storage-usage.ts`: `loadStorageUsage(stores, shopId, uid)` hàm thuần, dùng `loadSyncJobs` với mọi trạng thái (tái dùng phân loại người tạo của Trung tâm đồng bộ). Không migration, không đổi Rules/Functions, không gọi mạng.
- `upload/ui/use-evidence-stats.ts`: `useStorageUsage` trên `useLocalStats` (nạp khi focus và sau mỗi lượt hàng đợi, không định kỳ; đổi shop không hiện số cũ).
- `upload/ui/StorageScreen.tsx` thay khung; chuỗi ở `screens:storage.*`, `personal:evidenceData.storageRow`.

## Rà soát UI/UX (sau lần đầu)
Bỏ ba dòng giải thích lặp lại nhãn; chỉ còn một dòng phạm vi, và các dòng chỉ hiện khi đúng tình huống (rủi ro mất tệp khi có tệp chưa lên máy chủ; tệp chưa rõ cỡ; tài khoản khác). Hàng "Chưa có bản lưu trên máy" chỉ hiện khi có tệp; máy trống hiện một câu thay vì hai hàng "0 tệp · 0 B".

## Giới hạn đã biết
- Số liệu chỉ là phần máy này biết: tệp đã xóa khỏi máy hoặc ở máy khác không có trong tổng; màn nói rõ "trên máy này", không phải tổng dung lượng đám mây của shop.
- `loadSyncJobs` đọc mọi tệp của shop kèm tra phiên/đơn/hồ sơ (có đệm theo id): ổn với số tệp hiện tại, chưa đo trên máy nhiều nghìn tệp.
- Chưa chạy trên thiết bị (G-14).

## Test
`format-bytes.test.ts`, `storage-usage.test.ts` (trạng thái, tài khoản khác/không rõ, `case_owner`, shop khác, cỡ chưa biết, > 4 GiB), `StorageScreen.test.tsx` (trống, có tệp, lỗi, không nút xóa, mở UI-F01), `EvidenceRetentionScreens.test.tsx` (lối vào).
