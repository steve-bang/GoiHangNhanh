import { useEffect, useState, type ReactNode } from 'react';

import type { RecoveryAction } from '../domain/recovery-flow';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';

/**
 * Chỉ cho test: đặt sẵn trạng thái luồng khôi phục (ví dụ "đã xin mã") rồi mới dựng màn, giống như
 * người dùng đã đi qua bước trước.
 */
export function WithRecoveryState({
  actions,
  children,
}: {
  actions: () => RecoveryAction[];
  children: ReactNode;
}) {
  const { dispatchRecovery } = useOnboardingFlow();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    for (const action of actions()) dispatchRecovery(action);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dựng màn sau khi đã đặt trạng thái
    setReady(true);
    // chỉ chạy một lần lúc mở
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready ? <>{children}</> : null;
}
