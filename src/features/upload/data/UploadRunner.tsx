import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

import type { RemoteDocuments } from '@/api/contract';
import {
  useCurrentShopId,
  useDeviceSettings,
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

import {
  createUploadQueue,
  type ServerCheckResult,
  type UploadQueue,
  type UploadRunOptions,
} from '../domain/upload-queue';
import { evidenceFileSource, returnMediaSource } from '../domain/upload-sources';
import {
  UPLOAD_WIFI_ONLY,
  uploadNetworkGate,
  type UploadNetworkGate,
} from '../domain/network-policy';
import type { LocalFileHasher, UploadGateway } from '../domain/ports';
import { createDeviceUploadGateway, deviceHasher } from './device-gateway';

/** Giãn cách giữa các lượt tải khi app mở (mỗi lượt chỉ chạm mạng nếu có tệp đang chờ). */
const UPLOAD_INTERVAL_MS = 60_000;

/**
 * Điều khiển hàng đợi cho màn hình (Trung tâm đồng bộ, V1-08). Không có hàng đợi thật (cổng giả, test,
 * thiếu cấu hình Firebase, shop tạm): `active = false`, `runNow` không làm gì, kiểm tra lại trả
 * `unsupported`. Màn hình vẫn đổi trạng thái tệp cục bộ (Thử lại) qua kho, không qua đây.
 */
export interface UploadQueueControl {
  readonly active: boolean;
  /** Chạy một lượt ngay; đang có lượt chạy thì chạy lại MỘT lần sau khi lượt đó xong. */
  runNow(): void;
  /** Nhờ máy chủ xác minh lại tệp `uploaded` của chính tài khoản, rồi chạy một lượt để đối soát. */
  requestServerCheck(id: string): Promise<ServerCheckResult>;
  /** Nghe khi một lượt chạy xong (để màn hình đọc lại trạng thái). Trả hàm hủy. */
  subscribe(listener: () => void): () => void;
}

const INACTIVE: UploadQueueControl = {
  active: false,
  runNow: () => undefined,
  requestServerCheck: async () => 'unsupported',
  subscribe: () => () => undefined,
};

/** Xuất cho test giao diện (thay điều khiển hàng đợi); mã app dùng `useUploadQueueControl`. */
export const UploadQueueContext = createContext<UploadQueueControl>(INACTIVE);

export function useUploadQueueControl(): UploadQueueControl {
  return useContext(UploadQueueContext);
}

interface Engine {
  readonly queue: UploadQueue;
  readonly shopId: Parameters<UploadQueue['runOnce']>[0];
  readonly run: (options?: UploadRunOptions, rerunIfBusy?: boolean) => void;
}

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
 *
 * "Chỉ tải khi có Wi‑Fi" (V1-09, cài đặt máy `UPLOAD_WIFI_ONLY`): bật mà mạng không phải Wi‑Fi thì như
 * mất mạng với hàng đợi (không chạy lượt, lần gửi đang chạy bị hủy). Có Wi‑Fi lại hoặc tắt công tắc:
 * chạy ngay. Cài đặt cũng đọc thẳng (không tạo lại hàng đợi khi đổi).
 */
export function UploadRunner({
  docs,
  gateway,
  hasher,
  children,
}: {
  docs: RemoteDocuments | null;
  gateway?: UploadGateway;
  hasher?: LocalFileHasher;
  children?: ReactNode;
}) {
  const files = useEvidenceFileStore();
  const orders = useOrderStore();
  const returns = useReturnStore();
  const settings = useDeviceSettings();
  const shopId = useCurrentShopId();
  const engine = useRef<Engine | null>(null);
  const listeners = useRef(new Set<() => void>());

  const control = useMemo<UploadQueueControl>(
    () => ({
      get active() {
        return engine.current !== null;
      },
      runNow: () => engine.current?.run(undefined, true),
      requestServerCheck: async (id) => {
        const current = engine.current;
        if (!current) return 'unsupported';
        const result = await current.queue.requestServerCheck(current.shopId, id as never);
        // Đối soát ngay để thấy kết quả nếu máy chủ đã chốt (thường cần vài phút để băm lại).
        if (result === 'requested') current.run(undefined, true);
        return result;
      },
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );

  useEffect(() => {
    const effectiveGateway =
      gateway ?? (docs ? createDeviceUploadGateway(docs, getAppVersion() ?? undefined) : null);
    if (!effectiveGateway || shopId === LOCAL_SHOP_ID) return undefined;
    // Tài khoản đang đăng nhập theo Firebase Auth (cùng uid mà Rules thấy), đọc MỖI lượt.
    const currentUid = () => docs?.currentUid() ?? null;
    // Mạng + công tắc Wi‑Fi đọc MỖI lần hỏi. Cài đặt chưa nạp xong = chưa biết (chờ, xem network-policy).
    void settings.load(UPLOAD_WIFI_ONLY);
    const gate = (): UploadNetworkGate => {
      const wifiOnly = settings.peek(UPLOAD_WIFI_ONLY);
      return uploadNetworkGate(getConnectivity(), wifiOnly.loaded ? wifiOnly.value : null);
    };
    const stopListeners = new Set<() => void>();
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
      isWaitingForWifi: () => gate() === 'waiting_wifi',
      subscribeOffline: (onStop) => {
        stopListeners.add(onStop);
        return () => {
          stopListeners.delete(onStop);
        };
      },
    });
    // Một lượt tại một thời điểm. Lượt do người dùng bấm (hoặc có mạng lại) khi đang chạy thì chạy lại
    // MỘT lần sau đó (lượt định kỳ trùng thì bỏ, như trước). Xong mỗi lượt báo cho màn hình.
    let inflight = false;
    let again: UploadRunOptions | null = null;
    let disposed = false;
    const run = (options?: UploadRunOptions, rerunIfBusy = false) => {
      if (disposed) return;
      if (inflight) {
        if (rerunIfBusy) {
          again = { networkRestored: Boolean(again?.networkRestored || options?.networkRestored) };
        }
        return;
      }
      inflight = true;
      void queue
        .runOnce(shopId, options)
        .catch(() => undefined)
        .finally(() => {
          inflight = false;
          for (const listener of [...listeners.current]) listener();
          const next = again;
          again = null;
          if (next) run(next);
        });
    };
    engine.current = { queue, shopId, run };
    run();
    const timer = setInterval(() => run(), UPLOAD_INTERVAL_MS);
    const unsubscribeActive = subscribeAppActive(() => run());
    // Mạng hoặc công tắc Wi‑Fi đổi: không còn được gửi -> hủy lần gửi đang chạy; được gửi trở lại (có
    // mạng lại, có Wi‑Fi lại, tắt công tắc, nạp xong cài đặt) -> tải ngay thay vì đợi chu kỳ kế tiếp.
    let previous = gate();
    const onGateChange = () => {
      const next = gate();
      if (next === previous) return;
      previous = next;
      if (next === 'allowed') {
        run({ networkRestored: true }, true);
      } else {
        for (const listener of [...stopListeners]) listener();
      }
    };
    const unsubscribeNetwork = subscribeConnectivity(onGateChange);
    const unsubscribeSetting = settings.subscribe(UPLOAD_WIFI_ONLY.key, onGateChange);
    return () => {
      disposed = true;
      if (engine.current?.queue === queue) engine.current = null;
      clearInterval(timer);
      unsubscribeActive();
      unsubscribeNetwork();
      unsubscribeSetting();
    };
  }, [docs, gateway, hasher, files, orders, returns, settings, shopId]);

  return <UploadQueueContext.Provider value={control}>{children}</UploadQueueContext.Provider>;
}
