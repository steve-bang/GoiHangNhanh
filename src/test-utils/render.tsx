import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initI18n } from '@/core/i18n';
import { OnboardingFlowProvider, type Gateways } from '@/features/shop';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/**
 * Render kèm i18n tiếng Việt, vùng an toàn (giống iPhone có tai thỏ) và trạng thái luồng thiết lập
 * (cổng giả khi test; truyền `gateways` để dùng bản giả riêng của bài test).
 */
export function renderWithProviders(ui: ReactElement, options: { gateways?: Gateways } = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <I18nextProvider i18n={initI18n()}>
        <OnboardingFlowProvider {...(options.gateways ? { gateways: options.gateways } : {})}>
          {ui}
        </OnboardingFlowProvider>
      </I18nextProvider>
    </SafeAreaProvider>,
  );
}
