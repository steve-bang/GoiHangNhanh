# Kiến trúc kỹ thuật — Đơn Chứng

> **Trạng thái: ĐỀ XUẤT, CHỜ DUYỆT.** Công nghệ nền (React Native + Firebase, không backend riêng) đã chốt ở D-03. Mọi lựa chọn kỹ thuật bên dưới *không* nằm trong D-xx và chưa được người dùng duyệt; chúng được đánh số ADR-xx trong [decisions.md](decisions.md). Không mục nào ở đây chốt câu hỏi mở O-xx.
>
> Ngày kiểm tra phiên bản/bảo trì thư viện: **2026-10-26** (nguồn: npm registry, tài liệu chính thức; chi tiết ở mục 11). Phần chưa kiểm chứng trên thiết bị thật được ghi rõ là *cần spike* (mục 12).

Tài liệu nghiệp vụ là nguồn sự thật. Khi kỹ thuật và nghiệp vụ xung đột: dừng, ghi vào [decisions.md](decisions.md) và mục "Hệ quả với Firebase" của [docs/06](../06-evidence-retention-policy.md), hỏi người dùng. Chữ "bất biến #n" trỏ tới danh sách trong [CLAUDE.md](../../CLAUDE.md).

## 1. Mục tiêu và ràng buộc thiết kế

Kiến trúc được suy ra từ các bất biến, không từ sở thích công nghệ:

| Yêu cầu nghiệp vụ | Hệ quả kiến trúc |
|---|---|
| Bằng chứng gắn ID phiên + kiện tạo *trước* khi quay (#2) | Sinh ID phía client (offline được), tạo tài liệu phiên trước khi mở camera; ID là khóa chính ở mọi nơi |
| Trạng thái tệp tách khỏi phiên/đơn; không hiện "đã sao lưu" trước khi máy chủ xác nhận (#3) | Máy trạng thái tệp riêng (mục 5); trạng thái do máy chủ xác lập nằm trong vùng dữ liệu client không ghi được |
| Bản gốc bất biến, không xóa bản cục bộ khi tải lên mới bắt đầu (#4) | Storage chỉ-ghi-một-lần qua phiên tải do máy chủ cấp; một cổng duy nhất để giải phóng bản cục bộ |
| Không hứa tải nền vô hạn (#11); app có thể bị kill | Hàng đợi bền trên SQLite + tải nền của hệ điều hành + đối soát khi mở lại (mục 7) |
| Cô lập theo shop kể cả khi đoán ID (#8) | Mọi dữ liệu dưới `shops/{shopId}`; Security Rules + test truy cập chéo; Storage từ chối client |
| Bước tin cậy không do client quyết (docs/06) | Cloud Functions (mục 8) |
| Lịch sử, nhật ký không sửa được (#7) | `auditEvents` chỉ máy chủ ghi; sửa đổi quan trọng có `rev` + trigger ghi lịch sử |
| Dữ liệu đơn tối giản, ghi nguồn (#10) | `dataSource` bắt buộc; Rules ép client chỉ tạo `user_entered` |

## 2. Tổng quan

```
┌──────────────────────────── Thiết bị (React Native / Expo dev build) ────────────────────────────┐
│  ui (màn hình)  →  domain (quy tắc, máy trạng thái)  ←  data (repository)  →  platform (adapter) │
│                                                                                                  │
│  Lưu cục bộ bền (sống sót khi app bị kill):                                                      │
│    • Tệp video/ảnh: thư mục dữ liệu app (không phải cache)                                       │
│    • SQLite: phiên đang ghi, trạng thái tệp phía thiết bị, hàng đợi tải lên, nhật ký thử lại     │
│    • Firestore offline cache: bản sao dữ liệu máy chủ + hàng ghi chờ đồng bộ (do SDK quản lý)    │
└──────────────┬───────────────────────────────┬──────────────────────────────┬────────────────────┘
               │ Auth (ID token)                │ Firestore (Rules)             │ HTTPS (callable)
               ▼                                ▼                              ▼
        Firebase Auth                 Cloud Firestore                  Cloud Functions
                                      shops/{shopId}/…                 • cấp phiên tải / URL đọc
                                                                       • xác minh mã băm
        Cloud Storage  ◄───── phiên tải có thể tiếp tục (resumable) ───• ghi nhật ký kiểm toán
        (client bị Rules       do Function cấp, client PUT thẳng       • dọn theo hạn lưu, xuất hồ sơ
         từ chối hoàn toàn)    vào đối tượng đã định sẵn               • quản lý thành viên, gói
```

- **Không backend riêng** (D-03): "backend" = Firebase Auth, Firestore, Storage, Cloud Functions, Security Rules. Cloud Functions là mã chạy trong hệ sinh thái Firebase, đúng với docs/06.
- **Môi trường** (ADR-009, đề xuất): ba dự án Firebase `dev` / `staging` / `prod` + Emulator Suite cục bộ (project id giả `demo-doncung`). Tệp cấu hình Firebase của app (`google-services.json`, `GoogleService-Info.plist`) là cấu hình định danh dự án, không phải bí mật cho phép truy cập — nhưng vẫn không commit vào repo; nạp lúc build theo môi trường. Bảo vệ thật nằm ở Rules, App Check và quyền Functions.
- **App Check** (đề xuất, ADR-009): bật cho Firestore/Functions để giảm lạm dụng từ client giả; không thay thế Rules.

## 3. Phân lớp mã

Cấu trúc `src/` (đã dựng khung; ESLint thực thi, xem [conventions.md](conventions.md) mục 3):

```
src/
  bootstrap/     Composition root: provider, khởi tạo i18n/Firebase/hàng đợi. Không chứa nghiệp vụ.
  core/          TypeScript thuần dùng chung: errors, ids (branded), i18n, theme tokens, logging.
  features/<f>/
    domain/      Kiểu, quy tắc, máy trạng thái, hàm thuần. KHÔNG import React/Expo/Firebase.
    data/        Repository/adapter: SQLite, hàng đợi; dùng backend qua hợp đồng `ApiClient` (không gọi SDK Firebase).
    ui/          Màn hình/component/hook. Không gọi Firebase trực tiếp.
    index.ts     Public API; feature khác chỉ import từ đây.
  api/           Lớp API: `contract/` (giao diện thuần), `firebase/` (NƠI DUY NHẤT gọi SDK Firebase), `fake/`, `unavailable/`,
                 `create-api.ts` (chọn hiện thực), `contract-tests/` (bộ test chung cho mọi hiện thực).
  platform/      Adapter cho API native (camera, quét mã, hệ tệp, mạng, tải nền, sinh ID).
  shared/ui/     Component dùng chung theo design system (docs/09 mục 3).
firebase/        firebase.json, firestore.rules, storage.rules, tests/rules, functions/
docs/engineering/
```

Hướng phụ thuộc: `ui → domain ← data → platform`; `core` không phụ thuộc ai; `domain` chỉ phụ thuộc `core`. Lý do:

- **Nghiệp vụ trọng yếu kiểm thử được không cần thiết bị**: máy trạng thái tệp, liên kết phiên–kiện, hàng đợi (logic), phục hồi phiên đều là hàm thuần trong `domain` → unit test nhanh trong CI. Mã camera/tải nền chỉ kiểm chứng đầy đủ trên máy thật (xem [testing.md](testing.md)).
- **Thay thư viện camera/tải nền không đụng nghiệp vụ**: các lựa chọn ở mục 11 còn chờ duyệt và có khả năng đổi sau spike; `domain` định nghĩa giao diện (port), `platform` hiện thực.
- **Lớp API tách backend khỏi app**: đổi backend phía app = viết `api/<backend>/` và đổi một dòng ở `create-api.ts`. Rules, Functions, `firebase/` ở gốc repo là phần máy chủ của hiện thực Firebase, phải làm lại riêng nếu đổi backend.
- **Một chỗ gọi Firebase** (`api/firebase`) giúp kiểm soát chi phí đọc/ghi (mục 13) và đảm bảo mọi truy vấn đều có `shopId`.

Feature dự kiến: `shop`, `orders`, `packing`, `returns`, `evidence`, `upload`, `disputes` (+ `retention`/`plans` phía hiển thị khi cần). Ánh xạ màn hình: `A01–A08`/`B01–B08` (docs/04–05) và `UI-*` (docs/09) → feature tương ứng; mã `A/B` là đặc tả quy trình, `UI-` là danh mục giao diện.

## 4. Mô hình dữ liệu (Firestore + Storage)

### 4.1 Quy ước chung

- **ID nội bộ ổn định, sinh ở client** (UUID/ULID, branded type trong `core/ids`) và dùng làm ID tài liệu. Hệ quả: tạo ngoại tuyến được, **thử lại là idempotent** (cùng ID → không tạo bản ghi trùng; Rules chặn ghi đè). Mã đơn/mã vận đơn **không bao giờ** là ID (bất biến #1); chỉ là trường tìm kiếm kèm bản chuẩn hóa `…Normalized`.
- **Mọi dữ liệu dưới `shops/{shopId}/…`**, mỗi tài liệu mang `shopId` (Rules kiểm tra khớp đường dẫn). Truy vấn luôn giới hạn trong một shop.
- **Hai loại thời gian tách riêng** (docs/06): `…Device` do thiết bị khai báo (có thể sai), `…Server` / `createdAt`/`startedAtServer` do máy chủ đặt (`serverTimestamp()` — Rules ép bằng `== request.time`). Không dùng thời gian thiết bị làm căn cứ duy nhất.
- **`dataSource`** trên giá trị người dùng nhập = `user_entered`; Rules không cho client ghi giá trị khác (bất biến #10). Giá trị `synced` chỉ dành cho tích hợp sau này (Function ghi).
- **`rev`** (số nguyên tăng đúng 1 mỗi lần sửa) trên tài liệu có thể sửa bởi nhiều thiết bị; Rules yêu cầu `rev == cũ + 1` → hai thiết bị cùng sửa thì bên sau bị từ chối chứ không ghi đè âm thầm (UI-J13). Lưu ý: Rules chỉ trả `permission-denied`; client phải đọc lại để phân biệt "xung đột" với "không có quyền".
- **Không xóa cứng** từ client: Rules cấm `delete` trên mọi collection nghiệp vụ. Hủy đơn là đổi `status`. Việc xóa theo hạn lưu do Function thực hiện (mục 8).
- **Ảnh chụp dữ liệu đơn lúc bắt đầu phiên** (`orderSnapshot`) nằm trong tài liệu phiên và bất biến (docs/02).

### 4.2 Ánh xạ đối tượng docs/02 → collection

| Đối tượng (docs/02) | Đường dẫn | Client ghi? | Ghi chú |
|---|---|---|---|
| Shop | `shops/{shopId}` | Không (Function) | Gói dịch vụ/hạn mức: trường trong shop hoặc `plan` (chờ O-06) |
| Thành viên | `shops/{shopId}/members/{uid}` | Không (Function) | `roles[]`, `status` (`active`/`revoked`). Nguồn quyền cho Rules |
| Đơn hàng | `shops/{shopId}/orders/{orderId}` | Có (Rules) | `orderCode`, `source`, `trackingCode?`, `status`, `dataSource`, `rev`… |
| Dòng sản phẩm | `…/orders/{orderId}/lines/{lineId}` | Có | `name`, `variant?`, `quantity`; mỗi variant một dòng, không gộp |
| Kiện hàng | `…/orders/{orderId}/packages/{packageId}` | Có | Mỗi kiện có ID riêng |
| Lượt vận chuyển | `…/orders/{orderId}/shipments/{id}` | *(chưa có Rules)* | Đi/hoàn, mã vận đơn |
| Phiên ghi nhận | `shops/{shopId}/sessions/{sessionId}` | Có (hạn chế) | `orderId`, `packageId` bất biến; `orderSnapshot` bất biến; chỉ đổi `status`, `interruptions`, `note` |
| Bằng chứng (Media Asset) | `shops/{shopId}/evidence/{evidenceId}` | Có (hạn chế) | Xem 4.3; bản dẫn xuất chỉ Function tạo |
| Hồ sơ hàng hoàn | `shops/{shopId}/returnCases/{id}` | *(chưa có Rules)* | `linkedOrderId` nullable; liên kết qua `linkEvents` (ai/lúc nào/căn cứ) |
| Sai lệch | `…/returnCases/{id}/discrepancies/{id}` | *(chưa có Rules)* | Dữ liệu thực nhận là bản ghi riêng, không ghi đè dữ liệu dự kiến |
| Vụ tranh chấp | `shops/{shopId}/disputes/{id}` | *(chưa có Rules)* | Tham chiếu bằng ID; đặt cờ giữ trên bằng chứng (Function) |
| Bộ bằng chứng xuất | `shops/{shopId}/exports/{id}` | Không (Function) | Manifest + tệp trong Storage |
| Sự kiện kiểm toán | `shops/{shopId}/auditEvents/{id}` | **Không bao giờ** | Chỉ Function/trigger ghi; đọc: chủ shop, quản lý, người xử lý tranh chấp |

"Chưa có Rules" nghĩa là **bị từ chối mặc định** cho tới khi tính năng tương ứng được làm cùng Rules + test; không mở trước.

### 4.3 Bằng chứng (Media Asset) — hai vùng ghi tách biệt

```
evidence/{evidenceId}
  # Vùng client khai báo, bất biến sau khi tạo (trừ trạng thái phía thiết bị)
  shopId, sessionId, orderId, packageId      # liên kết bằng ID; Rules kiểm tra khớp phiên
  kind: 'original_video' | 'photo'           # 'derived' chỉ Function tạo
  origin: 'in_app_capture'                   # nhập thư viện (O-02) chưa được phép
  sha256Client, sizeBytes, durationMs, mimeType
  capturedAtDevice, createdAtServer, createdBy, appVersion
  # Vùng client cập nhật được (tập giá trị bị giới hạn)
  clientFileState: 'queued' | 'uploading' | 'upload_failed' | 'needs_attention' | 'unrecoverable'
  lastError?, retryCount?
  # Vùng CHỈ máy chủ ghi (client không ghi được; Rules cấm)
  server: { state: 'uploaded'|'verified'|'hash_mismatch', receivedAt, sha256Server,
            verifiedAt, storagePath, sizeBytesServer }
  retention: { policyId, startedFrom, expiresAt, hold: { disputeIds[] } }   # Function quản lý (O-06)
```

- Tài liệu bằng chứng được tạo khi tệp đã **đóng, đọc được và đã tính mã băm** (trạng thái `queued`). Các trạng thái `recording`/`saving_local` chỉ tồn tại cục bộ (SQLite) — vừa tiết kiệm ghi Firestore, vừa tránh bản ghi "ma" cho tệp chưa tồn tại. Phiên thì được tạo *trước* khi quay.
- Trạng thái hiển thị là hàm của (`server.state` nếu có, nếu không thì trạng thái phía thiết bị). `uploaded`/`verified`/`hash_mismatch` **chỉ** đến từ `server.*` (mục 5).
- `sha256Client` là giá trị *khai báo*; máy chủ tính lại và so (docs/06: không tin giá trị client). Không khớp → `hash_mismatch`, cách ly, ghi audit.

### 4.4 Storage (client bị từ chối hoàn toàn — ADR-006, chờ duyệt)

```
shops/{shopId}/evidence/{evidenceId}/original            bản gốc, tạo đúng một lần
shops/{shopId}/evidence/{evidenceId}/derived/{derivId}   xem trước/nén; liên kết bản gốc
shops/{shopId}/exports/{exportId}/…                      bộ hồ sơ xuất
```

- `storage.rules` = từ chối mọi truy cập client. Tải lên qua **phiên tải có thể tiếp tục** (resumable session URI của Cloud Storage) do Function `createUploadSession` cấp sau khi kiểm tra: người gọi là thành viên có quyền, tài liệu bằng chứng tồn tại ở trạng thái chưa tải, đường dẫn đích = `…/{evidenceId}/original`. Đọc qua URL có thời hạn do Function `createReadUrl` cấp (ghi audit "đã xem").
- **Không dùng `getDownloadURL()` phía client**: URL kèm token không hết hạn → vi phạm bất biến #8.
- Session URI là **bearer capability** (ai có URL là ghi được vào đối tượng đó): coi như bí mật, không log (logger đã che `sessionUri`), thời hạn ngắn, chỉ dùng một lần cho một đối tượng.
- Phương án thay thế (B): dùng SDK Firebase Storage từ client với Rules (đơn giản hơn, Rules thực thi trực tiếp) — nhưng upload của SDK này không được thiết kế để tiếp tục khi app bị hệ điều hành dừng (*chưa kiểm chứng*, cần spike S2) và không tải nền → khó đáp ứng D-07. Xem ADR-006.

## 5. Máy trạng thái tệp (đã hiện thực: `src/features/evidence/domain/file-state.ts`)

Độc lập hoàn toàn với trạng thái phiên và đơn (module không import gì về chúng). Hàm thuần `transition(state, event)`; sự kiện mang `origin: 'device' | 'server'`.

```
 recording ──STOP──► saving_local ──LOCAL_FILE_READABLE──► queued ──UPLOAD_STARTED──► uploading
     │                    │                                  ▲  ▲                         │
     │ RECOVERY_FOUND_FILE│(đọc lại kiểm tra)               │  └──RETRY_UPLOAD── upload_failed ◄─UPLOAD_FAILED
     └──────────►─────────┘                                  └─ATTENTION_RESOLVED─ needs_attention
                                                                                         
 [server] queued|uploading|upload_failed|needs_attention ──SERVER_RECEIVED──► uploaded
 [server] uploaded ──SERVER_VERIFIED──► verified           [server] uploaded ──SERVER_HASH_MISMATCH──► hash_mismatch
 recording|saving_local ──LOCAL_WRITE_FAILED──► local_save_failed ──RETRY_LOCAL_SAVE──► saving_local
 recording|saving_local|local_save_failed|needs_attention ──MARK_UNRECOVERABLE──► unrecoverable
```

Bảo đảm (có unit test, xem [testing.md](testing.md)):

1. **Client không tự tới `uploaded`/`verified`/`hash_mismatch`**: các chuyển này đòi `origin: 'server'`; sự kiện thiết bị giả danh bị từ chối (`ORIGIN_NOT_ALLOWED`). Chỉ lớp `data` mới tạo sự kiện server, và chỉ từ dữ liệu `server.*` đọc về. Lớp phòng thủ thứ nhất là Security Rules (cấm client ghi `server` và đặt `clientFileState` ngoài tập cho phép). *Mã trong app chỉ là kỷ luật; Rules mới là ranh giới tin cậy.*
2. **Khôi phục sau khi app bị kill khi đang quay** đi qua `saving_local` (kiểm tra lại tệp), không vào hàng đợi trực tiếp (A05: "không tự nhận là video đầy đủ"). Cờ "phiên bị gián đoạn" nằm ở *trạng thái phiên*, không ở trạng thái tệp.
3. **Đối soát QA-05**: máy chủ đã nhận nhưng app mất phản hồi → `SERVER_RECEIVED` được chấp nhận từ `queued`/`uploading`/`upload_failed`/`needs_attention`, nên đối soát đưa tệp lên `uploaded` mà không phải tải lại.
4. **`hash_mismatch` và `unrecoverable` là trạng thái cuối** (không có lối ra bằng sự kiện thường; cách xử lý do người dùng/hỗ trợ, ghi audit).
5. **`isLocalCopyReleasable`**: chỉ `verified` mới đủ *điều kiện cần* để giải phóng bản cục bộ (còn chính sách an toàn và thông báo người dùng). `uploaded` và `hash_mismatch` thì không (bản cục bộ có thể là bản đúng duy nhất).

**Nhãn hiển thị** (`toDisplayStatus` + `core/theme/evidence-status.ts`, docs/09 mục 3): sáu nhãn *Đã lưu trên máy / Chờ tải lên / Đang tải lên / Đã tải lên / Đã xác minh / Lỗi – cần xử lý*; hai pha ghi hình dùng trạng thái riêng của màn quay. Mọi trạng thái lỗi → *Lỗi – cần xử lý*. Cụm "Đã lưu an toàn trên máy chủ" chỉ gắn với `verified` (test i18n kiểm tra). **Điểm mơ hồ cần BA xác nhận** (Q-02): docs/09 ánh xạ cả *Đã lưu trên máy* và *Chờ tải lên* vào trạng thái nghiệp vụ "Chờ tải lên"; khung hiện phân biệt bằng "có lý do chờ" hay không.

**Các máy trạng thái khác** (phiên, đơn, hồ sơ hoàn, tranh chấp — docs/02) là máy riêng, làm cùng feature của chúng; không dùng chung enum với tệp. Điều kiện "hoàn tất" của phiên không phụ thuộc trạng thái tải lên (docs/02, bảng điều kiện hoàn tất).

## 6. Ghi hình an toàn (luồng kỹ thuật)

1. **Trước khi mở camera** (A03): sinh `sessionId`, `evidenceId`; ghi tài liệu phiên (`recording`, `orderSnapshot`, `startedAtDevice`, `startedAtServer = request.time`) — ngoại tuyến vẫn ghi được vào hàng chờ của Firestore. Rules kiểm tra kiện thuộc đúng đơn. Chuyển sang đơn khác **không** sửa được phiên trước (Rules cấm đổi `orderId`/`packageId`).
2. **Ghi ra tệp cục bộ**, không giữ video trong bộ nhớ JS. Thư viện camera ghi vào tệp tạm; ngay khi kết thúc phải **chuyển sang thư mục bền của app** (không phải cache) rồi mới tính là có tệp. Ghi bản ghi `recording` vào SQLite *trước* khi bắt đầu ghi để phục hồi được.
3. **Sau khi dừng**: `recording → saving_local` → đóng tệp → kiểm tra đọc được (mở, đọc metadata: thời lượng, kích thước > 0) → tính SHA-256 trên tệp (streaming bằng native, không nạp cả tệp vào JS — *cần spike S3*) → ghi SQLite `queued` → tạo tài liệu bằng chứng. Chỉ đến đây UI mới được nói "Video đã lưu trên thiết bị".
4. **Gián đoạn** (A05/B05): cuộc gọi/mất focus, hệ điều hành thu hồi camera, hết dung lượng, app bị kill. Cơ chế: lắng nghe sự kiện lỗi/tạm dừng của thư viện camera → ghi vào `sessions.interruptions[]` (thời điểm thiết bị, nguyên nhân); không bao giờ ghép các đoạn thành video liền mạch (UI-J14) — mỗi đoạn là một tệp/bằng chứng riêng thuộc cùng chuỗi phiên bổ sung. Hết dung lượng: cố đóng tệp an toàn, đánh dấu không hoàn chỉnh nếu không xác nhận được (QA-12).
5. **Khởi động app**: quét SQLite tìm tệp ở `recording`/`saving_local` và quét thư mục tạm/bền tìm tệp mồ côi → `RECOVERY_FOUND_FILE` → kiểm tra lại; không đọc được → `unrecoverable` + phiên `needs_attention`. Không tự xác nhận phiên.
6. **Kiểm tra trước khi quay** (A04, chạy ngầm): quyền camera/micro, dung lượng trống so với ngưỡng, ghi thử được vào thư mục bền. Ngưỡng dung lượng và thời lượng tối thiểu là cấu hình, chờ O-05.
7. Bản gốc trong thư mục bền cần cân nhắc **loại khỏi sao lưu tự động của hệ điều hành** (iCloud/Android Auto Backup) để không đầy dung lượng cá nhân của người dùng — *cần quyết định/spike*, ghi trong ADR-004.

## 7. Hàng đợi tải lên bền vững

**Lưu trữ**: bảng SQLite `upload_jobs` (ví dụ: `job_id`, `evidence_id`, `file_path`, `size`, `sha256`, `state`, `attempt`, `next_attempt_at`, `session_uri` (mã hóa/che, hết hạn), `bytes_confirmed`, `last_error_code`). Ghi theo giao dịch; là *nguồn sự thật phía thiết bị* cho tới khi máy chủ xác nhận. Không dùng Firestore offline cache làm hàng đợi (không kiểm soát được thứ tự/đối soát và không bảo vệ tệp).

**Vòng đời một job**:

1. `queued` → lấy lượt (điều kiện: có mạng, đúng chính sách Wi-Fi/dữ liệu di động nếu có cấu hình, còn dung lượng/hạn mức).
2. Xin phiên tải: Function `createUploadSession(evidenceId)` (idempotent: cùng `evidenceId` trả cùng đối tượng đích; nếu đối tượng đã đủ thì trả "đã nhận").
3. **Đối soát trước khi gửi/gửi lại**: hỏi trạng thái phiên (số byte máy chủ đã nhận) hoặc đọc `server.state`; tiếp tục từ byte đã nhận. Máy chủ đã có đủ tệp → `SERVER_RECEIVED` (QA-05), không tải lại.
4. Tải theo khối có thể tiếp tục; giao việc cho **trình tải nền của hệ điều hành** khi thư viện được chọn hỗ trợ (mục 11). Tiến độ ghi SQLite.
5. Xong phía thiết bị chỉ nghĩa là "đã gửi hết"; **trạng thái `uploaded` đến từ máy chủ** (trigger khi đối tượng được tạo xong ghi `server.state`). Client chỉ lắng nghe tài liệu bằng chứng.
6. Lỗi: mạng → quay `queued` có backoff, **không** đếm là lỗi; xác thực hết hạn / hết hạn mức / gói không cho lưu → `needs_attention` với mã rõ (giữ tệp, không báo đã sao lưu); lỗi khác lặp lại → `upload_failed` cho người dùng thử lại.

**Idempotency**: khóa = `evidenceId` (cũng là đường dẫn đối tượng). Rules/Function chỉ cho tạo đối tượng một lần; tạo lại cùng ID không sinh bằng chứng thứ hai (A07: "thử lại không tạo nhiều bản ghi").

**Giới hạn nền (phải nói thật trên UI, bất biến #11)**:

- iOS: tải nền qua `URLSession` nền có thể tiếp tục khi app bị hệ điều hành dừng, nhưng **không** tiếp tục nếu người dùng vuốt tắt app (force-quit) — theo tài liệu của thư viện đề xuất (mục 11) và Apple; hệ điều hành quyết định thời điểm.
- Android: cần dịch vụ foreground hoặc WorkManager; từ Android 15 dịch vụ foreground loại `dataSync` bị giới hạn 6 giờ trong 24 giờ và không được khởi động lại từ nền khi hết ngân sách ([tài liệu Android](https://developer.android.com/develop/background-work/services/fg-service-timeout)). Thiết kế phải lưu điểm tiếp tục và chịu được `onTimeout()`.
- Vì vậy UI chỉ được nói "Sẽ tiếp tục khi có thể; mở app nếu bị tạm dừng" (docs/09 mục 5.5, A.4), không "sẽ tự động hoàn tất".
- Mở app / quay lại foreground luôn kích hoạt: đối soát toàn bộ job chưa `verified` với máy chủ.

**Giải phóng bản cục bộ**: một module duy nhất `releaseLocalCopy(evidenceId)`; điều kiện: `isLocalCopyReleasable` (= `verified`) **và** chính sách an toàn **và** người dùng đã được thông báo (docs/06). Không có đường mã nào khác xóa tệp bằng chứng. Dọn bộ nhớ tự động chỉ được xóa tệp tạm không phải bằng chứng.

**Bảng đối chiếu docs/06**: mất mạng → giữ + chờ; ngắt giữa chừng → tiếp tục/tải lại an toàn không trùng; thoát app → khôi phục hàng đợi khi mở lại (SQLite); sắp hết dung lượng → cảnh báo, ưu tiên bảo vệ tệp chưa tải; tệp hỏng → `needs_attention`/`unrecoverable`, không báo đã sao lưu; máy chủ nhận đủ → kiểm tra dung lượng, metadata, mã băm (Function); xóa bản cục bộ → như trên.

## 8. Bước chạy phía máy chủ (Cloud Functions) và bước ở client

Không có Function nào được viết trong khung này; bảng dưới là hợp đồng dự kiến để thiết kế Rules/client. Mỗi Function khi làm phải có test hợp đồng ([testing.md](testing.md) mục 4).

| Việc | Ở đâu | Cách | Vì sao không để client | Bất biến |
|---|---|---|---|---|
| Tạo shop, mời/thu hồi/đổi vai trò thành viên | Function (callable) | Ghi `members`, audit | Tự nâng quyền; thu hồi phải có hiệu lực ngay | #7, #8 |
| Cấp phiên tải (resumable) | Function (callable) | Kiểm tra quyền + bằng chứng hợp lệ → trả session URI | Storage từ chối client; kiểm soát đường dẫn đích | #4, #8 |
| **Xác minh mã băm** | Function (khi đối tượng Storage hoàn tất) | Đọc streaming, tính SHA-256, so `sha256Client` → ghi `server.state`/`sha256Server`/`verifiedAt`; không khớp → `hash_mismatch` | Không tin giá trị client | #3 |
| Ghi nhật ký kiểm toán | Function/trigger (Firestore `onWrite`, callable) | Ghi `auditEvents` (ai, làm gì, đối tượng, kết quả, giá trị trước/sau cho trường quan trọng) | Client không được tự ghi/sửa | #7 |
| URL đọc có thời hạn | Function (callable) | Kiểm tra quyền → signed URL ngắn hạn + audit "đã xem" | URL không hết hạn vi phạm bảo mật | #8 |
| Thời gian máy chủ | Firestore `serverTimestamp()` / `request.time` | Rules ép bằng nhau | Giờ thiết bị có thể sai/bị đổi | docs/06 |
| Dọn theo hạn lưu | Function (lịch) | Tính hạn từ chính sách; **bỏ qua bằng chứng có `retention.hold`**; xóa có audit; xử lý bản sao lưu theo chính sách | Không để client xóa/giữ | #9 |
| Cờ giữ do tranh chấp | Trigger trên `disputes` | Đặt/gỡ `retention.hold.disputeIds` | Giữ phải nhất quán, không dựa vào client | #9 |
| Xuất bộ hồ sơ | Function (callable/task) | Gom tệp + manifest (liệt kê tệp thiếu/lỗi, trạng thái) | Cần đọc Storage và ghi audit; chờ O-08 | #7 |
| Hạn mức/gói | Function + Rules | Kiểm tra khi cấp phiên tải; hạ cấp không xóa ngầm | Chờ O-06 | #9 |

Rủi ro kỹ thuật cần kiểm tra khi làm Function xác minh (spike S5): thời gian chạy tối đa của Function sự kiện hiện hành so với video lớn (tính SHA-256 trên hàng trăm MB), chi phí CPU/băng thông. Phương án giảm thiểu: đẩy việc băm vào hàng đợi tác vụ chạy lâu hơn; đối chiếu thêm checksum CRC32C do Cloud Storage cung cấp như kiểm tra nhanh *bổ sung* (không thay SHA-256 mà docs/06 yêu cầu).

## 9. Cô lập theo shop và phân quyền

- **Nguồn quyền**: `shops/{shopId}/members/{uid}` (`status == 'active'`, `roles[]`). Rules `get()` tài liệu này ở mỗi thao tác. Lý do chọn thay cho custom claims (ADR-005): (a) thu hồi có hiệu lực **ngay** (claims chỉ cập nhật khi token làm mới, tới khoảng một giờ — docs/07 yêu cầu thu hồi ngay); (b) không chốt trước O-03 (một tài khoản nhiều shop). Đánh đổi: mỗi truy cập tốn thêm một lần đọc tài liệu trong đánh giá Rules (tính phí đọc, tối đa 10 truy cập tài liệu cho một yêu cầu đơn).
- **Vai trò** `owner`, `manager`, `packer`, `returns_staff`, `dispute_handler`, `viewer` (docs/07). Ma trận quyền theo hành động còn mở (O-07), nên Rules hiện dùng **khung tạm**: thành viên đang hoạt động đọc được; `owner`/`manager`/`packer` ghi đơn, phiên, bằng chứng; chỉ `owner`/`manager`/`dispute_handler` đọc audit; mọi thay đổi thành viên qua Function. Khi O-07 chốt phải cập nhật Rules + test.
- **Test truy cập chéo shop (QA-11)**: `firebase/tests/rules/firestore.rules.test.ts` và `storage.rules.test.ts` (đã chạy được với Emulator). Gồm: không đăng nhập, đoán ID tài liệu/danh sách của shop khác (kể cả chủ shop khác), người lạ, thành viên bị thu hồi, tự nâng quyền, giả mạo `shopId`.
- **Không bí mật trong app**: không khóa dịch vụ, không khóa ký URL; mọi thao tác cần quyền cao đi qua Function.
- **Quyền riêng tư**: thu thập tối thiểu; không đưa mã đơn/mã vận đơn/thông tin khách vào log/crash/analytics (logger che trường nhạy cảm; xem conventions mục 7). Chọn dịch vụ crash/analytics là quyết định riêng, chưa làm.

## 10. Offline-first và xung đột đồng bộ

| Khả năng | Offline | Cách |
|---|---|---|
| Quay video, lưu cục bộ, tính mã băm, xếp hàng tải | Có | SQLite + tệp; không cần mạng |
| Tạo phiên (gắn kiện) | Có | Ghi vào hàng chờ ghi của Firestore; ID sinh ở client |
| Tạo đơn nháp + kiện | Có, *có điều kiện* | Chỉ khi có cơ chế xử lý trùng khi đồng bộ (A02 nghiệm thu) — xem Q-03 |
| Tìm kiếm toàn bộ đơn | **Không đầy đủ** | Chỉ tìm trong bản sao cục bộ; phải báo "tìm kiếm chưa hoàn tất" (`SEARCH_UNAVAILABLE`) thay vì kết luận "không có đơn" |
| Xuất hồ sơ, xem video đã tải, đổi thành viên, xác minh | Không | Cần máy chủ; UI đánh dấu riêng |
| Hết hạn đăng nhập | Không bị bỏ qua âm thầm | Giữ công việc cục bộ, yêu cầu đăng nhập lại (A07) |

**Chính sách xung đột theo loại dữ liệu** (không "last write wins" âm thầm với dữ liệu bằng chứng):

- **Bằng chứng, phiên (liên kết, snapshot)**: bất biến; chỉ một thiết bị tạo; ghi lại = bị từ chối. Không có xung đột để giải quyết.
- **Đơn, dòng sản phẩm**: khóa lạc quan bằng `rev`. Thua cuộc → client đọc lại, hiển thị "Thông tin đơn đã thay đổi ở thiết bị khác" và để người dùng chọn (UI-J13); mọi thay đổi đều có dòng audit (trigger), không có bản ghi nào bị ghi đè mà không để lại lịch sử.
- **Trùng đơn tạo ngoại tuyến**: Firestore không bảo đảm duy nhất theo trường. Khung chọn **cho phép trùng tồn tại và phát hiện khi truy vấn/đồng bộ** (khớp `ORDER_DUPLICATE`: "Hãy chọn đúng đơn", không tự gộp, không tự chọn bản đầu — bất biến #5). Chốt ở Q-03.
- **Kiện đã có phiên đang thực hiện** (A03): cần ràng buộc "một phiên hoạt động cho một kiện" xuyên tài liệu; dự kiến dùng `activeSessionId` trên kiện trong cùng batch (Rules `getAfter`) — thiết kế khi làm `packing`.
- Firestore cache ngoại tuyến thuộc SDK: ghi chờ gửi có thể bị Rules từ chối khi đồng bộ; UI phải xử lý bản ghi "bị từ chối khi đồng bộ" như một trạng thái lỗi hiển thị được, không nuốt lỗi.

## 11. Lựa chọn thư viện (ĐỀ XUẤT, CHỜ DUYỆT)

Ngày kiểm tra: **2026-10-26**. "Cập nhật" = thời điểm xuất bản gần nhất trên npm. Kết luận "cần spike" = chưa thể kết luận nếu chưa thử trên thiết bị thật. Chỉ **Expo, React, i18next/react-i18next** và công cụ lint/test đã được cài trong khung (để khung chạy được); mọi thư viện native khác **chưa cài**.

### 11.1 Nền tảng: Expo (dev build + prebuild) hay React Native thuần

| Tiêu chí | Expo (SDK 58, dev build + CNG) | RN thuần (CLI) |
|---|---|---|
| Phiên bản | `expo` 58.0.x (RN 0.88.0, React 19.3.0), cập nhật 2026-10-23 | RN 0.88.0 (2026-10-26) |
| Mã native tùy biến | Config plugin + `expo prebuild` sinh `ios/`,`android/`; có thể commit thư mục native bất cứ lúc nào (thoát ra bare không mất mát) | Toàn quyền, tự bảo trì |
| Thư viện native bên thứ ba | Dùng được qua dev build (không dùng Expo Go) | Dùng được |
| Nâng phiên bản | Bộ phiên bản đồng bộ (`bundledNativeModules`) | Tự cân đối |
| Rủi ro | Thư viện không có config plugin phải viết plugin | Tốn công cấu hình, nâng cấp RN thủ công |

**Đề xuất (ADR-001): Expo dev build + prebuild (CNG), không dùng Expo Go.** Đây là phương án ít khóa chặt nhất: không mất khả năng viết module native (cần cho camera/tải nền nếu spike thất bại) và có thể chuyển sang bare bằng cách commit thư mục native. *Chưa build native trong khung này* (môi trường không có Xcode/Android SDK); đã kiểm chứng Metro đóng gói được JS cho iOS và Android (`expo export`).

### 11.2 Firebase client

| | `@react-native-firebase/*` 27.1.0 (2026-10-23) | Firebase JS SDK 13.1.0 (2026-10-21) |
|---|---|---|
| Bản chất | Bọc SDK native iOS/Android | JS thuần |
| Firestore ngoại tuyến bền | Theo thiết kế dùng bộ nhớ đệm bền của SDK native — *cần xác nhận trong spike S6* | Trên RN không có IndexedDB → bộ nhớ đệm bền không dùng được ([issue #7947](https://github.com/firebase/firebase-js-sdk/issues/7947)); chỉ cache bộ nhớ |
| Expo | Có config plugin; peer `expo>=47`, `react-native>=0.60` — *tương thích RN 0.88 cần xác nhận khi cài (S4)* | Không cần native |
| App Check, Auth, Functions | Có package riêng | Hạn chế trên RN |

**Đề xuất (ADR-002): `@react-native-firebase`** vì offline-first là yêu cầu cứng. Firebase JS SDK được dùng *chỉ* cho test Rules ở Node (`@firebase/rules-unit-testing`). Cần spike S4/S6 trước khi khóa.

### 11.3 Camera / ghi video

| | `react-native-vision-camera` 5.2.3 (2026-08-20) | `expo-camera` 58.0.12 (2026-10-21) |
|---|---|---|
| Kiến trúc | Viết lại trên Nitro Modules (v5), cần `react-native-nitro-modules` + `react-native-nitro-image` | Module Expo chính thức, theo SDK |
| Ghi video | `Recorder`: ghi ra tệp, `isPaused`, `recordedDuration`, `recordedFileSize`, `maxDuration`/`maxFileSize`, callback lỗi, lý do kết thúc; **ghi vào tệp tạm** (phải chuyển sang thư mục bền) | `recordAsync` với `maxDuration`, `maxFileSize`, sự kiện tiến độ |
| Xử lý gián đoạn (A05) | Có callback lỗi/tạm dừng — chi tiết trên thiết bị thật *chưa kiểm chứng* | Ít hook chi tiết hơn (*cần xác nhận*) |
| Quét mã | Gói riêng `react-native-vision-camera-barcode-scanner` 5.2.3 (MLKit) | Có sẵn trong `CameraView` |
| Config plugin Expo | Không thấy plugin đi kèm trong gói → khai báo quyền thủ công trong `app.json` | Có |
| Rủi ro | Phiên bản lớn mới (v5), cộng đồng đang chuyển; phụ thuộc Nitro | Tính năng ghi video có thể thiếu kiểm soát gián đoạn |

**Đề xuất (ADR-003): thử `react-native-vision-camera` v5 trước (S1)**, so với `expo-camera` cùng kịch bản (cuộc gọi đến, kill app giữa chừng, hết dung lượng, quay dài ≥ 20 phút, máy nóng). Chưa kết luận trước spike. Tiêu chí chọn: không mất phần đã ghi khi gián đoạn, báo lỗi/lý do rõ, ghi trực tiếp ra tệp.

### 11.4 Quét mã vạch/QR

Ưu tiên cùng thư viện camera đã chọn (một phiên camera, ít xung đột): `react-native-vision-camera-barcode-scanner` (MLKit) hoặc quét trong `expo-camera`. Hỗ trợ máy quét ngoài (A02) là bàn phím HID — không cần thư viện. Kết luận theo ADR-003.

### 11.5 Tải lên nền có thể tiếp tục — **rủi ro cao nhất**

| Phương án | Cập nhật / tình trạng | Nền iOS | Nền Android | Tiếp tục sau khi app bị kill | Ghi chú |
|---|---|---|---|---|---|
| `@kesha-antonov/react-native-background-downloader` 4.6.4 | 2026-10-21; hỗ trợ Expo plugin, TurboModules; nay có cả tải lên | `NSURLSession` nền | Foreground service (+ DownloadManager cho tải xuống); tải lên *chi tiết cơ chế cần xác nhận* | Có `getExistingUploadTasks()` để nối lại; **force-quit trên iOS thì hệ điều hành hủy** (theo README) | Cần kiểm tra: PUT thân nhị phân + `Content-Range` tới session URI của GCS, tải theo khối, token hết hạn |
| `expo-file-system` 58.0.11 (upload task) | Chính thức theo SDK | `sessionType: 'background'` (chỉ iOS) | Bỏ qua tùy chọn nền (foreground) | Không nối lại task khi app khởi động lại (theo README thư viện trên trích tài liệu Expo) | Đủ cho nền iOS, **không đủ Android** |
| `react-native-background-upload` 6.6.0 (Vydia) | Bản gốc cập nhật 2022-10 — **không còn bảo trì tích cực**; có fork rải rác | URLSession nền | WorkManager/Ktor tùy fork | — | Không đề xuất làm nền tảng |
| Module native tự viết (Expo Modules API) | Tự bảo trì | URLSession nền + `handleEventsForBackgroundURLSession` | WorkManager (+ foreground service loại `dataSync`) | Có thể thiết kế đầy đủ | Chi phí cao nhất, kiểm soát cao nhất |
| SDK Firebase Storage (`putFile`) | Chính thức | Không thiết kế cho nền (*chưa kiểm chứng*) | Idem | Không | Đơn giản, đáp ứng yếu D-07 |

**Đề xuất (ADR-004): spike `@kesha-antonov/react-native-background-downloader` (S2) với giao thức GCS resumable; nếu không đạt (không hỗ trợ PUT theo khối/Content-Range, không ổn định trên Android), viết module native tối thiểu (iOS `URLSession` nền + Android WorkManager) bằng Expo Modules.** Không phương án nào "hứa tải xong khi app bị dừng"; UI nói đúng như mục 7.

### 11.6 Mã băm tệp (SHA-256)

`expo-file-system` 58 có `file.digest('SHA-256')` (khai báo kiểu có thuật toán MD5/SHA-1/256/384/512) — *chưa rõ có băm theo luồng hay nạp cả tệp vào bộ nhớ*; `expo-crypto` 58.0.7 chỉ băm `TypedArray`/chuỗi trong bộ nhớ (không phù hợp video lớn). Ứng viên thay thế: `react-native-quick-crypto` 1.1.8 (Nitro). **Spike S3**: băm tệp ≥ 1 GB, đo RAM đỉnh và thời gian trên máy cấu hình thấp.

### 11.7 Lưu trữ cục bộ cho hàng đợi/phiên

| | `expo-sqlite` 58.0.14 | `@op-engineering/op-sqlite` 18.2.5 (2026-09-20) | `react-native-mmkv` 4.3.2 (2026-06-22) |
|---|---|---|---|
| Loại | SQLite theo SDK Expo | SQLite hiệu năng cao, JSI | Khóa–giá trị |
| Giao dịch/truy vấn | Có | Có | Không (không phù hợp hàng đợi có thứ tự, trạng thái) |
| Phù hợp Expo | Chính thức | Cần dev build | Cần dev build |

**Đề xuất (ADR-004b): `expo-sqlite`** (ít phụ thuộc, khớp SDK; hiệu năng thừa đủ cho hàng đợi vài trăm bản ghi). MMKV chỉ cho cờ nhỏ nếu cần.

### 11.8 Quản lý state, điều hướng, form, i18n

| Hạng mục | Ứng viên (phiên bản, cập nhật) | Đề xuất | Lý do |
|---|---|---|---|
| State UI | `zustand` 5.0.16 (2026-10-22) | Zustand cho state UI/phiên quay; dữ liệu máy chủ lấy từ snapshot Firestore qua hook ở `data/` | Nhỏ, không boilerplate; không thêm `@tanstack/react-query` 5.105 (Firestore đã có luồng realtime + cache — thêm lớp cache thứ hai gây mơ hồ về "dữ liệu mới nhất") |
| Điều hướng | `expo-router` 58.0.26 vs `@react-navigation/native` 7.5.1 (2026-10-13) | Expo Router (xây trên React Navigation) | Chính thức theo SDK, typed routes, deep link cho lời mời/thông báo; route mỏng, màn hình nằm trong `features/*/ui`. Màn quay cần ẩn tab bar + chặn rời vô tình (docs/09 mục 2) — cả hai làm được. Khi dùng Expo Router, thư mục `src/app` dành cho route (vì vậy composition root đặt ở `src/bootstrap`). |
| Form/validate | `react-hook-form` 7.91.0, `zod` 4.6.7 | `zod` để parse dữ liệu ở biên (Firestore → domain); **chưa** thêm react-hook-form | Form của app rất nhỏ (tạo đơn nhanh); thêm khi có form phức tạp |
| i18n | `i18next` 26.5.11 + `react-i18next` 17.1.9 (đã cài trong khung) | Giữ | Trưởng thành, đủ cho tiếng Việt mặc định; `expo-localization` 58.0.5 thêm khi O-17 mở ngôn ngữ khác |
| Mạng | `@react-native-community/netinfo` 12.0.1 | Dùng khi làm hàng đợi | Phát hiện offline/đổi Wi-Fi↔di động |
| Công cụ | Jest 30 + `jest-expo` 58.0.12; ESLint 9.39 + `eslint-config-expo` 58.0.4; Prettier 3.9; TypeScript 6.0 (mẫu Expo dùng `~6.0.3`) | Đã cài | ESLint 10 và TypeScript 7.0 đã ra nhưng `eslint-plugin-react`/`import` chưa khai báo hỗ trợ ESLint 10 và mẫu Expo ghim TS 6.0 — chờ hệ sinh thái; nâng khi đồng bộ |

## 12. Kế hoạch spike trước khi khóa thư viện (cần thiết bị thật iOS + Android)

| # | Câu hỏi | Tiêu chí đạt | Quyết định phụ thuộc |
|---|---|---|---|
| S1 | Camera nào ghi bền khi gián đoạn? | Cuộc gọi, kill app, thu hồi camera, hết dung lượng: phần đã ghi đọc được; lỗi báo đúng; quay ≥ 20 phút; nhiều video liên tiếp; máy nóng | ADR-003 |
| S2 | Tải nền resumable lên GCS trên cả hai hệ điều hành? | Tiếp tục sau khi app bị kill (không force-quit); đổi Wi-Fi↔4G; token/URI hết hạn; Android 14/15 | ADR-004 |
| S3 | Băm SHA-256 tệp lớn không nạp vào JS? | RAM đỉnh thấp, thời gian chấp nhận được trên máy yếu | ADR-004 |
| S4 | `@react-native-firebase` 27 + RN 0.88 + Expo 58 build được cả hai nền tảng? | Build dev + release; Auth/Firestore/Functions chạy | ADR-002 |
| S5 | Function xác minh mã băm cho video lớn? | Hoàn thành trong giới hạn thời gian/chi phí | ADR-006 |
| S6 | Firestore ngoại tuyến bền ở RNFirebase: ghi chờ sống sót khi kill app; hành vi khi Rules từ chối lúc đồng bộ | Ghi chờ không mất; lỗi hiển thị được | ADR-002 |

## 13. Chi phí

- **Đọc Firestore**: Rules `get()` thành viên tính vào chi phí đọc mỗi thao tác (mục 9); danh sách đồng bộ dùng truy vấn có giới hạn và listener có phạm vi (theo shop, trạng thái chưa `verified`), không nghe toàn bộ collection. Không ghi từng chuyển trạng thái cục bộ lên Firestore (mục 4.3).
- **Ghi Firestore**: tài liệu bằng chứng tạo một lần, cập nhật chỉ khi cần cho thiết bị khác thấy; tiến độ tải (phần trăm) không ghi lên Firestore.
- **Storage/băng thông video**: nén là *bản dẫn xuất*, không thay bản gốc (bất biến #4); lưu bản gốc là chi phí chính → gắn với hạn mức theo gói (O-06). Đo chi phí/ngày từ giai đoạn beta (docs/08 điều kiện phát hành "Vận hành").
- **Functions**: băm theo luồng tốn CPU/thời gian theo kích thước tệp (S5).

## 14. Hệ quả cần ghi vào docs nghiệp vụ

Các điểm kỹ thuật chạm hoặc làm rõ nghiệp vụ đã được ghi ở mục "Hệ quả với Firebase" của [docs/06](../06-evidence-retention-policy.md#hệ-quả-với-firebase-ghi-chú-cho-giai-đoạn-thiết-kế-kỹ-thuật--chưa-chốt) và các câu hỏi Q-xx trong [decisions.md](decisions.md). Tóm tắt: (1) tải nền có giới hạn nền tảng → UI không hứa; (2) thu hồi quyền tức thì buộc tra thành viên ở mỗi thao tác Rules; (3) trùng đơn ngoại tuyến không thể ngăn cứng; (4) hash đầy đủ phía máy chủ cho video lớn có giới hạn thời gian Function; (5) không dùng URL tải xuống kèm token.
