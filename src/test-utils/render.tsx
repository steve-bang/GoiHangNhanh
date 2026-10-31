import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initI18n } from '@/core/i18n';
import {
  DeviceSettingsProvider,
  EvidenceFileStoreProvider,
  OrderStoreProvider,
  createMemoryDeviceSettingsStore,
  createMemoryEvidenceFileStore,
  createMemoryOrderStore,
  type DeviceSettingsStore,
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
  LocalWipeProvider,
  PersonalGatewaysProvider,
  SessionProvider,
  SessionShopProvider,
  type PersonalGateways,
} from '@/features/personal';
import { OnboardingFlowProvider, type Gateways } from '@/features/shop';
import { ToastProvider } from '@/shared/ui';

import { createMemoryLocalWipe } from './memory-local-wipe';

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
    /** Kho cài đặt máy (V1-09); mặc định kho bộ nhớ mới cho mỗi lần render. */
    deviceSettingsStore?: DeviceSettingsStore;
    personalGateways?: PersonalGateways;
    /** Chế độ chặt của cổng phiên (bản Firebase, V1-06). Mặc định theo môi trường test = `false`. */
    requireKnownShop?: boolean;
    /** Phần xóa dữ liệu trên máy (V1-15); mặc định bản giả trong bộ nhớ, không có dấu. */
    localWipe?: ReturnType<typeof createMemoryLocalWipe>;
  } = {},
) {
  const orderStore = options.orderStore ?? createMemoryOrderStore();
  const evidenceFileStore = options.evidenceFileStore ?? createMemoryEvidenceFileStore();
  const returnStore = options.returnStore ?? createMemoryReturnStore();
  const disputeStore = options.disputeStore ?? createMemoryDisputeStore();
  const deviceSettingsStore = options.deviceSettingsStore ?? createMemoryDeviceSettingsStore();
  const localWipe = options.localWipe ?? createMemoryLocalWipe();
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
                <LocalWipeProvider device={localWipe.device} files={localWipe.files}>
                  <SessionShopProvider>
                    <OrderStoreProvider store={orderStore}>
                      <EvidenceFileStoreProvider store={evidenceFileStore}>
                        <ReturnStoreProvider store={returnStore}>
                          <DisputeStoreProvider store={disputeStore}>
                            <DeviceSettingsProvider store={deviceSettingsStore}>
                              {ui}
                            </DeviceSettingsProvider>
                          </DisputeStoreProvider>
                        </ReturnStoreProvider>
                      </EvidenceFileStoreProvider>
                    </OrderStoreProvider>
                  </SessionShopProvider>
                </LocalWipeProvider>
              </ToastProvider>
            </SessionProvider>
          </PersonalGatewaysProvider>
        </OnboardingFlowProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
}
