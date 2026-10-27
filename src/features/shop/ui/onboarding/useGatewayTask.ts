import { useCallback, useEffect, useRef, useState } from 'react';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { useIsScreenActive } from '@/platform';

/** Lỗi lạ (không phải AppError) coi như chưa kết nối được dịch vụ: không bao giờ báo thành công. */
export function toErrorCode(error: unknown): ErrorCode {
  return isAppError(error) ? error.code : 'AUTH_SERVICE_UNAVAILABLE';
}

export type GatewayTask = (isActive: () => boolean) => Promise<void>;

/**
 * Chạy một lời gọi cổng cho màn khôi phục/đăng nhập: chống bấm đúp bằng cờ ref (state chưa kịp cập
 * nhật giữa hai lần chạm), giữ trạng thái "đang xử lý" và lỗi chung; `retry` chạy lại ĐÚNG thao tác
 * vừa lỗi. `onFail` trả true nếu màn tự xử lý lỗi (ví dụ lỗi gắn với một ô), còn lại thành lỗi chung.
 *
 * Thao tác nhận `isActive()`: false khi người dùng đã rời màn (Back/đi chỗ khác) trong lúc chờ cổng.
 * Thao tác CHỈ được điều hướng hoặc đặt trạng thái của màn khi `isActive()` còn true, để kết quả muộn
 * không đẩy người dùng về một màn họ đã rời.
 */
export function useGatewayTask() {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<ErrorCode | null>(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const isActive = useIsScreenActive();
  const last = useRef<{ task: GatewayTask; onFail?: (code: ErrorCode) => boolean } | null>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (task: GatewayTask, onFail?: (code: ErrorCode) => boolean) => {
      if (busyRef.current) return;
      busyRef.current = true;
      last.current = onFail ? { task, onFail } : { task };
      setBusy(true);
      setFormError(null);
      try {
        await task(() => mountedRef.current && isActive());
      } catch (error) {
        if (mountedRef.current) {
          const code = toErrorCode(error);
          if (!onFail?.(code)) setFormError(code);
        }
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setBusy(false);
      }
    },
    [isActive],
  );

  const retry = useCallback(() => {
    const previous = last.current;
    if (previous) void run(previous.task, previous.onFail);
  }, [run]);

  return { busy, busyRef, formError, setFormError, run, retry };
}

/** Lỗi chung nào có nút "Thử lại" (mạng, hệ thống); lỗi giới hạn số lần/sai thông tin thì không. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'AUTH_NETWORK_ERROR' || code === 'AUTH_SERVICE_UNAVAILABLE';
}
