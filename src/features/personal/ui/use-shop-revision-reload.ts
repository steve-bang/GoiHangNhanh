import { useEffect, useRef } from 'react';

import { useSession } from './SessionProvider';

/**
 * Tải lại một khu vực hiện thông tin shop khi shop đang dùng vừa được cập nhật ở màn khác (đổi tên).
 * Giữ dữ liệu cũ trong lúc tải (không nháy khung chờ).
 */
export function useReloadOnShopUpdated(reload: () => Promise<void>): void {
  const { shopRevision } = useSession().state;
  const last = useRef(shopRevision);
  useEffect(() => {
    if (last.current === shopRevision) return;
    last.current = shopRevision;
    void reload();
  }, [shopRevision, reload]);
}
