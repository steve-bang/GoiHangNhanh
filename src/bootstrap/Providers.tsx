import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';

import { initI18n } from '@/core/i18n';
import { OrderStoreProvider } from '@/features/orders';
import { OnboardingFlowProvider } from '@/features/shop';

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
        <OrderStoreProvider>{children}</OrderStoreProvider>
      </OnboardingFlowProvider>
    </I18nextProvider>
  );
}
