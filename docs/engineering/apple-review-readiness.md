# Sẵn sàng qua App Review (iOS) — danh sách kiểm tra trước khi nộp

> **Trạng thái:** bản nháp đánh giá, soạn 2026-11-02, đối chiếu với `release-checklist.md`, `docs/store/*` và mã ở nhánh hiện tại. Không phải quyết định D-xx. Mã mục (D/F/S/G/C/P) là mã trong [release-checklist.md](release-checklist.md); mục nào chưa làm thật thì **không đánh dấu**.
>
> **Ước lượng chủ quan, không phải số liệu của Apple:** nộp ngay hôm nay ~85–95% bị từ chối; sau khi xong các mục "Chặn nộp" dưới đây ~30–45% bị từ chối lượt đầu; ~10–15% còn bị từ chối sau lượt sửa thứ hai.

## 1. Chặn nộp (không xong thì gần như chắc chắn bị từ chối)

| # | Guideline | Vấn đề hiện tại | Việc cần làm | Mục checklist |
|---|---|---|---|---|
| 1 | 2.1 (hoàn thiện, không crash) | Chưa mô-đun native nào chạy trên thiết bị thật; iOS `useFrameworks: dynamic` + Crashlytics chưa từng build | Build EAS `staging`, chạy QA-01…14 trên iPhone thật; nếu SPM/Crashlytics hỏng quá 1 ngày thì tách V1-16 khỏi v1 | S-1…S-4, S-3b, G-0, G-1…G-14 |
| 2 | 2.1(a), 5.1.1(i) (URL hoạt động) | `PUBLIC_SITE_URL` = `https://don-chung.invalid`, email hỗ trợ `null`, tên/địa chỉ bên vận hành `null` | Điền tên miền, email, pháp nhân; đăng bốn trang web; `npm --prefix web run check:release` đạt; mở từng URL trên điện thoại | D-4, C-2, C-6, C-7 |
| 3 | 2.1 (thông tin cho người duyệt) | Chưa có tài khoản demo trên Firebase production; ghi chú còn `<…>` | Tạo tài khoản demo, đính kèm ảnh mã vạch `DH-DEMO-0001`, điền liên hệ thật | F-1…F-10, P-3, `docs/store/review-notes.md` |
| 4 | 2.1 (backend phải chạy lúc duyệt) | Rules/Functions chưa deploy lên dự án nào | Deploy lên dự án production trước khi nộp; kiểm IAM ký URL (thiếu thì tải lên trả 500) | F-4, F-4b, F-5 |
| 5 | 5.1.1(v) (xóa tài khoản trong app) | Có trong app nhưng chưa kiểm trên thiết bị và Firebase thật | Chạy G-8 đầy đủ; URL `/xoa-tai-khoan/` mở được | G-8, C-7 |
| 6 | 5.1.1(i) + App Privacy | Khai báo là bản nháp; chưa có Privacy Report từ archive | Tạo Privacy Report trong Xcode Organizer; không có `GoogleAppMeasurement`; điền App Privacy đúng bảng 3.1 | S-7, S-8, C-4 |
| 7 | 2.3 (metadata) | Chưa có ảnh chụp từ bản build thật; icon 1024 chưa chính thức | Chụp từ bản build thật (không dùng ảnh web cổng giả); icon không trong suốt | C-5, `listing.md` |

## 2. Rủi ro cao nhưng phụ thuộc quyết định

| Guideline | Rủi ro | Cách xử lý |
|---|---|---|
| 4.2 (chức năng tối thiểu), 2.1 | Nếu bản 1.0 nộp khi cờ ghi video còn **tắt** thì giá trị cốt lõi (quay bằng chứng) không có; người duyệt chỉ thấy quét mã + tạo đơn | Nộp bản có ghi video bật cho người duyệt chỉ sau khi cổng G đạt (V1-21). Không bật cho người dùng thật trước G; không nộp bản tắt cờ rồi bật sau bằng cập nhật mà không nói rõ trong ghi chú |
| 4.8 (đăng nhập bên thứ ba) | Hiện chỉ email + mật khẩu nên không áp dụng; thêm Google (O-15) mà thiếu Apple sẽ bị từ chối | Nếu thêm Google thì thêm Sign in with Apple cùng lúc |
| 5.1.1 (quyền) | Chuỗi quyền camera và vị trí phải khớp thực tế; vị trí chỉ lưu trên máy | Chạy G-12 (EXIF không có GPS); nếu có GPS thì dừng phát hành và sửa khai báo |
| 5.1.2 | Crashlytics bật mặc định (R-8) cần công khai trong chính sách và có công tắc | C-2, C-6; đã có công tắc ở UI-I05 |
| 2.5.x / ITSAppUsesNonExemptEncryption | Đã đặt `false` trong `app.json` | Kiểm lại trong `npx expo config` của profile production (S-4) |
| Sàn OS | iOS 15.1 là giả định kỹ thuật | Xác nhận sau `expo prebuild` (D-2) |

## 3. Đã đạt hoặc thấp rủi ro

- Xóa tài khoản có trong app, có cảnh báo tệp chưa tải, có trang web (5.1.1(v)) — cần kiểm thật ở G-8.
- Mô tả quyền camera nêu đủ cách dùng (5.1.1(ii)); không xin micro.
- Metadata không có tên sàn (Shopee, TikTok Shop, Lazada) — 2.3.7.
- Không SDK quảng cáo, không Analytics, không mua trong app.
- Crashlytics lọc PII bằng danh sách cho phép, không `setUserId`.

## 4. Thứ tự làm đề xuất (để giảm số vòng bị trả)

1. **Quyết định (con người):** D-1 bundle id, D-2 sàn OS, D-4 tên miền + email + pháp nhân.
2. **Hạ tầng:** F-1…F-10 (production), S-1, S-2, S-6.
3. **Build thử:** S-3 + S-3b (làm đầu tiên, vì rủi ro build native lớn nhất), S-7.
4. **Cổng thiết bị:** G-0…G-14 trên ma trận 2 iPhone + 2 Android.
5. **Pháp lý và nội dung:** C-1…C-7, rà `listing.md` và `privacy-declarations.md` khớp bản build.
6. **Gói nộp:** ảnh chụp từ bản build thật, tài khoản demo, ghi chú người duyệt (tiếng Anh, ≤ 4000 byte).
7. **Nộp:** TestFlight nội bộ → App Review → phased release (P-3).

## 5. Lý do Apple hay trả bản đầu của app kiểu này (để chuẩn bị sẵn câu trả lời)

- "Không đăng nhập được / cần tài khoản demo": tài khoản demo hết hạn hoặc Firebase production chưa bật Email/Password.
- "Không thấy tính năng chính": máy người duyệt trống (Q-24a). Ghi rõ cách tự tạo đơn; không hứa đơn mẫu.
- "Metadata/URL không hoạt động": còn `.invalid`.
- "Khai báo quyền riêng tư không khớp": SDK trong build khác bảng 3.1.
- "Hạn chế khi mạng chậm": backend ở `asia-southeast1`; người duyệt ở Mỹ có độ trễ cao, nên các lỗi mạng phải có thông báo, không treo (G-13).

## 6. Việc không làm được bằng mã

Mọi mục ở bảng 1 trừ #7 cần tài khoản store, thiết bị thật hoặc quyền deploy; xem `release-checklist.md`. Tài liệu này không thay các mục đó, chỉ sắp xếp theo mức rủi ro với App Review.
