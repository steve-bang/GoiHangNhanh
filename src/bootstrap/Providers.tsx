import { useEffect, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';

import { getDefaultRemoteDocuments } from '@/api/create-remote-documents';
import { initI18n } from '@/core/i18n';
import {
  DeviceSettingsProvider,
  EvidenceFileStoreProvider,
  OrderStoreProvider,
  OrderSyncRunner,
} from '@/features/orders';
import { RecordingRecovery } from '@/features/packing';
import { DisputeStoreProvider } from '@/features/disputes';
import { ReturnMediaRecovery, ReturnStoreProvider, ReturnSyncRunner } from '@/features/returns';
import {
  PersonalGatewaysProvider,
  SessionHydrator,
  SessionProvider,
  SessionShopProvider,
} from '@/features/personal';
import { OnboardingFlowProvider } from '@/features/shop';
import { UploadRunner } from '@/features/upload';
import { excludeEvidenceDirFromBackup } from '@/platform';
import { ToastProvider } from '@/shared/ui';

const i18n = initI18n();

/**
 * Composition root (ADR-012). Điều hướng do Expo Router quản lý (`src/app`); provider Firebase,
 * state... được thêm cùng tính năng đầu tiên cần đến. SafeAreaProvider đã do Expo Router cung cấp.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  // V1-12 (Q-24d A): thư mục bằng chứng không vào iCloud Backup; gọi lại mỗi lần mở app (idempotent),
  // không chờ, không chặn. Thư mục CSDL do `openLocalDatabase` tự đặt cờ sau khi mở.
  useEffect(() => {
    excludeEvidenceDirFromBackup().catch(() => undefined);
  }, []);
  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="dark" />
      <OnboardingFlowProvider>
        <PersonalGatewaysProvider>
          <SessionProvider>
            {/* Nạp phiên ở gốc (V1-06): liên kết sâu tới màn ngoài nhóm tab cũng được nạp. */}
            <SessionHydrator />
            <ToastProvider>
              <SessionShopProvider>
                <OrderStoreProvider>
                  <EvidenceFileStoreProvider>
                    <ReturnStoreProvider>
                      <DisputeStoreProvider>
                        <DeviceSettingsProvider>
                          <RecordingRecovery />
                          <ReturnMediaRecovery />
                          <OrderSyncRunner docs={getDefaultRemoteDocuments()} />
                          <ReturnSyncRunner docs={getDefaultRemoteDocuments()} />
                          {/* Bọc màn hình: Trung tâm đồng bộ gọi hàng đợi qua `useUploadQueueControl` (V1-08). */}
                          <UploadRunner docs={getDefaultRemoteDocuments()}>{children}</UploadRunner>
                        </DeviceSettingsProvider>
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
