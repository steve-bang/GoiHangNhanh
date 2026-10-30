import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { requiresKnownShop } from '../data/session-mode';
import type { SessionHydration } from '../domain/session-gate';

import {
  INITIAL_SESSION,
  sessionKey,
  sessionReducer,
  type SessionState,
  type SessionUser,
} from '../domain/session-state';
import { usePersonalGateways } from './PersonalGatewaysProvider';

export interface SessionContextValue {
  readonly state: SessionState;
  /** Khóa cho mọi state/cache trong bộ nhớ gắn với phiên (đổi tài khoản/shop thì đổi). */
  readonly key: string;
  /** Ghi nhận đã đăng nhập (sau khi cổng xác nhận). */
  beginSession(user: SessionUser, shopId: string | null): void;
  changeShop(shopId: string | null): void;
  updateDisplayName(displayName: string | null): void;
  /** Báo thông tin shop đang dùng đã được cập nhật (sau khi cổng xác nhận) để màn đang hiện tên cũ tải lại. */
  notifyShopUpdated(): void;
  /**
   * Đăng xuất qua cổng. CHỈ xả state sau khi cổng xác nhận; lỗi thì ném lại và giữ nguyên phiên (không
   * báo đăng xuất giả). Gọi lặp khi đang chạy trả về cùng một lời hứa. Không xóa dữ liệu cục bộ (Q-20h).
   */
  signOut(): Promise<void>;
  /**
   * Đăng ký hàm xả state/cache trong bộ nhớ, gọi khi phiên đổi danh tính (đăng xuất, đổi shop,
   * đăng nhập tài khoản khác). Trả về hàm hủy đăng ký.
   */
  onSessionCleared(listener: () => void): () => void;
  /**
   * Chế độ chặt (bản Firebase/"chưa kết nối", V1-06): màn nghiệp vụ chỉ mở và chỉ ghi dữ liệu khi phiên đã
   * đăng nhập VÀ biết shop thật. Cổng giả = `false` (giữ hành vi cũ).
   */
  readonly requireKnownShop: boolean;
  /** Phiên trong bộ nhớ đã được đối chiếu với phiên lưu trên máy chưa (xem `session-gate.ts`). */
  readonly hydration: SessionHydration;
  /** Chỉ `SessionHydrator` gọi: báo trạng thái nạp danh tính (`pending` khi người dùng bấm Thử lại). */
  reportHydration(result: SessionHydration): void;
  /** Chỉ `SessionHydrator` gọi: đăng ký hàm thử nạp lại ngay. Trả về hàm hủy đăng ký. */
  registerHydrationRetry(retry: () => void): () => void;
  /** Người dùng bấm Thử lại (màn "Chưa kết nối được cửa hàng"): thử nạp danh tính ngay. */
  retryHydration(): void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Phiên toàn app. Luôn bắt đầu `signed_out` + `hydration: 'pending'`; `SessionHydrator` (gắn ở gốc) nạp
 * danh tính đã lưu trên máy. Không suy đoán phiên khi cổng chưa xác nhận.
 */
export function SessionProvider({
  children,
  requireKnownShop,
}: {
  children: ReactNode;
  /** Mặc định theo môi trường (`requiresKnownShop`); test truyền thẳng. */
  requireKnownShop?: boolean;
}) {
  const { account } = usePersonalGateways();
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION);
  const [strict] = useState(() => requireKnownShop ?? requiresKnownShop());
  const [hydration, setHydration] = useState<SessionHydration>('pending');
  const hydrationRetry = useRef<(() => void) | null>(null);
  const listeners = useRef(new Set<() => void>());
  const inFlight = useRef<Promise<void> | null>(null);
  const lastEpoch = useRef(state.epoch);

  // Phiên đổi danh tính -> xả state/cache ở các nơi đã đăng ký.
  useEffect(() => {
    if (lastEpoch.current === state.epoch) return;
    lastEpoch.current = state.epoch;
    for (const listener of Array.from(listeners.current)) listener();
  }, [state.epoch]);

  const beginSession = useCallback((user: SessionUser, shopId: string | null) => {
    dispatch({ type: 'signed_in', user, shopId });
    // Đăng nhập/tạo shop trong app là câu trả lời dứt khoát: không còn "đang nạp".
    setHydration('settled');
  }, []);
  const reportHydration = useCallback((result: SessionHydration) => {
    setHydration(result);
  }, []);
  const registerHydrationRetry = useCallback((retry: () => void) => {
    hydrationRetry.current = retry;
    return () => {
      if (hydrationRetry.current === retry) hydrationRetry.current = null;
    };
  }, []);
  const retryHydration = useCallback(() => {
    hydrationRetry.current?.();
  }, []);
  const changeShop = useCallback((shopId: string | null) => {
    dispatch({ type: 'shop_changed', shopId });
  }, []);
  const updateDisplayName = useCallback((displayName: string | null) => {
    dispatch({ type: 'profile_updated', displayName });
  }, []);
  const notifyShopUpdated = useCallback(() => {
    dispatch({ type: 'shop_updated' });
  }, []);
  const onSessionCleared = useCallback((listener: () => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const signOut = useCallback((): Promise<void> => {
    inFlight.current ??= account
      .signOut()
      .then(() => {
        dispatch({ type: 'signed_out' });
        // Cổng đã xác nhận đăng xuất: "chưa đăng nhập" là dứt khoát (không phải đang nạp).
        setHydration('settled');
      })
      .finally(() => {
        inFlight.current = null;
      });
    return inFlight.current;
  }, [account]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      key: sessionKey(state),
      beginSession,
      changeShop,
      updateDisplayName,
      notifyShopUpdated,
      signOut,
      onSessionCleared,
      requireKnownShop: strict,
      hydration,
      reportHydration,
      registerHydrationRetry,
      retryHydration,
    }),
    [
      state,
      beginSession,
      changeShop,
      updateDisplayName,
      notifyShopUpdated,
      signOut,
      onSessionCleared,
      strict,
      hydration,
      reportHydration,
      registerHydrationRetry,
      retryHydration,
    ],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession phải nằm trong SessionProvider');
  return value;
}
