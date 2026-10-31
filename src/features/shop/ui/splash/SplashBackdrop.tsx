import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

/**
 * Nền Splash: nền màn (`surface.screen`) với vài hình loang cam rất nhạt (`brand.soft`) (sương, đồi) như thiết kế. Vẽ bằng SVG co giãn
 * theo màn (`preserveAspectRatio="none"`: hình loang mềm nên méo nhẹ không đáng kể). Trang trí.
 */
export function SplashBackdrop() {
  const { color } = useTheme().tokens;
  return (
    <View
      testID="splash-backdrop"
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: color.surface.screen }]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="mist">
            <Stop offset="0" stopColor={color.brand.soft} stopOpacity={1} />
            <Stop offset="1" stopColor={color.brand.soft} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={8} cy={14} rx={60} ry={22} fill="url(#mist)" />
        <Ellipse cx={95} cy={32} rx={45} ry={18} fill="url(#mist)" />
        <Ellipse cx={50} cy={58} rx={70} ry={16} fill="url(#mist)" />
        <Path
          d="M0 49 C 18 41 34 40 52 47 C 72 54 88 46 100 38 L100 100 L0 100 Z"
          fill={color.brand.soft}
          fillOpacity={0.55}
        />
      </Svg>
    </View>
  );
}
