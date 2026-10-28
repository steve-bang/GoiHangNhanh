# Kế hoạch triển khai giao diện mới tab Đơn hàng (ORD-01…ORD-16)

> Trạng thái: **đề xuất, chờ người dùng duyệt** (không phải quyết định D-xx). Chưa viết mã. Các câu hỏi ở mục 7 cần chốt trước PR tương ứng.

## 1. Bối cảnh

Designer giao bộ UI/UX Flow mới cho tab Đơn hàng (16 khung hình ORD-01…ORD-16 + đặc tả chữ). Tab này **đã có bản chạy thật trên kho SQLite cục bộ** (Q-17, Q-18): danh sách, chi tiết chỉ đọc, quét mã, Tạo đơn nhanh, Xác nhận đơn. Vì vậy việc này chủ yếu là **đổi giao diện theo mockup, bổ sung màn còn thiếu, và chỉ bổ sung hành vi khi dữ liệu thật hỗ trợ**; không viết lại logic đã có test.

Ràng buộc: bám Design Token (`useTheme().tokens`, không hex/số thiết kế trong màn; `npm run check:tokens` + ESLint `design-tokens/no-raw-design-values`), 5 tab (D-16), bất biến trong `CLAUDE.md` (không dữ liệu giả, không "đã đồng bộ" khi chưa có xác nhận máy chủ, không tự gộp/chọn đơn trùng).

## 2. Ánh xạ ORD ↔ UI hiện có

| ORD | Màn | Mã UI / vị trí hiện tại | Hiện trạng | Việc cần làm |
|---|---|---|---|---|
| 01 | Danh sách | UI-E01 `OrdersListScreen` | Thật (tìm, chip, lọc, keyset, làm mới) | Đổi giao diện thẻ/đầu trang/chip theo mockup |
| 02 | Tìm kiếm | UI-B03 `SearchScreen` | **Placeholder** | Làm mới: màn tìm riêng, lịch sử tìm, kết quả, trùng mã |
| 03 | Quét mã | UI-B02 `ScanScreen` (`/scan`) | Thật (camera chưa kiểm chứng) | Đổi giao diện; giữ logic chống quét lặp |
| 04 | Kết quả quét / xác định đơn | trong `ScanScreen` | Có nhánh, giao diện khác | Chuẩn hóa thành bottom sheet dùng chung cho quét + tìm |
| 05 | Tạo đơn nhanh | UI-B04 `QuickOrderScreen` | Thật | Đổi giao diện; xem Q-21a về luồng |
| 06 | Xác nhận đơn | UI-C01 `OrderPreviewScreen` | Thật (bước trước khi quay) | Xem Q-21a |
| 07 | Chi tiết | UI-E02 `OrderDetailScreen` | Thật, chỉ đọc | Đổi giao diện; khối Bằng chứng/nút theo dữ liệu thật |
| 08 | Sửa đơn | *(chưa có)* | **Chưa có** (chỉ `updateLineQuantity`, bị khóa khi đã có phiên) | Mã UI mới (BA gán) hoặc route con UI-E02; cần kho + lịch sử (Q-21c) |
| 09 | Lọc/sắp xếp | `OrderFiltersSheet` | Thật | Đổi giao diện; thêm sắp xếp nếu dữ liệu hỗ trợ |
| 10 | Chọn nguồn bán | trong form | Chọn ngay trong form | Tách `OrderSourcePicker` dùng chung |
| 11 | Chọn sản phẩm/biến thể (P1) | — | Không có danh mục sản phẩm | **Hoãn** (Q-21e) |
| 12 | Danh sách bằng chứng | UI-E03 (placeholder) | Chưa có tệp bằng chứng | Màn thật, trạng thái trống trung thực |
| 13, 16 | Trống/lỗi/offline/loading | `EmptyState`, `ErrorState`, `OfflineBanner`, `Skeleton` | Có | Đồng bộ câu chữ theo mục 7 của đặc tả |
| 14 | Trùng mã | `duplicates.ts` + dialog | Có phát hiện, không tự gộp | Đổi giao diện dialog/danh sách chọn |
| 15 | Xác nhận nguy hiểm | `ConfirmDialog` | Chỉ dùng "bỏ thay đổi" | **Không làm Xóa đơn** (Q-21d) |

## 3. Nơi mockup lệch quy tắc dự án (đề xuất xử lý)

| Mockup | Vấn đề | Xử lý đề xuất |
|---|---|---|
| Thanh tab dưới 4 mục (Tổng quan, Đơn hàng, Hàng hoàn, Cá nhân) | D-16 chốt 5 tab (có Quét, Thông báo) | Giữ 5 tab, không đổi navigation (như Q-20a) |
| Thẻ đơn hiện "Đã đồng bộ", "Đang tải lên", ảnh sản phẩm | Chưa có tệp bằng chứng/hàng đợi tải lên; không có ảnh sản phẩm | Dùng `summarizeOrderEvidence` (hôm nay luôn *Chưa có video*); nhãn khác chỉ hiện khi có dữ liệu thật; thay ảnh sản phẩm bằng `SourceIcon` |
| Bộ lọc "Trạng thái bằng chứng" (Đang tải lên/Đã đồng bộ/Có lỗi) và "Trạng thái đơn" | Chưa có nguồn dữ liệu; "trạng thái đơn" chưa được định nghĩa (đặc tả mục 10 cũng nói vậy) | Chỉ giữ lựa chọn có dữ liệu; thêm mục khác khi có kho tệp |
| Chi tiết: nút *Tiếp nhận hàng hoàn*, "2 ảnh · 1 video", "Đã đồng bộ" | Hàng hoàn là workflow riêng (UI-D); số liệu bằng chứng giả | Nút hàng hoàn chỉ khi route/đơn phù hợp; khối bằng chứng đọc từ nguồn thật |
| ORD-16 "Xóa đơn" | Vi phạm bất biến 4, 9 (không xóa bằng chứng; chỉ lưu trữ/ẩn) | Không làm (Q-21d) |
| ORD-08 chỉnh sửa tự do | Bất biến 7: sau khi bắt đầu quay phải có lịch sử; ảnh chụp đơn của phiên cũ không đổi | Mã đơn khóa; sửa sau khi có phiên cần bảng lịch sử (Q-21c) |
| Cỡ chữ 9–11 trong ảnh | Dưới sàn chữ của app | Dùng token; nhóm `form*` đã mở rộng cho tab này (Q-18m, chờ BA) |
| Màu (Primary `#0B7048`, Success `#16A34A`…) | Không được viết hex trong màn | Map sang token ngữ nghĩa gần nhất (`brand`, `success`, `warning`, `danger`); không đổi bảng màu. Lệch thị giác đáng kể thì đề xuất chỉnh token, không hex trong màn |

## 4. Kiến trúc và thành phần

Giữ cấu trúc hiện tại (`src/features/orders/{domain,data,ui}`, `src/shared/ui`, `src/app` route mỏng, `ROUTES` là nguồn duy nhất); **không** chuyển sang `screens/hooks/services` như thư mục gợi ý của đặc tả. Chưa có TanStack Query: giữ hook dữ liệu hiện có (`use-order-list`, `use-order-detail`), tách form state/UI state như đặc tả.

| Đặc tả | Hiện có | Việc |
|---|---|---|
| OrderCard, OrderSourceBadge, EvidenceStatusBadge | `OrderCard`, `SourceIcon`, `EvidenceStatusBadge` | Chỉnh theo mockup |
| OrderSearchBar | `SearchField` | Thêm biến thể có nút quét/xóa |
| OrderFilterSheet | `OrderFiltersSheet` + `BottomSheet` | Chỉnh |
| OrderSourcePicker (mới) | chọn nguồn trong form | Tách, dùng ở tạo đơn/sửa/lọc |
| OrderItemEditor | `QuickOrderLineEditor` | Chỉnh |
| OrderSummary, EvidenceSummaryCard, CopyableOrderCode (mới) | `CopyButton`, một phần trong preview/detail | Tách |
| OrderMatchSheet (mới, ORD-04/14) | logic rải ở `ScanScreen`/`QuickOrderScreen` | Gom một nơi |
| ErrorState, OfflineBanner, EmptyState, Skeleton, ConfirmDialog, Toast, FormField | đã có | Đồng bộ câu chữ; `useIsOffline()` hiện là stub luôn `false` (`platform/connectivity.ts`) nên banner offline chưa phản ánh thật |

Component dùng ≥2 feature đặt ở `src/shared/ui`, còn lại ở `features/orders/ui`. Câu chữ nằm trong `src/core/i18n/locales/vi/screens.json` (khóa `orders.*`), không viết chuỗi trong màn (ESLint chặn). Đối chiếu bảng message mục 7 đặc tả; câu hứa quá (ví dụ "Bằng chứng đã được đồng bộ" khi chưa có xác nhận máy chủ) chỉ dùng khi trạng thái thật có.

## 5. Chia giai đoạn (mỗi giai đoạn = một PR vào `main`)

Mỗi PR: nhánh riêng từ `main`, `npm run check` xanh, test cho màn thay đổi, ảnh render bản web vào `docs/assets/screens/orders-v2/` (360×800 và 390×844), cập nhật `layout.md`/`decisions.md` (mục Q-21) và `CLAUDE.md` mục Trạng thái nếu hiện trạng đổi. PR nhỏ đủ để reviewer đọc trong một lượt.

| PR | Phạm vi | Phụ thuộc | Tiêu chí xong chính |
|---|---|---|---|
| **1. Nền và danh sách** | Component dùng chung mới/chỉnh (mục 4); ORD-01, 09, 13, 16: thẻ đơn, đầu trang, chip, sheet lọc, empty/error/offline/loading; câu chữ vào i18n; ảnh chụp | — | Hành vi danh sách giữ nguyên (test cũ xanh); không hex/số thiết kế mới; thẻ không hiện trạng thái không có dữ liệu thật |
| **2. Chi tiết và bằng chứng** | ORD-07 (CopyableOrderCode, EvidenceSummaryCard, nhóm nút); ORD-12 màn UI-E03 với trạng thái trống/đang ghi/lỗi trung thực (hôm nay chỉ có trống) | PR1 | Nút Quay đóng gói truyền đúng `orderId`/`packageId`; không nhãn "đã đồng bộ"; chuyển shop không giữ dữ liệu cũ |
| **3. Tìm kiếm, quét, xác định đơn** | ORD-02 (UI-B03: tìm riêng, debounce, bỏ qua kết quả cũ, lịch sử gần đây: Q-21f); ORD-03 giao diện; ORD-04 + ORD-14 gom thành `OrderMatchSheet` | PR1 | Quét/tìm không tự tạo đơn; nhiều kết quả/trùng mã bắt chọn, không chọn kết quả đầu; mã đã quét giữ nguyên khi sang tạo đơn; kết quả cũ không ghi đè mới |
| **4. Tạo đơn** | ORD-05, 06, 10: giao diện, `OrderSourcePicker`, xác nhận bỏ thay đổi, chống bấm đôi; luồng sau khi tạo theo Q-21a | PR1, PR3, **Q-21a** | Bấm nhiều lần không tạo hai bản ghi; lỗi lưu giữ nguyên form; mã trùng qua ORD-14 |
| **5. Sửa đơn và lịch sử** | ORD-08 + `OrderStore.updateOrder` + bảng lịch sử (migration mới) + màn UI-E05; khóa mã đơn; cảnh báo theo ORD-08 | PR2, **Q-21c** | Sửa không đổi ảnh chụp đơn của phiên cũ; mọi thay đổi sau bắt đầu quay đều có lịch sử; test hợp đồng cho cả kho SQLite và bộ nhớ |
| **6. Gia cố** | Accessibility (nhãn, thứ tự focus, chữ lớn hệ thống), bàn phím không che CTA, hiệu năng danh sách dài, `useIsOffline` thật nếu đã chọn thư viện, kiểm thử iOS + Android, cập nhật tài liệu | PR1–5 | Ma trận kiểm thử ở `platform-support.md`; chỗ chưa kiểm chứng trên máy ghi rõ |

ORD-11 (P1) **không nằm trong 6 PR**: chưa có danh mục sản phẩm (bất biến 10: không SKU/danh mục); làm khi BA chốt Q-21e.

## 6. Quy trình dev ↔ reviewer cho mỗi PR

1. Dev (senior-mobile-dev) làm xong, chạy `npm run check`, tự đọc lại diff, tạo PR vào `main` (theo mẫu PR nếu có).
2. Reviewer (pr-reviewer) đọc diff, đối chiếu docs và bất biến, comment từng finding lên PR (không sửa mã, không approve/merge).
3. Dev sửa mọi finding (đỏ/blocker bắt buộc; nit trả lời một dòng nếu không sửa), push; reviewer đọc lại phần đã sửa. Lặp đến khi không còn finding mở và CI xanh.
4. Chỉ sau khi xong mới mở PR kế tiếp (rẽ từ `main` đã có PR trước). Không gộp hai giai đoạn vào một PR.

Reviewer soi riêng cho tab này: (a) hex/số thiết kế hoặc chuỗi UI nằm trong màn; (b) nhãn trạng thái bằng chứng/đồng bộ có nguồn dữ liệu thật; (c) mọi truy vấn theo `shopId`; (d) không có đường tự chọn kết quả đầu khi trùng; (e) chuỗi lỗi ≤ 2 câu, < 20 từ (docs/09 mục 5.1); (f) Splash, đăng nhập/đăng ký, thiết lập **không bị đụng** (ngoài phạm vi token).

## 7. Câu hỏi cần chốt (Q-21, đề xuất)

| # | Câu hỏi | Lựa chọn | Đề xuất | Cần trước |
|---|---|---|---|---|
| a | Luồng tạo đơn: mockup mới là Tạo đơn nhanh → Xác nhận → **Tạo đơn hàng** → Chi tiết (chưa quay). Hôm nay là Tạo đơn nhanh → Xác nhận/Quay (Q-17e, theo mockup 03) | 1) Theo mockup mới (đơn lưu độc lập với quay; Quay đóng gói nằm ở chi tiết); 2) Giữ luồng cũ, chỉ đổi giao diện | 1, khớp "đơn tạo trước, phiên tạo sau"; cập nhật docs/09 (UI-B04 *Lưu và quay*, "không thêm hộp thoại xác nhận riêng") | PR4 |
| b | Thanh tab 4 mục trong mockup | Giữ 5 tab (D-16) | Giữ 5 | PR1 |
| c | Sửa đơn sau khi đã có phiên quay | 1) Làm bảng lịch sử rồi cho sửa; 2) Chỉ sửa khi chưa có phiên (như hôm nay) | 1 (bất biến 7), mã đơn vẫn khóa | PR5 |
| d | Xóa đơn (mockup ORD-16) | 1) Không có xóa; 2) Lưu trữ/ẩn đơn, không xóa bằng chứng | 1 ở giai đoạn này; 2 chỉ khi BA định nghĩa | — |
| e | ORD-11 và danh mục sản phẩm | Nhiều dòng sản phẩm tự do đã có; danh mục chưa có | Hoãn ORD-11 | — |
| f | Lịch sử tìm kiếm (ORD-02) lưu cục bộ | 1) Có, theo shop, có nút xóa; 2) Không | 1 (mã đơn là PII nhẹ; BA xác nhận) | PR3 |
| g | Mã UI cho màn mới (Sửa đơn, sheet kết quả) | BA gán, hoặc route con của UI-E02 (như Q-20k) | Route con | PR3/PR5 |

Chỉ bắt đầu triển khai khi người dùng cho phép; PR1 chỉ phụ thuộc câu b.
