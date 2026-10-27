import { Redirect } from 'expo-router';

import { ROUTES } from '@/core/navigation';

/**
 * Chỗ giữ cho nút Quét giữa thanh tab (xem `tab-config.ts`). Bấm nút KHÔNG vào đây (bị chặn ở
 * `_layout.tsx`); chỉ khi mở thẳng bằng liên kết sâu thì chuyển tới màn quét.
 */
export default function ScanTabPlaceholder() {
  return <Redirect href={ROUTES.scan.path} />;
}
