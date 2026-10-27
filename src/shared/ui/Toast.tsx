import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMinTouchTarget } from '@/platform';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastOptions {
  tone?: ToastTone;
  /**
   * Tự ẩn sau bao lâu (ms). `0` = giữ tới khi người dùng đóng. Mặc định: `info`/`success` tự ẩn, `error`
   * giữ lại (người dùng cần đọc kịp, trình đọc màn hình cần thời gian).
   */
  durationMs?: number;
  /**
   * Vị trí: `bottom` (mặc định, gần đáy) hoặc `top` (dưới vùng an toàn phía trên). Dùng `top` khi đáy
   * màn có nút/liên kết mà thông báo không được che (ví dụ Chào mừng sau khi đăng xuất).
   */
  placement?: 'bottom' | 'top';
}

/** Thời gian hiện mặc định của thông báo tự ẩn (ms). */
export const TOAST_DEFAULT_DURATION_MS = 4000;

interface ToastContextValue {
  show(message: string, options?: ToastOptions): void;
  dismiss(): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
  placement: 'bottom' | 'top';
}

/**
 * Thông báo ngắn nổi gần đáy (ví dụ "Đã lưu họ tên"). CHỈ nói điều đã xảy ra thật: gọi `show` sau
 * khi cổng xác nhận, không báo trước. Một thông báo tại một thời điểm (cái mới thay cái cũ).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const dismiss = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);
  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      clearTimer();
      const tone = options.tone ?? 'info';
      counter.current += 1;
      setToast({ id: counter.current, message, tone, placement: options.placement ?? 'bottom' });
      const duration = options.durationMs ?? (tone === 'error' ? 0 : TOAST_DEFAULT_DURATION_MS);
      if (duration > 0) timer.current = setTimeout(dismiss, duration);
    },
    [clearTimer, dismiss],
  );
  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? <ToastView key={toast.id} toast={toast} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast phải nằm trong ToastProvider');
  return value;
}

function ToastView({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const scheme = {
    info: { fg: tokens.color.text.primary, bg: tokens.color.surface.raised, icon: 'info' as const },
    success: {
      fg: tokens.color.feedback.success.fg,
      bg: tokens.color.feedback.success.bg,
      icon: 'check-circle' as const,
    },
    error: {
      fg: tokens.color.feedback.danger.fg,
      bg: tokens.color.feedback.danger.bg,
      icon: 'alert' as const,
    },
  }[toast.tone];
  const touch = getMinTouchTarget();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingHorizontal: tokens.space.lg,
          ...(toast.placement === 'top'
            ? { top: insets.top + tokens.space.lg }
            : { bottom: insets.bottom + tokens.space.lg }),
        },
      ]}
    >
      <View
        testID="toast"
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[
          styles.toast,
          {
            gap: tokens.space.md,
            paddingLeft: tokens.space.lg,
            backgroundColor: scheme.bg,
            borderColor: scheme.fg,
            borderWidth: tokens.borderWidth.thin,
            borderRadius: tokens.radius.md,
          },
        ]}
      >
        <Icon name={scheme.icon} size={20} color={scheme.fg} />
        <Text style={[styles.message, { color: scheme.fg }]}>{toast.message}</Text>
        <Pressable
          testID="toast-dismiss"
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.dismiss')}
          style={[styles.dismiss, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="close" size={18} color={scheme.fg} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0 },
  toast: { flexDirection: 'row', alignItems: 'center' },
  message: { flex: 1, flexShrink: 1 },
  dismiss: { alignItems: 'center', justifyContent: 'center' },
});
