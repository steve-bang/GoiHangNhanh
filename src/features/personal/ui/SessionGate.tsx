import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { CurrentShopProvider } from '@/features/orders';
import { Button, ErrorState, Screen, Text, useTheme } from '@/shared/ui';

import { evaluateSessionGate, type SessionGate as Gate } from '../domain/session-gate';
import { useSession } from './SessionProvider';
import { SignOutDialogs } from './SignOutDialogs';
import { useSignOut } from './use-sign-out';

export interface SessionGateOptions {
  /**
   * Màn quay. Đã mở một lần thì giữ nội dung dù phiên đổi sau đó, giữ `shopId`/`uid` chụp lúc mở cho cả
   * cây con (không đọc shop mới), và giữ mọi cổng phiên khác (không `reset` gỡ màn quay khỏi ngăn
   * xếp) cho tới khi màn đóng. Phiên/kiện đã được tạo dưới shop đã biết TRƯỚC khi quay (bất biến 2).
   */
  readonly latch?: boolean;
}

/**
 * Trạng thái cổng phiên cho màn hiện tại (V1-06). Tự điều hướng khi cần: chưa đăng nhập -> Chào mừng,
 * chưa có cửa hàng -> Tạo cửa hàng (giống Splash), TRỪ KHI đang có màn quay mở (`gatesHeld`): khi đó
 * không điều hướng và giữ nội dung đang hiện; xét lại khi màn quay đóng. Trả `open` khi được hiện màn.
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
  const held = session.gatesHeld;
  // Mẫu "lưu thông tin từ lần render trước" của React: đặt state trong render, có điều kiện.
  const [latched, setLatched] = useState(false);
  if (options.latch && evaluated === 'open' && !latched) setLatched(true);
  const [shown, setShown] = useState<Gate>(evaluated);
  let gate: Gate = evaluated;
  if (latched) gate = 'open';
  else if (held && shown === 'open') gate = 'open'; // màn quay đang mở phía trên: giữ nguyên
  if (gate !== shown) setShown(gate);

  const hold = session.holdSessionGates;
  useEffect(() => (latched ? hold() : undefined), [latched, hold]);

  useEffect(() => {
    if (held) return;
    if (gate === 'signed_out') navigation.reset(ROUTES.welcome);
    else if (gate === 'no_shop') navigation.reset(ROUTES.createShop);
  }, [gate, held, navigation]);

  return gate;
}

/**
 * Bọc màn nghiệp vụ: chỉ hiện `children` khi phiên đã đăng nhập và biết cửa hàng thật (bản Firebase).
 * Cổng giả giữ hành vi cũ (luôn hiện). Không hiện dữ liệu dưới shop tạm trong lúc chờ.
 */
export function SessionGate({ children, latch }: SessionGateOptions & { children: ReactNode }) {
  const gate = useRequireSession(latch ? { latch } : {});
  if (gate !== 'open') return <SessionGateFallback gate={gate} />;
  if (latch) return <FrozenShop>{children}</FrozenShop>;
  return <>{children}</>;
}

/**
 * Chụp shop/uid của phiên lúc màn quay mở và cấp cho cây con (chế độ chặt). Phiên đổi sau đó (đăng xuất,
 * chuyển shop) không làm màn quay đọc/ghi sang shop khác. Cổng giả giữ hành vi cũ (không chụp).
 */
function FrozenShop({ children }: { children: ReactNode }) {
  const session = useSession();
  const [frozen] = useState(() => ({
    shopId: session.state.shopId,
    uid: session.state.user?.uid ?? null,
  }));
  if (!session.requireKnownShop) return <>{children}</>;
  return (
    <CurrentShopProvider shopId={frozen.shopId} uid={frozen.uid} strict>
      {children}
    </CurrentShopProvider>
  );
}

function SessionGateFallback({ gate }: { gate: Exclude<Gate, 'open'> }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const session = useSession();
  const signOut = useSignOut();
  return (
    <Screen title={t('personal:sessionGate.title')} scroll={false} testID="session-gate">
      <View style={styles.center}>
        {gate === 'unreachable' ? (
          <View style={{ gap: tokens.space.md }}>
            <ErrorState
              testID="session-gate-unreachable"
              variant="card"
              title={t('personal:sessionGate.unreachableTitle')}
              message={t('personal:sessionGate.unreachableHint')}
              onRetry={session.retryHydration}
            />
            {/* Lối ra khi kẹt (V1-06 e): đúng luồng đăng xuất an toàn PER-21 (chặn khi đang quay/còn tệp chưa đồng bộ). */}
            <Button
              testID="session-gate-sign-out"
              variant="destructive"
              outlined
              size="slim"
              icon="sign-out"
              label={t('personal:signOut.action')}
              onPress={signOut.start}
              loading={signOut.busy}
            />
          </View>
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
      {/* Mở Trung tâm đồng bộ chỉ dẫn lại về màn chặn này: ẩn nút đó. */}
      <SignOutDialogs signOut={signOut} allowOpenSync={false} />
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
