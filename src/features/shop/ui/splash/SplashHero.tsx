import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

/**
 * Ảnh minh họa 3D (cô gái, bong bóng, logo sàn). Ảnh GIỮ NGUYÊN, không cắt/xóa/vẽ đè lên logo sàn
 * (layout.md mục 3.1); chỉ cắt biên trong suốt thừa và nén (WebP). Ảnh có logo Shopee/TikTok/Lazada
 * và chữ trong bong bóng nằm sẵn trong ảnh: bản chính thức TẠM, người dùng sẽ thay (decisions.md
 * Q-15). Thay ảnh: ghi đè `assets/images/splash/splash-hero.webp` (cùng tỉ lệ 1024 x 1050) hoặc
 * đổi `HERO_IMAGE` trong splash-layout.ts. Ẩn khỏi trình đọc màn hình.
 *
 * `scale` < 1: ảnh hẹp hơn màn nên hai mép ảnh được làm mờ vào nền để không lộ vết cắt.
 */
const HERO_SOURCE = require('../../../../../assets/images/splash/splash-hero.webp') as number;

interface SplashHeroProps {
  width: number;
  height: number;
  scale: number;
  bottomOffset: number;
  onSettled: () => void;
}

export function SplashHero({ width, height, scale, bottomOffset, onSettled }: SplashHeroProps) {
  const { colors } = useTheme();
  const fade = scale < 1 ? Math.round(width * 0.14) : 0;
  return (
    <View
      testID="splash-hero"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.hero, { width, height, bottom: bottomOffset, marginLeft: -width / 2 }]}
    >
      <Image
        source={HERO_SOURCE}
        accessible={false}
        style={{ width, height }}
        resizeMode="contain"
        onLoad={onSettled}
        onError={onSettled}
      />
      {fade > 0 ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="fadeLeft" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.splashBackground} stopOpacity={1} />
              <Stop offset="1" stopColor={colors.splashBackground} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="fadeRight" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.splashBackground} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.splashBackground} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={fade} height={height} fill="url(#fadeLeft)" />
          <Rect x={width - fade} y={0} width={fade} height={height} fill="url(#fadeRight)" />
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ hero: { position: 'absolute', left: '50%' } });
