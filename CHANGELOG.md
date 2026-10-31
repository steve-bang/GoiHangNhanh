# Nhật ký thay đổi

Mọi thay đổi đáng chú ý của ứng dụng Đơn Chứng được ghi ở đây. Định dạng theo [Keep a Changelog 1.1.0](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/). Quy ước ghi (mỗi PR một dòng, kèm mã `V1-xx` và số PR): [docs/engineering/v1-release-plan.md mục 5](docs/engineering/v1-release-plan.md#5-quy-ước-changelog).

Trạng thái hiện tại: **chưa có bản phát hành nào trên cửa hàng ứng dụng.** Chưa có gì trong app từng chạy trên thiết bị thật hay build native; mọi mục dưới đây chỉ được kiểm chứng bằng unit test (Jest), Firebase Emulator và `expo export`.

## [Unreleased]

### Added

- Kế hoạch tổng phát hành v1.0, checklist phát hành cho con người và nhật ký thay đổi này (tài liệu).
- Công cụ chụp ảnh màn hình bản web với cổng giả cho PR (`scripts/screens`, không đổi phụ thuộc, không chạy ở CI) và bộ ảnh mốc các màn chính (V1-00, #41).
- Website: trang Chính sách quyền riêng tư, Điều khoản sử dụng, Hỗ trợ và Yêu cầu xóa tài khoản (bản chờ rà pháp lý; email, tên pháp nhân, tên miền còn giữ chỗ), liên kết ở chân trang và sitemap; trang chủ web không còn nói "tải lên chạy nền" (V1-19, #42).
- Tài liệu nộp store: mô tả, khai báo quyền riêng tư, ghi chú duyệt (V1-20, #45).
- Quên mật khẩu gửi thư đặt lại của Firebase Auth (thư tiếng Việt, trả lời trung tính) và màn mới "Kiểm tra hộp thư"; chưa kiểm chứng gửi thư thật trên thiết bị (V1-03, #47).
- Xem lại video và ảnh bằng chứng ngay trên máy đã ghi (màn Chi tiết bằng chứng, mở từ Bằng chứng của đơn), chỉ xem, không sửa hay xóa tệp gốc; tệp không còn trên máy thì báo rõ, chưa xem được từ máy chủ. Chưa kiểm chứng trên thiết bị (V1-17).
- Xem lại ảnh kiện và video mở kiện hàng hoàn trên máy (từ Tình trạng bên ngoài, Xác nhận và Hoàn tất hồ sơ) và các tệp của hồ sơ tranh chấp (từ Chọn bằng chứng); chỉ xem, mang nhãn "Hạn chế bằng chứng" theo cùng điều kiện ở Hoàn tất hồ sơ (kiện mở trước khi quay, không có hoặc gián đoạn video mở kiện), không hiện vị trí ảnh. Chưa kiểm chứng trên thiết bị (V1-17b).
- Công tắc "Chỉ tải khi có Wi‑Fi" ở Trung tâm đồng bộ và màn Dữ liệu bằng chứng (mặc định tắt: luôn tải kể cả 4G/5G); khi bật mà máy không dùng Wi‑Fi thì ảnh/video chờ, tệp hiện "Đang chờ Wi‑Fi.", có Wi‑Fi lại thì tải tiếp khi ứng dụng đang mở. Lưu cài đặt trên máy (CSDL cục bộ phiên bản 15). Chưa kiểm chứng trên thiết bị (V1-09).

- Màn quay video (đóng gói và mở kiện hàng hoàn) giữ màn hình sáng; ứng dụng chuyển sang nền khi đang quay thì dừng quay, lưu phần đã quay và đánh dấu gián đoạn (không tự quay tiếp), quay lại ứng dụng có thông báo; camera bị hệ thống ngắt sớm cũng được đánh dấu gián đoạn; thêm dòng nhắc "nếu ứng dụng bị tắt, đoạn đang quay có thể mất" và bài Trợ giúp. Ghi video vẫn tắt mặc định, chưa kiểm chứng trên thiết bị (V1-11).
- Xóa tài khoản trong ứng dụng (bản Firebase): điều kiện thật (chặn khi đang quay, còn tranh chấp mở hoặc máy còn dữ liệu của tài khoản khác; cảnh báo và xác nhận riêng khi còn tệp chưa tải), nhập mật khẩu để xác nhận; chỉ sau khi máy chủ xác nhận mới xóa video, ảnh và dữ liệu trên máy (có dấu để xóa tiếp nếu ứng dụng bị tắt giữa chừng); màn "Đang hoàn tất xóa tài khoản" khi việc xóa còn dở. Chưa kiểm chứng trên thiết bị (V1-15).
- Báo lỗi ứng dụng bằng Firebase Crashlytics: chỉ gửi mã lỗi, tên thao tác và vị trí lỗi trong mã đã lọc (không email, mã tài khoản, mã cửa hàng, mã đơn, mã vận đơn, đường dẫn tệp, không gắn tài khoản); công tắc "Gửi báo lỗi ứng dụng" ở Quyền riêng tư và bảo mật, mặc định bật, tắt có hiệu lực ngay; khai báo quyền riêng tư iOS (privacy manifest). Chưa build native, chưa kiểm chứng trên thiết bị (V1-16).

### Security

- Bản production luôn dùng Firebase thật: build dừng nếu mang cờ cổng giả hoặc Firebase Emulator, app bỏ qua các cờ đó lúc chạy; mã app không còn `.dev`; Android không đưa dữ liệu vào sao lưu tự động và bỏ các quyền không dùng (micro, hiển thị trên ứng dụng khác, bộ nhớ ngoài). Chưa chạy build EAS thật (V1-01, #43).
- iOS: video, ảnh bằng chứng và CSDL trên máy không vào sao lưu iCloud (module Expo cục bộ đầu tiên của app); đổi máy hoặc cài lại sẽ mất tệp chưa tải lên. Chưa build và chưa kiểm chứng trên thiết bị (V1-12, #46).
- Máy chủ tự ghi nhật ký kiểm toán cho mọi lần tạo/sửa đơn, dòng, kiện, phiên, bằng chứng và hồ sơ hàng hoàn; Rules kiểm kiểu/độ dài trường và trần dung lượng mọi bằng chứng (ảnh 25 MB, video 2 GB); chỉ người khai báo mới xin được URL tải lên; xác minh mã băm không thử lại vô hạn và xác minh lại bằng chứng kẹt khi app thử tải lại tệp đó; ô nhập đơn giới hạn độ dài khớp máy chủ (V1-04, #44; chưa deploy).
- Bản Firebase không mở màn nghiệp vụ khi chưa đăng nhập hoặc chưa có cửa hàng (kể cả mở bằng liên kết sâu) và không tạo đơn, phiên quay, hồ sơ hàng hoàn khi chưa nạp được cửa hàng thật; offline lần đầu hiện "Chưa kết nối được cửa hàng" kèm Thử lại; màn đang quay không bị cắt ngang. Chưa kiểm chứng trên thiết bị (V1-06, #49).
- Máy chủ xóa tài khoản theo yêu cầu: Function `deleteAccount` (phải vừa đăng nhập lại) gỡ quyền vào cửa hàng và xóa tài khoản ngay, khóa dữ liệu cửa hàng và xóa hẳn sau 30 ngày bằng hàm chạy hằng ngày (kể cả nhật ký kiểm toán), trừ khi bị giữ vì lý do pháp lý; chỉ giữ bản ghi xóa tối thiểu không email/tên; script cho nhân viên xử lý yêu cầu xóa qua email. Chưa deploy, app chưa nối (V1-14).
- Máy chủ chỉ nhận khai báo và cấp URL tải bằng chứng cho chính người tạo phiên quay (đóng gói) hoặc người chụp/quay ảnh, video hàng hoàn (Rules + `createUploadSession`); ứng dụng báo "cần xử lý" ngay khi máy chủ từ chối vì tài khoản khác tạo, không thử lại mãi. Chưa deploy, chưa kiểm chứng trên thiết bị (V1-07b).

### Changed

- Giao diện Splash, Chào mừng, Đăng nhập, Đăng ký, Quên mật khẩu, Mã xác minh, Mật khẩu mới, Tạo shop và Hoàn tất thiết lập đồng nhất với phần còn lại của ứng dụng: màu cam thương hiệu thay xanh ngọc, cỡ chữ và khoảng cách theo bộ chuẩn chung, liên kết cùng một màu; dấu * bắt buộc ở Tên shop không còn màu đỏ. Biểu tượng ứng dụng và ảnh tĩnh (ảnh khởi động, ảnh minh họa Splash) chưa đổi. Chỉ kiểm qua ảnh bản web và unit test, chưa xem trên thiết bị (D-20).
- Tài liệu nội bộ: `CLAUDE.md` (trạng thái dự án, lệnh, ngoại lệ thứ hai của bất biến 4) và trạng thái từng PR trong kế hoạch v1 khớp mã sau V1-20 (tài liệu).
- Câu chữ trung thực cho v1: Trợ giúp thêm bài Chỉ tải khi có Wi‑Fi (kể cả lưu ý điểm phát Wi‑Fi từ máy khác), khi nào tải lên (chỉ khi ứng dụng đang mở), đổi máy/gỡ ứng dụng, mã băm, thời hạn lưu, xóa tài khoản; bài quay video theo cờ ghi video; màn Thời hạn lưu nói rõ chưa áp dụng thời hạn và chưa tự xóa; dải đồng bộ không còn nói "tải nền"; chuỗi quyền camera nêu đủ quét mã, quay video, chụp ảnh, không ghi âm; liên kết web và email hỗ trợ khai báo một chỗ (`public-links.ts`) có test khớp với web, điều kiện "dữ liệu tài khoản khác" ở Xóa tài khoản có nút bấm được khi đã có kênh thật; sửa ô tìm và nhãn thanh tab bị tràn/cắt ở màn 320 pt. Chưa kiểm chứng trên thiết bị (V1-18).
- Băm mã SHA-256 trước khi tải lên nhường luồng định kỳ để giao diện không đứng khi băm video dài, và không băm lại toàn tệp ở mỗi lần thử khi tệp không đổi (kích thước và thời điểm sửa đổi như lần băm trước; nghi ngờ thì băm lại, khác mã thì không tải); video mở kiện hàng hoàn lưu cờ gián đoạn bền ngay khi app vào nền, nên ứng dụng bị tắt hay lưu lỗi rồi khôi phục vẫn ghi đúng "bị gián đoạn"; thêm index (CSDL cục bộ phiên bản 16). Tốc độ băm trên điện thoại chưa đo, chưa kiểm chứng trên thiết bị (V1-13).
- Tab Cá nhân ở bản Firebase: đổi mật khẩu (xác thực lại bằng mật khẩu hiện tại), đổi họ tên, danh sách và đổi tên cửa hàng chạy thật; ẩn Cài đặt thông báo vì bản v1 chưa gửi thông báo. Chưa kiểm chứng trên thiết bị (V1-05).
- Ẩn nút đăng nhập Apple/Google ở Chào mừng, Đăng nhập, Đăng ký: bản v1 chỉ có email + mật khẩu (V1-03, #47).

### Fixed

- Trang chủ không còn dữ liệu minh họa: tên cửa hàng lấy từ tài khoản, ba ô "Thống kê hôm nay" đếm thật trên máy (đơn đã đóng gói có video, tệp máy chủ đã nhận hôm nay, tệp lỗi cần xử lý; ô Lỗi mở thẳng bộ lọc Lỗi), máy trống hiện số 0 kèm câu rỗng, thêm thẻ "Dữ liệu nằm trên máy này" đóng được; thẻ và màn Dữ liệu bằng chứng ở Cá nhân có số thật; tab Thông báo nói rõ ứng dụng chưa gửi thông báo và mở Trung tâm đồng bộ. Chưa kiểm chứng trên thiết bị (V1-10).
- Trung tâm đồng bộ hiện tệp thật trên máy (video đóng gói, ảnh/video hàng hoàn) thay cho dữ liệu minh họa, theo bốn mục Đang tải lên / Chờ tải lên / Lỗi / Đã tải lên; có nút Thử lại cho lỗi máy chủ (không cho lỗi của chính tệp), Kiểm tra lại cho tệp máy chủ nhận lâu chưa xác minh, nhóm riêng cho tệp của tài khoản khác, màn Chi tiết lỗi thật; nói rõ ứng dụng chỉ tải khi đang mở. Chưa kiểm chứng trên thiết bị (V1-08).
- Một máy một tài khoản: app chỉ tải lên ảnh/video do chính tài khoản đang đăng nhập tạo, không tải hộ tài khoản khác dùng chung máy; tệp của tài khoản khác hiện "Chờ tải lên" kèm lý do; tệp của tài khoản khác không còn chặn đăng xuất. Chưa kiểm chứng trên thiết bị (V1-07).
- Bản Firebase: đơn có nguồn bán "Khác" nay đăng được lên máy chủ (trước đây bị từ chối nên phiên và bằng chứng của đơn đó không bao giờ tải lên), tạo/sửa cửa hàng chọn "Khác" không còn bị từ chối; dữ liệu trên máy không đổi. Chưa deploy, chưa kiểm chứng trên thiết bị (fix-other-source).
- Test giao diện nặng không còn đỏ chập chờn khi máy tải cao: hạn mỗi test Jest đặt ở gốc cấu hình là 30 giây (giá trị đặt trong từng project trước đây bị Jest bỏ qua) (#50).
- Tải lên bằng chứng theo trạng thái mạng thật: mất mạng không còn làm tệp thành "cần xử lý" (chỉ lỗi máy chủ từ chối mới tính lượt, tối đa 8), lệnh tới máy chủ có hạn 30 giây để hàng đợi không treo, hàng đợi dừng khi mất mạng và chạy lại ngay khi có mạng; dải "ngoại tuyến" hiện thật (chưa kiểm chứng trên thiết bị) (V1-02, #48).

### Đã có trước khi mở nhật ký (đến commit `42f6a3c`, gom từ PR #13–#39)

Tóm tắt một lần để bản `1.0.0` có mốc; không tách theo từng PR.

- **Khung ứng dụng:** Expo SDK 58 + React Native + TypeScript, Expo Router, thanh tab 5 mục (Trang chủ, Đơn hàng, Quét, Thông báo, Cá nhân), design system theo token, i18n tiếng Việt, logger che dữ liệu cá nhân.
- **Bắt đầu sử dụng:** Splash, Chào mừng, đăng ký, đăng nhập, quên mật khẩu (giao diện, cổng giả), tạo cửa hàng.
- **Đơn hàng:** quét mã bằng camera, tra cứu trước khi tạo (không tự chọn/gộp), tạo đơn nhanh có kiểm trùng, danh sách có tìm/lọc/phân trang, chi tiết, bằng chứng của đơn, lịch sử tìm, sửa đơn khi chưa có phiên quay; kho cục bộ SQLite có migration (v1–v14).
- **Quay đóng gói (sau cờ, tắt mặc định):** tạo phiên và bản ghi tệp trước khi quay, lưu tệp bền, tính SHA-256, khôi phục sau khi app bị đóng; kiểm tra trước khi quay; giới hạn 10 phút; không thu tiếng.
- **Tải lên bằng chứng:** hàng đợi bền, đối soát với máy chủ, URL ký tạo một lần, xác minh mã băm phía máy chủ (`verifyEvidence`); chỉ chạy khi app mở.
- **Đồng bộ đơn/phiên lên Firestore:** một chiều, idempotent, chỉ bản ghi do chính tài khoản tạo.
- **Hàng hoàn:** hồ sơ cục bộ, tìm đơn gốc không tự ghép, tình trạng bên ngoài, ngoại lệ kiện mở trước khi quay, chụp tối đa 5 ảnh (có vị trí máy nếu được phép, chỉ lưu trên máy), xóa ảnh chụp nhầm có điều kiện, video mở kiện (sau cờ), kiểm hàng, xác nhận, nhãn "Hạn chế bằng chứng"; ảnh/video đi qua cùng hàng đợi tải lên.
- **Tranh chấp:** hồ sơ cục bộ, chọn bằng chứng (đánh dấu giữ), xem trước và chia sẻ văn bản tóm tắt, đóng hồ sơ không xóa dữ liệu.
- **Tab Cá nhân:** hồ sơ, cửa hàng, đổi họ tên/mật khẩu (cổng giả), đăng xuất an toàn (chặn khi đang quay, cảnh báo tệp chưa đồng bộ), cài đặt thông báo, quyền riêng tư và bảo mật, trợ giúp, dữ liệu bằng chứng, thời hạn lưu, thông tin xóa tài khoản (nút khóa); ẩn Gói dịch vụ.
- **Firebase:** Security Rules cô lập theo cửa hàng (Firestore; Storage từ chối client), Cloud Functions `createShop`, `updateShop`, `createUploadSession`, `verifyEvidence`; 147 test Rules/Functions trên Emulator. Phiên Firebase có `uid`/`shopId` thật và đăng xuất thật (gia cố PR1); index danh sách đơn (gia cố PR3, migration v7). Chưa deploy.
- **Website** marketing tĩnh (Astro) độc lập với app.
