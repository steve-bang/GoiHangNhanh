import { useEffect } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import {
  useCurrentShopId,
  useEvidenceFileStore,
  useOrderStore,
  LOCAL_SHOP_ID,
} from '@/features/orders';
import { useReturnStore } from '@/features/returns';
import {
  getAppVersion,
  getConnectivity,
  subscribeAppActive,
  subscribeConnectivity,
} from '@/platform';

import { createUploadQueue, type UploadRunOptions } from '../domain/upload-queue';
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
 * Hàng đợi là MỘT thể hiện ổn định theo (cổng, kho, shop): trạng thái mạng đổi KHÔNG tạo lại nó (đọc
 * thẳng từ `platform/connectivity`), nếu không cờ `running` của thể hiện cũ mất tác dụng và hai lượt tải
 * chạy chồng nhau. Mất mạng: hàng đợi dừng (lần gửi đang chạy bị hủy); có mạng lại: chạy ngay, tệp lỗi
 * mạng tới hạn ngay (V1-02).
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
  const orders = useOrderStore();
  const returns = useReturnStore();
  const shopId = useCurrentShopId();

  useEffect(() => {
    const effectiveGateway =
      gateway ?? (docs ? createDeviceUploadGateway(docs, getAppVersion() ?? undefined) : null);
    if (!effectiveGateway || shopId === LOCAL_SHOP_ID) return undefined;
    // Tài khoản đang đăng nhập theo Firebase Auth (cùng uid mà Rules thấy), đọc MỖI lượt.
    const currentUid = () => docs?.currentUid() ?? null;
    const queue = createUploadQueue({
      // Tệp đóng gói + media hàng hoàn dùng CHUNG một hàng đợi (Q-28), và CHỈ tệp do chính tài khoản đang
      // đăng nhập tạo (Q-24g, V1-07: không tải hộ tài khoản khác dùng chung máy). Media hàng hoàn chỉ tải
      // khi hồ sơ đã đăng bản neo; tệp đóng gói chỉ khai báo khi phiên đã đăng (không gọi máy chủ rồi
      // chờ bị từ chối).
      sources: [
        evidenceFileSource(files, orders, currentUid),
        returnMediaSource(returns, currentUid),
      ],
      gateway: effectiveGateway,
      hasher: hasher ?? deviceHasher,
      now: Date.now,
      isOnline: () => getConnectivity().online,
      subscribeOffline: (onOffline) =>
        subscribeConnectivity((value) => {
          if (!value.online) onOffline();
        }),
    });
    const run = (options?: UploadRunOptions) => {
      void queue.runOnce(shopId, options).catch(() => undefined);
    };
    run();
    const timer = setInterval(() => run(), UPLOAD_INTERVAL_MS);
    const unsubscribeActive = subscribeAppActive(() => run());
    // Có mạng lại: tải ngay thay vì đợi chu kỳ kế tiếp (lượt đang chạy thì bỏ qua, `busy`).
    let wasOnline = getConnectivity().online;
    const unsubscribeNetwork = subscribeConnectivity((value) => {
      if (value.online && !wasOnline) run({ networkRestored: true });
      wasOnline = value.online;
    });
    return () => {
      clearInterval(timer);
      unsubscribeActive();
      unsubscribeNetwork();
    };
  }, [docs, gateway, hasher, files, orders, returns, shopId]);

  return null;
}
