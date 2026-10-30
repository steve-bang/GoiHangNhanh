# V1-15 account-delete-client: kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (xóa tài khoản), 3.3 V1-15 (gồm phần "Xóa dở dang" thêm sau review V1-14), 7.5 (R-2 = A, R-4 = A "sau 30 ngày"); [decisions.md](../decisions.md) Q-29 / V1-14 (a–m), Q-29 / V1-20 điểm 11 (câu chung), Q-29 / V1-07 điểm 6 (tệp của tài khoản khác). Máy chủ (`deleteAccount`, `createShop` trả `account_deleted`) đã có ở V1-14.

## Mục tiêu

Người dùng xóa được tài khoản trong app (bản Firebase), an toàn và trung thực: chặn khi đang quay, khi còn hồ sơ tranh chấp mở trên máy (bất biến 9) và khi máy còn dữ liệu của tài khoản khác; cảnh báo + tích xác nhận riêng khi còn tệp chưa tải (R-2 A); xác thực lại bằng mật khẩu rồi gọi `deleteAccount`; **chỉ sau khi máy chủ xác nhận** mới xóa dữ liệu trên máy theo thứ tự bền có dấu ngoài CSDL; xóa dở dang (`account_deleted`) có màn riêng.

## Không làm

- Không đổi Functions/Rules (V1-14 đã có). Không migration (chỉ `DELETE` dữ liệu, giữ schema).
- Không xóa chọn lọc theo uid (xem "Tài khoản khác" dưới). Không đổi giao diện màn khách đã xác nhận (Chào mừng, Tạo cửa hàng): chỉ thêm logic điều hướng/toast.
- Không khôi phục tài khoản. Không tạo `public-links.ts` (V1-18).

## Thiết kế

### Hợp đồng và cổng

- `AuthApi.deleteAccount({ password })` (đặt trong `auth` thay vì namespace `account` mới của kế hoạch: cùng chỗ với `changePassword`, không đổi cấu trúc `ApiClient`). Firebase: `reauthenticateWithCredential(email, password)` -> `getIdToken(true)` -> callable `deleteAccount`; kết quả phải có `status` hợp lệ, không thì coi là lỗi (không xóa gì cục bộ). Ánh xạ: sai mật khẩu -> `AUTH_WRONG_CURRENT_PASSWORD`; `details.reason`: `requires_recent_login` -> `AUTH_REQUIRES_RECENT_LOGIN`, `shop_has_members` -> `ACCOUNT_DELETE_SHOP_HAS_MEMBERS` (mới, đề xuất), `account_deleted` -> `ACCOUNT_DELETION_PENDING` (mới, đề xuất); mạng -> `AUTH_NETWORK_ERROR`. `createShop` gặp `account_deleted` -> `ACCOUNT_DELETION_PENDING`.
- Bản giả (`FakeAuthApi`), "chưa kết nối", bộ test hợp đồng; `AccountGateway.deleteAccount(password)` ở cổng cá nhân giả/Firebase/chưa kết nối. Cổng giả có mật khẩu mô phỏng mất mạng để chụp ảnh.

### Điều kiện (`delete-account-conditions.ts`)

| Mục | Nguồn | Trạng thái |
|---|---|---|
| Đang quay | `hasRecordingOnDevice` | chặn |
| Tranh chấp mở | `DisputeStore.countOpenOnDevice()` (mới, mọi shop trên máy) | chặn |
| Dữ liệu tài khoản khác | `LocalDeviceData.countForeignRecords(uid)` (mới: đơn/kiện/phiên/hồ sơ hoàn/ảnh-video hoàn/tranh chấp có `created_by` khác uid hoặc NULL) | chặn |
| Tệp chưa tải | `countUnsyncedOnDevice` | cảnh báo + tích riêng "N tệp chưa tải lên sẽ bị xóa khỏi máy này và không thể khôi phục" |
| Chủ cửa hàng | `listShops` | thông tin, câu chung 30 ngày |

Đọc lỗi (`null`) = "Chưa kiểm tra được" = chặn (không bao giờ coi là đạt).

**Tài khoản khác (V1-07 điểm 6):** dữ liệu trên máy liên kết chéo (phiên của B trên đơn của A, ảnh của A trong hồ sơ của B, tranh chấp tham chiếu bằng chứng của người khác); xóa chọn lọc dễ sai và có thể xóa bằng chứng của người khác. Chọn **chặn và giải thích** (an toàn nhất): máy còn bất kỳ bản ghi nào không chắc là của chính tài khoản thì không xóa trong app; người dùng vẫn xóa được qua trang web/hỗ trợ (kênh `support` của V1-14, không đụng máy). v1 là một máy một tài khoản (Q-24a A) nên hiếm.

### Xóa dữ liệu cục bộ (`features/orders/data/wipe-local-data.ts`)

- `createLocalDataWiper({ marker, deleteEvidenceFiles, wipeDatabase, signOutLocal })`: `run()` = (1) đặt dấu, (2) xóa mọi tệp trong `evidence/`, (3) `DELETE` mọi bảng nghiệp vụ trong một giao dịch (giữ `user_version`, schema và `device_settings` là cài đặt của máy), (4) thoát phiên Auth trên máy (lỗi bỏ qua), (5) gỡ dấu. Bước nào lỗi thì dừng, giữ dấu. `resumeIfPending()` thấy dấu thì chạy lại từ (1)/(2). Mọi bước idempotent.
- Lệch có chủ đích với thứ tự kế hoạch ("gỡ dấu -> thoát"): thoát Auth trên máy **trước** khi gỡ dấu, để app bị tắt giữa hai bước không để lại phiên Auth của tài khoản đã xóa mà không có dấu nào nhắc dọn. Trạng thái phiên trong bộ nhớ (`signed_out`) vẫn xả sau cùng.
- Dấu: `platform/local-wipe-marker.ts`, tệp `Paths.document/.pending-local-wipe`, nội dung chỉ là phiên bản định dạng (không PII), đồng bộ (`File.exists`) để đọc được ngay khi dựng cây. `platform/recording-files.ts` thêm `deleteAllEvidenceFiles()`.
- Bảng cần xóa khai báo một nơi; test đối chiếu với `sqlite_master` (bảng mới ở migration sau mà quên thêm thì test đỏ).

### Gắn vào app

- `LocalWipeProvider` (`features/personal/ui`), đặt trong `Providers.tsx` ngay sau `ToastProvider`: trạng thái `ready | wiping | failed`, khởi tạo đồng bộ từ dấu (có dấu -> `wiping` ngay lần render đầu, chạy lại TRƯỚC khi gắn runner). Runner (`RecordingRecovery`, `ReturnMediaRecovery`, `OrderSyncRunner`, `ReturnSyncRunner`) chỉ gắn khi `ready`; `UploadRunner` thêm prop `enabled`. Khi không `ready`: lớp phủ toàn màn "Đang xóa dữ liệu trên máy này" / lỗi có "Thử lại" (chặn thao tác, không đổi điều hướng).
- Xong: phiên `signed_out`, `reset` về Chào mừng, toast ở trên đầu (không đổi giao diện Chào mừng).

### Màn hình

- **UI-I05 Xóa tài khoản** (không thuộc danh sách khách đã xác nhận): điều kiện thật, khối "Dữ liệu sẽ ra sao" trung thực (câu chung 30 ngày nguyên văn), hộp "Tôi hiểu và đồng ý" + hộp riêng cho tệp chưa tải -> nút "Xóa tài khoản" bật -> bước nhập mật khẩu tại chỗ -> gọi cổng -> xóa cục bộ. Lỗi: sai mật khẩu gắn ô; mạng/máy chủ: thông báo + "Chưa có gì bị xóa".
- **Đang hoàn tất xóa tài khoản** (route mới `/account-deletion-pending`, ngoài tab, không cần shop): giải thích, cùng điều kiện máy, nhập mật khẩu -> `deleteAccount` -> xóa cục bộ; nút Đăng xuất (luồng đăng xuất an toàn). Vào từ Tạo cửa hàng khi `createShop` trả `ACCOUNT_DELETION_PENDING` (chỉ đổi logic).
- Liên kết web `/xoa-tai-khoan/`: `LEGAL_LINKS.accountDeletion` giữ chỗ `.invalid` -> hàng bị ẩn tới V1-18 (TODO ghi rõ).

## Test

- Điều kiện: tranh chấp mở/đang quay/tài khoản khác/đọc lỗi chặn; tệp chưa tải cần tích thêm.
- Wiper: thứ tự gọi (adapter giả ghi nhật ký); lỗi máy chủ không gọi gì; kill sau bước 1, 2, 3, 4 rồi khởi động lại -> chạy lại từ đầu, kết quả giống chạy một lần, dấu bị gỡ; không có dấu -> không làm gì; dấu không nằm trong CSDL.
- `wipeDatabase` trên `node:sqlite`: đủ migration, mọi bảng trừ `device_settings` rỗng, `user_version` giữ, gọi lại được; `countForeignRecords`.
- `LocalWipeProvider`: có dấu -> runner chưa gắn tới khi xong; không dấu -> gắn ngay.
- Màn: nút bật/tắt theo điều kiện, mật khẩu sai, mạng lỗi không xóa gì, thành công gọi wiper rồi về Chào mừng; màn hoàn tất.
- Hợp đồng `deleteAccount` (giả + Firebase qua `FirebaseOps` giả: thứ tự reauth -> token mới -> callable; ánh xạ `details.reason`).

## Ảnh

UI-I05: đạt; chặn tranh chấp mở; cảnh báo tệp chưa tải; bước mật khẩu; mật khẩu sai; lỗi mạng; màn Đang hoàn tất; Chào mừng sau khi xóa (toast). Bản web + cổng giả, dữ liệu dựng bằng thay đổi tạm trên nhánh nháp.

## Rủi ro

- Xóa tệp cục bộ (kể cả chưa tải) là ngoại lệ có chủ đích với bất biến 4 (R-2 A): ghi `docs/06`, đề xuất câu CLAUDE.md.
- Lời gọi tải lên đang chạy khi xóa không bị hủy ngay (runner chỉ dừng lượt sau); các cập nhật sau đó là `UPDATE` theo id, không còn hàng nào để ghi.
- RNFirebase: mã lỗi callable và `details` chưa kiểm chứng trên thiết bị; `auth_time` sau `getIdToken(true)` chưa kiểm chứng trên dự án thật.
- Tệp tạm của camera (thư mục cache) không bị xóa (hệ điều hành dọn).

## Tự review

Vòng 1: (a) bất biến 4: chỉ xóa sau máy chủ xác nhận; có cảnh báo + tích riêng; (b) bất biến 9: chặn khi còn tranh chấp mở, cả ở màn hoàn tất; (c) bất biến 5: không xóa dữ liệu không chắc của mình -> chặn; (d) dấu nằm ngoài CSDL, đọc đồng bộ trước khi gắn runner; (e) nguy cơ dấu còn sót làm xóa dữ liệu của lần đăng nhập sau: dấu chỉ đặt sau khi máy chủ xác nhận, lớp phủ chặn mọi thao tác tới khi gỡ dấu, nên không thể đăng nhập tài khoản khác khi còn dấu.
Đã sửa: đổi thứ tự thoát Auth trước gỡ dấu (e); thêm điều kiện "dữ liệu tài khoản khác" thay vì xóa chọn lọc; màn hoàn tất dùng lại điều kiện máy (không xóa dữ liệu tranh chấp mở chỉ vì máy chủ đã khóa shop).

Tự review: đã chấp nhận.
