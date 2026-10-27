# platform/

Adapter mỏng cho API native/thư viện bên thứ ba (camera, máy quét mã, hệ tệp, mạng, kho khóa,
sinh ID, tải nền). `domain/` định nghĩa giao diện cần có; `platform/` hiện thực chúng, để thay
thư viện (đề xuất trong `docs/engineering/decisions.md`) mà không đụng nghiệp vụ và để mock trong test.

Hiện có:

- `navigation.ts` - adapter duy nhất gọi Expo Router (`useAppNavigation`, `useRouteParams`,
  `useConfirmBeforeLeave` cho màn quay).
- `layout.ts` - khác biệt bố cục iOS/Android (vùng chạm tối thiểu, tránh bàn phím).
- `native-splash.ts` - giữ/ẩn splash hệ điều hành (`expo-splash-screen`) cho màn Splash UI-A01; lỗi bị nuốt.
- `connectivity.ts` - **stub** `useIsOffline()` luôn `false` cho tới khi chọn thư viện theo dõi mạng.

Camera, quét mã, hệ tệp, tải nền: thêm cùng tính năng đầu tiên cần đến.
