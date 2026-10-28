import { useCallback, useEffect, useRef, useState } from 'react';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';

/**
 * Trạng thái tải của MỘT khu vực màn hình (hồ sơ, cửa hàng...), độc lập với khu vực khác. Lỗi một
 * khu vực không làm mất khu vực đã tải xong; làm mới thất bại vẫn giữ dữ liệu cũ (kèm `refreshError`).
 */
export type RegionState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly code: ErrorCode }
  | {
      readonly status: 'ready';
      readonly data: T;
      /** Mã lỗi của lần làm mới gần nhất thất bại; dữ liệu hiện là bản đã tải trước đó. */
      readonly refreshError: ErrorCode | null;
    };

export interface Region<T> {
  readonly state: RegionState<T>;
  /** Đang làm mới (kéo để làm mới hoặc thử lại sau lỗi). */
  readonly refreshing: boolean;
  /** Tải lại; trả về khi xong. Gọi lặp khi đang chạy thì bỏ qua. */
  reload(): Promise<void>;
}

/** Lỗi lạ (không phải AppError) coi như dịch vụ chưa dùng được, không lộ chi tiết ra màn hình. */
export function toErrorCode(error: unknown): ErrorCode {
  return isAppError(error) ? error.code : 'AUTH_SERVICE_UNAVAILABLE';
}

/**
 * Tải dữ liệu một khu vực khi vào màn và mỗi khi `scopeKey` đổi (đổi tài khoản/shop: state cũ bị bỏ,
 * không rò dữ liệu sang phiên mới). Bỏ kết quả về muộn của lần tải đã cũ.
 */
export function useRegion<T>(load: () => Promise<T>, scopeKey: string): Region<T> {
  // Gắn kết quả với khóa phiên: đổi khóa thì kết quả cũ bị bỏ ngay (suy ra khi render), không rò sang phiên mới.
  const [slot, setSlot] = useState<{
    key: string;
    state: RegionState<T>;
    refreshing: boolean;
  }>({ key: scopeKey, state: LOADING, refreshing: false });
  const generation = useRef(0);
  const inFlight = useRef(false);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const run = useCallback(async (key: string) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const mine = generation.current;
    try {
      const data = await loadRef.current();
      if (mine !== generation.current) return;
      setSlot({ key, state: { status: 'ready', data, refreshError: null }, refreshing: false });
    } catch (error) {
      if (mine !== generation.current) return;
      const code = toErrorCode(error);
      setSlot((c) => ({
        key,
        refreshing: false,
        state:
          c.key === key && c.state.status === 'ready'
            ? { ...c.state, refreshError: code }
            : { status: 'error', code },
      }));
    } finally {
      if (mine === generation.current) inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    void run(scopeKey);
    return () => {
      generation.current += 1;
    };
  }, [scopeKey, run]);

  const reload = useCallback(async () => {
    if (inFlight.current) return;
    setSlot((c) => (c.key === scopeKey ? { ...c, refreshing: true } : c));
    await run(scopeKey);
  }, [run, scopeKey]);

  const current = slot.key === scopeKey ? slot : null;
  return {
    state: current?.state ?? LOADING,
    refreshing: current?.refreshing ?? false,
    reload,
  };
}

const LOADING = { status: 'loading' } as const;
