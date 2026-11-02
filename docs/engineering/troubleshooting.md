# Nhật ký xử lý sự cố build và chạy trên thiết bị

Ghi lại lỗi đã gặp, nguyên nhân và cách sửa để lần sau không phải dò lại. Mục mới nhất ở trên. Mỗi mục có: triệu chứng, nguyên nhân, cách sửa, cách tránh.

Ghi chú chung: thư mục `ios/` và `android/` do `expo prebuild` sinh ra và nằm trong `.gitignore`. Sửa thẳng trong đó sẽ **mất** khi chạy lại prebuild; sửa xong phải ghi lại ở đây để làm lại.

## 2026-11-01 · Tải lên luôn lỗi "Mạng chập chờn", đếm 0 lần thử (CHƯA GIẢI QUYẾT)

- **Triệu chứng:** quay video xong lưu được trên máy (1,1 MB), nhưng ở Trung tâm đồng bộ → Chi tiết lỗi luôn hiện "Lỗi – cần xử lý", "Mạng chập chờn. Ứng dụng sẽ tự thử lại.", "Số lần đã thử: 0". Bấm Thử lại không đổi.
- **Phát hiện (đo bằng `firebase functions:log --json`, dự án `donchungdev`):** mỗi lần thử, `createUploadSession` nhận được yêu cầu, xác thực hợp lệ (`auth: VALID`), rồi trả **HTTP 500 sau khoảng 0,2 giây**. Region khớp (`asia-southeast1`), Functions đã deploy đủ. Vậy đây là lỗi nội bộ của hàm, **không phải mạng điện thoại**.
- **Vì sao app nói "mạng":** `toPortError` (`src/features/upload/data/firebase-ports.ts`) xếp mã `internal`/`unknown` không kèm `details` vào lỗi mạng; loại này không tính lượt thử nên app thử lại mãi và hiện chữ "mạng chập chờn". Khi thấy chữ này cùng "0 lần thử", hãy xem log máy chủ trước.
- **Điểm có thể ném lỗi bất ngờ:** mọi kiểm tra quyền/bằng chứng/phiên trong `uploads.ts` ném lỗi có mã cụ thể (không ra 500). Chỉ còn hai bước dùng Storage: `objectExists` và `getSignedUrl` v4 (`storageSigner` ở `firebase/functions/src/index.ts`).
- **Giả thuyết (chưa xác nhận):**
  1. Tài khoản dịch vụ của hàm thiếu quyền ký (`iam.serviceAccounts.signBlob`).
  2. Firebase Storage chưa bật hoặc chưa có bucket mặc định.
- **Đã thử:** cấp vai trò *Service Account Token Creator* cho `48751791-compute@developer.gserviceaccount.com` → **vẫn lỗi** (chưa rõ vai trò được cấp ở mức dự án hay riêng tài khoản dịch vụ, và có thể cần vài phút để có hiệu lực). Chưa kiểm tra Storage đã bật chưa.
- **Chưa biết lỗi gốc vì:** `toHttpsError` (`firebase/functions/src/http-errors.ts`) không ghi log lỗi lạ, và máy dev không có `gcloud` nên không đọc được log chi tiết.
- **Bước tiếp theo đề xuất:** (a) kiểm tra Firebase Console → Storage đã bật chưa; (b) thêm `logger.error` vào `toHttpsError` cho lỗi không phải `HttpsError`, deploy lại `createUploadSession` lên `donchungdev`, thử lại rồi đọc log để biết nguyên nhân chính xác (cần người dùng đồng ý trước khi deploy). Khi sửa xong, cập nhật mục này thành "đã giải quyết" kèm nguyên nhân thật.
- **Cải tiến nên làm riêng:** `createUploadSession` nên trả `details` cho lỗi bất ngờ, hoặc app không coi `internal` là lỗi mạng khi lặp lại nhiều lần, để người dùng không bị đánh lừa.

## 2026-11-01 · iOS: app mở lên rồi tắt ngay, `dyld: Symbol not found` ở `ExpoFileSystem`

- **Triệu chứng:** build và cài lên iPhone thành công, nhưng mở app thì tắt ngay. Chạy `xcrun devicectl device process launch --console ...` thấy `dyld: Symbol not found: _$s15ExpoModulesCore9AnyModule...`, tham chiếu từ `ExpoFileSystem.framework`, "Expected in" `ExpoModulesCore.framework`; kết thúc bằng `signal 6`.
- **Nguyên nhân:** `ios/Podfile.properties.json` có `"EXPO_USE_PRECOMPILED_MODULES": "true"`, nên Expo dùng các `.xcframework` biên dịch sẵn. Bản `ExpoFileSystem` biên dịch sẵn không khớp với bản `ExpoModulesCore` biên dịch sẵn (ký hiệu Swift có trong cái này mà không có trong cái kia), nên liên kết động thất bại lúc nạp.
- **Cách sửa:** đặt `"EXPO_USE_PRECOMPILED_MODULES": "false"` trong `ios/Podfile.properties.json`, chạy lại `pod install` trong `ios/`, rồi build lại. Module Expo sẽ được biên dịch từ mã nguồn (build lâu hơn, tốn thêm dung lượng).
- **Cách tránh:** lệnh `expo prebuild` tạo lại file này với giá trị `true`. Sau mỗi lần prebuild, kiểm tra lại giá trị. Khi nâng bản Expo SDK, thử bật lại bản biên dịch sẵn và chạy thử trên máy thật trước khi giữ.
- **Cách chẩn đoán nhanh:** app chết ngay khi mở thì xem log console của thiết bị (lệnh trên) trước, đừng đoán.

## 2026-11-01 · iOS: build treo ở bước Crashlytics `upload-symbols`

- **Triệu chứng:** log build dừng ở `[RNFB] Crashlytics Configuration`; tiến trình `upload-symbols` chạy hàng phút với 0% CPU.
- **Nguyên nhân:** script tải symbol Crashlytics chạy cả ở cấu hình Debug và chờ mạng.
- **Cách sửa:** thêm vào đầu script của build phase `[CP-User] [RNFB] Crashlytics Configuration` trong `ios/DJonChung.xcodeproj/project.pbxproj`, ngay sau `set -e`: `if [[ "${CONFIGURATION}" == "Debug" ]]; then exit 0; fi`. Bản Release vẫn tải symbol.
- **Lưu ý:** mất khi chạy lại prebuild. Không dừng script bằng `kill`, Xcode sẽ coi là lỗi build.

## 2026-11-01 · iOS: các lỗi nhỏ khi `expo run:ios --device`

| Triệu chứng | Nguyên nhân | Cách sửa |
| --- | --- | --- |
| `Unicode Normalization not appropriate for ASCII-8BIT` khi cài Pods | Terminal không đặt locale UTF-8 | `export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` trước khi chạy |
| `No device UDID or name matching ...` | Truyền mã CoreDevice của `devicectl`; Expo cần UDID của `xctrace` | Dùng mã trong `xcrun xctrace list devices` (dạng `00008110-...`) |
| `No code signing certificates are available` | Xcode chưa đăng nhập Apple ID, chưa chọn Team | Xcode → Settings → Accounts, chọn Team ở Signing & Capabilities |
| `database is locked ... build.db` | Hai build cùng DerivedData (Xcode đang mở, hoặc build trước còn treo) | Đóng Xcode, đợi tiến trình `xcodebuild` cũ kết thúc rồi chạy lại |
| `ENOSPC: no space left on device` | Ổ đĩa đầy giữa chừng | Giải phóng ít nhất 10 GB (DerivedData, simulator cũ) trước khi build iOS |
| `invalid code signature ... profile has not been explicitly trusted` | Chứng chỉ Personal Team chưa được tin cậy trên máy | Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị → Tin cậy |
| `Unable to find a destination ... iOS 26.2 is not installed` | Đã gỡ runtime simulator iOS 26.3.1 để lấy chỗ; Xcode 26.2 cần runtime này để build ra thiết bị | `xcodebuild -downloadPlatform iOS` (tải lại ~8 GB). Khi dọn đĩa, **không gỡ runtime iOS mới nhất**; chỉ xoá DerivedData và simulator cũ |
| `developerModeStatus: disabled` | Chưa bật Developer Mode | Cắm máy vào Mac cho Xcode nhận, rồi bật ở Cài đặt → Quyền riêng tư & Bảo mật |

## 2026-11-01 · Bật quay video có tiếng (O-09)

- Đã đổi `app.json` (`microphonePermission`, `recordAudioAndroid: true`, bỏ `RECORD_AUDIO` khỏi `blockedPermissions`) và `src/platform/camera-recorder.tsx` (xin quyền micro, bỏ `mute` cố định). Cần `expo prebuild` và build native lại mới có quyền micro. Cờ `EXPO_PUBLIC_RECORDER_ENABLED=1` đặt trong `.env.local` (không commit).
- iOS Simulator không có camera nên không quay được; thử trên máy thật hoặc Android emulator có camera ảo.
