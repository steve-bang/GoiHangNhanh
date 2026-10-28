# Đơn Chứng

Ứng dụng di động (iOS + Android) quản lý **bằng chứng theo vòng đời đơn hàng thương mại điện tử**: đóng gói → bàn giao → nhận hàng hoàn → đối chiếu → tranh chấp. Đây không phải "app lưu video đơn hàng".

> **Tên làm việc.** "Đơn Chứng" có thể đổi sau khi kiểm tra nhãn hiệu (O-11); tên repo là `GoiHangNhanh`.

## Trạng thái hiện tại (đọc trước khi dùng)

Dự án đang ở giai đoạn **khung kỹ thuật + giao diện chạy bằng cổng giả**. Chưa phải sản phẩm phát hành.

| Đã có                                                                                        | Chưa có                                                                                                     |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Khung Expo + React Native + TypeScript, điều hướng Expo Router, design system (Design Token) | Firebase thật (Auth, Firestore, Storage, Functions): mới có Security Rules + test bằng Emulator             |
| Onboarding bằng **cổng giả**: Splash, Chào mừng, đăng ký/đăng nhập/quên mật khẩu, tạo shop   | Chặn truy cập theo phiên (route guard)                                                                      |
| Thanh tab: Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân                                 | **Ghi video thật**: màn quay chỉ xem trước camera, luôn kèm dải "chưa ghi video" (`RECORDER_ENABLED=false`) |
| Quét mã đơn bằng camera (`expo-camera`)                                                      | Tải lên nền, mã băm, đồng bộ                                                                                |
| Tạo đơn nhanh, Xác nhận đơn, Quay đóng gói; đơn/kiện/phiên lưu cục bộ bằng `expo-sqlite`     | Sửa đơn, danh sách bằng chứng, hàng hoàn, tranh chấp                                                        |
| Danh sách đơn (tìm, lọc, phân trang) và chi tiết chỉ đọc                                     | Build native (iOS/Android) chưa từng chạy trên máy ảo hay thiết bị thật                                     |
| Test Security Rules (QA-11), CI                                                              | Gửi lên App Store / Google Play                                                                             |

Thiết kế kỹ thuật trong `docs/engineering/` là **đề xuất, chờ duyệt**; các thư viện native (ghi video, tải nền, Firebase client) chưa chốt, chờ spike trên thiết bị thật.

## Công nghệ

- **App:** Expo SDK 58 · React Native 0.88 · React 19.3 · TypeScript (strict) · Expo Router
- **Dữ liệu cục bộ:** `expo-sqlite` (đơn, dòng sản phẩm, kiện, phiên)
- **Camera/quét mã:** `expo-camera`
- **i18n:** `i18next` / `react-i18next` (chuỗi UI tiếng Việt)
- **Backend (đích):** Firebase (Auth, Firestore, Storage, Cloud Functions, App Check). Hiện chỉ có Rules và Emulator.
- **Công cụ:** ESLint 9, Prettier, Jest 30 + `jest-expo`, `firebase-tools`
- **Yêu cầu:** Node **>= 22.13** (`.nvmrc` = 22), npm 10. Java 21 chỉ cần để chạy test Security Rules.

## Bắt đầu nhanh

```bash
nvm use            # Node 22
npm ci
npm run check      # lint + typecheck + format + token + unit test
```

Chạy giao diện (không cần Xcode/Android SDK) bằng web hoặc export JS:

```bash
npx expo export --platform ios       # bắt lỗi bundle Metro
npx expo export --platform android
```

Chạy app trên máy ảo/thiết bị (dev build, **không dùng Expo Go**) và triển khai lên cửa hàng: xem [DEPLOYMENT.md](DEPLOYMENT.md).

## Chạy trên máy ảo (macOS)

**Cài một lần:** Node theo `.nvmrc` (`nvm use`), `npm ci`; iOS: Xcode + iOS Simulator; Android: Android Studio + một AVD (Device Manager). Với Firebase thật, tải tệp cấu hình app từ Firebase Console (Project settings → Your apps; cách tạo dự án: [firebase-setup.md](docs/engineering/firebase-setup.md) mục 2) và đặt vào `firebase/config/dev/` (`GoogleService-Info.plist`, `google-services.json`; dự án prod thì `firebase/config/prod/`). Hai tệp không commit.

**Chạy:** ở thư mục gốc repo.

| Lệnh                                | Việc                                                                |
| ----------------------------------- | ------------------------------------------------------------------- |
| `npm run dev:ios` / `dev:android`   | Mở máy ảo, nối Firebase thật dự án **dev**, chạy dev client         |
| `npm run prod:ios` / `prod:android` | Như trên, nối Firebase **prod** (điền `scripts/env/prod.env` trước) |
| `npm run fake:ios` / `fake:android` | Cổng giả trong Expo Go, không cần Firebase hay build native         |

Lần đầu `dev`/`prod` chưa có app trên máy ảo nên script tự build (`expo run:*`, vài phút). **Build iOS chưa chạy được với Xcode 16.4** (cần Xcode 26+); khi đó dùng Android hoặc `fake:ios`. Chọn máy: `AVD_NAME=<tên AVD>`, `IOS_DEVICE="iPhone 16"`. Chưa thử trên máy thật; lỗi thường gặp: thiếu tệp cấu hình (script báo rõ), thiếu `LANG=en_US.UTF-8` khi `pod install`.

## Lệnh thường dùng

| Lệnh                              | Việc                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `npm start`                       | `expo start --dev-client` (cần dev build đã cài trên máy ảo/thiết bị)         |
| `npm run lint`                    | ESLint (gồm quy tắc lớp/import, chuỗi UI, `no-console`, Design Token)         |
| `npm run typecheck`               | `tsc --noEmit`                                                                |
| `npm run format` / `format:check` | Prettier ghi / kiểm tra                                                       |
| `npm run check:tokens`            | Kiểm tra cấu trúc Design Token                                                |
| `npm test`                        | Unit test Jest. Một tệp: `npx jest --selectProjects unit -- <đường-dẫn>`      |
| `npm run test:rules`              | Test Security Rules bằng Firebase Emulator (Firestore + Storage; cần Java 21) |
| `npm run check`                   | Chạy tất cả kiểm tra nhanh ở trên: **chạy trước khi báo xong**                |

Test kho SQLite dùng `node:sqlite` của Node nên cần Node >= 22.13.

### Cờ môi trường của cổng giả

| Biến                                                      | Tác dụng                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_USE_FAKE_BACKEND=1`                          | Bật cổng giả ở bản không phải dev (ví dụ xuất web để chụp giao diện)                                                                                  |
| `EXPO_PUBLIC_FAKE_SESSION=signed_out\|no_shop\|signed_in` | Phiên giả khi mở app. Không đặt: dev/test = `signed_in`, bản xem trước = `signed_out`. **Bản build thường không có cổng giả nên luôn vào Chào mừng.** |

## Cấu trúc thư mục

```text
src/
  app/          Route mỏng của Expo Router (màn hình thật nằm ở features/*/ui)
  bootstrap/    Providers, cấu hình thanh tab (tab-config.ts)
  core/         config, errors (mã lỗi), i18n, ids, logging, navigation (route ↔ UI-xx), theme
  features/     orders, evidence, packing, returns, disputes, shop, upload (domain / data / ui)
  platform/     Adapter nền tảng: camera, quét mã, SQLite, clipboard, điều hướng, bố cục
  shared/       ui (design system), fixtures (dữ liệu minh họa duy nhất)
firebase/       firebase.json, firestore.rules, storage.rules, tests/rules, functions/ (chưa có mã)
docs/           Tài liệu nghiệp vụ 01–09 + engineering/ + Design Token
scripts/        Kiểm tra Design Token
assets/         Icon, splash
.github/        CI (PR vào main)
```

Quy tắc lớp được ESLint ép: mã nghiệp vụ không gọi trực tiếp thư viện nền tảng, mà đi qua `src/platform/`. Màn hình dùng `useTheme().tokens`, không viết hex hay số thiết kế.

## Bất biến nghiệp vụ

Mọi tính năng phải tuân thủ (chi tiết ở [CLAUDE.md](CLAUDE.md)):

1. Không "một đơn = một video": Đơn → nhiều Kiện → nhiều Phiên ghi nhận → nhiều Bằng chứng. Mã đơn/mã vận đơn chỉ là thuộc tính tìm kiếm, không phải định danh.
2. Bằng chứng gắn với ID phiên + ID kiện được tạo **trước** khi quay.
3. Trạng thái tệp tách khỏi trạng thái phiên/đơn; chỉ hiện "đã lưu an toàn trên máy chủ" sau khi máy chủ xác nhận.
4. Bản gốc bất biến; bản nén/cắt là bản dẫn xuất.
5. Không tự liên kết, không tự kết luận nguyên nhân hay bên chịu trách nhiệm.
6. Không dữ liệu giả; thiếu bằng chứng thì ghi nhận là thiếu.
7. Mọi thay đổi sau khi quay/xác nhận đều lưu lịch sử.
8. Cô lập dữ liệu theo shop trên mọi truy vấn; không URL công khai vĩnh viễn tới video.
9. Không xóa bằng chứng đang bị giữ do tranh chấp.
10. Dữ liệu đơn tối giản, ghi nguồn rõ ràng; thiếu thông tin sản phẩm không chặn quay.
11. Ngôn ngữ trung thực: không hứa "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại.

## Tài liệu

Mục lục đầy đủ và nhật ký quyết định: [docs/README.md](docs/README.md). Mọi tài liệu viết bằng tiếng Việt.

| Chủ đề                                   | Tệp                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| Nghiệp vụ, trạng thái, quy trình         | `docs/01…03`                                         |
| Đặc tả màn hình đóng gói / hàng hoàn     | `docs/04`, `docs/05`                                 |
| Chính sách bằng chứng & lưu trữ, bảo mật | `docs/06`, `docs/07`                                 |
| Nghiệm thu, QA, rủi ro                   | `docs/08`                                            |
| Thiết kế UI/UX                           | `docs/09-ui-ux-design.md`                            |
| Kiến trúc, dữ liệu Firestore/Storage     | `docs/engineering/architecture.md`                   |
| Quy ước mã                               | `docs/engineering/conventions.md`                    |
| Khung giao diện, route ↔ `UI-xx`         | `docs/engineering/layout.md`                         |
| Chiến lược test                          | `docs/engineering/testing.md`                        |
| Hỗ trợ iOS/Android, sàn phiên bản        | `docs/engineering/platform-support.md`               |
| ADR và câu hỏi chờ duyệt (Q-xx)          | `docs/engineering/decisions.md`                      |
| Design Token                             | `docs/design-system.md`, `docs/design-token-spec.md` |
| **Triển khai và phát hành**              | [DEPLOYMENT.md](DEPLOYMENT.md)                       |

## Đóng góp

- Nhánh tính năng → PR vào `main`. CI (`.github/workflows/ci.yml`) chạy lint, typecheck, format, check tokens, unit test và test Rules.
- Commit/PR theo `docs/engineering/conventions.md`. "Xong" nghĩa là `npm run check` qua, có test, chạy đúng trên cả iOS và Android (hoặc ghi rõ phần chưa kiểm chứng).
- Không commit bí mật: `.env*`, `google-services.json`, `GoogleService-Info.plist`, keystore, `.p8/.p12`, khóa tài khoản dịch vụ (đã có trong `.gitignore`).
- Splash, đăng nhập/đăng ký, khôi phục mật khẩu và luồng thiết lập đã được khách hàng xác nhận: **không đổi giao diện** các màn này.
