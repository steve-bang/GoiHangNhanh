import { useEffect, useMemo } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import { useCurrentShopId, useEvidenceFileStore, LOCAL_SHOP_ID } from '@/features/orders';
import { getAppVersion, subscribeAppActive, useIsOffline } from '@/platform';

import { createUploadQueue } from '../domain/upload-queue';
import type { LocalFileHasher, UploadGateway } from '../domain/ports';
import { createDeviceUploadGateway, deviceHasher } from './device-gateway';

/** Giãn cách giữa các lượt tải khi app mở (mỗi lượt chỉ chạm mạng nếu có tệp đang chờ). */
const UPLOAD_INTERVAL_MS = 60_000;

/**
 * Chạy hàng đợi tải lên bằng chứng (ngay khi gắn, khi app trở lại foreground và định kỳ). `docs = null`
 * (cổng giả, test, thiếu cấu hình Firebase) thì KHÔNG làm gì; shop cục bộ tạm không bao giờ tải. Tải ở
 * tiền cảnh khi app mở: chưa có tải nền khi app bị đóng (iOS/Android giới hạn chạy nền). Không hiển thị
 * gì, nuốt mọi lỗi (hàng đợi tự thử lại và giữ trạng thái đúng). `gateway`/`hasher` chỉ để test thay thế.
 */
export function UploadRunner({
  docs,
  gateway,
  hasher,
}: {
  docs: RemoteDocuments | null;
  gateway?: UploadGateway;
  hasher?: LocalFileHasher;
}) {
  const files = useEvidenceFileStore();
  const shopId = useCurrentShopId();
  const offline = useIsOffline();

  const queue = useMemo(() => {
    const effectiveGateway =
      gateway ?? (docs ? createDeviceUploadGateway(docs, getAppVersion() ?? undefined) : null);
    if (!effectiveGateway) return null;
    return createUploadQueue({
      files,
      gateway: effectiveGateway,
      hasher: hasher ?? deviceHasher,
      now: Date.now,
      isOnline: () => !offline,
    });
  }, [docs, gateway, hasher, files, offline]);

  useEffect(() => {
    if (!queue || shopId === LOCAL_SHOP_ID) return undefined;
    const run = () => {
      void queue.runOnce(shopId).catch(() => undefined);
    };
    run();
    const timer = setInterval(run, UPLOAD_INTERVAL_MS);
    const unsubscribe = subscribeAppActive(run);
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [queue, shopId]);

  return null;
}
