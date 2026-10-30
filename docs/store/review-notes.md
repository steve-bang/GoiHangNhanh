# Ghi chú cho người duyệt App Store và Google Play (v1.0)

> **Trạng thái:** bản nháp, soạn 2026-10-30 (PR V1-20), chờ duyệt (release-checklist [C-4](../engineering/release-checklist.md#c-duyệt-câu-chữ-và-pháp-lý)). Dán vào App Store Connect > App Review Information > **Notes** và Play Console > App content > **App access**. Tài khoản demo tạo ở release-checklist [F-9](../engineering/release-checklist.md#f-firebase-production); **không ghi email/mật khẩu demo vào repo**.
>
> Tài liệu cùng bộ: [Nội dung trang ứng dụng](listing.md) · [Khai báo quyền riêng tư](privacy-declarations.md).

## 1. Điều người duyệt cần biết (tóm tắt tiếng Việt)

- **Phải đăng nhập** mới dùng được (App Review 2.1(a): kèm tài khoản demo và bật dịch vụ máy chủ; [App Review Guidelines][guidelines]). Dịch vụ là Firebase production (F-1…F-8 phải xong trước khi nộp).
- **Máy người duyệt sẽ trống:** đơn và bằng chứng chỉ nằm trên máy tạo ra chúng (Q-24a). Không hứa "có sẵn đơn mẫu". Người duyệt tự tạo đơn bằng mã mẫu `DH-DEMO-0001` (mục 3).
- **Camera:** quét mã, quay video đóng gói và mở kiện, chụp ảnh kiện hàng hoàn. Không ghi âm, không xin micro.
- **Vị trí:** tùy chọn, chỉ lưu trên máy cùng ảnh hàng hoàn, không gửi lên; từ chối vẫn dùng đủ tính năng.
- **Xóa tài khoản:** Cá nhân > Quyền riêng tư và bảo mật > Xóa tài khoản (**[theo V1-15]**; nhãn đã có trong `nav.json` `account.security`, `personal.json` `security.deleteAccount`).
- **Không mua trong ứng dụng**, không quảng cáo; Gói dịch vụ đang ẩn (`account-menu.ts`, Q-21ag).
- **Đăng nhập chỉ email + mật khẩu** (O-15): Guideline 4.8 (đăng nhập bên thứ ba) không áp dụng.
- **Mã hóa xuất khẩu:** chỉ HTTPS; **[theo V1-01]** `ios.config.usesNonExemptEncryption: false` (`ITSAppUsesNonExemptEncryption = NO`).

Ghi chú viết bằng **tiếng Anh** (người duyệt đọc nhanh hơn, và trường Notes của Apple giới hạn **4000 byte**: chữ có dấu tiếng Việt tốn 2–3 byte mỗi chữ; [Platform version information][asc-version]). Tên nút giữ nguyên tiếng Việt trong ngoặc kép để người duyệt tìm đúng trên màn hình.

## 2. Văn bản dán vào App Store Connect > Notes

Khoảng 3.000 byte (chủ yếu ASCII; chữ tiếng Việt trong ngoặc kép tốn thêm). Dán xong xem App Store Connect có báo vượt 4000 byte không. Thay `<…>` trước khi dán.

```
Don Chung ("Đơn Chứng") is a Vietnamese-language app for online sellers. It records evidence per order: a video while packing, photos and a video when a returned parcel is opened, and a dispute file kept on the device.

DEMO ACCOUNT
Use the credentials in the Sign-in Information fields. The account already has a shop.
Important: in version 1.0, orders and evidence stay on the phone that created them (one account = one phone). Your device will start empty. Please create an order as below.

HOW TO TEST (about 3 minutes, real device needed for the camera)
1. Tap "Đăng nhập" (Sign in) and sign in with the demo account.
2. Tap the center scan button on the tab bar. Allow camera access.
3. Scan the attached Code 128 barcode "DH-DEMO-0001" (open it on another screen or print it).
   Or tap "Nhập mã thủ công" (manual entry), type DH-DEMO-0001 and tap "Tra cứu mã" (look up).
4. The app reports the order is not on this device. Tap "Tạo đơn với mã này" (create order with this code), pick any sales source, optionally add a product, tap "Tiếp tục" (continue), then "Tạo đơn hàng" (create order).
   Alternative: Home tab > "Tạo đơn nhanh" (quick order).
5. On the order screen tap "Kiểm tra camera và bắt đầu" (check camera and start). Record a few seconds, tap "Dừng quay" (stop), then "Lưu bằng chứng" (save evidence). Videos have no audio and are limited to 10 minutes.
6. The video is saved on the device first, then uploaded while the app is open. The status label changes from "Chờ tải lên" (waiting) to "Đang tải lên" (uploading), "Đã tải lên" (received by server) and "Đã xác minh" (server re-computed the SHA-256 hash and it matches). There is no background upload when the app is closed.
7. Returns: Home tab > "Nhận hàng hoàn" (receive return). Disputes: create from an order or a return; the summary can be shared through the system share sheet.

PERMISSIONS
- Camera: scan order barcodes, record packing and parcel-opening videos, take photos of returned parcels. No audio is recorded; the app does not request microphone access.
- Location (while using the app, optional): saved on the device only, together with photos of returned parcels. It is never uploaded. Denying it does not block any feature.

ACCOUNT DELETION
"Cá nhân" (Profile tab) > "Quyền riêng tư và bảo mật" (Privacy and security) > "Xóa tài khoản" (Delete account). After password confirmation the account is deleted immediately and the shop data on the server is deleted within 30 days. Deletion waits while a video is being recorded or while an open dispute file exists on the device (close it first). Web request page: <https://DOMAIN/xoa-tai-khoan/>

PURCHASES AND ADS
The app is free. No in-app purchases, no subscriptions, no ads.

OTHER
- Sign-in is email and password only; no third-party login.
- The app does not connect to any marketplace. Order details are scanned or typed by the user.
- Encryption: standard HTTPS only.
- Contact: <name>, <email>, <phone in +84 format>.
```

**Điều phải kiểm trên bản build trước khi dán** (nhãn nút có thể đổi do PR V1-xx):

| Bước | Nhãn trong ghi chú | Nguồn hôm nay | Kiểm lại vì |
|---|---|---|---|
| 1 | "Đăng nhập" | màn UI-A02/A03 (đã khách xác nhận) | – |
| 3 | "Nhập mã thủ công", "Tra cứu mã" | `screens.json` `scan.manualButton`, `scan.lookup` | – |
| 4 | "Tạo đơn với mã này", "Tiếp tục", "Tạo đơn hàng" | `screens.json` `orderMatch.createWithCode`, `quickOrder.continue`, `quickOrder.createOrder` | Q-17e/O-19 có thể đổi luồng |
| 5 | "Kiểm tra camera và bắt đầu", "Dừng quay", "Lưu bằng chứng" | `screens.json` `preview.startRecording`, `common.json` `recording.stop`, `screens.json` `confirm.save` | Bản build phải bật ghi video (**[theo V1-21]**) |
| 6 | Nhãn trạng thái | `docs/09` mục 3, `src/core/theme/evidence-status.ts` | – |
| 7 | "Nhận hàng hoàn" | `screens.json` `home.receiveReturn` | – |
| Xóa tài khoản | đường dẫn menu, điều kiện chặn | **[theo V1-15]** | Hôm nay nút xóa luôn khóa: **không nộp** trước V1-15 |
| "within 30 days" | R-4 | **[theo V1-14]** `purgeDeletedShops` | Khớp app/web |

## 3. Mã vạch mẫu `DH-DEMO-0001`

- **Nội dung:** đúng chuỗi `DH-DEMO-0001` (12 ký tự, hợp lệ với `validateCode` ở `src/features/orders/domain/codes.ts`: không rỗng, ≤ 64 ký tự, không ký tự điều khiển). Không trùng định dạng mã của sàn nào; là mã giả, ghi rõ "DEMO".
- **Loại:** Code 128 (app quét được: `src/platform/barcode-scanner.tsx`). In chữ đọc được dưới mã.
- **Tạo ảnh:** lúc nộp, bằng công cụ tạo mã vạch Code 128 bất kỳ (ví dụ thư viện `bwip-js`), PNG nền trắng, rộng ≥ 600 px, chừa lề trắng (quiet zone) hai bên. **Không commit ảnh vào repo trong PR này** (không có công cụ tạo ảnh trong môi trường soạn; một mã vạch vẽ tay sai sẽ tệ hơn không có).
- **Kiểm trước khi đính kèm:** quét bằng bản `staging` trên một iPhone và một Android (G-1): màn tra cứu phải hiện `Mã: DH-DEMO-0001`.
- **Đính kèm:** App Store Connect có ô tệp đính kèm ở App Review Information (*chưa xác nhận trên trang trợ giúp đã đọc*); nếu không có ô đó, bỏ câu "Scan the attached…" và để người duyệt nhập tay (bước 3 đã có cách thay thế). Google Play App access không có ô đính kèm: người duyệt nhập tay.

## 4. Google Play: App content > App access

- Chọn: **All or some functionality in my app is restricted**.
- Thêm một bộ hướng dẫn: Name `Demo account`; Username/Password = tài khoản F-9; "Any other information required to access your app": dán phần **DEMO ACCOUNT**, **HOW TO TEST** (bỏ câu đính kèm mã vạch, dùng nhập tay) và **ACCOUNT DELETION** của mục 2.
- Tài khoản không có xác thực 2 lớp, không giới hạn vị trí, không hết hạn (Apple cũng yêu cầu tài khoản demo "must not expire": [Platform version information][asc-version]).
- *Giới hạn độ dài ô hướng dẫn của Google chưa tra được* (trang trợ giúp bị chặn): nếu bị cắt, rút gọn bước 6–7.

## 5. Câu trả lời soạn sẵn nếu bị hỏi lại

| Câu hỏi có thể gặp | Trả lời (tiếng Anh, dán vào Resolution Center/Play) |
|---|---|
| Vì sao cần camera? | "The camera is the core feature: it scans the order barcode and records the packing or parcel-opening video that is linked to that order. No audio is recorded." |
| Vì sao xin vị trí? | "Optional. Location is saved on the device only, next to photos of returned parcels, so the seller can recall where a photo was taken. It is not uploaded and not shown as coordinates. Denying it does not block any feature." |
| Không thấy dữ liệu sau khi đăng nhập | "By design in version 1.0, data stays on the phone that created it. Please create an order with code DH-DEMO-0001 as described in the notes." |
| Video không tải lên | "Uploads run only while the app is open and connected. Keep the app open for a moment; the status label shows the real state reported by the server." |
| Có mua trong app/gói trả phí? | "No. The app is free; there are no in-app purchases, subscriptions or ads." |
| Có tích hợp sàn? | "No. The app does not use any marketplace API or brand. Order details are scanned or typed by the user." |
| App iPhone chạy trên iPad | App chỉ khai iPhone (`supportsTablet: false`); Apple có thể thử ở chế độ tương thích trên iPad. Kiểm bố cục trên iPad Simulator trước khi nộp (rủi ro, mục 6). |

## 6. Rủi ro bị từ chối đã biết

| Rủi ro | Guideline | Cách tránh |
|---|---|---|
| URL chính sách/hỗ trợ còn `don-chung.invalid` hoặc trang còn "sẽ công bố" | 2.1(a), 5.1.1(i) | D-4: tên miền, email, tên bên vận hành thật; đăng web trước khi nộp |
| Nút xóa tài khoản còn khóa | 5.1.1(v) | Chỉ nộp sau V1-14 + V1-15 và G-8 đạt |
| Chuỗi quyền camera chưa nói tới quay video/chụp ảnh | 5.1.1(ii) | V1-18 đổi chuỗi; kiểm `Info.plist` (v1-release-plan mục 6.1 bước 5) |
| Báo lỗi ứng dụng bật sẵn, chưa hỏi đồng ý | 5.1.1(ii) ("must secure user consent for the collection") | R-8 đã chốt bật sẵn có công tắc tắt; **đưa vào rà pháp lý C-2**; phương án dự phòng: hỏi đồng ý lần đầu mở app (đổi giao diện, cần duyệt) |
| Splash có logo sàn (D-15) | 2.3.7, 5.2 (sở hữu trí tuệ) | C-3 trước khi nộp; ảnh store không chụp Splash |
| App lỗi/crash khi người duyệt quay trên máy của họ | 2.1(a) | Cổng thiết bị G-1…G-4 đạt trên bản ứng viên |
| Bố cục vỡ khi chạy iPhone app trên iPad | 2.1 | Thử trên iPad Simulator ở chế độ tương thích |

[guidelines]: https://developer.apple.com/app-store/review/guidelines/
[asc-version]: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
