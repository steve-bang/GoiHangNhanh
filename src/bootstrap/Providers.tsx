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
  LocalWipeProvider,
  PersonalGatewaysProvider,
  SessionHydrator,
  SessionProvider,
  SessionShopProvider,
  useLocalWipe,
} from '@/features/personal';
import { OnboardingFlowProvider } from '@/features/shop';
import { UploadRunner } from '@/features/upload';
import { excludeEvidenceDirFromBackup } from '@/platform';
import { ToastProvider } from '@/shared/ui';

const i18n = initI18n();

/**
 * Tiến trình nền (khôi phục quay dở, đồng bộ, tải lên). Chỉ chạy khi không đang xóa dữ liệu trên máy
 * (V1-15): đang xóa thì gỡ khôi phục/đồng bộ và tắt hàng đợi, nhưng vẫn bọc màn hình bằng `UploadRunner`.
 */
function BackgroundRunners({ children }: { children: ReactNode }) {
  const { ready } = useLocalWipe();
  return (
    <>
      {ready ? (
        <>
          <RecordingRecovery />
          <ReturnMediaRecovery />
          <OrderSyncRunner docs={getDefaultRemoteDocuments()} />
          <ReturnSyncRunner docs={getDefaultRemoteDocuments()} />
        </>
      ) : null}
      {/* Bọc màn hình: Trung tâm đồng bộ gọi hàng đợi qua `useUploadQueueControl` (V1-08). */}
      <UploadRunner docs={getDefaultRemoteDocuments()} enabled={ready}>
        {children}
      </UploadRunner>
    </>
  );
}

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
            {/* V1-15: thấy dấu xóa dở thì xóa xong TRƯỚC khi nạp phiên, dựng kho/tiến trình nền/màn hình. */}
            <LocalWipeProvider>
              {/* Nạp phiên ở gốc (V1-06): liên kết sâu tới màn ngoài nhóm tab cũng được nạp. */}
              <SessionHydrator />
              <ToastProvider>
                <SessionShopProvider>
                  <OrderStoreProvider>
                    <EvidenceFileStoreProvider>
                      <ReturnStoreProvider>
                        <DisputeStoreProvider>
                          <DeviceSettingsProvider>
                            <BackgroundRunners>{children}</BackgroundRunners>
                          </DeviceSettingsProvider>
                        </DisputeStoreProvider>
                      </ReturnStoreProvider>
                    </EvidenceFileStoreProvider>
                  </OrderStoreProvider>
                </SessionShopProvider>
              </ToastProvider>
            </LocalWipeProvider>
          </SessionProvider>
        </PersonalGatewaysProvider>
      </OnboardingFlowProvider>
    </I18nextProvider>
  );
}
