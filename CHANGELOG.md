# Nhật ký thay đổi

Mọi thay đổi đáng chú ý của ứng dụng Đơn Chứng được ghi ở đây. Định dạng theo [Keep a Changelog 1.1.0](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/). Quy ước ghi (mỗi PR một dòng, kèm mã `V1-xx` và số PR): [docs/engineering/v1-release-plan.md mục 5](docs/engineering/v1-release-plan.md#5-quy-ước-changelog).

Trạng thái hiện tại: **chưa có bản phát hành nào trên cửa hàng ứng dụng.** Chưa có gì trong app từng chạy trên thiết bị thật hay build native; mọi mục dưới đây chỉ được kiểm chứng bằng unit test (Jest), Firebase Emulator và `expo export`.

## [Unreleased]

### Added

- Kế hoạch tổng phát hành v1.0, checklist phát hành cho con người và nhật ký thay đổi này (tài liệu).

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
