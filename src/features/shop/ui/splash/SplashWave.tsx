import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

import { WAVE_VIEWBOX } from './splash-layout';

/**
 * Sóng thương hiệu đậm ở đáy màn (cùng dải sáng phía trên) như thiết kế. Thân sóng chuyển từ
 * `action.primary` xuống `brand.deep`: chữ trắng (câu viết tay) đạt >= 4.5:1 trên mọi điểm.
 * Dải sáng: `brand.softStrong`. Phần đường cong dùng khung
 * 1024 x 130 co theo chiều rộng màn; phần thân kéo dài tới hết `height`. Trang trí.
 * Thay hình sóng: sửa hai đường dẫn bên dưới (toạ độ trong khung 1024 x 130).
 */
export function SplashWave({ width, height }: { width: number; height: number }) {
  const { color } = useTheme().tokens;
  const k = width / WAVE_VIEWBOX.width;
  const h = height / k; // chiều cao tính theo đơn vị khung
  const bottom = `L${WAVE_VIEWBOX.width} ${h} L0 ${h} Z`;
  return (
    <View
      testID="splash-wave"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.wave, { width, height }]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${WAVE_VIEWBOX.width} ${h}`}>
        <Defs>
          <LinearGradient id="waveDeep" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.action.primary} />
            <Stop offset="1" stopColor={color.brand.deep} />
          </LinearGradient>
          <LinearGradient id="waveLight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.brand.softStrong} stopOpacity={0.55} />
            <Stop offset="1" stopColor={color.brand.softStrong} stopOpacity={0.95} />
          </LinearGradient>
        </Defs>
        <Path
          fill="url(#waveLight)"
          d={`M0 5 C90 50 170 112 260 120 L640 110 C800 95 930 40 1024 0 ${bottom}`}
        />
        <Path
          fill="url(#waveDeep)"
          d={`M0 43 C80 85 170 120 280 118 C380 114 430 92 520 92 C700 92 880 70 1024 33 ${bottom}`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({ wave: { position: 'absolute', left: 0, bottom: 0 } });
