# Ảnh màn hình V1-03 auth-email-reset

**Ảnh bản web (react-native-web trong Chromium) với cổng giả, không phải ảnh iOS/Android; chưa kiểm chứng trên thiết bị.** Font, bóng, vùng an toàn, bàn phím, chữ lớn hệ thống khác thiết bị thật. Bản giả không gửi thư thật.

Cách chụp (`scripts/screens/capture.cjs`, phiên giả `signed_out`, 390x844 @2x; Quên mật khẩu thêm 320x568; Kiểm tra hộp thư thêm 320x568 và 360x800). Ảnh Quên mật khẩu và Kiểm tra hộp thư chụp lại sau review PR #47 (bố cục theo độ dài câu mô tả):

- "Trước": `--source origin/main` (`4e59fd3`).
- "Sau": `--source claude/v1-03-auth-email-reset`.
- **Thay đổi tạm, không commit** (chỉ cho ảnh Kiểm tra hộp thư, nhánh nháp `draft/v1-03-shots` không đẩy): `INITIAL_RECOVERY_STATE` trong `src/features/shop/domain/recovery-flow.ts` đặt sẵn `requestedEmail = 'lan.anh@example.com'` và `resendAvailableAt = Date.now() + 60 000`, như người dùng vừa bấm "Gửi email đặt lại" (vào thẳng `/forgot-password/sent` khi chưa gửi thì app chuyển về Quên mật khẩu). Đồng hồ đếm ngược trong ảnh là 00:56 vì công cụ chờ ~3,5 giây trước khi chụp.

Lệch có chủ đích (decisions.md `#### Q-29 / V1-03 — auth-email-reset`): ba màn khách đã xác nhận mất khối nút Apple/Google (cờ `SOCIAL_SIGN_IN_FLAGS` tắt, không sửa tệp màn); màn Quên mật khẩu giữ bố cục, đổi câu mô tả và nhãn nút cho đúng cách gửi thư.

## 1. Chào mừng (UI-A02)

Trước | Sau
---|---
![Chào mừng trước](01-welcome-before-390x844.png) | ![Chào mừng sau: không còn Apple/Google](01-welcome-after-390x844.png)

## 2. Đăng nhập (UI-A03)

Trước | Sau
---|---
![Đăng nhập trước](02-sign-in-before-390x844.png) | ![Đăng nhập sau: không còn "Hoặc đăng nhập với"](02-sign-in-after-390x844.png)

## 3. Đăng ký (UI-A03)

Trước | Sau
---|---
![Đăng ký trước](03-sign-up-before-390x844.png) | ![Đăng ký sau: không còn "Hoặc đăng ký với"](03-sign-up-after-390x844.png)

## 4. Quên mật khẩu (UI-A07)

Trước | Sau
---|---
![Quên mật khẩu trước: gửi mã xác minh](04-forgot-password-before-390x844.png) | ![Quên mật khẩu sau: gửi email đặt lại](04-forgot-password-after-390x844.png)
![Quên mật khẩu trước 320x568](04-forgot-password-before-320x568.png) | ![Quên mật khẩu sau 320x568: câu dài hơn, bố cục theo độ dài câu](04-forgot-password-after-320x568.png)

## 5. Kiểm tra hộp thư (UI-A07, `/forgot-password/sent`, màn mới)

390x844 | 360x800 | 320x568
---|---|---
![Kiểm tra hộp thư 390x844](05-check-inbox-after-390x844.png) | ![Kiểm tra hộp thư 360x800](05-check-inbox-after-360x800.png) | ![Kiểm tra hộp thư 320x568](05-check-inbox-after-320x568.png)
