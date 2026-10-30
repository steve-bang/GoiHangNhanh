import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initI18n } from '@/core/i18n';
import {
  EvidenceFileStoreProvider,
  OrderStoreProvider,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  type OrderStore,
} from '@/features/orders';
import type { EvidenceFileStore } from '@/features/evidence';
import {
  DisputeStoreProvider,
  createMemoryDisputeStore,
  type DisputeStore,
} from '@/features/disputes';
import { ReturnStoreProvider, createMemoryReturnStore, type ReturnStore } from '@/features/returns';
import {
  PersonalGatewaysProvider,
  SessionProvider,
  SessionShopProvider,
  type PersonalGateways,
} from '@/features/personal';
import { OnboardingFlowProvider, type Gateways } from '@/features/shop';
import { ToastProvider } from '@/shared/ui';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Render kèm i18n tiếng Việt, vùng an toàn (giống iPhone có tai thỏ) và trạng thái luồng thiết lập
 * (cổng giả khi test; truyền `gateways` để dùng bản giả riêng của bài test).
 */
export function renderWithProviders(
  ui: ReactElement,
  options: {
    gateways?: Gateways;
    orderStore?: OrderStore;
    evidenceFileStore?: EvidenceFileStore;
    returnStore?: ReturnStore;
    disputeStore?: DisputeStore;
    personalGateways?: PersonalGateways;
    /** Chế độ chặt của cổng phiên (bản Firebase, V1-06). Mặc định theo môi trường test = `false`. */
    requireKnownShop?: boolean;
  } = {},
) {
  const orderStore = options.orderStore ?? createMemoryOrderStore();
  const evidenceFileStore = options.evidenceFileStore ?? createMemoryEvidenceFileStore();
  const returnStore = options.returnStore ?? createMemoryReturnStore();
  const disputeStore = options.disputeStore ?? createMemoryDisputeStore();
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <I18nextProvider i18n={initI18n()}>
        <OnboardingFlowProvider {...(options.gateways ? { gateways: options.gateways } : {})}>
          <PersonalGatewaysProvider
            {...(options.personalGateways ? { gateways: options.personalGateways } : {})}
          >
            <SessionProvider
              {...(options.requireKnownShop !== undefined
                ? { requireKnownShop: options.requireKnownShop }
                : {})}
            >
              <ToastProvider>
                <SessionShopProvider>
                  <OrderStoreProvider store={orderStore}>
                    <EvidenceFileStoreProvider store={evidenceFileStore}>
                      <ReturnStoreProvider store={returnStore}>
                        <DisputeStoreProvider store={disputeStore}>{ui}</DisputeStoreProvider>
                      </ReturnStoreProvider>
                    </EvidenceFileStoreProvider>
                  </OrderStoreProvider>
                </SessionShopProvider>
              </ToastProvider>
            </SessionProvider>
          </PersonalGatewaysProvider>
        </OnboardingFlowProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
}
