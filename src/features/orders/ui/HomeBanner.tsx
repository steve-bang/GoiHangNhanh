import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon, useTheme } from '@/shared/ui';

/** Nền xanh chuyển màu cho khối nổi ở Trang chủ (mẫu thiết kế); vẽ bằng SVG, không thêm thư viện. */
export function GradientPanel({
  from,
  to,
  radius,
  children,
}: {
  from: string;
  to: string;
  radius: number;
  children: ReactNode;
}) {
  return (
    <View style={{ borderRadius: radius, overflow: 'hidden' }}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#panel)" />
      </Svg>
      {children}
    </View>
  );
}

const BOX = '#E2A95C';
const BOX_DARK = '#C48A3C';

/** Hộp hàng có khiên tick (trang trí, ẩn khỏi trình đọc màn hình); thay bằng ảnh thật khi có. */
export function ParcelIllustration({ size = 72 }: { size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size }}
    >
      <View style={{ position: 'absolute', left: 0, top: size * 0.12 }}>
        <Icon name="package-solid" size={size * 0.82} color={BOX} />
      </View>
      <View style={{ position: 'absolute', left: size * 0.3, top: size * 0.12 }}>
        <Icon name="package-solid" size={size * 0.42} color={BOX_DARK} />
      </View>
      <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
        <Icon name="brand-shield-check" size={size * 0.5} color={colors.onBrand} />
      </View>
    </View>
  );
}
