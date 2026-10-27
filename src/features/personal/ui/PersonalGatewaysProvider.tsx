import { createContext, useContext, type ReactNode } from 'react';

import { getDefaultPersonalGateways } from '../data/personal-gateways';
import type { PersonalGateways } from '../domain/types';

const PersonalGatewaysContext = createContext<PersonalGateways | null>(null);

/** Cấp cổng tài khoản/cài đặt cho cây giao diện (test truyền cổng giả riêng qua `gateways`). */
export function PersonalGatewaysProvider({
  gateways,
  children,
}: {
  gateways?: PersonalGateways;
  children: ReactNode;
}) {
  return (
    <PersonalGatewaysContext.Provider value={gateways ?? getDefaultPersonalGateways()}>
      {children}
    </PersonalGatewaysContext.Provider>
  );
}

export function usePersonalGateways(): PersonalGateways {
  return useContext(PersonalGatewaysContext) ?? getDefaultPersonalGateways();
}
