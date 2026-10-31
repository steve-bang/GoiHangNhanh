import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEnabledSocialProviders, type SocialProvider } from '@/core/config/feature-flags';
import { LEGAL_LINKS } from '@/core/config/legal-links';
import { ROUTES } from '@/core/navigation';
import { layout } from '@/core/theme';
import { getMinTouchTarget, openExternalLink, useAppNavigation } from '@/platform';
import { AppThemeScope, Button, Icon, Text, useTheme } from '@/shared/ui';

import { signInWithProvider } from '../data/auth-gateway';
import { BrandLogo } from './BrandLogo';
import { SOCIAL_BUTTON_HEIGHT } from './onboarding-layout';
import { computeWelcomeLayout } from './welcome-layout';
import { WelcomeHero } from './WelcomeHero';

function SocialButton({ provider }: { provider: SocialProvider }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
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
          minHeight: Math.max(getMinTouchTarget(), SOCIAL_BUTTON_HEIGHT),
          backgroundColor: tokens.color.surface.raised,
          borderColor: tokens.color.border.default,
          borderRadius: tokens.radius.md,
          gap: tokens.space.sm,
          opacity: pressed ? tokens.opacity.pressed : 1,
        },
      ]}
    >
      <Icon name={provider} size={tokens.icon.md} />
      <Text bold style={{ color: tokens.color.text.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * UI-A02 Chào mừng (docs/09 mục 4, 5.1): một trang, hành động chính là Đăng nhập. Không dùng
 * `Screen` vì màn thương hiệu không có thanh tiêu đề; bọc `AppThemeScope` để `Button`/`Text`/`Icon`
 * dùng bảng Bright Orange như các màn trong app (D-20). Đăng nhập thật chưa có (O-15): nút Đăng nhập
 * và Tạo tài khoản chỉ điều hướng tới màn khung UI-A03; nút Apple/Google gọi cổng xác thực rỗng.
 */
export function WelcomeScreen() {
  return (
    <AppThemeScope>
      <WelcomeContent />
    </AppThemeScope>
  );
}

function WelcomeContent() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const providers = getEnabledSocialProviders();

  const { illustrationHeight, gaps } = computeWelcomeLayout({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const link = (url: string) => () => void openExternalLink(url);
  // Hai đốm nền trang trí, tỉ lệ theo bề rộng cửa sổ (thiết kế gốc 320 và 380 trên màn rộng 390).
  const blobTop = width * 0.82;
  const blobBottom = width * 0.97;
  const { color, space } = tokens;

  return (
    <View testID="screen-UI-A02" style={[styles.root, { backgroundColor: color.surface.screen }]}>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        <View
          style={[
            styles.blob,
            {
              width: blobTop,
              height: blobTop,
              top: -blobTop * 0.53,
              right: -blobTop * 0.41,
              backgroundColor: color.brand.soft,
            },
          ]}
        />
        <View
          style={[
            styles.blob,
            {
              width: blobBottom,
              height: blobBottom,
              bottom: -blobBottom * 0.66,
              left: -blobBottom * 0.42,
              backgroundColor: color.brand.soft,
            },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + gaps.top,
          paddingBottom: Math.max(insets.bottom, space.lg) + space.sm,
          paddingHorizontal: space.xl,
        }}
        showsVerticalScrollIndicator={false}
      >
        <BrandLogo />
        <View style={{ marginTop: gaps.section, gap: space.md }}>
          <Text
            variant="screenTitle"
            accessibilityRole="header"
            style={{ color: color.text.primary }}
            bold
          >
            {t('screens:welcome.title')}
          </Text>
          <Text style={{ color: color.text.secondary }}>{t('screens:welcome.subtitle')}</Text>
        </View>

        <View style={styles.illustrationSlot}>
          {illustrationHeight > 0 ? <WelcomeHero height={illustrationHeight} /> : null}
        </View>

        <View style={{ gap: space.md }}>
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
          <View testID="welcome-social-group" style={{ marginTop: gaps.section, gap: space.lg }}>
            <View style={[styles.dividerRow, { gap: space.md }]}>
              <View style={[styles.line, { backgroundColor: color.border.subtle }]} />
              <Text variant="caption" style={{ color: color.text.secondary }}>
                {t('screens:welcome.orSignInWith')}
              </Text>
              <View style={[styles.line, { backgroundColor: color.border.subtle }]} />
            </View>
            <View style={[styles.socialRow, { gap: space.md }]}>
              {providers.map((provider) => (
                <SocialButton key={provider} provider={provider} />
              ))}
            </View>
          </View>
        ) : null}

        <Text
          variant="caption"
          style={[styles.legal, { color: color.text.secondary, marginTop: gaps.section }]}
        >
          {t('screens:welcome.legalPrefix')}
          <Text
            variant="caption"
            bold
            accessibilityRole="link"
            onPress={link(LEGAL_LINKS.terms)}
            style={{ color: color.action.link }}
          >
            {t('screens:welcome.terms')}
          </Text>
          {t('screens:welcome.legalAnd')}
          <Text
            variant="caption"
            bold
            accessibilityRole="link"
            onPress={link(LEGAL_LINKS.privacy)}
            style={{ color: color.action.link }}
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
  blob: { position: 'absolute', borderRadius: layout.radius.full },
  illustrationSlot: { flexGrow: 1, justifyContent: 'center', paddingVertical: layout.space.md },
  socialRow: { flexDirection: 'row' },
  social: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.borderWidth.thin,
    paddingHorizontal: layout.space.md,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center' },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  legal: { textAlign: 'center' },
});
