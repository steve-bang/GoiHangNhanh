import { StyleSheet, View } from 'react-native';

import { Icon, useTheme } from '@/shared/ui';

import { getIllustrationGeometry, ILLUSTRATION_MAX_HEIGHT } from './welcome-layout';

interface WelcomeIllustrationProps {
  /** Chiều cao khả dụng; hình tự co theo (màn nhỏ). */
  height: number;
}

const BOX = '#C99A5B';
const BOX_DARK = '#A97A3F';

/**
 * Hình minh họa giữa màn Chào mừng: nền tròn xanh nhạt, lá, hộp hàng và khiên có dấu tick, dựng
 * bằng biểu tượng sẵn có. THAY BẰNG HÌNH THẬT chỉ ở tệp này (ví dụ `<Image source=... />` cùng
 * kích thước `height`); màn hình không phải sửa. Bị ẩn khỏi trình đọc màn hình (chỉ trang trí).
 */
export function WelcomeIllustration({ height }: WelcomeIllustrationProps) {
  const { colors } = useTheme();
  const g = getIllustrationGeometry(Math.min(height, ILLUSTRATION_MAX_HEIGHT));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: g.frame.width, height: g.frame.height }]}
      testID="welcome-illustration"
    >
      <View
        style={{
          position: 'absolute',
          left: (g.frame.width - g.blob.diameter) / 2,
          top: (g.frame.height - g.blob.diameter) / 2,
          width: g.blob.diameter,
          height: g.blob.diameter,
          borderRadius: g.blob.diameter / 2,
          backgroundColor: colors.welcomeBlob,
        }}
      />
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color="#7CC08F" />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color="#9BD0AA" />
      </View>
      <View style={{ position: 'absolute', left: g.boxLarge.left, bottom: g.boxLarge.bottom }}>
        <Icon name="package-solid" size={g.boxLarge.size} color={BOX} />
      </View>
      <View style={{ position: 'absolute', left: g.boxSmall.left, bottom: g.boxSmall.bottom }}>
        <Icon name="package-solid" size={g.boxSmall.size} color={BOX_DARK} />
      </View>
      <View style={{ position: 'absolute', right: g.shield.right, top: g.shield.top }}>
        <Icon name="brand-shield" size={g.shield.size} color={colors.brand} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="check" size={g.shield.checkSize} color={colors.onBrand} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
