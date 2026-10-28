import { AppState } from 'react-native';

/** Gọi `onActive` mỗi khi app trở lại foreground. Trả hàm hủy đăng ký. */
export function subscribeAppActive(onActive: () => void): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') onActive();
  });
  return () => subscription.remove();
}
