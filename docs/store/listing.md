# Nội dung trang ứng dụng trên App Store và Google Play (v1.0)

> **Trạng thái:** bản nháp để dán vào App Store Connect và Google Play Console, chờ khách/BA duyệt (release-checklist [C-4](../engineering/release-checklist.md#c-duyệt-câu-chữ-và-pháp-lý)). Soạn ngày 2026-10-30 theo [v1-release-plan.md](../engineering/v1-release-plan.md) mục 1.1, 1.2, 3.3 V1-20 (PR V1-20). Không phải quyết định D-xx.
>
> Tài liệu cùng bộ: [Khai báo quyền riêng tư](privacy-declarations.md) · [Ghi chú cho người duyệt](review-notes.md).
>
> **Quy tắc viết (bất biến 11, CLAUDE.md):** không "bằng chứng pháp lý", không hứa thắng khiếu nại, không hứa tải nền, không "lưu trữ an toàn" khi máy chủ chưa xác nhận; mã băm chỉ chứng minh tệp không đổi kể từ lúc tính. Câu đánh dấu **[theo V1-xx]** mô tả hành vi của PR **chưa hợp nhất** ở ngày soạn: phải đối chiếu lại với bản build thật trước khi nộp (bảng ở [mục 9](#9-phải-đối-chiếu-lại-trước-khi-nộp)).

## 1. Tên ứng dụng

| Trường | Giá trị đề xuất | Độ dài | Giới hạn | Nguồn giới hạn |
|---|---|---|---|---|
| App Store: Name | `Đơn Chứng` | 9 ký tự | 2–30 ký tự | [App information][asc-appinfo]; [App Review 2.3.7][guidelines] |
| App Store: Subtitle | `Video đóng gói và hàng hoàn` | 27 ký tự | ≤ 30 ký tự | [App information][asc-appinfo] |
| Google Play: App name | `Đơn Chứng – Video đóng hàng` | 27 ký tự | ≤ 30 ký tự | [Play Console Help 9866151][gp-listing] (*chưa đọc trực tiếp*, xem mục 10) |
| Tên dưới icon trên máy | `Đơn Chứng` (từ `app.json` `expo.name`) | 9 ký tự | – | `app.json` |

- **Rủi ro nhãn hiệu (O-11, release-checklist D-1):** "Đơn Chứng" là **tên làm việc**, chưa kiểm tra nhãn hiệu. Tên trên store đổi được sau này, nhưng **bundle id/applicationId không đổi được** sau lần tải lên đầu (giữ chỗ `vn.doncung.app`). Cần người dùng chốt D-1 trước khi tạo app trên App Store Connect (tên app phải duy nhất trên App Store) và trước lần tải AAB đầu.
- Không đưa tên sàn (Shopee, TikTok Shop, Lazada…) vào tên, phụ đề, từ khóa: App Review 2.3.7 cấm nhồi nhãn hiệu của bên khác vào metadata; ứng dụng cũng không tích hợp sàn nào.
- Phụ đề và tên Google nhắc "video": chỉ đúng khi bản nộp đã bật ghi video (**[theo V1-21]**: `EXPO_PUBLIC_RECORDER_ENABLED=1` ở profile `production` sau cổng thiết bị). Không nộp mô tả này với bản build chưa bật ghi video.
- Đếm ký tự: chữ tiếng Việt viết ở dạng dựng sẵn (NFC), mỗi chữ có dấu là một ký tự. Dán xong phải xem bộ đếm của Console; nếu Console báo khác, sửa câu chứ không cắt giữa từ.

## 2. Mô tả

### 2.1 Mô tả ngắn (Google Play, ≤ 80 ký tự)

```
Quay video đóng gói và mở hàng hoàn, lưu bằng chứng theo từng đơn và kiện.
```

74 ký tự. "Lưu" ở đây là lưu trên máy và tải lên khi app mở; không viết "lưu an toàn trên đám mây".

### 2.2 Văn bản quảng bá (App Store "Promotional Text", ≤ 170 ký tự, tùy chọn)

```
Bản đầu tiên: miễn phí, không có mua trong ứng dụng. Đơn và video nằm trên máy này; tệp được tải lên máy chủ khi ứng dụng đang mở.
```

129 ký tự. Giới hạn: [Platform version information][asc-version].

### 2.3 Mô tả đầy đủ (cả hai store, ≤ 4000 ký tự)

Giới hạn App Store: 4000 ký tự, văn bản thuần ([Platform version information][asc-version]). Google Play: 4000 ký tự (*chưa đọc trực tiếp*, mục 10). Bản dưới đây khoảng 2.300 ký tự.

```
Đơn Chứng giúp người bán online ghi lại bằng chứng theo từng đơn hàng: quay video lúc đóng gói, ghi nhận hàng hoàn, rồi gom bằng chứng khi cần khiếu nại.

ĐÓNG GÓI
• Quét mã vạch hoặc mã QR trên nhãn đơn, hoặc nhập tay. Mã chưa có thì tạo đơn nhanh, chỉ cần mã đơn và nguồn bán.
• Quay video từ lúc lấy hàng đến khi niêm phong xong. Mỗi video gắn với đúng đơn và kiện hàng bạn chọn trước khi quay.
• Một đơn có thể có nhiều kiện và nhiều lần quay.
• Video không có tiếng. Mỗi lần quay tối đa 10 phút.
• Xem lại video, ảnh đã ghi ngay trên máy.

HÀNG HOÀN
• Tìm đơn gốc bằng mã. Không tìm thấy thì vẫn tạo hồ sơ chưa liên kết và liên kết sau.
• Chụp tối đa 5 ảnh kiện, quay video mở kiện, ghi số lượng thực nhận.
• Kiện đã bị mở trước khi quay được ghi rõ là hạn chế bằng chứng.

TRANH CHẤP
• Tạo hồ sơ từ đơn hoặc từ hàng hoàn, chọn bằng chứng liên quan.
• Xem trước và chia sẻ văn bản tóm tắt qua ứng dụng bạn chọn.
• Đóng hồ sơ không xóa dữ liệu.

TRẠNG THÁI TỆP RÕ RÀNG
• Mỗi tệp hiện đúng trạng thái: đã lưu trên máy, chờ tải lên, đang tải lên, máy chủ đã nhận, đã xác minh.
• Máy chủ tính lại mã băm SHA-256 để kiểm tra tệp còn nguyên. Mã băm chỉ cho biết tệp không bị đổi kể từ lúc tính. Nó không chứng minh thời điểm quay hay nội dung là thật.
• Có tùy chọn chỉ tải lên khi có Wi-Fi.

ĐIỀU CẦN BIẾT TRƯỚC KHI DÙNG
• Mỗi tài khoản dùng trên một điện thoại. Đơn và hồ sơ nằm trên máy này; máy chủ chỉ giữ phần đã tải lên. Đổi máy hoặc cài lại ứng dụng thì không xem lại được dữ liệu cũ trong ứng dụng.
• Ứng dụng chỉ tải lên khi đang mở. Gỡ ứng dụng hoặc mất máy trước khi tải xong thì tệp chưa tải sẽ mất.
• Nếu ứng dụng bị tắt giữa lúc quay, đoạn đang quay có thể mất.
• Hồ sơ hàng hoàn và tranh chấp chỉ lưu trên máy này.
• Ứng dụng không kết nối với sàn thương mại điện tử. Thông tin đơn và sản phẩm do bạn nhập.
• Đơn Chứng giúp bạn có tư liệu để đối chiếu. Ứng dụng không bảo đảm kết quả khiếu nại; mỗi sàn và đơn vị vận chuyển có quy trình riêng.

QUYỀN RIÊNG TƯ
• Không quảng cáo, không bán dữ liệu.
• Vị trí lúc chụp ảnh hàng hoàn (nếu bạn cho phép) chỉ lưu trên máy, không gửi đi.
• Xóa tài khoản ngay trong ứng dụng: Cá nhân > Quyền riêng tư và bảo mật > Xóa tài khoản.

Miễn phí, không có mua trong ứng dụng.
```

Đối chiếu từng câu với app (cột "Nguồn" là nơi kiểm; **[theo V1-xx]** = chưa hợp nhất ngày soạn):

| Câu | Nguồn | Ghi chú |
|---|---|---|
| Quét mã vạch/QR | `src/platform/barcode-scanner.tsx` (QR, Code 128, Code 39, Code 93, EAN-13/8, ITF-14, UPC-A/E, Codabar, Data Matrix) | Có |
| Tạo đơn nhanh chỉ cần mã đơn + nguồn bán | `screens.json` `quickOrder` (sản phẩm "không bắt buộc") | Có |
| Video gắn đơn + kiện chọn trước khi quay | `recording-controller.ts` (bất biến 2) | Có, sau cờ ghi video |
| Không tiếng; tối đa 10 phút | `app.json` `microphonePermission: false`, `recordAudioAndroid: false`; `recording-policy.ts` | Kiểm lại con số nếu chính sách đổi |
| Xem lại trên máy | **[theo V1-17]** | Bỏ câu nếu V1-17 bị tách khỏi v1 |
| Hàng hoàn: hồ sơ chưa liên kết, 5 ảnh, video mở kiện, hạn chế bằng chứng | `features/returns` (Q-26, Q-26i, Q-28) | Có |
| Tranh chấp: chia sẻ văn bản tóm tắt, đóng không xóa | `features/disputes` (Q-27) | Có; chưa có gói xuất tệp: không viết "xuất hồ sơ" |
| Nhãn trạng thái tệp | `docs/09` mục 3, `evidence-status.ts` | Có |
| Chỉ tải khi có Wi-Fi | **[theo V1-09]** | Bỏ câu nếu V1-09 chưa vào |
| Một máy một tài khoản; không kéo dữ liệu xuống máy mới | Q-24a A | Có (do thiếu tính năng, không phải chặn) |
| Video đang quay có thể mất khi app bị tắt | Q-24b A, **[theo V1-11]** câu trong app | Đúng với mã hiện tại |
| Vị trí chỉ trên máy | `evidence-document.ts` không gửi vị trí; Q-26k, Q-28a | Có |
| Xóa tài khoản trong app | **[theo V1-15]** | Hôm nay nút luôn khóa: không nộp trước V1-15 |

### 2.4 Nội dung "Có gì mới" (What's New) cho bản 1.0.0

App Store không yêu cầu cho bản đầu. Google Play (Release notes):

```
Bản đầu tiên của Đơn Chứng.
```

## 3. Từ khóa (chỉ App Store, ≤ 100 byte)

Giới hạn tính theo **byte**, không theo ký tự ([Platform version information][asc-version]). Chữ có dấu tiếng Việt chiếm 2–3 byte (UTF-8), nên 100 byte chỉ đủ khoảng 8 cụm.

```
bằng chứng,khiếu nại,vận đơn,mã vạch,kiện hàng,niêm phong,bán online,quét mã
```

98 byte (đếm UTF-8 dạng NFC: `bằng chứng` 14, `khiếu nại` 13, `vận đơn` 11, `mã vạch` 10, `kiện hàng` 12, `niêm phong` 11, `bán online` 11, `quét mã` 9, cộng 7 dấu phẩy). Nếu App Store Connect báo vượt (chữ bị lưu ở dạng tổ hợp NFD), bỏ cụm cuối.

- Không lặp chữ đã có trong tên và phụ đề (video, đóng gói, hàng hoàn): App Store đã lập chỉ mục tên và phụ đề. `bằng chứng` có chữ "chứng" trùng tên nhưng giữ vì là cụm người bán hay tìm.
- Không tên sàn, không tên app khác, không giá (App Review 2.3.7).
- Chưa biết App Store có coi tìm kiếm không dấu ("dong goi") là khớp có dấu hay không: **chưa chắc**, theo dõi qua App Store Connect sau phát hành rồi điều chỉnh.

Google Play không có trường từ khóa; nội dung tìm kiếm lấy từ tên, mô tả ngắn và mô tả đầy đủ.

## 4. Danh mục, giá, khu vực

| Mục | App Store | Google Play |
|---|---|---|
| Danh mục chính | Business (Kinh doanh) | Business (Kinh doanh) |
| Danh mục phụ | Productivity (Năng suất) | – (Play chỉ có một danh mục; thẻ tùy chọn) |
| Giá | Miễn phí | Miễn phí |
| Mua trong ứng dụng | Không | Không (`Contains ads`: Không; không có sản phẩm trong app) |
| Khu vực phân phối | **Chỉ Việt Nam** (Q-29 / V1-20) | **Chỉ Việt Nam** |
| Ngôn ngữ trang | Tiếng Việt (vi) | Tiếng Việt (vi-VN) là ngôn ngữ mặc định |
| Copyright (App Store) | `2026 <tên bên vận hành>` (giữ chỗ `operatorName` ở `web/src/config/site.ts`, D-4) | – |

Lý do chỉ Việt Nam: giao diện chỉ có tiếng Việt, chính sách quyền riêng tư viết theo bối cảnh Việt Nam và chờ rà pháp lý Việt Nam (C-2). Mở thêm khu vực (ví dụ EU) kéo theo nghĩa vụ khác (ví dụ khai báo trader status theo Đạo luật Dịch vụ số của EU trên App Store Connect; *chưa tra chi tiết*), làm sau.

## 5. Phân loại độ tuổi

### 5.1 App Store (bảng câu hỏi trong App information > Age Rating)

Theo [Age ratings values and definitions][asc-age] (truy cập 2026-10-30). Trả lời đề xuất:

| Nhóm | Câu hỏi | Trả lời | Lý do |
|---|---|---|---|
| In-App Controls | Parental Controls | Không | Không có |
| In-App Controls | Age Assurance | Không | Không có |
| Capabilities | Unrestricted Web Access | Không | Liên kết chính sách/hỗ trợ mở bằng trình duyệt của hệ điều hành (`src/platform/external-link.ts`), không có trình duyệt trong app |
| Capabilities | User-Generated Content | Không | Nội dung (đơn, video, ảnh, hồ sơ) chỉ người dùng của cửa hàng đó thấy; không phát tán cho người khác trong app. Chia sẻ văn bản tóm tắt do người dùng tự gửi qua bảng chia sẻ của hệ điều hành |
| Capabilities | Social Media | Không | |
| Capabilities | Messaging and Chat | Không | |
| Capabilities | Advertising | Không | |
| Mature Themes, Medical/Wellness, Sexuality/Nudity, Violence | Mọi câu | Không có (None) | |
| Chance-Based | Gambling, Simulated Gambling, Contests, Loot Boxes | Không | |

Kết quả dự kiến: **4+**. Kết quả thật do App Store Connect tính từ câu trả lời.

### 5.2 Google Play (App content > Content rating, bảng câu hỏi IARC)

Không đọc được trang trợ giúp của Google trong môi trường soạn (mục 10). Hướng trả lời:

- Loại ứng dụng: nhóm "tiện ích/năng suất/giao tiếp/khác" (không phải trò chơi). Tên nhóm chính xác chọn theo Console.
- Bạo lực, tình dục, ngôn từ, chất kích thích, cờ bạc: Không.
- Người dùng tương tác hoặc trao đổi nội dung với người dùng khác trong app: Không.
- Chia sẻ vị trí hiện tại của người dùng với người khác: Không.
- Mua hàng hóa số: Không.

Kết quả dự kiến: mức thấp nhất (ví dụ "Everyone"/"3+"); **chưa chắc**, IARC cấp sau khi gửi.

### 5.3 Google Play: đối tượng mục tiêu (Target audience and content)

Chọn **18 tuổi trở lên** (người bán hàng). Không chọn nhóm dưới 13 để không thuộc chính sách Gia đình. Khớp câu "Ứng dụng dành cho người bán hàng, không dành cho trẻ em" ở trang chính sách quyền riêng tư (`web/src/pages/chinh-sach-quyen-rieng-tu.astro`, mục "Quyền của bạn").

## 6. URL và liên hệ

Đường dẫn cố định ở `web/src/config/site.ts` `legalPages` (PR V1-19); tên miền **giữ chỗ** `https://don-chung.invalid` (RFC 2606, không bao giờ phân giải). App dùng cùng giá trị ở `src/core/config/public-links.ts` (**[theo V1-18]**), có test so khớp.

| Trường | App Store Connect | Google Play Console | URL (giữ chỗ) |
|---|---|---|---|
| Chính sách quyền riêng tư | Privacy Policy URL (bắt buộc) | App content > Privacy policy (bắt buộc) | `https://don-chung.invalid/chinh-sach-quyen-rieng-tu/` |
| Hỗ trợ | Support URL (bắt buộc) | Store settings > Website (tùy chọn) | `https://don-chung.invalid/ho-tro/` |
| Trang chủ/marketing | Marketing URL (tùy chọn) | Website | `https://don-chung.invalid/` |
| Điều khoản | (đặt trong mô tả hoặc EULA tùy chỉnh nếu muốn; không bắt buộc) | – | `https://don-chung.invalid/dieu-khoan/` |
| Yêu cầu xóa tài khoản | – (Apple chỉ yêu cầu xóa trong app, 5.1.1(v)) | Data safety > Data deletion > Delete account URL (bắt buộc khi app cho tạo tài khoản) | `https://don-chung.invalid/xoa-tai-khoan/` |
| Email liên hệ | App Review contact (chỉ Apple thấy) | Store settings > Email (hiển thị công khai, bắt buộc) | `site.legal.supportEmail` = `null` |

**Điều kiện nộp:** thay tên miền và email thật (release-checklist D-4) và đăng 4 trang lên web trước. App Review 2.1(a) yêu cầu URL hoạt động và không có nội dung giữ chỗ ([App Review Guidelines][guidelines]); trang xóa tài khoản của Google phải mở được công khai. Trang chính sách hiện còn "sẽ công bố" ở tên bên vận hành và địa chỉ (`operatorName`, `operatorAddress` = `null`): phải điền trước khi nộp.

## 7. Ảnh chụp màn hình và tài sản đồ họa

### 7.1 Cỡ bắt buộc hiện hành

**App Store** ([Screenshot specifications][asc-screens], truy cập 2026-10-30):

| Thiết bị | Bắt buộc? | Kích thước dọc chấp nhận | Số ảnh |
|---|---|---|---|
| iPhone, màn có Dynamic Island cỡ vừa | **Bắt buộc** | 1179 × 2556 hoặc 1206 × 2622 | 1–10 |
| iPhone, Dynamic Island cỡ lớn | Tùy chọn (khuyến nghị cho máy lớn) | 1260 × 2736, 1290 × 2796 hoặc 1320 × 2868 | 1–10 |
| Cỡ iPhone nhỏ hơn | Không: App Store Connect tự thu nhỏ từ cỡ bắt buộc | – | – |
| iPad 13 inch | Chỉ khi app hỗ trợ iPadOS. `app.json` hiện `ios.supportsTablet: false` nên **không cần** | 2064 × 2752 hoặc 2048 × 2732 | – |

Định dạng `.png`/`.jpg`/`.jpeg`, **không có kênh alpha/trong suốt**. Trang Apple ghi "iPhone Duo" sẽ bắt buộc từ tháng 4/2027 cho app dùng SDK iOS 27.1 trở lên: không áp dụng bản v1 nếu build bằng SDK hiện tại, kiểm lại khi nâng SDK.

**Google Play** (*chưa đọc trực tiếp* [Play Console Help 9866151][gp-listing]; số liệu theo hiểu biết và tài liệu bên thứ ba, phải kiểm trong Console trước khi chụp):

| Tài sản | Yêu cầu (cần kiểm) |
|---|---|
| Icon | 512 × 512, PNG 32-bit, ≤ 1 MB |
| Ảnh nổi bật (feature graphic) | 1024 × 500, JPEG hoặc PNG 24-bit không alpha; **bắt buộc** để đăng |
| Ảnh điện thoại | 2–8 ảnh; PNG/JPEG 24-bit không alpha; mỗi cạnh 320–3840 px, cạnh dài ≤ 2 lần cạnh ngắn; nên ≥ 4 ảnh cỡ ≥ 1080 px để đủ điều kiện được đề xuất |
| Ảnh máy tính bảng 7"/10" | Tùy chọn; v1 không tối ưu cho máy tính bảng, không nộp |

Icon chính thức còn chờ O-23/C-5 (icon hiện là bản tạm).

### 7.2 Danh sách ảnh cần chụp (cùng bộ cho hai store)

Thứ tự đề xuất, màn dọc. Chú thích trên ảnh (nếu có) phải trung thực như mô tả; không viết "an toàn tuyệt đối", "thắng khiếu nại".

| # | Màn (mã UI) | Trạng thái cần có | Chú thích đề xuất (minh họa) |
|---|---|---|---|
| 1 | Quét mã (UI-B02) | Camera đang nhận mã vạch mẫu | "Quét mã trên nhãn đơn" |
| 2 | Xác nhận đơn (UI-C01) | Đơn `DH-DEMO-0001`, 1 kiện, có dòng sản phẩm | "Kiểm tra đơn và kiện trước khi quay" |
| 3 | Quay video đóng gói (UI-C03) | Đang quay (có đồng hồ đếm) | "Quay từ lúc lấy hàng đến khi niêm phong" |
| 4 | Bằng chứng của đơn (UI-E03) | Một video "Đã xác minh", một video "Chờ tải lên" | "Biết rõ tệp nào đã lên máy chủ" |
| 5 | Đồng bộ (UI-F01) **[theo V1-08]** | Có tệp ở nhiều nhóm | "Theo dõi việc tải lên" |
| 6 | Hàng hoàn: tình trạng kiện/ảnh (UI-D03) | 2–3 ảnh kiện | "Ghi nhận hàng hoàn có ảnh và video" |
| 7 | Hàng hoàn: hoàn tất (UI-D07) hoặc kiểm hàng (UI-D05) | Có nhãn "Hạn chế bằng chứng" nếu kiện mở trước | "Ghi rõ khi bằng chứng bị hạn chế" |
| 8 | Tranh chấp: xem trước (UI-G04) | Tóm tắt có danh sách bằng chứng | "Gom bằng chứng khi cần khiếu nại" |

Quy tắc chụp:

- Chụp từ **bản build thật** (bản `staging` hoặc ứng viên production) trên máy thật hoặc Simulator, với dữ liệu demo tự tạo bằng chính app (cửa hàng "Cửa hàng mẫu", mã `DH-DEMO-000x`). **Không** dùng ảnh bản web cổng giả (`docs/assets/screens/`), không ghép ảnh, không sửa nhãn trạng thái: trạng thái "Đã xác minh" phải là trạng thái thật do máy chủ trả (bất biến 3, 6).
- Màn quay (ảnh 1, 3) cần camera: chụp trên **máy thật** (Simulator không có camera).
- Không có dữ liệu thật của khách (tên người mua, địa chỉ, số điện thoại trên nhãn) trong khung hình.
- Không chụp Splash (có logo sàn, chờ C-3) và không chụp màn Gói dịch vụ (đang ẩn).
- Chỉ chụp màn đã có trong bản nộp: ảnh 5 cần V1-08; nếu thiếu thì thay bằng Trang chủ (UI-B01, **[theo V1-10]** số liệu thật).
- Thanh trạng thái: giờ, pin, sóng bình thường; không để thông báo của app khác.

## 8. Chuỗi quyền hiển thị khi xin quyền

Chuỗi sở hữu ở `app.json` (iOS `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`); không chép sang đây để tránh lệch. Nội dung v1:

- Camera: hiện là "Đơn Chứng dùng camera để quét mã trên đơn hàng và xem trước khi quay." Chuỗi này **chưa nói tới quay video/chụp ảnh**: **[theo V1-18]** đổi thành câu nêu đủ quét mã, quay video đóng gói và mở kiện, chụp ảnh kiện hàng hoàn, không ghi âm. App Review 5.1.1(ii) yêu cầu chuỗi mục đích mô tả đầy đủ cách dùng ([App Review Guidelines][guidelines]): **không nộp với chuỗi camera cũ khi đã bật ghi video**.
- Vị trí (khi đang dùng app): giữ nguyên chuỗi hiện có (ghi nơi chụp ảnh kiện hàng hoàn; không cho phép vẫn chụp được).
- Micro: không xin (O-09). Thư viện ảnh: không xin.

## 9. Phải đối chiếu lại trước khi nộp

| Nội dung | Phụ thuộc | Nếu PR bị tách khỏi v1 |
|---|---|---|
| "Quay video", phụ đề, ảnh 3 | V1-21 bật ghi video ở production | Không nộp bản đó với mô tả này |
| "Xem lại video, ảnh đã ghi ngay trên máy" | V1-17 | Bỏ câu |
| "Chỉ tải lên khi có Wi-Fi" | V1-09 | Bỏ câu |
| Ảnh UI-F01 | V1-08 | Thay ảnh Trang chủ |
| Xóa tài khoản trong app | V1-15 (và V1-14 phía máy chủ) | **Không nộp**: Apple 5.1.1(v) và Google bắt buộc |
| Chuỗi quyền camera | V1-18 | Không nộp khi đã bật ghi video |
| URL, email, tên bên vận hành | D-4 | Không nộp |
| Khai báo crash/ID thiết bị | V1-16 | Sửa [privacy-declarations.md](privacy-declarations.md) mục 2–3 |

## 10. Nguồn đã tra và mức chắc chắn

Truy cập 2026-10-30.

| Nguồn | Đọc trực tiếp? | Dùng cho |
|---|---|---|
| [App Store Connect Help: App information][asc-appinfo] | Có | Tên 2–30 ký tự, phụ đề ≤ 30, URL chính sách bắt buộc, phân loại độ tuổi bắt buộc |
| [App Store Connect Help: Platform version information][asc-version] | Có | Mô tả 4000 ký tự, văn bản quảng bá 170, từ khóa 100 byte, What's New 4000, Notes 4000 byte |
| [App Store Connect Help: Screenshot specifications][asc-screens] | Có | Cỡ ảnh bắt buộc, không alpha, 1–10 ảnh |
| [App Store Connect Help: Age ratings values and definitions][asc-age] | Có (phần đầu) | Câu hỏi và mức tuổi 4+/9+/13+/16+/18+ |
| [App Review Guidelines][guidelines] | Có | 2.1(a), 2.3.7, 4.8, 5.1.1(i), (ii), (v) |
| [Google Play Console Help 9866151 (tài sản trang ứng dụng)][gp-listing] | **Không** (tên miền `support.google.com` bị chặn trong môi trường soạn) | Giới hạn tên 30, mô tả ngắn 80 (kết quả tìm kiếm xác nhận), mô tả 4000, ảnh, feature graphic: **phải kiểm lại trong Console** |
| [Google Play Console Help 13327111 (yêu cầu xóa tài khoản)][gp-delete] | **Không** (chỉ đoạn trích kết quả tìm kiếm) | Bắt buộc URL web yêu cầu xóa tài khoản kể cả khi đã có xóa trong app |

[asc-appinfo]: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information
[asc-version]: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
[asc-screens]: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
[asc-age]: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions
[guidelines]: https://developer.apple.com/app-store/review/guidelines/
[gp-listing]: https://support.google.com/googleplay/android-developer/answer/9866151
[gp-delete]: https://support.google.com/googleplay/android-developer/answer/13327111
