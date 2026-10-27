import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from 'react';

import { getDefaultGateways } from '../../data/gateways';
import {
  INITIAL_ONBOARDING_STATE,
  onboardingReducer,
  type OnboardingAction,
  type OnboardingState,
} from '../../domain/onboarding-flow';
import {
  INITIAL_RECOVERY_STATE,
  recoveryReducer,
  type RecoveryAction,
  type RecoveryState,
} from '../../domain/recovery-flow';
import type { Gateways } from '../../domain/types';

interface OnboardingFlowValue {
  state: OnboardingState;
  dispatch: Dispatch<OnboardingAction>;
  /** Luồng Quên mật khẩu (UI-A07..A09): chỉ trong bộ nhớ, không lưu đĩa, không log. */
  recovery: RecoveryState;
  dispatchRecovery: Dispatch<RecoveryAction>;
  gateways: Gateways;
}

const OnboardingFlowContext = createContext<OnboardingFlowValue | null>(null);

/**
 * Trạng thái luồng thiết lập, luồng khôi phục mật khẩu + cổng dịch vụ, đặt ở gốc app (bootstrap/Providers) để giữ giá trị khi
 * quay lại/tiến tới giữa các màn. Nhẹ: useReducer + context, không thêm thư viện. Test truyền
 * `gateways` giả riêng.
 */
export function OnboardingFlowProvider({
  children,
  gateways,
}: {
  children: ReactNode;
  gateways?: Gateways;
}) {
  const [state, dispatch] = useReducer(onboardingReducer, INITIAL_ONBOARDING_STATE);
  const [recovery, dispatchRecovery] = useReducer(recoveryReducer, INITIAL_RECOVERY_STATE);
  const [resolved] = useState<Gateways>(() => gateways ?? getDefaultGateways());
  const value = useMemo(
    () => ({ state, dispatch, recovery, dispatchRecovery, gateways: resolved }),
    [state, recovery, resolved],
  );
  return <OnboardingFlowContext.Provider value={value}>{children}</OnboardingFlowContext.Provider>;
}

export function useOnboardingFlow(): OnboardingFlowValue {
  const value = useContext(OnboardingFlowContext);
  if (!value) throw new Error('useOnboardingFlow phải nằm trong OnboardingFlowProvider');
  return value;
}
