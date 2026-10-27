import { StyleSheet, View } from 'react-native';

import { Icon, useTheme } from '@/shared/ui';

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
  const size = Math.min(height, 260);
  const u = size / 260; // đơn vị theo tỉ lệ thiết kế 260
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { height: size }]}
      testID="welcome-illustration"
    >
      <View
        style={{
          position: 'absolute',
          width: 230 * u,
          height: 230 * u,
          borderRadius: 115 * u,
          backgroundColor: colors.welcomeBlob,
        }}
      />
      <View style={{ position: 'absolute', left: 36 * u, bottom: 30 * u }}>
        <Icon name="leaf" size={64 * u} color="#7CC08F" />
      </View>
      <View style={{ position: 'absolute', right: 30 * u, bottom: 18 * u }}>
        <Icon name="leaf" size={52 * u} color="#9BD0AA" />
      </View>
      <View style={{ position: 'absolute', left: 58 * u, bottom: 22 * u }}>
        <Icon name="package-solid" size={92 * u} color={BOX} />
      </View>
      <View style={{ position: 'absolute', left: 120 * u, bottom: 12 * u }}>
        <Icon name="package-solid" size={70 * u} color={BOX_DARK} />
      </View>
      <View style={{ position: 'absolute', right: 52 * u, top: 18 * u }}>
        <Icon name="brand-shield" size={128 * u} color={colors.brand} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="check" size={64 * u} color={colors.onBrand} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
