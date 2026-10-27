# Quy ước mã và quy trình — Đơn Chứng

> Quy ước làm việc cho đội. Các quy tắc có thể kiểm tra tự động được thực thi bằng ESLint/TypeScript/test (ghi chú "tự động"); phần còn lại do người review kiểm tra theo [PR template](../../.github/pull_request_template.md). Lựa chọn thư viện và kiến trúc: [architecture.md](architecture.md) (đề xuất, chờ duyệt). Bất biến nghiệp vụ: [CLAUDE.md](../../CLAUDE.md).

Ngôn ngữ: tài liệu và chuỗi giao diện bằng tiếng Việt có dấu; mã, tên biến, tên tệp, commit message bằng tiếng Anh. Comment trong mã: tiếng Việt hoặc tiếng Anh, nhưng thống nhất trong một tệp; ưu tiên giải thích *vì sao* (đặc biệt khi gắn với bất biến nghiệp vụ), không chép lại *cái gì*.

## 1. Lệnh

| Lệnh | Việc |
|---|---|
| `npm ci` | Cài đúng theo `package-lock.json` (Node 22, xem `.nvmrc`) |
| `npm run lint` | ESLint (gồm quy tắc lớp/import, chuỗi UI, `no-console`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run format:check` / `npm run format` | Prettier kiểm tra / sửa |
| `npm test` | Unit test (Jest, project `unit`) |
| `npm run test:rules` | Test Security Rules bằng Firebase Emulator (cần Java 21; tải emulator lần đầu cần mạng) |
| `npm run check` | lint + typecheck + format:check + test |

## 2. Cấu trúc thư mục và đặt tên

Sơ đồ thư mục: [architecture.md mục 3](architecture.md#3-phân-lớp-mã). Quy tắc đặt tên:

| Đối tượng | Quy ước | Ví dụ |
|---|---|---|
| Tệp/thư mục | `kebab-case`; component React `PascalCase.tsx` | `file-state.ts`, `StatusBadge.tsx` |
| Test | Cạnh tệp được test, `<tên>.test.ts(x)` | `file-state.test.ts` |
| Kiểu, interface, class, component | `PascalCase` | `FileState`, `AppError` |
| Hàm, biến | `camelCase`; hàm trả boolean bắt đầu `is/has/can` | `isLocalCopyReleasable` |
| Hằng số/giá trị enum-object | `UPPER_SNAKE_CASE` cho khóa; **giá trị trạng thái** `lower_snake_case` | `FILE_STATES.UPLOAD_FAILED = 'upload_failed'` |
| Mã lỗi nghiệp vụ | `UPPER_SNAKE_CASE`, khóa = giá trị | `ORDER_NOT_FOUND` |
| Khóa i18n | namespace `:` đường dẫn; trạng thái dùng đúng giá trị `lower_snake_case` | `evidence:status.saved_on_device` |
| Trường Firestore | `camelCase`; hậu tố chỉ nguồn thời gian: `…Device` (thiết bị khai), `…Server`/`createdAt` (máy chủ) | `capturedAtDevice`, `createdAtServer` |
| ID | Kiểu branded trong `core/ids`; tên biến kết thúc `Id` | `sessionId: SessionId` |
| Thời lượng / dung lượng | Số nguyên, đơn vị trong tên | `durationMs`, `sizeBytes` |

- **Không để mã đơn/mã vận đơn đóng vai ID.** Tên biến `orderCode`/`trackingCode` luôn là chuỗi tìm kiếm; khóa liên kết luôn là `orderId`… (bất biến #1, #2).
- Không đặt tên trạng thái chung chung (`status`, `done`) cho nhiều máy trạng thái khác nhau: dùng `fileState`, `sessionStatus`, `orderStatus`, `returnCaseStatus` để không trộn trạng thái tệp với phiên/đơn (bất biến #3).
- Một feature chỉ phơi bày API qua `index.ts`.

## 3. Quy tắc lớp và import (tự động bằng ESLint)

| Lớp | Được import | Không được import |
|---|---|---|
| `features/*/domain`, `core` | `core`, kiểu của chính nó | React, React Native, `expo*`, `@react-native-firebase/*`, `firebase*`, `data/`, `ui/`, `platform/`, feature khác (domain) |
| `features/*/data` | `domain` cùng feature, `core`, `platform`, `@/api/contract` (kiểu `ApiClient`), `@/api/create-api` | `ui/`, `api/firebase`, `api/fake`, mọi SDK Firebase |
| `api/contract` | `core` | SDK, React, feature, platform |
| `api/fake`, `api/unavailable` | `api/contract`, `core` | SDK, feature, platform |
| `api/firebase` | `api/contract`, `core`, `@react-native-firebase/*` | feature, platform (**nơi DUY NHẤT gọi SDK Firebase**) |
| `api/create-api.ts` | các hiện thực trong `api/` | feature, SDK |
| `features/*/ui`, `shared/ui` | `domain` (kiểu, hàm thuần), hook/API của `data`, `core/theme`, i18n | SDK Firebase trực tiếp |
| `platform` | thư viện native/Expo | `ui/` |
| `bootstrap` | mọi thứ (composition root) | — |

- Test của feature cần bản giả: import từ `@/api/testing` (không import `@/api/fake` trực tiếp). Đổi backend = thêm `api/<backend>/` + đổi chọn ở `create-api.ts`; feature không đổi. Mọi hiện thực phải qua `api/contract-tests`.
- Import feature khác **chỉ qua** `@/features/<tên>`; cấm `@/features/*/*`.
- Dùng alias `@/` thay cho `../../../`; trong cùng một feature dùng đường dẫn tương đối ngắn.
- **Lý do**: giữ `domain` kiểm thử được không cần thiết bị; một chỗ gọi Firebase để kiểm soát chi phí và bảo đảm truy vấn theo shop; thay thư viện camera/tải nền (còn chờ spike) không đụng nghiệp vụ.
- Lưu ý kỹ thuật: cấu hình flat của ESLint *thay thế* (không gộp) rule `no-restricted-imports` giữa các khối; khi sửa `eslint.config.js` phải giữ `COMMON_PATTERNS` trong mỗi khối.

## 4. TypeScript

`tsconfig.json` bật `strict` và thêm `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`.

- Cấm `any` (ESLint `no-explicit-any`); dùng `unknown` rồi thu hẹp. Cấm non-null assertion `!` (ESLint) — chứng minh bằng kiểm tra, không khẳng định.
- `import type` cho kiểu (ESLint `consistent-type-imports`).
- `switch` trên union/enum phải **vét cạn**: để trình biên dịch báo lỗi khi thêm giá trị (xem `toDisplayStatus`). Không dùng `default:` che giá trị mới.
- Hàm `domain` trả **kết quả tường minh** (`{ ok: true, … } | { ok: false, error }`) cho lỗi dự kiến (chuyển trạng thái sai, dữ liệu không hợp lệ); `throw` chỉ cho lỗi lập trình/bất biến bị vi phạm. Hàm thuần: không đọc đồng hồ, ngẫu nhiên, I/O — truyền vào qua tham số (để test xác định).
- Dữ liệu từ ngoài (Firestore, tệp cấu hình, kết quả quét) phải **được parse/kiểm tra ở biên** (`data/`), không ép kiểu `as`. Dự kiến dùng `zod` khi có tài liệu Firestore đầu tiên.
- `as const` objects cho enum (có thể lặp, có kiểu union) thay vì `enum` của TypeScript.

## 5. Xử lý lỗi và thông báo

- **Mã lỗi nghiệp vụ** chỉ là các mã có trong [docs/04](../04-screen-spec-packing.md) và [docs/05](../05-screen-spec-returns.md), khai báo trong `src/core/errors/codes.ts`. Test kiểm tra: dạng `UPPER_SNAKE_CASE`, mỗi mã có thông báo i18n (`errors:<CODE>`) trừ các mã docs mới mô tả hành vi, và không có thông báo cho mã không tồn tại.
- **Cần mã/thông báo mới → không tự đặt rời rạc.** Ghi đề xuất vào [decisions.md](decisions.md) mục "Mã lỗi đề xuất" để BA đưa vào docs 04/05, rồi mới thêm vào mã. (Hiện đề xuất: nhóm mã tải lên/đồng bộ — xem Q-04.)
- Thông báo người dùng: tối đa 2 câu, dưới 20 từ, từ thường ngày; chỉ nêu ảnh hưởng khi người dùng có thể lo mất dữ liệu; có nút hành động khi có việc làm ngay ([docs/09 mục 5.1](../09-ui-ux-design.md), "Quy ước viết thông báo lỗi"). Thông báo hai câu tách khóa i18n `title` (câu đầu, in đậm) + `hint`. Nhóm `AUTH_*` đã theo quy ước mới; docs/04 "Quy tắc chung" và thông báo các màn khác còn mẫu ba phần cũ, chờ BA rà (việc sau). Không "Có lỗi xảy ra" khi xác định được nguyên nhân.
- Lỗi SDK (Firebase, camera, hệ tệp) được **dịch sang `AppError` ở `data/`/`platform/`**; UI không hiển thị `error.message` thô. `context` của `AppError` chỉ chứa ID nội bộ/giá trị kỹ thuật.
- Không nuốt lỗi (`catch {}` rỗng). Lỗi ảnh hưởng bằng chứng phải đi vào trạng thái có thể thấy được (tệp `needs_attention`/`upload_failed`, phiên `needs_attention`) và được ghi log đã che.
- `permission-denied` của Firestore mơ hồ (không có quyền *hay* xung đột `rev`): đọc lại tài liệu để phân loại trước khi báo cho người dùng.
- Mỗi màn hình có đủ trạng thái **loading / empty / offline / error / retry / success** (docs/04 quy tắc chung).

## 6. i18n và quy tắc giao diện

- **Tiếng Việt là mặc định** (O-17: chế độ tối/ngôn ngữ khác chưa chốt). Mọi chuỗi hiển thị nằm trong `src/core/i18n/locales/vi/*.json`; **cấm văn bản cứng trong JSX** (ESLint `no-restricted-syntax` trên `JSXText`). Chuỗi dài hơn một câu hoặc có tham số dùng nội suy i18n, không nối chuỗi.
- **Nhãn trạng thái bằng chứng đúng [docs/09 mục 3](../09-ui-ux-design.md#3-design-system)**: *Đã lưu trên máy / Chờ tải lên / Đang tải lên / Đã tải lên / Đã xác minh / Lỗi – cần xử lý*. Luôn dùng `EVIDENCE_STATUS_PRESENTATION` + `toDisplayStatus`; không tự dựng nhãn/biểu tượng/màu ở nơi khác.
  - Mỗi nhãn có chữ **và** biểu tượng riêng; màu không là tín hiệu duy nhất. *Đã tải lên* và *Đã xác minh* cùng sắc xanh nhưng khác chữ/biểu tượng.
  - **Không dùng tick xanh/màu thành công cho *Đã lưu trên máy*** (trạng thái chỉ-trên-máy). Test theme kiểm tra.
  - Cụm **"Đã lưu an toàn trên máy chủ" chỉ dùng cho *Đã xác minh***. Không thêm "an toàn" vào *Đã tải lên*. Test i18n kiểm tra.
  - Đỏ chỉ cho lỗi, hành động phá hủy, nguy cơ mất dữ liệu.
- **Không câu chữ hứa quá mức** (bất biến #11): cấm "tuyệt đối", "chống giả mạo", "đã sao lưu" (khi chưa `verified`), "bằng chứng pháp lý", "chắc chắn được sàn chấp nhận", "sẽ tự động hoàn tất", hứa thắng khiếu nại. Test i18n quét danh sách cụm cấm (bổ sung vào `FORBIDDEN` trong `i18n.test.ts` khi phát hiện cụm mới). Thay bằng: "Sẽ tiếp tục khi có thể; mở app nếu bị tạm dừng".
- Mã băm: chỉ diễn đạt đúng nội dung "tệp không đổi kể từ lúc tính"; không nói chứng minh thời điểm quay hay tính chân thực. Thời gian thiết bị và thời gian máy chủ hiển thị riêng, có nhãn.
- Thông tin người dùng nhập: ghi nguồn "do người dùng nhập"; không trình bày như dữ liệu từ sàn. Thiếu thông tin sản phẩm → nhãn *Chưa khai báo sản phẩm*, không chặn quay.
- Nút chính có nhãn cụ thể (*Lưu và quay video*, *Giữ video và quay lại*), tránh "OK/Tiếp tục" mơ hồ. Hộp thoại xác nhận chỉ cho xóa, đóng hồ sơ, đổi quan trọng, rời phiên quay.
- Cỡ chữ/vùng chạm lấy từ `core/theme` (≥ 44pt iOS / 48dp Android; không khóa font scale). Màu/typography dùng token, không hex rải rác. Giá trị màu hiện là **tạm** (docs/09 chưa có Figma).
- Không dùng mockup `docs/assets/ui/` làm căn cứ cuối: đối chiếu [docs/09 mục 5.5](../09-ui-ux-design.md#55-đối-chiếu-mockup-với-đặc-tả) trước khi làm theo.
- Có hai bộ mã màn hình, không nhầm: `A01–A08`/`B01–B08` (đặc tả quy trình) và `UI-A01…UI-J15` (danh mục giao diện). Ghi cả hai khi tham chiếu trong PR.

## 7. Log và dữ liệu cá nhân (PII)

- Chỉ ghi log qua `src/core/logging/logger.ts` (ESLint cấm `console`). Logger **che** các khóa nhạy cảm (mã đơn, mã vận đơn, mã hoàn, mã quét, tên/SĐT/địa chỉ, ghi chú, tên sản phẩm/variant, token, URL ký, session URI). Đó là lưới an toàn thứ hai: người viết vẫn không được đưa dữ liệu nhạy cảm vào log.
- Log bằng **ID nội bộ và trạng thái** (`evidenceId`, `sessionId`, `state`, mã lỗi), không bằng mã đơn.
- Không gửi mã đơn/mã vận đơn/thông tin khách vào dịch vụ crash/analytics. Chưa chọn dịch vụ crash/analytics (quyết định riêng, cần duyệt); khi chọn phải cấu hình bộ lọc dữ liệu trước khi gửi và tắt thu thập vị trí/danh bạ (UI-A05: không xin danh bạ/vị trí).
- Ảnh chụp màn hình/video trong PR không chứa dữ liệu khách thật (mẫu PR đã nhắc).
- Thu thập tối thiểu: chỉ thu thập phiên bản app và thông tin thiết bị tối thiểu cần để điều tra sự cố (docs/06).

## 8. Bảo mật

- **Không bí mật trong app**: không khóa dịch vụ, khóa ký, khóa API ngoài Firebase config. Tệp `google-services.json`/`GoogleService-Info.plist` và `.env*` nằm ngoài git (`.gitignore`); nạp theo môi trường lúc build. Không thêm bí mật vào `.github/workflows`.
- **Mọi thay đổi Rules có test Emulator** cùng PR, gồm truy cập chéo shop (QA-11) và trường hợp bị từ chối. Quy tắc viết Rules: mặc định từ chối; mỗi collection chỉ mở khi có tính năng; `create` dùng `hasOnly/hasAll` + kiểu + `== request.time` cho thời gian máy chủ; `update` dùng `affectedKeys().hasOnly(...)`; không cho client `delete` dữ liệu nghiệp vụ; client không ghi `server.*`, `auditEvents`, `members`, `retention`.
- Mỗi truy vấn Firestore **bắt buộc nằm dưới `shops/{shopId}`**; không có truy vấn collection-group nếu chưa có Rules và test cho nó.
- Không dùng `getDownloadURL()`/URL công khai vĩnh viễn; đọc video qua URL có thời hạn do Function cấp.
- Không client nào xóa tệp bằng chứng cục bộ ngoài `releaseLocalCopy` (điều kiện: `isLocalCopyReleasable` + chính sách + đã thông báo).
- Không "last write wins" im lặng với dữ liệu bằng chứng: dùng `rev`/bất biến (architecture mục 10).
- Thêm dependency: mục 10.

## 9. Dữ liệu

- ID nội bộ sinh ở client, dùng làm ID tài liệu; thử lại phải idempotent (cùng ID).
- Thay đổi trường quan trọng sau khi bắt đầu quay/sau xác nhận: tăng `rev`, có dòng audit do máy chủ ghi (bất biến #7). Không tự viết `auditEvents` từ client.
- Bản gốc bất biến; bản dẫn xuất tạo bởi Function, có liên kết bản gốc (bất biến #4).
- Không tự liên kết/tự chọn kết quả đầu/tự kết luận nguyên nhân (bất biến #5): nhiều kết quả → bắt người dùng chọn; hàng hoàn không rõ đơn gốc → hồ sơ chưa liên kết.
- Không tạo dữ liệu giả (bất biến #6): không có đường mã nào tạo video "bổ sung" mạo là quay lúc đóng hàng.
- Đổi cấu trúc dữ liệu đã triển khai → có kế hoạch tương thích với bản app cũ (ghi trong PR mục "Rủi ro").

## 10. Thêm hoặc nâng cấp thư viện

1. Kiểm tra phiên bản hiện hành và tình trạng bảo trì (ngày phát hành gần nhất, issue mở, tương thích RN/Expo SDK hiện tại và New Architecture); ghi **ngày kiểm tra** vào [architecture.md mục 11](architecture.md#11-lựa-chọn-thư-viện-đề-xuất-chờ-duyệt) hoặc ADR.
2. Thư viện có mã native (camera, tải nền, mã băm…) phải qua spike trên thiết bị thật trước khi khóa ([architecture mục 12](architecture.md#12-kế-hoạch-spike-trước-khi-khóa-thư-viện-cần-thiết-bị-thật-ios--android)) và được người dùng duyệt.
3. Với gói Expo dùng `npx expo install <gói>` để lấy phiên bản khớp SDK. Dùng `npm ci` + commit `package-lock.json`.
4. Kiểm tra giấy phép tương thích phát hành thương mại.
5. Không thêm thư viện cho nhu cầu chưa tới; không thêm tiện ích dùng một lần.

## 11. Git, commit, nhánh, PR

- **Nhánh**: từ `main`, tên `<loại>/<mô-tả-ngắn>` (ví dụ `feat/packing-session-link`, `fix/upload-reconcile`, `docs/retention-policy`, `chore/ci`). Nhánh do công cụ tạo có thể có tiền tố riêng. Không commit thẳng vào `main`.
- **Commit message: Conventional Commits**, tiếng Anh, dạng mệnh lệnh, ≤ 72 ký tự ở dòng đầu:
  `<type>(<scope>): <mô tả>` — `type` ∈ `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`; `scope` là tên feature hoặc vùng (`evidence`, `upload`, `rules`, `functions`, `i18n`, `theme`, `ci`).
  Ví dụ: `feat(evidence): reject client-origin transitions to verified`. Thay đổi phá vỡ: `!` sau scope và `BREAKING CHANGE:` ở thân. Thân commit giải thích *vì sao*, nêu bất biến/QA liên quan khi có.
- **PR**: dùng [.github/pull_request_template.md](../../.github/pull_request_template.md); điền mã màn hình (A/B và UI-), quyết định D-xx/O-xx, QA-xx ảnh hưởng, lệnh đã chạy + kết quả thật, và **phần chưa kiểm chứng** (đặc biệt: chưa thử trên thiết bị thật iOS/Android). PR đổi hành vi nghiệp vụ phải có người dùng chốt. PR nhỏ, một mục đích.
- CI (`.github/workflows/ci.yml`) chạy trên PR vào `main`: lint, typecheck, format:check, unit test, test Rules. PR chỉ hợp nhất khi CI xanh.

## 12. Định nghĩa "xong" (Definition of Done)

Một thay đổi mã chỉ được báo "xong" khi **tất cả** điều dưới đây đúng và được nêu bằng lệnh + kết quả thật trong PR:

- [ ] `npm run lint`, `npm run typecheck`, `npm run format:check` sạch.
- [ ] `npm test` xanh; mã nghiệp vụ trọng yếu (máy trạng thái tệp, hàng đợi, khôi phục phiên, liên kết phiên–kiện) có unit test cho đường thuận **và** nhánh ngoại lệ.
- [ ] Đổi `firestore.rules`/`storage.rules` → `npm run test:rules` xanh, có test truy cập chéo shop và test từ chối cho mọi trường hợp mới.
- [ ] Đổi Function → test hợp đồng (testing.md mục 4) xanh.
- [ ] Luồng ghi hình/tải lên/phục hồi: kịch bản QA tương ứng đã chạy trên thiết bị thật iOS **và** Android (ghi máy, phiên bản hệ điều hành), hoặc ghi rõ "chưa kiểm chứng trên thiết bị" ở mục "Chưa kiểm chứng được". **Không** tuyên bố đã chạy trên thiết bị khi chỉ chạy unit test/emulator.
- [ ] Chuỗi UI qua i18n; nhãn trạng thái đúng docs/09 mục 3; không câu chữ hứa quá mức; mã lỗi/thông báo khớp docs/04–05.
- [ ] Không log dữ liệu nhạy cảm; không bí mật trong mã/CI.
- [ ] Cập nhật `docs/` (kể cả mục "Hệ quả với Firebase" của docs/06) và `CLAUDE.md` nếu thêm lệnh hoặc quyết định; quyết định kỹ thuật mới được ghi vào [decisions.md](decisions.md).
- [ ] Mục "Nguyên tắc nghiệp vụ" của PR template đã đánh dấu đúng với phần PR chạm tới.
