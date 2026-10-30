import { AppState } from 'react-native';

/** Gọi `onActive` mỗi khi app trở lại foreground. Trả hàm hủy đăng ký. */
export function subscribeAppActive(onActive: () => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onActive();
  });
  return () => subscription.remove();
}

/**
 * Gọi `onBackground` mỗi khi app chuyển hẳn sang nền (`background`: về màn hình chính, mở app khác, khóa
 * máy, thường cả khi nghe cuộc gọi). KHÔNG gồm `inactive` của iOS (kéo Trung tâm điều khiển/thông báo, hộp thoại hệ
 * thống, băng báo cuộc gọi): app vẫn hiện và camera thường vẫn chạy, coi đó là vào nền sẽ dừng quay oan
 * (V1-11). Android không có `inactive`. Trả hàm hủy đăng ký.
 */
export function subscribeAppBackground(onBackground: () => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') onBackground();
  });
  return () => subscription.remove();
}

/**
 * Gọi `callback` MỘT lần ở lần kế tiếp app trở lại foreground, rồi tự hủy. Không gắn với màn nào: dùng để
 * báo người dùng điều đã xảy ra lúc app ở nền, kể cả khi màn gây ra đã đóng. Trả hàm hủy (gọi nhiều lần vô hại).
 */
export function onceAppActive(callback: () => void): () => void {
  let done = false;
  const subscription = AppState.addEventListener('change', (state) => {
    if (done || state !== 'active') return;
    done = true;
    subscription.remove();
    callback();
  });
  return () => {
    if (done) return;
    done = true;
    subscription.remove();
  };
}
