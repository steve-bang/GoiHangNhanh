# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Trạng thái dự án

Repo có tài liệu nghiệp vụ (`docs/`) và **khung kỹ thuật** (Expo + React Native + TypeScript, cấu hình Firebase, Security Rules có test, CI). Có **khung giao diện (app shell)**: điều hướng Expo Router, design system, màn hình khung với dữ liệu minh họa (`docs/engineering/layout.md`). Đã có các màn thật chạy bằng **cổng giả** (Splash UI-A01 với cổng phiên giả, Chào mừng, đăng ký/đăng nhập/quên mật khẩu, tạo shop; xem `layout.md` mục 2.x, `decisions.md` Q-13..Q-15); chưa chặn truy cập (route guard). Đã dựng thanh tab theo mockup (Trang chủ · Đơn hàng · Quét · Thông báo · Cá nhân; D-16) với Trang chủ và Quét mã đơn hàng (camera quét mã thật qua `expo-camera`, ADR-016; chưa kiểm chứng trên thiết bị). Đã dựng theo mockup 03 ba màn **Tạo đơn nhanh (UI-B04), Xác nhận đơn (UI-C01), Quay đóng gói (UI-C03)**: đơn/dòng sản phẩm/kiện/phiên **lưu cục bộ bằng `expo-sqlite`** (ADR-017, `shopId` tạm, Q-17); gợi ý từ lịch sử, tìm trùng không tự gộp, bắt đầu quay = tạo phiên + ảnh chụp đơn trước khi mở camera, màn quay mở bằng `sessionId`. Tab **Đơn hàng** đã có **danh sách thật (UI-E01: tìm, chip, bộ lọc, phân trang keyset, làm mới) và chi tiết chỉ đọc (UI-E02)** trên kho cục bộ; trạng thái thẻ gộp theo `summarizeOrderEvidence` (hôm nay luôn *Chưa có video* vì chưa có tệp bằng chứng; phiên `created` không phải bằng chứng; `decisions.md` Q-18, O-28); chưa có sửa đơn, danh sách bằng chứng. **Màn quay chưa ghi video**: camera chỉ xem trước (`expo-camera`), luôn kèm dải "chưa ghi video" (`RECORDER_ENABLED=false`). Chưa có quay/ghi tệp thật, tải lên hay Firebase thật; chưa build native (iOS/Android) và chưa chạy trên máy ảo/thiết bị thật (SQLite, camera, clipboard chưa kiểm chứng trên máy). Thiết kế kỹ thuật ở `docs/engineering/` là **đề xuất, chờ người dùng duyệt** (không phải quyết định D-xx); các thư viện native chưa chốt chờ spike trên thiết bị thật.

Sản phẩm: **Đơn Chứng** (tên làm việc, có thể đổi sau khi kiểm tra nhãn hiệu; tên repo là `GoiHangNhanh`) — ứng dụng di động quản lý bằng chứng theo vòng đời đơn hàng thương mại điện tử: đóng gói → bàn giao → nhận hàng hoàn → đối chiếu → tranh chấp. Không phải "app lưu video đơn hàng".

Tài liệu nằm trong `docs/`, bắt đầu từ `docs/README.md` (mục lục + nhật ký quyết định). Mọi tài liệu viết bằng tiếng Việt.

## Lệnh và tài liệu kỹ thuật

### Lệnh (Node 22, npm 10; đã chạy được trong môi trường khung)

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài phụ thuộc theo `package-lock.json` |
| `npm run lint` / `npm run typecheck` / `npm run format:check` | ESLint (gồm quy tắc lớp/import, chuỗi UI, `no-console`) / `tsc --noEmit` strict / Prettier |
| `npm test` | Unit test Jest (project `unit`); chạy một tệp: `npx jest --selectProjects unit -- <đường-dẫn>`. Test kho SQLite dùng `node:sqlite` của Node (cần Node >= 22.13; ADR-017) |
| `npm run test:rules` | Test Security Rules và logic Cloud Functions bằng Firebase Emulator (Firestore + Storage); cần Java 21, lần đầu tải emulator, và `npm --prefix firebase/functions ci` |
| `npm run check:tokens` | Kiểm tra cấu trúc Design Token (nguồn hex duy nhất, kiến trúc tầng, baseline ngoại lệ); rule ESLint `design-tokens/no-raw-design-values` chạy trong `npm run lint` |
| `npm run check` | lint + typecheck + format:check + check:tokens + unit test (chạy trước khi báo xong) |
| `npx expo start --go --ios` | **Cách chạy thử trên iOS Simulator** (đã chạy được, 2026-10-27): mở app trong Expo Go 58 và tự cài Expo Go khớp SDK nếu thiếu. Không cần build native/Xcode mới. **Không dùng `npm start`** để chạy thử: script đó có `--dev-client` và báo `No development build (vn.doncung.app.dev) ... installed` nếu chưa build. Camera quét mã không dùng được trên simulator; `expo-sqlite`/`expo-camera` chưa kiểm chứng kỹ trong Expo Go |
| `npx expo export --platform ios` / `--platform android` | Đóng gói JS (Metro) để bắt lỗi bundle; không cần Xcode/Android SDK. Thêm `--output-dir <thư mục ngoài repo>` nếu không muốn tạo `dist/`. `npx expo install` cần truy cập `api.expo.dev` (có thể bị chặn trong môi trường hạn chế: xem ADR-013) |

Chọn backend (`src/api/create-api.ts`): test = giả; `__DEV__` = giả; bản build thường = **Firebase thật** (thiếu `GoogleService-Info.plist`/`google-services.json` thì rơi về "chưa kết nối"). `EXPO_PUBLIC_BACKEND=firebase|fake` ép chọn; `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST=<host>` nối Firebase Emulator (Android emulator: `10.0.2.2`). Hai tệp cấu hình app không commit, đặt ở gốc repo hoặc trỏ `GOOGLE_SERVICES_INFO_PLIST`/`GOOGLE_SERVICES_JSON` (`app.config.js`). Cờ môi trường của cổng giả (không phải lệnh): `EXPO_PUBLIC_USE_FAKE_BACKEND=1` (bật cổng giả ở bản không phải dev, ví dụ xuất web để chụp ảnh giao diện); `EXPO_PUBLIC_FAKE_SESSION=signed_out|no_shop|signed_in` (phiên giả khi mở app, màn Splash UI-A01; không đặt: dev/test = `signed_in`, bản xem trước = `signed_out`; **bản build thường không có cổng giả nên luôn vào Chào mừng**: `layout.md` mục 2.4, `decisions.md` Q-15). `npx expo prebuild --no-install` đã chạy được trên bản sao ngoài repo (chỉ để kiểm tra cấu hình `app.json`), chưa build/chạy native.

Build native (`npx expo run:ios`) **chưa chạy được trên máy có Xcode 16.4**: `ExpoModulesJSI` cần Swift tools 6.2 (Xcode 26+), lỗi `package 'apple' is using Swift tools version 6.2.0 but the installed version is 6.1.0`. CocoaPods cần `export LANG=en_US.UTF-8` (nếu không `pod install` lỗi Unicode Normalization). Thư mục `ios/` sinh ra đã được gitignore. Chưa có lệnh build/chạy native (dev build) chạy thật; sau `expo prebuild`/EAS cần bổ sung vào đây khi đã chạy thật. CI: `.github/workflows/ci.yml` (PR vào `main`): lint, typecheck, format, unit test, test Rules.

### Tài liệu kỹ thuật

- `docs/engineering/architecture.md` — kiến trúc, mô hình dữ liệu Firestore/Storage, máy trạng thái tệp, hàng đợi tải lên, Cloud Functions, so sánh thư viện (kiểm tra 2026-10-26), kế hoạch spike.
- `docs/engineering/conventions.md` — cấu trúc/đặt tên, quy tắc lớp, TypeScript, lỗi, i18n/UI, log/PII, bảo mật, commit/PR, định nghĩa "xong".
- `docs/engineering/layout.md` — khung giao diện: cấu trúc điều hướng, bảng route ↔ mã `UI-xx`, component dùng chung, quy tắc bố cục iOS/Android, cách thêm màn hình, cách đổi thanh tab (O-18).
- `docs/engineering/testing.md` — chiến lược test, ánh xạ QA-01…14, phần chưa tự động hóa được.
- `docs/engineering/decisions.md` — ADR đề xuất + câu hỏi cần duyệt (Q-xx).
- `docs/design-system.md` (cách dùng token), `docs/design-token-spec.md` (đặc tả), `docs/design-system-audit.md`, `docs/design-token-migration-report.md` — **màn trong app dùng `useTheme().tokens`, không viết hex/số thiết kế; Splash, đăng nhập/đăng ký, khôi phục mật khẩu và luồng thiết lập đã được khách hàng xác nhận, nằm ngoài phạm vi, không được đổi giao diện** (danh sách: `scripts/design-token-scope.cjs`).
- `docs/engineering/platform-support.md` — hỗ trợ iOS + Android: thị phần, sàn phiên bản, khác biệt nền tảng, ma trận kiểm thử.

Mã khung đáng chú ý: `src/api/` (lớp API: hợp đồng `ApiClient`, bản giả, bản "chưa kết nối", `create-api.ts`; Firebase thật ở `src/api/firebase`: Auth + Cloud Function `createShop`/`updateShop` + `userShops/{uid}`; **đã viết và qua test trên emulator, chưa chạy trên thiết bị và chưa deploy**; dự án dev `ghn-test-67b39` ở `firebase/.firebaserc`; khôi phục mật khẩu và Apple/Google vẫn trả `AUTH_SERVICE_UNAVAILABLE`), `src/app/` (route mỏng Expo Router), `src/bootstrap/navigation/tab-config.ts` (cấu hình thanh tab 5 mục, một nơi duy nhất; nút Quét giữa là hành động, không phải tab), `src/core/navigation/routes.ts` (bảng route ↔ `UI-xx`), `src/shared/ui` (design system), `src/shared/fixtures/illustrative-data.ts` (dữ liệu minh họa duy nhất), `src/platform/` (adapter điều hướng/bố cục/camera/lưu cục bộ/ID/clipboard); `src/features/orders/{domain,data}` (đơn, gợi ý, tìm trùng, kho SQLite + bộ nhớ); `src/features/evidence/domain/file-state.ts` (máy trạng thái tệp; client không tự tới `uploaded`/`verified`), `src/core/theme/evidence-status.ts` (nhãn trạng thái docs/09 mục 3), `src/core/errors/codes.ts` (mã lỗi từ docs/04–05), `firebase/firestore.rules` + `firebase/tests/rules/` (cô lập theo shop, QA-11).

## Quyết định đã chốt (bản mới nhất thắng)

Các trao đổi ban đầu đã thay đổi định hướng nhiều lần. Chỉ áp dụng bản cuối:

| Chủ đề | Đã chốt | Đã bị thay thế (không dùng) |
|---|---|---|
| Nền tảng chính | App iOS + Android là sản phẩm chính; web chỉ để marketing/SEO/chuyển đổi | Web quản trị cho người bán, PWA ghi hình |
| Mobile | **React Native** | Flutter, PWA |
| Hệ điều hành | **Cả iOS và Android, ngang hàng**, phù hợp các phiên bản phổ biến. Tính năng chỉ xong khi chạy đúng trên cả hai; khác biệt nền tảng ghi trong `docs/engineering/platform-support.md`. Sàn phiên bản tối thiểu **chưa chốt** (O-20) | iOS-first hoặc Android-first, nền tảng "phụ" |
| Backend | **Firebase** (backend-as-a-service), không xây backend riêng | NestJS, PostgreSQL, Redis, S3 multipart |
| Nhập đơn | Quét mã hoặc nhập tay; mã chưa có thì tạo nhanh. Dữ liệu đơn **tối giản**: mã đơn + nguồn bán (+ mã vận đơn) để định danh; dòng sản phẩm (tên, variant, số lượng free text) để đối chiếu. Không bắt nhập sản phẩm trước khi quay; tích hợp sàn không bắt buộc | Bắt buộc API sàn, danh mục/SKU, form dài, quản lý bán hàng thu nhỏ |
| Chế độ đóng hàng | Cả đơn lẻ và theo lô, dùng **chung một quy trình và mô hình dữ liệu** | Hai tính năng rời |
| Kiểu video | Video đầy đủ: từ trước khi đóng gói đến khi niêm phong xong | Quay ngắn |
| Tải lên | Tải lên nền, cho làm đơn tiếp theo, trạng thái minh bạch | Chờ tải xong mới cho làm tiếp |
| Lưu trữ | Thời hạn theo gói dịch vụ, có cảnh báo và bảo toàn khi tranh chấp | Thời hạn cố định |

Các quyết định còn mở: xem `docs/README.md#quyết-định-còn-mở`. Không tự chốt thay người dùng.

## Bất biến nghiệp vụ (không được vi phạm trong thiết kế hay mã)

Đây là phần cần đọc nhiều file mới thấy; mọi tính năng phải tuân thủ:

1. **Không "một đơn = một video".** Đơn → nhiều Kiện → nhiều Phiên ghi nhận → nhiều Bằng chứng; đơn có thể có nhiều lượt hoàn và nhiều vụ tranh chấp. Mã đơn/mã vận đơn chỉ là thuộc tính tìm kiếm, **không** phải định danh; mọi đối tượng có ID nội bộ ổn định.
2. **Bằng chứng gắn với ID phiên + ID kiện được tạo trước khi bắt đầu quay**, không suy ra từ mã đơn đang hiển thị. Chuyển sang đơn tiếp theo không được làm thay đổi liên kết của phiên trước.
3. **Trạng thái tệp tách khỏi trạng thái phiên/đơn.** Vòng đời tệp: Đang ghi → Đang lưu trên thiết bị → Chờ tải lên → Đang tải lên → Đã tải lên → Đã xác minh (mã băm khớp), cùng các trạng thái lỗi riêng. Chỉ hiển thị "đã lưu an toàn trên máy chủ" sau khi máy chủ xác nhận và kiểm tra cần thiết thành công.
4. **Bản gốc bất biến.** Không ghi đè/chỉnh sửa video gốc; bản nén/cắt là bản dẫn xuất có liên kết. Quay bổ sung tạo phiên/tài liệu mới, không thay thế. Không xóa bản cục bộ chỉ vì tải lên đã bắt đầu.
5. **Không tự liên kết, không tự kết luận.** Mã không khớp/nhiều kết quả → yêu cầu xác minh, không chọn kết quả đầu tiên. Hàng hoàn không xác định đơn gốc → hồ sơ chưa liên kết. Không tự kết luận nguyên nhân sai lệch hay bên chịu trách nhiệm.
6. **Không dữ liệu giả.** Quên quay thì ghi nhận thiếu bằng chứng, không cho tạo video bổ sung giả như quay lúc đóng hàng. Kiện mở trước khi quay → nhánh ngoại lệ, đánh dấu thiếu bằng chứng quá trình mở.
7. **Mọi thay đổi sau khi bắt đầu quay/sau xác nhận đều lưu lịch sử**; nhật ký kiểm toán không cho người dùng thường sửa/xóa.
8. **Cô lập dữ liệu theo shop** trên mọi truy vấn, kể cả khi đoán ID. Không URL công khai vĩnh viễn tới video.
9. **Không xóa bằng chứng đang bị giữ do tranh chấp**; hạ cấp/hết hạn gói không được xóa ngầm.
10. **Dữ liệu đơn tối giản, nguồn rõ ràng.** Đơn Chứng không quản lý bán hàng (không SKU/giá/khách hàng/tồn kho). Thiếu thông tin sản phẩm không được chặn quay — gắn nhãn *Chưa khai báo sản phẩm*. Không gộp các variant khác nhau. Thông tin do người dùng nhập phải ghi nguồn là do người dùng nhập, không giả định là dữ liệu chính thức từ sàn. Quét mã vận đơn không có nghĩa là lấy được tên sản phẩm.
11. **Ngôn ngữ trung thực:** không quảng cáo "bằng chứng pháp lý tuyệt đối", không hứa thắng khiếu nại, không hứa tải nền vô hạn (iOS/Android giới hạn chạy nền). Mã băm chỉ chứng minh tệp không đổi kể từ lúc tính, không chứng minh thời điểm quay hay tính chân thực; thời gian thiết bị và thời gian máy chủ lưu riêng.

## Quy ước khi viết tài liệu/mã

- Mỗi màn hình đặc tả theo khung: mục đích, thành phần, hành động, trạng thái, lỗi, tiêu chí nghiệm thu. Mã màn hình: `A01–A08` (đóng gói), `B01–B08` (hàng hoàn).
- Có hai bộ mã màn hình, không nhầm lẫn: `A01–A08`/`B01–B08` là đặc tả **quy trình** (docs/04, 05); `UI-A01…UI-J15` là danh mục màn hình **giao diện** (docs/09, bảng ánh xạ ở cuối mục 4). Nhãn trạng thái bằng chứng hiển thị theo bảng ở docs/09 mục 3.
- Thông báo lỗi viết cho người không rành công nghệ: tối đa 2 câu, dưới 20 từ, một ý, từ thường ngày; chỉ nêu ảnh hưởng khi người dùng có thể lo mất dữ liệu; có nút hành động khi có việc làm ngay (quy ước đầy đủ ở `docs/09` mục 5.1). Mã lỗi nghiệp vụ dạng `UPPER_SNAKE_CASE` (ví dụ `ORDER_NOT_FOUND`), danh sách trong `docs/04-*` và `docs/05-*`.
- Thiết kế exception-first: mỗi luồng phải có nhánh ngoại lệ, không chỉ đường thuận.
- UX: người bán dùng phải cực kỳ đơn giản; ưu tiên camera/máy quét, hạn chế gõ, không bắt cấu hình khi đăng ký.
- Công nghệ phục vụ nghiệp vụ: không cắt nghiệp vụ quan trọng chỉ vì Firebase/React Native khó làm; nếu xung đột, ghi vào mục "Hệ quả với Firebase" trong `docs/06-evidence-retention-policy.md` và hỏi người dùng.
