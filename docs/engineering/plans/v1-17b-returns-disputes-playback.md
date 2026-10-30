# V1-17b returns-disputes-playback — kế hoạch chi tiết

Nguồn: [v1-17-local-playback.md](v1-17-local-playback.md) mục "Phạm vi để sau", [decisions.md](../decisions.md) `Q-29 / V1-17` dòng 7. Quyết định nhỏ: `Q-29 / V1-17b`.

## Mục tiêu

Người bán xem lại ảnh kiện và video mở kiện của hồ sơ hàng hoàn, và các tệp đưa vào tranh chấp, trên chính máy này, bằng cùng nội dung UI-E04 của V1-17 (`EvidenceDetailView`). Chỉ thêm lối vào và route, không đổi hành vi nghiệp vụ hay dữ liệu.

## Tệp đổi

| Tệp | Thay đổi |
|---|---|
| `src/core/navigation/routes.ts` | Hai route con của UI-E04 ngoài nhóm tab: `returnMediaDetail` `/returns/[returnId]/media/[mediaId]`, `disputeEvidenceDetail` `/disputes/[disputeId]/evidence/[evidenceId]` |
| `src/bootstrap/navigation/routes.test.ts` | Thêm hai route con vào danh sách đã duyệt; ngoại lệ có tên: hai route này là con của `evidenceDetail` nhưng `tabBar: false` (nằm trong luồng hàng hoàn/tranh chấp, ngoài nhóm tab) |
| `src/app/returns/[returnId]/media/[mediaId].tsx`, `src/app/disputes/[disputeId]/evidence/[evidenceId].tsx` (mới) | Route mỏng, `withSessionGate` |
| `src/features/evidence/ui/EvidenceDetailShell.tsx` (mới) | Trạng thái chưa sẵn sàng dùng chung của UI-E04 (đang mở / "Không tìm thấy bằng chứng này." / lỗi đọc), tách từ `orders/ui/EvidenceDetailScreen.tsx` (không đổi chữ, testID) |
| `src/features/orders/ui/EvidenceDetailScreen.tsx` | Tách `PackingEvidenceDetail({ orderId, evidenceId, title, inTabs })`; màn cũ là vỏ đọc tham số. Xuất `PackingEvidenceDetail` qua `@/features/orders` |
| `src/features/returns/ui/use-return-media-detail.ts`, `ReturnMediaDetail.tsx` (mới) | Nạp hồ sơ + media theo `returnId`/`mediaId` trong shop hiện tại; media phải nằm trong `listMedia(shopId, returnId)` (đúng hồ sơ, đúng shop). Hiển thị `EvidenceDetailView` + thẻ "Hạn chế bằng chứng" (`hasOpeningEvidenceLimit`) + lý do hạn chế mở kiện. Không vị trí/tọa độ |
| `src/features/returns/ui/ReturnPhotosSection.tsx` (D03) | Mỗi ảnh ĐÃ LƯU (`isMediaSavedLocally` + có đường dẫn) có nút nhỏ "Xem ảnh"; ảnh dở dang không có. Nút Xóa giữ nguyên điều kiện |
| `src/features/returns/ui/ReturnSummaryCards.tsx` (D06 + D07 dùng chung) | Khối tình trạng bên ngoài: danh sách hàng bấm được "Ảnh n" (mẫu UI-E03: hàng + mũi tên); khối video: hàng "Xem video mở kiện" khi video đã lưu |
| `src/features/disputes/ui/DisputeEvidenceDetailScreen.tsx` (mới), `DisputeSelectEvidenceScreen.tsx` (G03) | Màn trung tính: hồ sơ tranh chấp của shop, tệp phải nằm trong tập tệp của hồ sơ (cùng nguồn `useDisputeFiles` như G03); tệp hàng hoàn -> `ReturnMediaDetail`, tệp đóng gói -> `PackingEvidenceDetail`. G03: mỗi thẻ có nút nhỏ "Xem", tách khỏi ô chọn |
| i18n `nav.json` (`subTitles.*`), `returns.json`, `disputes.json`, `evidence.json` | Chuỗi mới (chờ BA) |
| Tài liệu | `decisions.md` Q-29 / V1-17b + sửa V1-17 dòng 7, `layout.md`, `testing.md`, `CHANGELOG.md`, ảnh `docs/assets/screens/v1-17b-returns-disputes-playback/` |

G05 chỉ hiện số tệp (không liệt kê), nên không thêm lối vào ở G05; tệp đã chọn vẫn xem được ở G03 (hiện cả tệp đã nằm trong hồ sơ, kể cả hồ sơ đã đóng).

## Thiết kế

- **Tra theo ID, cô lập shop + hồ sơ (bất biến 1, 8):** hàng hoàn: `getReturn(shopId, returnId)` + `listMedia(shopId, returnId)`; không thấy hồ sơ, media không thuộc hồ sơ trên đường dẫn, shop khác hay ID lạ -> "Không tìm thấy bằng chứng này." (cùng chữ V1-17 dòng 3). Tranh chấp: `getDispute(shopId, disputeId)` rồi tệp phải có trong tập tệp của hồ sơ (đơn của hồ sơ + media của hồ sơ hoàn của hồ sơ), sau đó màn con kiểm lại (đơn trên đường dẫn / hồ sơ hoàn) như route riêng.
- **Giữ mọi quy tắc V1-17:** dùng nguyên `EvidenceDetailView` (không cache, không tự phát, không nút sửa/xóa/cắt/chia sẻ, `recording`/`saving_local` không mở, câu tệp mất 5/5b, giờ thiết bị, mã băm + câu giới hạn). Media hàng hoàn không có thời lượng (`durationMs: null`): không có dòng thời lượng.
- **Hàng hoàn:** loại "Ảnh kiện hàng hoàn" / "Video mở kiện hàng hoàn"; dòng liên kết: hồ sơ (mã hồ sơ hiển thị), đơn gốc (mã hoặc "Chưa liên kết"). Thẻ "Hạn chế bằng chứng" theo `hasOpeningEvidenceLimit` (cùng điều kiện nhãn D07/tranh chấp) kèm lý do mở kiện (`returns:review.limits.*`, chuỗi sẵn có). Không đọc/hiện `location` (Q-26k). Người tải: `returnMediaUploader`.
- **Lối vào D03:** chỉ ảnh đã lưu bền; nút "Xem ảnh" đặt cạnh nút Xóa, không chạm vào camera/quyền. Không đổi điều kiện xóa (Q-26j).
- **Điều hướng:** `navigation.push`, Back về màn trước. Route ngoài nhóm tab (`inTabs: false`).
- **iOS/Android ngang hàng:** không `Platform.OS`; trình phát là adapter V1-17.

## Migration / Rules / Functions

Không.

## Test

- Route: `routes.test.ts` (bảng route <-> tệp, route con).
- `ReturnMediaDetail` (adapter video giả): ảnh có tệp -> ảnh + nhãn; video -> trình phát; `saving_local` -> "đang được lưu"; tệp mất -> câu mất; hạn chế (kiện mở trước) -> nhãn + lý do; hồ sơ không hạn chế -> không nhãn; không có vị trí trong cây; media hồ sơ khác / shop khác / ID lạ / thiếu tham số -> không tìm thấy; chỉ có nút Quay lại.
- D03: ảnh đã lưu có "Xem ảnh" -> `returnMediaDetail` đúng tham số; ảnh dở dang không có; nút Xóa vẫn còn.
- D07 (và D06 qua `ReturnSummaryCards`): hàng ảnh/video mở đúng route.
- G03: nút Xem -> `disputeEvidenceDetail`; màn tranh chấp: tệp hàng hoàn, tệp đóng gói, tệp không thuộc hồ sơ, hồ sơ shop khác -> không tìm thấy.
- `npm run check`, `expo export` ios/android.

## Màn cần chụp

D03 (ảnh có nút Xem), D07 (hàng ảnh + video), G03 (nút Xem), chi tiết ảnh hàng hoàn (có nhãn hạn chế), chi tiết video mở kiện (web: tệp giả không phát được), "Không tìm thấy". Dữ liệu dựng trên nhánh nháp, không commit.

## Rủi ro

- Route `[returnId]/media/[mediaId]` cạnh các route tĩnh `/returns/done`…: Expo Router ưu tiên segment tĩnh; `routes.test.ts` + `expo export` bắt lỗi trùng.
- Ngoại lệ route con khác cờ `tabBar` với gốc: ghi tên cụ thể trong test để không thành lỗ hổng chung.
- Chưa kiểm chứng trên thiết bị (như V1-17).

## Tự review

Vòng 1: (1) bất biến 1/2/8: tra theo ID + shop + hồ sơ; sửa: màn tranh chấp ban đầu chỉ dựa vào route con, nay kiểm thêm tệp thuộc tập tệp của hồ sơ tranh chấp trước. (2) bất biến 4: không thêm thao tác ghi; nút Xóa D03 giữ nguyên. (3) Q-26k: màn chi tiết không nhận `location`. (4) Bất biến 11: nhãn trạng thái thật qua `EvidenceDetailView`; nhãn hạn chế không bị ẩn ở màn chi tiết (docs/05 B07). (5) Giao diện màn có sẵn: chỉ thêm hàng/nút; D03 không thêm gì vào luồng chụp. (6) Kích thước ~600 dòng mã + test.

Vòng 2: không còn điểm vi phạm.

**Tự review: đã chấp nhận** (điểm đã sửa: kiểm tệp thuộc hồ sơ tranh chấp ở màn tranh chấp, không chỉ ở màn con).
