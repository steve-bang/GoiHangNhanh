import { useEffect, useRef } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import { useCurrentShopId, useEvidenceFileStore, LOCAL_SHOP_ID } from '@/features/orders';
import { useReturnStore } from '@/features/returns';
import { getAppVersion, subscribeAppActive, useIsOffline } from '@/platform';

import { createUploadQueue, type UploadQueue } from '../domain/upload-queue';
import { evidenceFileSource, returnMediaSource } from '../domain/upload-sources';
import type { LocalFileHasher, UploadGateway } from '../domain/ports';
import { createDeviceUploadGateway, deviceHasher } from './device-gateway';

/** Giãn cách giữa các lượt tải khi app mở (mỗi lượt chỉ chạm mạng nếu có tệp đang chờ). */
const UPLOAD_INTERVAL_MS = 60_000;

/**
 * Chạy hàng đợi tải lên bằng chứng (ngay khi gắn, khi app trở lại foreground, khi có mạng lại và định
 * kỳ). `docs = null` (cổng giả, test, thiếu cấu hình Firebase) thì KHÔNG làm gì; shop cục bộ tạm không
 * bao giờ tải. Tải ở tiền cảnh khi app mở: chưa có tải nền khi app bị đóng (iOS/Android giới hạn chạy
 * nền). Không hiển thị gì, nuốt mọi lỗi (hàng đợi tự thử lại và giữ trạng thái đúng).
 * `gateway`/`hasher` chỉ để test thay thế.
 *
 * Hàng đợi là MỘT thể hiện ổn định theo (cổng, kho, shop): trạng thái mạng đổi KHÔNG tạo lại nó (đọc qua
 * ref), nếu không cờ `running` của thể hiện cũ mất tác dụng và hai lượt tải chạy chồng nhau.
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
  const returns = useReturnStore();
  const shopId = useCurrentShopId();
  const offline = useIsOffline();
  const offlineRef = useRef(offline);
  const queueRef = useRef<UploadQueue | null>(null);

  useEffect(() => {
    offlineRef.current = offline;
  }, [offline]);

  useEffect(() => {
    const effectiveGateway =
      gateway ?? (docs ? createDeviceUploadGateway(docs, getAppVersion() ?? undefined) : null);
    if (!effectiveGateway || shopId === LOCAL_SHOP_ID) return undefined;
    const queue = createUploadQueue({
      // Tệp đóng gói + media hàng hoàn dùng CHUNG một hàng đợi (Q-28). Media hàng hoàn chỉ tải khi hồ sơ
      // đã đăng bản neo và do chính tài khoản đang đăng nhập tạo.
      sources: [
        evidenceFileSource(files),
        returnMediaSource(returns, () => docs?.currentUid() ?? null),
      ],
      gateway: effectiveGateway,
      hasher: hasher ?? deviceHasher,
      now: Date.now,
      isOnline: () => !offlineRef.current,
    });
    queueRef.current = queue;
    const run = () => {
      void queue.runOnce(shopId).catch(() => undefined);
    };
    run();
    const timer = setInterval(run, UPLOAD_INTERVAL_MS);
    const unsubscribe = subscribeAppActive(run);
    return () => {
      clearInterval(timer);
      unsubscribe();
      queueRef.current = null;
    };
  }, [docs, gateway, hasher, files, returns, shopId]);

  // Có mạng lại: tải ngay thay vì đợi chu kỳ kế tiếp (lượt đang chạy thì bỏ qua, `busy`).
  useEffect(() => {
    if (!offline) void queueRef.current?.runOnce(shopId).catch(() => undefined);
  }, [offline, shopId]);

  return null;
}
