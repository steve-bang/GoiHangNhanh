import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

import {
  createRestoreController,
  IDLE_RESTORE,
  type RestoreController,
  type RestoreStatus,
} from './restore-status';

const RestoreContext = createContext<RestoreController | null>(null);

/** Giữ trạng thái khôi phục dùng chung giữa bộ chạy nền và màn hình. Test truyền `controller` riêng. */
export function RestoreProvider({
  controller,
  children,
}: {
  controller?: RestoreController;
  children: ReactNode;
}) {
  const value = useMemo(() => controller ?? createRestoreController(), [controller]);
  return <RestoreContext.Provider value={value}>{children}</RestoreContext.Provider>;
}

/** Không có provider (test màn hình cũ) = không khôi phục gì: màn hình hiển thị như trước. */
export function useRestoreController(): RestoreController | null {
  return useContext(RestoreContext);
}

const NEVER = () => () => undefined;

export function useRestoreStatus(): RestoreStatus {
  const controller = useContext(RestoreContext);
  return useSyncExternalStore(
    controller ? controller.subscribe : NEVER,
    controller ? controller.get : () => IDLE_RESTORE,
    () => IDLE_RESTORE,
  );
}
