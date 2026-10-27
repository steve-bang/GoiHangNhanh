import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

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
  /**
   * Đăng xuất qua cổng. CHỈ xả state sau khi cổng xác nhận; lỗi thì ném lại và giữ nguyên phiên (không
   * báo đăng xuất giả). Gọi lặp khi đang chạy trả về cùng một lời hứa. Không xóa dữ liệu cục bộ (Q-19h).
   */
  signOut(): Promise<void>;
  /**
   * Đăng ký hàm xả state/cache trong bộ nhớ, gọi khi phiên đổi danh tính (đăng xuất, đổi shop,
   * đăng nhập tài khoản khác). Trả về hàm hủy đăng ký.
   */
  onSessionCleared(listener: () => void): () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Phiên toàn app. Chưa nối vào Splash/đăng nhập (PR sau); hôm nay luôn bắt đầu `signed_out` và không
 * tự khôi phục: không suy đoán phiên khi cổng chưa xác nhận.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { account } = usePersonalGateways();
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION);
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
  }, []);
  const changeShop = useCallback((shopId: string | null) => {
    dispatch({ type: 'shop_changed', shopId });
  }, []);
  const updateDisplayName = useCallback((displayName: string | null) => {
    dispatch({ type: 'profile_updated', displayName });
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
      signOut,
      onSessionCleared,
    }),
    [state, beginSession, changeShop, updateDisplayName, signOut, onSessionCleared],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession phải nằm trong SessionProvider');
  return value;
}
