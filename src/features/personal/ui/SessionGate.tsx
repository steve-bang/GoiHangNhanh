import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { ErrorState, Screen, Text, useTheme } from '@/shared/ui';

import { evaluateSessionGate, type SessionGate as Gate } from '../domain/session-gate';
import { useSession } from './SessionProvider';

export interface SessionGateOptions {
  /**
   * Đã mở một lần thì giữ nội dung dù phiên đổi sau đó. Dùng cho màn quay: phiên/kiện đã được tạo dưới
   * shop đã biết TRƯỚC khi quay (bất biến 2); cổng không bao giờ gỡ màn quay giữa chừng (đăng xuất,
   * chuyển shop vốn đã bị chặn khi đang quay).
   */
  readonly latch?: boolean;
}

/**
 * Trạng thái cổng phiên cho màn hiện tại (V1-06). Tự điều hướng khi cần: chưa đăng nhập -> Chào mừng,
 * chưa có cửa hàng -> Tạo cửa hàng (giống Splash). Trả `open` khi được hiện màn.
 */
export function useRequireSession(options: SessionGateOptions = {}): Gate {
  const session = useSession();
  const navigation = useAppNavigation();
  const evaluated = evaluateSessionGate({
    strict: session.requireKnownShop,
    status: session.state.status,
    shopId: session.state.shopId,
    hydration: session.hydration,
  });
  // Mẫu "lưu thông tin từ lần render trước" của React: đặt state trong render, có điều kiện.
  const [latched, setLatched] = useState(false);
  if (options.latch && evaluated === 'open' && !latched) setLatched(true);
  const gate: Gate = latched ? 'open' : evaluated;

  useEffect(() => {
    if (gate === 'signed_out') navigation.reset(ROUTES.welcome);
    else if (gate === 'no_shop') navigation.reset(ROUTES.createShop);
  }, [gate, navigation]);

  return gate;
}

/**
 * Bọc màn nghiệp vụ: chỉ hiện `children` khi phiên đã đăng nhập và biết cửa hàng thật (bản Firebase).
 * Cổng giả giữ hành vi cũ (luôn hiện). Không hiện dữ liệu dưới shop tạm trong lúc chờ.
 */
export function SessionGate({ children, latch }: SessionGateOptions & { children: ReactNode }) {
  const gate = useRequireSession(latch ? { latch } : {});
  if (gate === 'open') return <>{children}</>;
  return <SessionGateFallback gate={gate} />;
}

function SessionGateFallback({ gate }: { gate: Exclude<Gate, 'open'> }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const session = useSession();
  return (
    <Screen title={t('personal:sessionGate.title')} scroll={false} testID="session-gate">
      <View style={styles.center}>
        {gate === 'unreachable' ? (
          <ErrorState
            testID="session-gate-unreachable"
            variant="card"
            title={t('personal:sessionGate.unreachableTitle')}
            message={t('personal:sessionGate.unreachableHint')}
            onRetry={session.retryHydration}
          />
        ) : (
          // Đang nạp, hoặc đang chuyển sang Chào mừng/Tạo cửa hàng: không hiện màn nghiệp vụ.
          <View testID="session-gate-loading" style={[styles.loading, { gap: tokens.space.md }]}>
            <ActivityIndicator color={tokens.color.brand.primary} />
            {gate === 'loading' ? (
              <Text color="textMuted">{t('personal:sessionGate.loading')}</Text>
            ) : null}
          </View>
        )}
      </View>
    </Screen>
  );
}

/** Bọc component màn cho route Expo Router (route vẫn mỏng: `export default withSessionGate(Màn)`). */
export function withSessionGate<P extends object>(
  Inner: ComponentType<P>,
  options: SessionGateOptions = {},
): ComponentType<P> {
  function Gated(props: P) {
    return (
      <SessionGate {...options}>
        <Inner {...props} />
      </SessionGate>
    );
  }
  Gated.displayName = `withSessionGate(${Inner.displayName ?? Inner.name})`;
  return Gated;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  loading: { alignItems: 'center' },
});
