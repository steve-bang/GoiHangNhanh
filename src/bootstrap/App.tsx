import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { initI18n } from '@/core/i18n';
import { colors, spacing, typography } from '@/core/theme';

const i18n = initI18n();

function Placeholder() {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('app.name')}</Text>
      <Text style={styles.body}>{t('app.placeholder')}</Text>
      <StatusBar style="dark" />
    </View>
  );
}

/** Composition root. Điều hướng, provider Firebase, v.v. được thêm cùng tính năng đầu tiên. */
export function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Placeholder />
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: { ...typography.screenTitle, color: colors.brand },
  body: { ...typography.body, color: colors.text, marginTop: spacing.md, textAlign: 'center' },
});
