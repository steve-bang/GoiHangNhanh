import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useSyncExternalStore } from 'react';

/** Loại kết nối đủ cho nghiệp vụ: `other` gồm Ethernet, VPN, Bluetooth và loại không rõ. */
export type ConnectionType = 'wifi' | 'cellular' | 'other' | 'none';

export interface Connectivity {
  /** `false` CHỈ khi hệ điều hành báo chắc chắn không có kết nối. Chưa biết = coi là có mạng. */
  readonly online: boolean;
  readonly type: ConnectionType;
}

/** Trước sự kiện đầu tiên của NetInfo: chưa biết, coi là có mạng (lỗi thật nếu có không tốn lượt). */
const UNKNOWN: Connectivity = { online: true, type: 'other' };

/** Dịch trạng thái NetInfo. Không dùng `isInternetReachable` (phép thử tới máy chủ ngoài có thể sai). */
export function toConnectivity(state: Pick<NetInfoState, 'type' | 'isConnected'>): Connectivity {
  const type: ConnectionType =
    state.type === 'wifi' || state.type === 'cellular' || state.type === 'none'
      ? state.type
      : 'other';
  const online = state.isConnected !== false && type !== 'none';
  return { online, type: online ? type : 'none' };
}

let current: Connectivity = UNKNOWN;
let started = false;
const listeners = new Set<(value: Connectivity) => void>();

/** Một đăng ký NetInfo duy nhất cho cả app, mở ở lần dùng đầu và giữ suốt phiên chạy. */
function ensureStarted(): void {
  if (started) return;
  started = true;
  NetInfo.addEventListener((state) => {
    const next = toConnectivity(state);
    if (next.online === current.online && next.type === current.type) return;
    current = next;
    for (const listener of [...listeners]) listener(next);
  });
}

/** Trạng thái mạng mới nhất (đồng bộ, cho hàng đợi tải lên/đồng bộ). */
export function getConnectivity(): Connectivity {
  ensureStarted();
  return current;
}

/** Nghe thay đổi trạng thái mạng (chỉ khi `online` hoặc `type` đổi). Trả hàm hủy. */
export function subscribeConnectivity(listener: (value: Connectivity) => void): () => void {
  ensureStarted();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, getConnectivity);
}

/** Banner ngoại tuyến (UI-F04) và các bộ chạy đồng bộ. */
export function useIsOffline(): boolean {
  return !useConnectivity().online;
}
