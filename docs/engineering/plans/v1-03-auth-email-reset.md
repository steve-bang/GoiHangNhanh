# V1-03 auth-email-reset — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 1.2 (O-15, D-14), 3.0, 3.3 V1-03, 7.5. Quyết định tự chốt: [decisions.md](../decisions.md) `#### Q-29 / V1-03 — auth-email-reset`.

## Mục tiêu

1. Quên mật khẩu chạy thật ở bản Firebase bằng `sendPasswordResetEmail` (thư tiếng Việt `languageCode = 'vi'`), trung tính (không lộ email có tài khoản hay không).
2. Không còn nút đăng nhập Apple/Google không hoạt động (O-15 v1: chỉ email + mật khẩu).

## Thiết kế

- **Cờ** (`src/core/config/feature-flags.ts`): `SOCIAL_SIGN_IN_FLAGS` = `false` cả hai (mọi bản build, vì chưa có đăng nhập Apple/Google thật ở đâu cả); thêm `PASSWORD_RECOVERY_MODE: PasswordRecoveryMode = 'email_link'` (`'email_link' | 'otp'`, một chỗ).
- **Cổng Firebase** (`ops.ts`): `sendPasswordReset(email)` = `setLanguageCode(auth, 'vi')` (lỗi bỏ qua: thư vẫn gửi, chỉ có thể là tiếng Anh) rồi `sendPasswordResetEmail(auth, email)` không `actionCodeSettings` (trang đặt mật khẩu mới là trang của Firebase). `firebase-api.ts`: `requestPasswordRecovery` gọi `ops.sendPasswordReset`, nuốt `auth/user-not-found` (trung tính), trả `retryAfterSeconds = 60`; lỗi khác qua `guard` (`auth/invalid-email` -> `AUTH_INVALID_CREDENTIALS` có sẵn, `auth/too-many-requests` -> `AUTH_TOO_MANY_REQUESTS`, mạng -> `AUTH_NETWORK_ERROR`). `verifyRecoveryCode`/`resetPassword`/`signInWithProvider` vẫn `AUTH_SERVICE_UNAVAILABLE`.
- **Cổng giả:** `requestPasswordRecovery` đã trung tính và có kịch bản bận/khóa/mất mạng; dùng nguyên cho chế độ email (mã `123456` chỉ còn ý nghĩa ở chế độ `otp`). Chỉ cập nhật chú thích.
- **UI-A07 Quên mật khẩu** (màn đã khách xác nhận): bố cục giữ nguyên. Đổi: (1) đích sau khi gửi thành công: `email_link` -> `push(ROUTES.recoveryEmailSent)`, `otp` -> `push(ROUTES.verifyOtp)` như cũ; (2) **câu chữ** mô tả, nhãn nút, lời lỗi "nhiều lần"/"chưa gửi được" theo chế độ, vì câu cũ hứa "gửi mã xác minh" là sai ở chế độ email (bất biến 11); (3) `AUTH_INVALID_CREDENTIALS` ở màn này hiện lời "email chưa đúng định dạng" có sẵn thay vì "Email hoặc mật khẩu chưa chính xác". Ghi lệch có chủ đích.
- **Màn mới "Kiểm tra hộp thư"** `features/shop/ui/RecoveryEmailSentScreen.tsx` (trong phạm vi token), route con `/forgot-password/sent` (mã UI-A07, parent `forgotPassword`). `src/app/forgot-password.tsx` chuyển thành `src/app/forgot-password/index.tsx` (URL không đổi). Nội dung: minh họa khóa của luồng, tiêu đề "Kiểm tra hộp thư", mô tả trung tính với email đã che (`maskEmail`), câu Thư rác, nút chính "Quay lại đăng nhập" (điền sẵn email qua `signInEmail`, `reset(signIn)`), "Gửi lại email" có đếm ngược theo `resendAvailableAt`, banner "Đã gửi lại" / lỗi (cùng lời theo chế độ email), liên kết "Đổi email" (`back`). Vào thẳng khi chưa gửi -> `replace(forgotPassword)`. Trạng thái dùng lại `recoveryReducer` (`code_requested` = đã gửi yêu cầu); không thêm trạng thái mới.
- **Chặn deep link** `/verify-otp`, `/new-password` ở chế độ `email_link`: `replace(ROUTES.signIn)` lúc mở màn (logic, không đổi hiển thị).
- Chống dò email: màn mới không bao giờ nói "đã gửi tới email của bạn" một cách khẳng định; câu "Nếu email … đã đăng ký, thư … sẽ tới trong vài phút."

## Tệp

`feature-flags.ts`(+test), `api/firebase/{ops,firebase-api}.ts`(+test), `api/contract/auth.ts` (chú thích), `api/contract-tests/api.contract.ts` (trung tính), `api/fake/fake-api.ts` (chú thích), `ForgotPasswordScreen.tsx`, `VerifyOtpScreen.tsx`, `NewPasswordScreen.tsx` (chặn), `RecoveryEmailSentScreen.tsx`(+test), `ui/screens.tsx`, `src/app/forgot-password/{index,sent}.tsx`, `routes.ts`, `routes.test.ts`, `locales/vi/screens.json`, test màn hiện có (chế độ `otp` mock cờ), `auth-flow.test.tsx`, `layout.md`, `decisions.md`, `firebase-setup.md`, `CHANGELOG.md`.

**Migration/Rules/thư viện:** không.

## Test

- `firebase-api.test.ts`: gửi thư với email đã cắt khoảng trắng; `auth/user-not-found` trung tính; `invalid-email`, `too-many-requests`, mạng ánh xạ đúng; OTP/provider vẫn unavailable. `ops.test.ts`: đặt `vi` trước khi gửi, lỗi `setLanguageCode` không chặn gửi.
- Hợp đồng: email có và không có tài khoản đều resolve cùng dạng.
- `ForgotPasswordScreen.test.tsx`: chế độ email đi `/forgot-password/sent`, câu chữ email; chế độ otp giữ hành vi cũ.
- `RecoveryEmailSentScreen.test.tsx`: chặn khi chưa gửi, email che, đếm ngược rồi Gửi lại, lỗi gửi lại, Quay lại đăng nhập điền sẵn email, Đổi email.
- Chặn `/verify-otp`, `/new-password` ở chế độ email; luồng otp cũ chạy với cờ mock `otp`.
- `auth-flow.test.tsx` (Expo Router thật): Đăng nhập -> Quên -> Kiểm tra hộp thư -> Quay lại đăng nhập; không còn nút xã hội.

## Ảnh

Chào mừng, Đăng nhập, Đăng ký (sau khi ẩn nút), Quên mật khẩu, Kiểm tra hộp thư (3 cỡ; trạng thái cần dữ liệu dựng bằng nhánh nháp không đẩy). "Trước": cùng route ở `origin/main`.

## Rủi ro

- Thư Firebase mặc định có thể vào Thư rác; mẫu thư/tên người gửi chỉnh trong Console (checklist F-6). Trang đặt mật khẩu mới là trang Firebase (không theo thương hiệu, có thể tiếng Anh nếu chưa đặt ngôn ngữ mẫu).
- Bật "Email enumeration protection" (mặc định dự án mới) thì Firebase không báo `user-not-found`; nếu tắt, app vẫn nuốt mã này.
- Giới hạn tần suất gửi thư nằm ở Firebase (không cấu hình được chi tiết); app chỉ đếm ngược 60 giây.
- Đổi mật khẩu trên trang web không thu hồi ngay phiên đang mở trên máy (Firebase thu hồi refresh token; v1 một máy).
- Chưa kiểm chứng trên thiết bị: gửi thư thật, mở thư từ app Mail, quay lại app.

## Tự review

Vòng 1 (bất biến 1–11, dữ liệu, kích thước): không đụng dữ liệu bằng chứng/Rules/migration (1–10 không bị ảnh hưởng). Bất biến 11: phát hiện câu cũ "Đơn Chứng sẽ gửi mã xác minh" sai ở chế độ email -> **sửa kế hoạch**: đổi câu chữ theo chế độ (lệch có chủ đích, ghi Q-29/V1-03). Chống dò: phát hiện `AUTH_INVALID_CREDENTIALS` hiện "Email hoặc mật khẩu chưa chính xác" ở màn Quên mật khẩu gây hiểu nhầm -> **sửa**: lời riêng "email chưa đúng định dạng" (không liên quan tồn tại). Kích thước: ước ~400 dòng mã, trong ngân sách.

Vòng 2 (điều hướng): màn Kiểm tra hộp thư đặt TRÊN Quên mật khẩu (push) để Back/Đổi email giữ email và không kích hoạt `left_flow`; "Quay lại đăng nhập" xóa điều kiện như màn Quên. Route con mới cần cập nhật danh sách đã duyệt trong `routes.test.ts` (kế hoạch v1 đã cho phép route `/forgot-password/sent`).

Tự review: đã chấp nhận.
