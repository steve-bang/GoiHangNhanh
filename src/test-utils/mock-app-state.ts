/**
 * Mock điều khiển được cho `@/platform/app-state`:
 *
 *   jest.mock('@/platform/app-state', () => jest.requireActual('@/test-utils/mock-app-state').appStateMock);
 *
 * `emitAppState('background' | 'inactive' | 'active')` phát đổi trạng thái tới mọi người nghe đang đăng ký,
 * cùng quy tắc với adapter thật (nền = chỉ `background`).
 */
type AppStateValue = 'active' | 'background' | 'inactive';

const listeners = new Set<(state: AppStateValue) => void>();

function listen(fn: (state: AppStateValue) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitAppState(state: AppStateValue): void {
  for (const fn of Array.from(listeners)) fn(state);
}

/** Số người nghe đang đăng ký (kiểm tra màn đã hủy đăng ký khi bị gỡ). */
export function appStateListenerCount(): number {
  return listeners.size;
}

export function resetMockAppState(): void {
  listeners.clear();
}

export const appStateMock = {
  subscribeAppActive: (onActive: () => void) => listen((s) => s === 'active' && onActive()),
  subscribeAppBackground: (onBackground: () => void) =>
    listen((s) => s === 'background' && onBackground()),
  onceAppActive: (callback: () => void) => {
    const off = listen((s) => {
      if (s !== 'active') return;
      off();
      callback();
    });
    return off;
  },
};
