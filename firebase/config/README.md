# Tệp cấu hình Firebase của app (không commit)

Đặt tệp tải từ Firebase Console (Project settings → Your apps) theo môi trường:

| Môi trường | iOS                             | Android                     |
| ---------- | ------------------------------- | --------------------------- |
| dev        | `dev/GoogleService-Info.plist`  | `dev/google-services.json`  |
| prod       | `prod/GoogleService-Info.plist` | `prod/google-services.json` |

`app.config.js` chọn thư mục theo `APP_ENV` (`npm run dev:*` / `npm run prod:*`, hoặc profile `eas.json`;
nhận bí danh `production`). Bundle ID/package của
app Firebase phải khớp: dev = `vn.doncung.app.dev`, prod = `vn.doncung.app` (giá trị giữ chỗ, O-11).
