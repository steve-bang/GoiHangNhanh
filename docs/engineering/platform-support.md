# Hỗ trợ nền tảng: iOS và Android

Trạng thái: **đề xuất, chờ người dùng duyệt** (sàn phiên bản tối thiểu là câu hỏi mở O-20). Nguyên tắc "hỗ trợ cả hai hệ điều hành" đã được người dùng chốt (D-12). Số liệu kiểm tra ngày 2026-10-26.

## 1. Nguyên tắc

1. **iOS và Android ngang hàng.** Không có "nền tảng chính" và "nền tảng phụ". Một tính năng chỉ coi là xong khi chạy đúng trên cả hai.
2. **Phiên bản phổ biến.** Hỗ trợ các phiên bản hệ điều hành mà người bán thật đang dùng, kể cả máy đời cũ. Sàn phiên bản được chốt theo bảng ở mục 3 và rà soát lại bằng số liệu người dùng thật.
3. **Khác biệt nền tảng phải trung thực.** Nơi hệ điều hành khác nhau (tải nền, quyền, tiết kiệm pin), UI nói đúng điều đó theo bất biến #11 trong `CLAUDE.md`, không giấu bằng một hành vi "có vẻ giống nhau".
4. **Cô lập khác biệt.** Mã riêng cho từng nền tảng nằm sau một lớp adapter (cổng), không rải `Platform.OS` trong màn hình hay mã nghiệp vụ.
5. **Không merge tính năng chỉ chạy một nền tảng**, trừ khi khác biệt đã được ghi vào tài liệu và người dùng đồng ý.

## 2. Dữ liệu thị trường

| Số liệu | Giá trị | Nguồn / ghi chú |
|---|---|---|
| Thị phần hệ điều hành di động tại Việt Nam, 06/2026 | Android **60,65%**, iOS **39,31%** | [StatCounter](https://gs.statcounter.com/os-market-share/mobile/viet-nam) |
| Android toàn cầu, 12/2025 | Android 15: 19,3%; Android 14: 17,2%; Android 16: 7,5% | [Android Headlines](https://www.androidheadlines.com/2026/01/android-version-distribution-numbers-2025-2026-market-share.html) (dữ liệu Google, cập nhật không đều, chỉ gồm máy dùng Google Play) |
| iOS toàn cầu, 06/2026 | 79% iPhone có thể chạy iOS 26 đã dùng iOS 26 | [9to5Mac](https://9to5mac.com/2026/06/10/ios-26-adoption-grows-but-still-lags-slightly-behind-ios-18/); các trình theo dõi khác (StatCounter) cho số khác, do phương pháp đo khác nhau |

Điều rút ra và giới hạn:
- iOS gần 40% tại Việt Nam, không thể hoãn.
- **Không tìm thấy số liệu theo phiên bản hệ điều hành riêng cho Việt Nam.** Các số liệu phiên bản ở trên là toàn cầu và chỉ để tham khảo. Số liệu đáng tin nhất sẽ đến từ chính người dùng của app (Play Console, App Store Connect, bản beta); cần xác nhận lại trước khi nâng sàn.
- Chưa có số liệu hãng máy phổ biến tại Việt Nam trong tài liệu này; ma trận thiết bị ở mục 5 cần được đối chiếu với dữ liệu đó.

## 3. Sàn phiên bản

### Sàn kỹ thuật hiện tại (đọc từ `node_modules`, 2026-10-26)

| | iOS | Android |
|---|---|---|
| React Native 0.88 | tối thiểu **iOS 15.1** | `minSdk` 24 (**Android 7.0**), `targetSdk` 36 (Android 16), `compileSdk` 37 |

Chưa kiểm tra: sàn mà **Expo SDK 58** đặt (có thể cao hơn RN) và sàn của các thư viện native sẽ chọn (camera, tải nền, `@react-native-firebase`). Thư viện nào có sàn cao hơn sẽ nâng sàn thật của app. Việc này nằm trong các spike S1–S6 ở `architecture.md`.

### Đề xuất

1. **Đặt sàn hỗ trợ = sàn kỹ thuật cao nhất trong số framework và thư viện native đã chọn**, chốt sau spike. Không tự đặt sàn cao hơn mức đó khi chưa có số liệu người dùng, vì máy cũ vẫn phổ biến ở nhóm người bán nhỏ.
2. **Ngưỡng để loại máy cũ phải dựa trên chức năng cốt lõi**: nếu quay video dài, lưu tệp và tải nền không đạt độ tin cậy trên một phiên bản/cấu hình, đó là lý do hợp lệ để nâng sàn (kèm thông báo rõ khi cài).
3. **Rà soát sàn theo chu kỳ** (ví dụ mỗi lần Expo/RN nâng bản chính và sau mỗi 6 tháng) bằng số liệu từ Play Console/App Store Connect; chỉ nâng khi phần người dùng bị ảnh hưởng nhỏ và có thông báo trước.
4. **Cần kiểm tra khi phát hành:** yêu cầu `targetSdk` hiện hành của Google Play và phiên bản Xcode/SDK iOS tối thiểu của App Store (cả hai thay đổi hằng năm) — chưa xác minh trong tài liệu này.

## 4. Khác biệt nền tảng cần tính từ đầu

| Chủ đề | iOS | Android | Hệ quả |
|---|---|---|---|
| Tải nền | Không tiếp tục sau khi người dùng vuốt tắt app | Từ Android 15 dịch vụ foreground loại `dataSync` bị giới hạn 6 giờ/24 giờ; nhiều hãng máy có trình tiết kiệm pin riêng giết tiến trình nền | UI trung thực về chờ/tiếp tục; kiểm thử trên nhiều hãng (`docs/06`, spike S2–S3) |
| Quyền camera, micro, thông báo | Hộp thoại một lần; từ chối thì phải vào Cài đặt | Từ chối nhiều lần có thể bị chặn hỏi lại; thông báo cần quyền riêng từ Android 13 | Chỉ xin quyền khi bắt đầu tác vụ (UI-A05), có đường dẫn tới Cài đặt |
| Lưu tệp và sao lưu | Tệp có thể vào sao lưu iCloud | Sao lưu tự động của Google có thể chứa tệp ứng dụng | Quyết định loại bản gốc khỏi sao lưu: Q-09 trong `decisions.md` |
| Camera | Ít biến thể | Rất nhiều hãng/phần cứng/phiên bản API camera | Kiểm thử video dài trên nhiều dòng máy Android |
| Bố cục | Vùng an toàn, Dynamic Island, màn hình nhỏ (dòng SE) | Thanh điều hướng 3 nút hoặc cử chỉ; bắt buộc bố cục tràn viền từ `targetSdk` 35; tỉ lệ khung hình đa dạng | Dùng vùng an toàn; kiểm thử màn hình nhỏ và dài |
| Splash hệ điều hành (UI-A01) | iOS: storyboard với nền + ảnh khiên giữa màn (`contain`, 120pt); `fade` khi ẩn (`SplashScreen.setOptions`) chỉ có tác dụng trên iOS | Android 12+: API Splash Screen hệ thống chỉ hiện **biểu tượng giữa màn** (trong vòng tròn, cắt phần ngoài ~1/3) trên nền một màu, **không có `fade`/ảnh toàn màn**; ảnh Android riêng có đệm (288dp, khiên ~40%). Android dưới 12 do thư viện dựng. Nhiều hãng máy có launcher/adaptive icon riêng | Hai nền tảng không giống hệt nhau về splash hệ điều hành; Splash của app (UI-A01) là phần giống nhau. `userInterfaceStyle: "light"` nên không cấu hình bản tối. **Chưa kiểm chứng trên máy thật**; icon ứng dụng/adaptive icon hiện là bản tạm (O-23). Xem decisions.md Q-15 |
| Chữ lớn | Dynamic Type | Font scale | Nút chính không vỡ bố cục khi chữ lớn (`docs/09` mục 3) |
| Thanh toán gói dịch vụ | Chính sách App Store | Chính sách Google Play | O-16: chưa kết luận |
| Đăng nhập bên thứ ba | Cần kiểm tra điều kiện của App Store khi có đăng nhập Google | — | O-15; chưa xác minh |
| Hết bộ nhớ, thiết bị nóng | Hệ điều hành có thể dừng app | Tiến trình có thể bị giết theo chính sách từng hãng | QA-04, QA-12 |

## 5. Ma trận kiểm thử đề xuất (tối thiểu)

Bổ sung cho mục 5 của `testing.md`. Số máy cụ thể do đội quyết định; phải đủ các lớp sau:

| Lớp | Android | iOS |
|---|---|---|
| Sàn hỗ trợ (phiên bản cũ nhất) | 1 máy chạy phiên bản sàn | 1 iPhone chạy iOS sàn |
| Phiên bản giữa | Android 14 | iOS 18 |
| Mới nhất | Android 16 (và 15 vì giới hạn dịch vụ nền) | iOS 26 |
| Cấu hình thấp | RAM thấp, bộ nhớ gần đầy | iPhone đời cũ nhất còn hỗ trợ |
| Hãng/dòng máy | Ít nhất hai hãng phổ biến tại Việt Nam, gồm một hãng có trình tiết kiệm pin mạnh | iPhone màn hình nhỏ (SE) và màn hình lớn |

Các số phiên bản trong bảng là điểm khởi đầu, phải điều chỉnh sau khi sàn được chốt. Mỗi lần chạy ghi máy, hệ điều hành, phiên bản app, kết quả (như `testing.md`).

## 6. Câu hỏi mở

- **O-20:** sàn phiên bản tối thiểu chính thức cho iOS và Android (mục 3).
- **O-21:** có hỗ trợ máy tính bảng và màn hình gập không, hay chỉ điện thoại ở bản đầu? Khuyến nghị: điện thoại ở bản đầu; không khóa chiều dọc nếu thư viện camera không bắt buộc.
