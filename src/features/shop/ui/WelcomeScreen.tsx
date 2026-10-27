import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEnabledSocialProviders, type SocialProvider } from '@/core/config/feature-flags';
import { LEGAL_LINKS } from '@/core/config/legal-links';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, openExternalLink, useAppNavigation } from '@/platform';
import { Button, Icon, Text, useTheme } from '@/shared/ui';

import { signInWithProvider } from '../data/auth-gateway';
import { BrandLogo } from './BrandLogo';
import { computeWelcomeLayout } from './welcome-layout';
import { WelcomeIllustration } from './WelcomeIllustration';

function SocialButton({ provider }: { provider: SocialProvider }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const label = t(`screens:welcome.${provider}`);
  return (
    <Pressable
      testID={`welcome-social-${provider}`}
      accessibilityRole="button"
      accessibilityLabel={t(
        provider === 'apple'
          ? 'screens:welcome.signInWithApple'
          : 'screens:welcome.signInWithGoogle',
      )}
      // Chưa có luồng đăng nhập thật (O-15): lỗi "chưa kết nối" được bỏ qua, màn này không báo gì.
      onPress={() => void signInWithProvider(provider).catch(() => undefined)}
      style={({ pressed }) => [
        styles.social,
        {
          minHeight: Math.max(getMinTouchTarget(), 48),
          backgroundColor: colors.surface,
          borderColor: colors.borderSubtle,
          borderRadius: radius.md,
          gap: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Icon name={provider} size={20} />
      <Text bold style={styles.socialLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * UI-A02 Chào mừng (docs/09 mục 4, 5.1): một trang, hành động chính là Đăng nhập. Không dùng
 * `Screen` vì màn thương hiệu không có thanh tiêu đề. Đăng nhập thật chưa có (O-15): nút Đăng nhập
 * và Tạo tài khoản chỉ điều hướng tới màn khung UI-A03; nút Apple/Google gọi cổng xác thực rỗng.
 */
export function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const providers = getEnabledSocialProviders();

  const layout = computeWelcomeLayout({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const { illustrationHeight, gaps, title } = layout;
  const link = (url: string) => () => void openExternalLink(url);

  return (
    <View
      testID="screen-UI-A02"
      style={[styles.root, { backgroundColor: colors.welcomeBackground }]}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View style={[styles.blob, styles.blobTop, { backgroundColor: colors.welcomeBlob }]} />
        <View style={[styles.blob, styles.blobBottom, { backgroundColor: colors.welcomeBlob }]} />
      </View>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + gaps.top,
          paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.sm,
          paddingHorizontal: spacing.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo />
        <View style={{ marginTop: gaps.section, gap: spacing.md }}>
          <Text accessibilityRole="header" style={[title, { color: colors.brandDark }]} bold>
            {t('screens:welcome.title')}
          </Text>
          <Text color="textMuted">{t('screens:welcome.subtitle')}</Text>
        </View>

        <View style={styles.illustrationSlot}>
          {illustrationHeight > 0 ? <WelcomeIllustration height={illustrationHeight} /> : null}
        </View>

        <View style={{ gap: spacing.md }}>
          <Button
            label={t('screens:welcome.signIn')}
            onPress={() => navigation.push(ROUTES.signIn)}
            testID="welcome-sign-in"
          />
          <Button
            variant="secondary"
            label={t('screens:welcome.createAccount')}
            onPress={() => navigation.push(ROUTES.signUp)}
            testID="welcome-create-account"
          />
        </View>

        {providers.length > 0 ? (
          <View testID="welcome-social-group" style={{ marginTop: gaps.section, gap: spacing.lg }}>
            <View style={[styles.dividerRow, { gap: spacing.md }]}>
              <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />
              <Text variant="caption" color="textMuted">
                {t('screens:welcome.orSignInWith')}
              </Text>
              <View style={[styles.line, { backgroundColor: colors.borderSubtle }]} />
            </View>
            <View style={[styles.socialRow, { gap: spacing.md }]}>
              {providers.map((provider) => (
                <SocialButton key={provider} provider={provider} />
              ))}
            </View>
          </View>
        ) : null}

        <Text
          variant="caption"
          color="textMuted"
          style={[styles.legal, { marginTop: gaps.section }]}
        >
          {t('screens:welcome.legalPrefix')}
          <Text
            variant="caption"
            accessibilityRole="link"
            onPress={link(LEGAL_LINKS.terms)}
            style={[styles.legalLink, { color: colors.brand }]}
          >
            {t('screens:welcome.terms')}
          </Text>
          {t('screens:welcome.legalAnd')}
          <Text
            variant="caption"
            accessibilityRole="link"
            onPress={link(LEGAL_LINKS.privacy)}
            style={[styles.legalLink, { color: colors.brand }]}
          >
            {t('screens:welcome.privacy')}
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999 },
  blobTop: { width: 320, height: 320, top: -170, right: -130 },
  blobBottom: { width: 380, height: 380, bottom: -250, left: -160 },
  illustrationSlot: { flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
  socialRow: { flexDirection: 'row' },
  social: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  socialLabel: { fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  legal: { textAlign: 'center' },
  legalLink: { fontWeight: '700' },
});
