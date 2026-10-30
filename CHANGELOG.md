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

### Security

- Bản production luôn dùng Firebase thật: build dừng nếu mang cờ cổng giả hoặc Firebase Emulator, app bỏ qua các cờ đó lúc chạy; mã app không còn `.dev`; Android không đưa dữ liệu vào sao lưu tự động và bỏ các quyền không dùng (micro, hiển thị trên ứng dụng khác, bộ nhớ ngoài). Chưa chạy build EAS thật (V1-01, #43).
- iOS: video, ảnh bằng chứng và CSDL trên máy không vào sao lưu iCloud (module Expo cục bộ đầu tiên của app); đổi máy hoặc cài lại sẽ mất tệp chưa tải lên. Chưa build và chưa kiểm chứng trên thiết bị (V1-12, #46).
- Máy chủ tự ghi nhật ký kiểm toán cho mọi lần tạo/sửa đơn, dòng, kiện, phiên, bằng chứng và hồ sơ hàng hoàn; Rules kiểm kiểu/độ dài trường và trần dung lượng mọi bằng chứng (ảnh 25 MB, video 2 GB); chỉ người khai báo mới xin được URL tải lên; xác minh mã băm không thử lại vô hạn và xác minh lại bằng chứng kẹt khi app thử tải lại tệp đó; ô nhập đơn giới hạn độ dài khớp máy chủ (V1-04, #44; chưa deploy).
- Bản Firebase không mở màn nghiệp vụ khi chưa đăng nhập hoặc chưa có cửa hàng (kể cả mở bằng liên kết sâu) và không tạo đơn, phiên quay, hồ sơ hàng hoàn khi chưa nạp được cửa hàng thật; offline lần đầu hiện "Chưa kết nối được cửa hàng" kèm Thử lại; màn đang quay không bị cắt ngang. Chưa kiểm chứng trên thiết bị (V1-06, #49).
- Máy chủ xóa tài khoản theo yêu cầu: Function `deleteAccount` (phải vừa đăng nhập lại) gỡ quyền vào cửa hàng và xóa tài khoản ngay, khóa dữ liệu cửa hàng và xóa hẳn sau 30 ngày bằng hàm chạy hằng ngày (kể cả nhật ký kiểm toán), trừ khi bị giữ vì lý do pháp lý; chỉ giữ bản ghi xóa tối thiểu không email/tên; script cho nhân viên xử lý yêu cầu xóa qua email. Chưa deploy, app chưa nối (V1-14).

### Changed

- Tab Cá nhân ở bản Firebase: đổi mật khẩu (xác thực lại bằng mật khẩu hiện tại), đổi họ tên, danh sách và đổi tên cửa hàng chạy thật; ẩn Cài đặt thông báo vì bản v1 chưa gửi thông báo. Chưa kiểm chứng trên thiết bị (V1-05).
- Ẩn nút đăng nhập Apple/Google ở Chào mừng, Đăng nhập, Đăng ký: bản v1 chỉ có email + mật khẩu (V1-03, #47).

### Fixed

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
