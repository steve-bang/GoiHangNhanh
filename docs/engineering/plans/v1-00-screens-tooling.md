# V1-00 screens-tooling — kế hoạch chi tiết

Nguồn: [v1-release-plan.md](../v1-release-plan.md) mục 3.3 V1-00 và mục 4.

## Mục tiêu

Một lệnh trong repo để mọi PR v1 tự chụp ảnh màn hình bản web (cổng giả) không cần thiết bị, không đổi `package.json`/`package-lock.json`, không chạy ở CI. Kèm bộ ảnh mốc "trước" các màn chính.

## Tệp đổi

- `scripts/screens/capture.cjs` (điều phối: sao mã ra thư mục làm việc ngoài repo, `node_modules`, `npm i --no-save` hai gói web, `expo export --platform web` theo từng phiên giả, phục vụ, chụp).
- `scripts/screens/shoot.cjs` (Playwright, chạy riêng được với `--base-url`), `serve.cjs` (máy chủ tĩnh Node, SPA), `lib.cjs` (hàm thuần), `lib.test.js`, `routes/v1-00-baseline.json`, `README.md`.
- `jest.config.js`: project `tooling` thêm `scripts/**/*.test.js`.
- Tài liệu: `v1-release-plan.md` (mục 3.3 V1-00, 4.1 trỏ công cụ thật), `testing.md` (dòng tầng "Ảnh màn hình bản web"), `decisions.md` Q-29 (lệch so với kế hoạch), `CHANGELOG.md`.
- Ảnh: `docs/assets/screens/v1-00-baseline/` (8 ảnh 390x844 @2x + README).

## Thiết kế

- **Node `.cjs` thay vì `capture.sh`** như kế hoạch: qua ESLint/Prettier của repo, test được phần thuần bằng Jest, không phụ thuộc bash (Windows dev vẫn chạy được phần lớn), một nơi xử lý lỗi.
- **Không thêm phụ thuộc**: `react-native-web@~0.21.4`, `@expo/metro-runtime@~58.0.15` (bản trong `expo/bundledNativeModules.json` của SDK 58) cài `--no-save` trong bản sao; Playwright nạp từ `NODE_PATH`/`/opt/node-tools`/`npm root -g`. Lý do chọn so với thêm devDependency: CI không cần web, thêm vào `package.json` là đụng tệp "nóng" (V1-02/11/16/17 cũng sửa) và kéo `react-dom`/web vào `npm ci` của CI mà không ai dùng; Playwright + trình duyệt (~150 MB) càng không nên vào CI.
- **Thư mục làm việc bắt buộc ngoài repo** (kiểm `isInside`), `node_modules` chép thật (`cp -a`) một lần, dùng lại theo băm `package-lock.json`.
- **Mã nguồn mặc định là cây làm việc** (`git ls-files -co --exclude-standard`, gồm thay đổi chưa commit) để chụp trước khi commit; `--source <ref>` cho nhánh nháp có thay đổi tạm.
- **Phiên giả là biến lúc xuất** (`EXPO_PUBLIC_FAKE_SESSION` được Metro thay lúc đóng gói), nên mỗi phiên một bản xuất `dist-<phiên>`; `--clear` để bộ nhớ đệm Metro không lẫn biến môi trường giữa hai lần xuất. Luôn ép cổng giả, bỏ `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`/`EXPO_PUBLIC_APP_ENV`, `APP_ENV=dev` (không va chặn prod của V1-01).
- **Cỡ mặc định 390x844** (đề bài điều phối), `--sizes all` cho ba cỡ của kế hoạch mục 4.1. Hệ số 2, `locale vi-VN`, múi giờ `Asia/Ho_Chi_Minh` (ngày giờ hiển thị ổn định).
- **Báo lỗi**: lỗi trang (`pageerror`) hoặc route không chụp được -> mã thoát 1 (tắt bằng `--allow-page-errors`); `console.error` chỉ in. Tên ảnh trùng -> lỗi trước khi chụp (không ghi đè âm thầm). Máy chủ chỉ nghe 127.0.0.1, chặn thoát thư mục.

## Migration / Rules / Functions

Không.

## Test

- `lib.test.js` (Jest `tooling`, trong `npm test`): tham số, cỡ, route, tệp route, tên trùng, biến môi trường xuất, máy chủ tĩnh (SPA, chặn `..`).
- Chạy thật: bộ ảnh mốc (8 route, hai phiên) 0 lỗi trang; `--skip-export --sizes all --wait-for`; `--wait-for` sai -> thoát 1; `--work` trong repo -> lỗi; tên trùng -> lỗi; `git status` của repo sạch sau khi chạy.

## Màn cần chụp

Mốc "trước": Trang chủ, Đơn hàng, Cá nhân, Trung tâm đồng bộ, Hàng hoàn, Tranh chấp, Thông báo, Chào mừng (`signed_out`).

## Rủi ro

- Playwright/Chromium không có ở máy khác: báo lỗi rõ kèm lệnh cài, dừng trước khi xuất.
- `npm i --no-save` trong bản sao có thể gỡ vài gói "thừa" của bản sao (đã thấy "removed 4 packages"): chỉ ảnh hưởng bản sao; nếu một ngày bản xuất web hỏng vì vậy, xóa `<work>/repo/node_modules` để chép lại.
- Đĩa: bản sao `node_modules` ~1,4 GB mỗi thư mục làm việc.
- `jest.config.js` cũng có thể bị V1-01 sửa (thêm test `scripts/env`): xung đột một dòng, mẫu `scripts/**/*.test.js` đã bao cả hai.

## Tự review

Bất biến 1–11: không đụng mã app, dữ liệu, Rules; ảnh và README ghi rõ là bản web cổng giả (bất biến 11, ngôn ngữ trung thực). Rủi ro dữ liệu: không có (thư mục làm việc ngoài repo, kiểm bắt buộc). Kích thước: ~600 dòng script + test, trong ngân sách S. Điểm đã sửa khi tự review: (1) bỏ `serve` qua `npx --yes` (cần mạng, không kiểm được lỗi cổng bận) thay bằng máy chủ Node nội bộ; (2) thêm kiểm tên ảnh trùng; (3) `resolveStaticFile` không thử `<root>.html` ngoài thư mục gốc; (4) đổi hướng dẫn "sửa trong `<work>/repo`" vì bước sao mã xóa bản sao mỗi lần.

**Tự review: đã chấp nhận.**
