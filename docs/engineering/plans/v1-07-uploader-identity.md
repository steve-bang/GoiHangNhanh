# V1-07 uploader-identity — kế hoạch chi tiết

Nguồn: `v1-release-plan.md` mục 1.2 (Q-24g = A + lọc theo `created_by` như Q-23g), 3.0, 3.3 V1-07, 7.5. Quyết định tự chốt ghi ở `decisions.md` `#### Q-29 / V1-07 — uploader-identity`.

## Mục tiêu

1. Máy này chỉ tải lên bằng chứng ĐÓNG GÓI thuộc phiên do CHÍNH tài khoản đang đăng nhập tạo (`packing_sessions.created_by = uid`). Hàng hoàn đã lọc từ R2b (`listMediaForUpload`), giữ nguyên.
2. Tệp do tài khoản khác (hoặc không rõ tài khoản) tạo trên máy này **không đứng im trong im lặng**: nơi hiện trạng thái từng tệp nói rõ "Chờ tải lên" + lý do (docs/09 mục 3: "Chờ tải lên ... ghi lý do").
3. Chặn đăng xuất / cảnh báo chuyển cửa hàng đếm tệp chưa đồng bộ **của chính tài khoản**; tệp của tài khoản khác không làm kẹt đăng xuất (đăng xuất là cách để tài khoản kia đăng nhập lại và tải).

## Hiện trạng (main 33c762f)

- `evidenceFileSource` (`upload/domain/upload-sources.ts`) không lọc uid; chỉ chờ phiên đã đăng (`isSessionPublished`, V1-02). Phiên do V đăng rồi V đăng xuất (hoặc bị đăng xuất ngoài ý muốn), U đăng nhập cùng shop: hàng đợi của U **khai báo hộ** tệp của V với `createdBy = U` (Rules cho phép vì chỉ ép `createdBy == auth.uid` của tài liệu bằng chứng và phiên tồn tại) -> sai người tải trong kiểm toán. Phiên của V chưa đăng: tệp đứng mãi ở `queued`, UI hiện "Đã lưu trên máy" mà không giải thích.
- Đăng xuất chặn khi còn BẤT KỲ tệp chưa đồng bộ trên máy (`countUnsyncedOnDevice`): U kẹt không đăng xuất được vì tệp của V, mà V chỉ tải được khi U đăng xuất.

## Thiết kế

**Dữ liệu (không migration, không Rules):**
- `EvidenceFileStore.listForUpload(shopId, states, uid)`: SQLite `JOIN packing_sessions s ON s.id = f.session_id AND s.shop_id = f.shop_id WHERE s.created_by = ?` (NULL không bao giờ khớp); bộ nhớ: tra `sessions.getSession` (không có tra cứu phiên = không biết người tạo = trả rỗng). `uid` rỗng -> rỗng.
- `OrderStore.countUnsyncedByOwner(scope: ShopId | 'device', uid)` -> `{ own, foreign }` gộp `evidence_files` (qua phiên) + `return_media` (`created_by`). `foreign` = khác uid hoặc không rõ. Kho bộ nhớ trả `{0,0}` như `countUnsynced`. V1-08 dùng `foreign` cho nhóm "Do tài khoản khác tạo trên máy này".
- Wrapper `create-*-store.ts` thêm hàm tương ứng.

**Hàng đợi:** `evidenceFileSource(files, sessions?, currentUid?)`: có `currentUid` -> `listForUpload(shop, states, uid)`; `uid` null -> không gì; không truyền (test cũ) -> như cũ. `UploadRunner` truyền `() => docs?.currentUid() ?? null` (cùng nguồn với hàng hoàn). Áp dụng mọi trạng thái hàng đợi đọc (queued, uploading, upload_failed...) nên hàng đợi của U không đối soát/đổi trạng thái tệp của V (bất biến 5: không gán lại tệp cho uid hiện tại).

**Hiển thị (domain `features/evidence`):**
- `uploaderRelation(createdBy, currentUid)`: `'current' | 'other' | 'unknown'`; `currentUid` null -> `'current'` (chưa biết ai đăng nhập: không kết luận, hàng đợi cũng không chạy).
- `toDisplayStatus(state, { uploader })`: `uploader !== 'current'` và state `queued`/`uploading` -> nhãn `waiting_upload` (không hiện "Đang tải lên" khi máy này không tải tệp đó). Trạng thái khác giữ nhãn cũ (lỗi vẫn là lỗi).
- `foreignUploadNote(state, relation)`: `'other' | 'unknown' | null`, chỉ cho trạng thái còn chờ máy chủ (`queued`, `uploading`, `upload_failed`, `needs_attention`).
- Câu i18n (`evidence:uploaderNote.other|unknown`), theo docs/09 mục 5.1 (≤ 2 câu, < 20 từ).
- Áp dụng ở: UI-E03 (từng mục, `OrderEvidenceItem` thêm `sessionId`), UI-E04 (thay câu giải thích nhãn), hàng hoàn D03/D06/D07 (ảnh `PhotoRow`, video `OpeningVideoStatus`, theo `ReturnMedia.createdBy`). Ngoài phạm vi (ghi rủi ro): nhãn gộp ở danh sách đơn, G03/G04 tranh chấp, UI-F01 (V1-08).

**Đăng xuất / chuyển cửa hàng:**
- `readDeviceFacts(store, uid?)`: có uid -> `unsynced = own` (toàn máy); không có uid -> như cũ (`countUnsyncedOnDevice`, bảo thủ). Xóa tài khoản (UI-I05) vẫn gọi không có uid (đếm toàn máy, bảo thủ; V1-15 quyết lại).
- `useSwitchShop`: có uid -> `own` của shop đang dùng; không có -> `countUnsynced` như cũ.

## Test

- Hợp đồng kho tệp (SQLite `node:sqlite` + bộ nhớ): `listForUpload` chỉ tệp của phiên do uid tạo; phiên `created_by` NULL không bao giờ; uid rỗng; khác shop; trạng thái.
- Kho SQLite đơn: `countUnsyncedByOwner` theo shop/toàn máy, gồm `return_media`.
- `upload-sources`/`upload-queue`: hai uid trên cùng kho -> chỉ tải tệp của uid hiện tại; đổi uid giữa hai lượt; uid null không tải; tệp `uploading` của uid khác không bị đối soát.
- `UploadRunner`: tệp phiên của uid khác không gọi cổng.
- Domain hiển thị: `uploaderRelation`, `toDisplayStatus` với `uploader`, `foreignUploadNote`.
- UI: E03/E04 hiện "Chờ tải lên" + câu lý do; hàng hoàn ảnh; đăng xuất không bị chặn bởi tệp của tài khoản khác, vẫn chặn bởi tệp của mình; chuyển shop đếm theo uid.

## Ảnh màn hình

Có đổi giao diện (câu lý do). Chụp bản web cổng giả với dữ liệu mẫu tạm (nhánh nháp không commit, như V1-17): UI-E03 có tệp của tài khoản khác, UI-E04 tệp của tài khoản khác, UI-E04 tệp không rõ tài khoản.

## Rủi ro

- Phiên `created_by` NULL (tạo trước v5 hoặc khi chưa biết uid) không bao giờ tải: chỉ máy dev; UI nói "không rõ tài khoản".
- Rules vẫn cho thành viên quản lý đơn khai báo bằng chứng cho phiên do người khác tạo (không thêm điều kiện `sessions.createdBy == auth.uid` ở PR này; ghi đề xuất ở decisions).
- Danh sách đơn (nhãn gộp), G03/G04 vẫn dùng nhãn theo trạng thái thuần: tệp `uploading` của tài khoản khác (hiếm: đăng xuất bị chặn khi còn tệp) có thể hiện "Đang tải lên".
- Kích thước: ~400–600 dòng mã, dưới ngân sách.

## Tự review

Vòng 1: (1) Ban đầu định lọc trong nguồn bằng `getSession` từng tệp: đổi sang truy vấn JOIN ở kho (ít lần đọc, cùng mẫu với `listMediaForUpload`). (2) Đăng xuất: nếu vẫn đếm tệp của tài khoản khác, U không bao giờ đăng xuất được -> chỉ đếm tệp của mình khi biết uid; không biết uid thì giữ đếm toàn máy (bảo thủ). (3) Xóa tài khoản giữ đếm toàn máy (bảo thủ, chờ V1-15) để không làm lỏng điều kiện xóa. (4) Hiển thị `uploading` của tệp tài khoản khác thành "Chờ tải lên" (máy này không tải nó) — chỉ là nhãn, không đổi trạng thái tệp (bất biến 3). Bất biến 2 (liên kết phiên–kiện không đổi), 5 (không gán lại tệp cho uid hiện tại), 4 (không xóa gì), 8 (mọi truy vấn có `shop_id`, JOIN cùng shop) giữ.

Tự review: đã chấp nhận.
