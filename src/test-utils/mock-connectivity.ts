import { useSyncExternalStore } from 'react';

import type { Connectivity } from '@/platform/connectivity';

/**
 * Mock cho `@/platform/connectivity` (đã đăng ký mặc định trong `jest.setup.ts`): mặc định có mạng
 * Wi‑Fi. Test đổi mạng bằng `setMockConnectivity` (bọc trong `act` nếu có component đang hiển thị) và
 * gọi `resetMockConnectivity` sau mỗi test. Test của chính adapter dùng `jest.unmock`.
 */
const ONLINE: Connectivity = { online: true, type: 'wifi' };
let current: Connectivity = ONLINE;
const listeners = new Set<(value: Connectivity) => void>();

export function setMockConnectivity(next: Partial<Connectivity>): void {
  const online = next.online ?? current.online;
  current = { online, type: next.type ?? (online ? 'wifi' : 'none') };
  for (const listener of [...listeners]) listener(current);
}

export function resetMockConnectivity(): void {
  current = ONLINE;
  listeners.clear();
}

function subscribeConnectivity(listener: (value: Connectivity) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getConnectivity = (): Connectivity => current;

function useConnectivity(): Connectivity {
  return useSyncExternalStore(subscribeConnectivity, getConnectivity, getConnectivity);
}

export const connectivityMock = {
  getConnectivity,
  subscribeConnectivity,
  useConnectivity,
  useIsOffline: (): boolean => !useConnectivity().online,
};
