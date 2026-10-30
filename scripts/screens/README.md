# Chụp ảnh màn hình bản web cho PR (`scripts/screens`)

Công cụ của kế hoạch [v1-release-plan.md](../../docs/engineering/v1-release-plan.md) mục 4 (PR V1-00). Một lệnh xuất app ra **bản web (react-native-web) với cổng giả**, phục vụ tĩnh và chụp bằng Playwright (Chromium) để đính ảnh vào mô tả PR khi không có thiết bị.

**Ảnh này không phải ảnh iOS/Android.** Font, bóng, vùng an toàn, bàn phím, Back phần cứng, chữ lớn hệ thống khác thiết bị thật. Web không có camera, SQLite thật (dùng kho bộ nhớ), Firebase, trạng thái mạng thật. Mọi ảnh đính kèm phải ghi rõ điều này (README trong thư mục ảnh).

## Cần có

- Node 22 và `node_modules` của repo (`npm ci`). Nếu repo chưa có `node_modules`, công cụ chạy `npm ci` trong bản sao.
- **Playwright + Chromium cài ngoài repo** (không có trong `package.json`, không chạy ở CI): `npm i -g playwright && npx playwright install chromium`. Công cụ tìm `playwright` theo `NODE_PATH`, `/opt/node-tools/node_modules` rồi `npm root -g`; thiếu thì báo cách cài và dừng trước khi xuất.
- Khoảng 1,5 GB đĩa trống cho thư mục làm việc (bản sao `node_modules`).

## Cách dùng

```bash
# Ảnh 390x844 @2x của ba màn, phiên giả đã đăng nhập (mặc định)
node scripts/screens/capture.cjs --work /tmp/ds-work --out /tmp/ds-shots \
  --routes "/=01-home,/account=02-account,/sync=03-sync"

# Ba cỡ của kế hoạch (320x568, 360x800, 390x844), chờ chữ xuất hiện rồi đợi thêm 1 giây
node scripts/screens/capture.cjs --work /tmp/ds-work --out /tmp/ds-shots --sizes all \
  --routes "/orders=02-orders" --wait-for "text=Đơn hàng" --wait-ms 1000

# Nhiều phiên giả trong một lệnh: dùng tệp route (mỗi phiên xuất một bản web riêng)
node scripts/screens/capture.cjs --work /tmp/ds-work \
  --out docs/assets/screens/v1-00-baseline --routes-file scripts/screens/routes/v1-00-baseline.json

# Chụp lại nhanh khi mã không đổi (dùng bản xuất trước trong <work>/dist-<phiên>)
node scripts/screens/capture.cjs --work /tmp/ds-work --out /tmp/ds-shots --skip-export --routes "/sync"
```

`node scripts/screens/capture.cjs --help` liệt kê mọi tham số. Chính:

| Tham số                 | Ý nghĩa                                                                                                                                                                                                                   | Mặc định                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `--routes "/a=ten,/b"`  | Route cần chụp; `=ten` là tên ảnh (không có thì lấy từ route, `/` là `root`)                                                                                                                                              | bắt buộc nếu không có `--routes-file` |
| `--routes-file f.json`  | Mảng `{ "route", "name"?, "session"?, "waitFor"?, "waitMs"?, "fullPage"? }`                                                                                                                                               |                                       |
| `--out <dir>`           | Nơi ghi ảnh `<tên>-<W>x<H>.png` (có thể là `docs/assets/screens/...`)                                                                                                                                                     | `<work>/shots`                        |
| `--work <dir>`          | Thư mục làm việc: **ngoài repo, không chứa repo**, mới/rỗng hoặc do công cụ tạo (có `.doncung-screens-work`)                                                                                                              | `<tmp>/doncung-screens`               |
| `--session`             | Phiên giả `signed_in` / `signed_out` / `no_shop` (`EXPO_PUBLIC_FAKE_SESSION`, lúc xuất)                                                                                                                                   | `signed_in`                           |
| `--sizes`               | `390x844`, danh sách cách bởi dấu phẩy, hoặc `all`                                                                                                                                                                        | `390x844`                             |
| `--scale`               | `deviceScaleFactor`                                                                                                                                                                                                       | `2`                                   |
| `--wait-for`            | Selector Playwright phải xuất hiện (tối đa 15 giây)                                                                                                                                                                       | không                                 |
| `--wait-ms`             | Đợi thêm trước khi chụp (cổng giả trễ ~450 ms)                                                                                                                                                                            | `3500`                                |
| `--port`                | Cổng máy chủ tĩnh (127.0.0.1). PR chạy song song dùng cổng khác nhau                                                                                                                                                      | `5100`                                |
| `--source`              | `worktree` (gồm tệp chưa commit, bỏ tệp bị `.gitignore`) hoặc một git ref                                                                                                                                                 | `worktree`                            |
| `--env EXPO_PUBLIC_X=v` | Thêm biến `EXPO_PUBLIC_*` lúc xuất (lặp được); cấm các khóa công cụ ép/bỏ: `EXPO_PUBLIC_USE_FAKE_BACKEND`, `EXPO_PUBLIC_BACKEND`, `EXPO_PUBLIC_FAKE_SESSION`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` |                                       |
| `--skip-export`         | Không sao/xuất lại                                                                                                                                                                                                        |                                       |
| `--allow-page-errors`   | Có lỗi trang vẫn thoát 0                                                                                                                                                                                                  |                                       |

Mã thoát khác 0 khi: tham số sai, xuất web lỗi, route không chụp được (hết giờ tải, `--wait-for` không thấy) hoặc trang có lỗi JavaScript (`pageerror`). `console.error` chỉ được in ra. Tóm tắt ghi ở `<work>/report.json`.

## Công cụ làm gì

1. Kiểm thư mục làm việc (đường dẫn thật, bỏ symlink): từ chối nếu nằm trong repo, là repo hay thư mục cha của repo, hoặc đã có dữ liệu mà không có tệp đánh dấu `.doncung-screens-work` (công cụ tạo tệp này khi thư mục mới/rỗng). Chỉ sau đó mới xóa `<work>/repo` (giữ `node_modules`) và sao mã nguồn: cây làm việc (`git ls-files -co --exclude-standard`) hoặc `git archive --end-of-options <ref>` (ref bắt đầu bằng `-` hoặc có ký tự lạ bị từ chối trước mọi thao tác trên đĩa).
2. Lần đầu (hoặc khi `package-lock.json` đổi): chép thật `node_modules` của repo (`cp -a`, không hardlink vì npm sẽ ghi vào), rồi `npm i --no-save react-native-web@~0.21.4 @expo/metro-runtime@~58.0.15` (bản Expo SDK 58 khuyến nghị) **trong bản sao**. `package.json`/`package-lock.json` của repo không đổi.
3. Với mỗi phiên giả cần dùng: `npx expo export --platform web --clear` với `EXPO_PUBLIC_USE_FAKE_BACKEND=1`, `EXPO_PUBLIC_BACKEND=fake`, `EXPO_PUBLIC_FAKE_SESSION=<phiên>`, `APP_ENV=dev`; bỏ `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`, `EXPO_PUBLIC_APP_ENV`.
4. Phục vụ `<work>/dist-<phiên>` bằng máy chủ tĩnh Node (route không có tệp trả `index.html`), chụp từng route ở từng cỡ (`locale vi-VN`, múi giờ `Asia/Ho_Chi_Minh`), gom lỗi trang.

Lần đầu mất khoảng 2–3 phút (chép `node_modules` + xuất); các lần sau chỉ còn sao mã + xuất.

## Dựng trạng thái cần dữ liệu

Bản web chỉ có dữ liệu của cổng giả và kho bộ nhớ (thường rỗng). Muốn chụp trạng thái có dữ liệu (đơn mẫu, tệp lỗi, đang tải…) thì cần thay đổi tạm (ví dụ tham số URL đọc ở cổng giả). Sửa thẳng trong `<work>/repo` **không bền**: bước 1 xóa bản sao mỗi lần chạy. Hai cách:

- **Khuyến nghị:** commit thay đổi tạm lên một nhánh nháp không đẩy, rồi chạy với `--source <nhánh-nháp>`.
- Để thay đổi tạm chưa commit trong cây làm việc (mặc định `--source worktree`), chụp xong thì hoàn tác; dễ lỡ commit nên chỉ dùng cho thay đổi rất nhỏ.

README ảnh phải liệt kê mọi thay đổi tạm (tiền lệ `docs/assets/screens/orders-v2/README.md`).

## Ảnh trong PR

Theo kế hoạch v1 mục 4.3: `docs/assets/screens/v1-<số>-<tên>/<NN>-<trạng-thái>-<WxH>.png` + `README.md` ghi cách chụp, thay đổi tạm, "ảnh bản web, chưa kiểm chứng trên thiết bị". Ảnh 390x844 @2x thường 60–140 KB. Không dùng dữ liệu khách thật.

## Test

`scripts/screens/lib.test.js` (Jest project `tooling`, chạy trong `npm test`) kiểm phần thuần: tham số, route, cỡ, biến môi trường xuất, máy chủ tĩnh không cho thoát thư mục. Phần xuất web + Playwright **không** chạy trong `npm run check`/CI.
