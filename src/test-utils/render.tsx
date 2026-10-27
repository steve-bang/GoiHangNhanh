import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initI18n } from '@/core/i18n';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Render kèm i18n tiếng Việt và vùng an toàn (giống iPhone có tai thỏ) cho test giao diện. */
export function renderWithProviders(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <I18nextProvider i18n={initI18n()}>{ui}</I18nextProvider>
    </SafeAreaProvider>,
  );
}
