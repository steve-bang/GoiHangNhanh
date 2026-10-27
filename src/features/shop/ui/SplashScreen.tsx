import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hideNativeSplash, useAppNavigation } from '@/platform';
import { Text, useTheme } from '@/shared/ui';

import { BrandMarkPlay } from './splash/BrandMarkPlay';
import { SplashBackdrop } from './splash/SplashBackdrop';
import { SplashFeatures } from './splash/SplashFeatures';
import { SplashHero } from './splash/SplashHero';
import { SplashWave } from './splash/SplashWave';
import { computeSplashLayout, FONT_CAPS } from './splash/splash-layout';
import { useSplashLaunch } from './splash/use-splash-launch';
import { useOnboardingFlow } from './onboarding/OnboardingFlow';
import { SPLASH_HERO_MAX_WAIT_MS } from '../domain/launch';

/**
 * UI-A01 Splash (docs/09 mục 4 và 5.7; ảnh thiết kế `docs/assets/ui/06-splash-design.png`): màn tĩnh,
 * không nút, hiện vài giây mỗi lần mở app rồi tự chuyển (Chào mừng / Tạo shop / Tổng quan theo
 * phiên). Chuyển bằng `reset` nên Back không quay lại Splash. Không chặn truy cập (route guard là
 * việc sau). Không có chuyển động nên không cần xử lý "giảm chuyển động".
 *
 * Chữ theo thiết kế đã được người dùng duyệt giữ nguyên (decisions.md Q-15, D-15). Trợ năng: mọi
 * thành phần trang trí ẩn khỏi trình đọc màn hình; chỉ đọc tên app "Đơn Chứng".
 */
export function SplashScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const navigation = useAppNavigation();
  const { gateways } = useOnboardingFlow();

  const layout = computeSplashLayout({
    width,
    height,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    fontScale,
  });
  const { header, hero, wave } = layout;

  // Splash của app "thật sự hiện" khi ảnh minh họa xong (tải được hoặc lỗi), hoặc không cần ảnh, hoặc
  // quá hạn bảo hiểm; lúc đó ẩn splash hệ điều hành và bắt đầu đếm thời gian hiển thị tối thiểu.
  const [visible, setVisible] = useState(false);
  const settled = useRef(false);
  const heroSettled = useCallback(() => {
    if (settled.current) return;
    settled.current = true;
    hideNativeSplash();
    setVisible(true);
  }, []);

  useSplashLaunch({
    session: gateways.session,
    visible,
    onRoute: (route) => navigation.reset(route),
  });

  // Đổi bố cục khi đang chạy (xoay màn, đổi cỡ chữ) không được ẩn splash hệ điều hành: chỉ coi là
  // sẵn sàng khi không cần ảnh.
  useEffect(() => {
    if (!layout.showHero) heroSettled();
  }, [layout.showHero, heroSettled]);
  useEffect(() => {
    const timer = setTimeout(heroSettled, SPLASH_HERO_MAX_WAIT_MS);
    return () => clearTimeout(timer);
  }, [heroSettled]);
  // Gỡ màn: luôn ẩn splash hệ điều hành (an toàn khi gọi nhiều lần).
  useEffect(() => () => hideNativeSplash(), []);

  return (
    <View
      testID="screen-UI-A01"
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('screens:splash.brandName')}
      style={styles.root}
    >
      <SplashBackdrop />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={StyleSheet.absoluteFill}
      >
        {layout.showHero ? (
          <SplashHero
            width={hero.width}
            height={hero.height}
            scale={hero.scale}
            bottomOffset={hero.bottomOffset}
            onSettled={heroSettled}
          />
        ) : null}
        <SplashWave width={width} height={wave.height} />
        {layout.showSlogan ? (
          <View
            testID="splash-slogan"
            style={[styles.slogan, { bottom: 0, height: wave.height - wave.slogan.top }]}
          >
            <View style={styles.sloganTilt}>
              <Text
                maxFontSizeMultiplier={FONT_CAPS.slogan}
                style={[
                  styles.sloganText,
                  {
                    color: colors.onSplashWave,
                    fontSize: wave.slogan.fontSize,
                    lineHeight: wave.slogan.lineHeight,
                  },
                ]}
              >
                {t('screens:splash.slogan')}
              </Text>
              <Svg width={Math.round(width * 0.6)} height={10} viewBox="0 0 250 10">
                <Path
                  d="M0 9 C70 2 170 0 250 0 C170 2.2 70 5 0 9 Z"
                  fill={colors.onSplashWave}
                  fillOpacity={0.85}
                />
              </Svg>
            </View>
          </View>
        ) : null}

        <View style={[styles.header, { paddingTop: insets.top + header.paddingTop }]}>
          <BrandMarkPlay width={header.shield.width} />
          <Text
            testID="splash-wordmark"
            maxFontSizeMultiplier={FONT_CAPS.wordmark}
            style={[
              styles.wordmark,
              {
                marginTop: header.gaps.shieldWordmark,
                color: colors.splashWordmark,
                fontSize: header.wordmark.fontSize,
                lineHeight: header.wordmark.lineHeight,
              },
            ]}
          >
            {t('screens:splash.brandName')}
          </Text>
          {layout.showTagline ? (
            <Text
              testID="splash-tagline"
              maxFontSizeMultiplier={FONT_CAPS.tagline}
              style={[
                styles.tagline,
                {
                  marginTop: header.gaps.wordmarkTagline,
                  color: colors.splashTagline,
                  fontSize: header.tagline.fontSize,
                  lineHeight: header.tagline.lineHeight,
                },
              ]}
            >
              {t('screens:splash.tagline')}
            </Text>
          ) : null}
          {layout.showFeatures ? (
            <View style={{ marginTop: header.gaps.taglineFeatures, alignSelf: 'stretch' }}>
              <SplashFeatures layout={header} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  header: { alignItems: 'center' },
  wordmark: { fontWeight: '800', textAlign: 'center' },
  tagline: { fontWeight: '600', textAlign: 'center' },
  slogan: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sloganTilt: { alignItems: 'center', transform: [{ rotate: '-4deg' }] },
  sloganText: { fontStyle: 'italic', fontWeight: '400', textAlign: 'center' },
});
