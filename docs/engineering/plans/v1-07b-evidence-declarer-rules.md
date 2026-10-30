# V1-07b — evidence-declarer-rules

Nguồn: `decisions.md` Q-29 / V1-07 dòng 8 (đề xuất phòng thủ thêm), `architecture.md` mục hàng đợi ("Rules chưa ép người khai báo trùng người tạo phiên"). Điều phối đã chốt v1: một máy một tài khoản (Q-24g = A), đa thành viên (O-03) để sau v1, nên **máy chủ ép người khai báo/tải bằng chứng là người tạo phiên (đóng gói) hoặc người tạo từng media (hàng hoàn)**. Sửa sau review PR #64: bản đầu ép người tạo bản neo hàng hoàn, gây hồi quy (xem cuối tệp).

## Mục tiêu

App đã tự lọc (V1-07); PR này đưa cùng điều kiện lên máy chủ để một client sửa đổi hoặc lỗi logic phía app không khai báo/tải hộ bằng chứng cho phiên/hồ sơ của người khác (kiểm toán sai người, bất biến 2, 5, 7).

## Nơi khai báo/tải bằng chứng (đã rà)

| Đường | Tệp | Trước PR | Sau PR |
|---|---|---|---|
| Tạo tài liệu `shops/{shopId}/evidence/{id}` (client) | `firebase/firestore.rules` | `createdBy == auth.uid`; phiên tồn tại và khớp đơn/kiện; hồ sơ hoàn `exists` | thêm `sessions/{sessionId}.createdBy == auth.uid` (đóng gói); hàng hoàn giữ `exists` bản neo (đơn vị sở hữu là từng media, `createdBy == auth.uid` đã ép người khai báo) |
| Cập nhật trạng thái phía thiết bị của tài liệu bằng chứng | `firestore.rules` | mọi thành viên `canManageOrders` | thêm `resource.data.createdBy == auth.uid` (app hiện không dùng đường này; chặn người khác đổi `clientFileState` của bằng chứng không phải của mình) |
| Xin URL ký tải bản gốc (`createUploadSession`) | `functions/src/uploads.ts` | `evidence.createdBy == uid`; hồ sơ hoàn tồn tại | thêm: phiên tồn tại + `createdBy == uid` (đóng gói); hàng hoàn chỉ kiểm bản neo tồn tại; lỗi kèm `details.reason` |
| `verifyEvidence` (trigger Storage), `reverifyEvidence`, đối soát `server.state` | `evidence.ts`, `reverify.ts` | Admin SDK, không đọc người tạo | **không đổi** (không phải đường khai báo; chỉ xử lý đối tượng đã có) |

## Thiết kế

- **Rules**: hai điều kiện mới trong nhánh tạo bằng chứng; không thêm `get` thừa (phiên đã được `get` để so đơn/kiện, Firestore gộp cùng tài liệu). Hồ sơ hoàn đổi `exists` -> `get(...).data.createdBy == auth.uid`.
- **Function** `createUploadSessionForUser`: thứ tự giữ nguyên tới nhánh `already_received` (bản gốc đã có hoặc máy chủ đã có trạng thái -> không cấp URL, chỉ đặt yêu cầu xác minh lại cho chính người khai báo). Kiểm người tạo phiên (đóng gói) đặt **trước khi ký URL** (sau nhánh `already_received`), để bằng chứng cũ (khai báo trước PR) kẹt "Đã tải lên" vẫn được người khai báo nhờ máy chủ xác minh lại, nhưng không ai xin được URL mới cho phiên của người khác.
  - `UploadError` thêm `reason` tùy chọn: `not_evidence_declarer` (bằng chứng do tài khoản khác khai báo; trước đây không có lý do), `not_session_creator` -> `permission-denied`; `session_missing` -> `failed-precondition` (phiên không tồn tại/ID sai); hồ sơ hoàn không có giữ `failed-precondition` (thêm lý do `return_missing`).
  - `describeCallableError` chuyển `reason` của `UploadError` vào `details` (không lộ thông điệp gốc).
- **App** (`features/upload/data/firebase-ports.ts`): lỗi callable có `details.reason` thuộc ba lý do người tạo -> `UploadPortError('attention', 'NOT_EVIDENCE_CREATOR')` (mã nội bộ `lastErrorCode`, không phải mã lỗi nghiệp vụ, cùng loại `LOCAL_HASH_CHANGED`). Đưa `NOT_EVIDENCE_CREATOR` vào `NON_RETRYABLE_ATTENTION_CODES` (bấm Thử lại không đổi được người tạo); Trung tâm đồng bộ hiện lý do mới `notCreator`: "Chỉ tài khoản đã tạo phiên quay hoặc hồ sơ này mới tải lên được. Tệp vẫn còn trên máy." Khai báo Firestore bị Rules từ chối: Rules không có lý do, giữ `retryable` (8 lượt rồi "cần xử lý", có giới hạn), vì app đã chỉ khai báo khi phiên/neo đăng bởi chính uid.
- Không migration, không trạng thái tệp mới (bất biến 3), không xóa gì (bất biến 4).

## Test

- Emulator Rules (`firebase/tests/rules/evidence-declare.rules.test.ts`): đóng gói: đúng người tạo phiên được, thành viên khác cùng shop (owner, manager) bị từ chối; hàng hoàn: thành viên khác khai báo media của chính mình trong hồ sơ có bản neo của người khác được, khai báo với `createdBy` người khác bị từ chối; người ngoài shop bị từ chối; phiên/bản neo không tồn tại bị từ chối; cập nhật trạng thái thiết bị chỉ người khai báo. Fixture `helpers.ts`: phiên/bằng chứng nền do `packerA` tạo (trước là `'seed'`).
- Functions (`firebase/tests/functions/uploads.test.ts`, chạy trong `test:rules`): đúng người tạo được ký; người khác cùng shop -> `permission-denied` + `reason`, không ký, không kiểm toán; phiên/bản neo thiếu -> `failed-precondition`; bằng chứng cũ đã có đối tượng vẫn `already_received`.
- `callable-errors` (unit qua test functions): `details.reason` có mặt.
- Jest app: `firebase-ports.test.ts` map lý do; `file-state` không cho thử lại; `sync-jobs` lý do `notCreator`.

## Màn hình

Không có thay đổi giao diện (chỉ thêm một câu lý do ở Trung tâm đồng bộ cho trường hợp hiếm; có test, không chụp).

## Tài liệu

decisions (mục mới + sửa dòng 8 V1-07), architecture.md (mục hàng đợi), firebase-setup.md + release-checklist (deploy Rules + Functions), CHANGELOG (Security).

## Rủi ro

- Phải deploy Rules và Functions **cùng lúc** với bản app; app cũ (trước V1-07) có thể khai báo hộ, nay bị từ chối 8 lượt rồi "cần xử lý" (đúng ý: không tải hộ).
- Bằng chứng đã khai báo hộ trước PR (dev) mà chưa có bản gốc: không ai tải được nữa (đúng chính sách; chưa có dữ liệu production).
- Khi làm đa thành viên (O-03) phải nới lại điều kiện này có chủ đích (ghi ở decisions).
- Kích thước: nhỏ (~200 dòng mã + test).

## Tự review

Vòng 1: (1) Ban đầu định đặt kiểm người tạo phiên ngay sau kiểm `evidence.createdBy` (trước nhánh `already_received`): sẽ làm bằng chứng cũ kẹt "Đã tải lên" không bao giờ được xác minh lại -> dời xuống ngay trước khi ký URL. (2) Khai báo Firestore bị từ chối không có lý do: không đọc thêm tài liệu phiên để phân loại (tốn lượt đọc, hiếm) -> giữ `retryable` có trần 8 lượt. (3) Thêm điều kiện cho `update` để không thành viên nào đổi trạng thái thiết bị của bằng chứng người khác; app không dùng nên không rủi ro hồi quy. Bất biến 2, 3, 4, 5, 7, 8, 11 giữ; không câu chữ hứa hẹn.

Tự review: đã chấp nhận.

## Sửa sau review PR #64 (lỗi chặn)

Kịch bản: A tạo hồ sơ hàng hoàn và đăng bản neo; B đăng nhập trên cùng máy, chụp thêm ảnh ở D03. Bản đầu ép `returns/{returnId}.createdBy == auth.uid` (Rules) và `not_return_creator` (Function) nên ảnh của B kẹt mãi, B bị chặn Đăng xuất an toàn, câu `case_owner` thành lời hứa sai. Điều phối chốt phương án (b): với hàng hoàn, đơn vị sở hữu là **từng media** (như phiên với đóng gói; khớp V1-07 dòng 7b). Đã sửa:

- Rules: nhánh hàng hoàn quay lại `exists(returns/{returnId})` cùng shop; vẫn giữ `createdBy == auth.uid` khi tạo và giới hạn cập nhật chỉ người khai báo. Phía đóng gói giữ nguyên.
- Function: bỏ kiểm người tạo bản neo và lý do `not_return_creator`; giữ `return_missing` và `not_evidence_declarer`.
- App: bỏ `not_return_creator` khỏi danh sách lý do vĩnh viễn; câu `notCreator` đổi thành "Chỉ tài khoản tạo tệp hoặc phiên quay này mới tải lên được. Tệp vẫn còn trên máy."
- Test: emulator (media của B trong hồ sơ của A được; khai báo với `createdBy` của người khác bị từ chối; media của người khác không cập nhật được), Function (B tải media của chính B trong hồ sơ của A được ký).
- Bảng "Nơi khai báo" phía trên: dòng Rules tạo/`createUploadSession` cho hàng hoàn nay chỉ kiểm bản neo tồn tại.

