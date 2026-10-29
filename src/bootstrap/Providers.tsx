import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';

import { getDefaultRemoteDocuments } from '@/api/create-remote-documents';
import { initI18n } from '@/core/i18n';
import { EvidenceFileStoreProvider, OrderStoreProvider, OrderSyncRunner } from '@/features/orders';
import { RecordingRecovery } from '@/features/packing';
import { DisputeStoreProvider } from '@/features/disputes';
import { ReturnStoreProvider, ReturnSyncRunner } from '@/features/returns';
import {
  PersonalGatewaysProvider,
  SessionProvider,
  SessionShopProvider,
} from '@/features/personal';
import { OnboardingFlowProvider } from '@/features/shop';
import { UploadRunner } from '@/features/upload';
import { ToastProvider } from '@/shared/ui';

const i18n = initI18n();

/**
 * Composition root (ADR-012). Điều hướng do Expo Router quản lý (`src/app`); provider Firebase,
 * state... được thêm cùng tính năng đầu tiên cần đến. SafeAreaProvider đã do Expo Router cung cấp.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="dark" />
      <OnboardingFlowProvider>
        <PersonalGatewaysProvider>
          <SessionProvider>
            <ToastProvider>
              <SessionShopProvider>
                <OrderStoreProvider>
                  <EvidenceFileStoreProvider>
                    <ReturnStoreProvider>
                      <DisputeStoreProvider>
                        <RecordingRecovery />
                        <OrderSyncRunner docs={getDefaultRemoteDocuments()} />
                        <ReturnSyncRunner docs={getDefaultRemoteDocuments()} />
                        <UploadRunner docs={getDefaultRemoteDocuments()} />
                        {children}
                      </DisputeStoreProvider>
                    </ReturnStoreProvider>
                  </EvidenceFileStoreProvider>
                </OrderStoreProvider>
              </SessionShopProvider>
            </ToastProvider>
          </SessionProvider>
        </PersonalGatewaysProvider>
      </OnboardingFlowProvider>
    </I18nextProvider>
  );
}
