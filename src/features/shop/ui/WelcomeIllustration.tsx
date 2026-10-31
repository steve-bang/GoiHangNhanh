import { StyleSheet, View } from 'react-native';

import { Icon, useTheme } from '@/shared/ui';

import { getIllustrationGeometry, ILLUSTRATION_MAX_HEIGHT } from './welcome-layout';

interface WelcomeIllustrationProps {
  /** Chiều cao khả dụng; hình tự co theo (màn nhỏ). */
  height: number;
}

/**
 * Hình minh họa giữa màn Chào mừng: nền tròn cam nhạt, lá, hộp hàng và khiên có dấu tick, dựng
 * bằng biểu tượng sẵn có, tô bằng token (tông Bright Orange + trung tính ấm cho hộp). THAY BẰNG HÌNH
 * THẬT chỉ ở tệp này (ví dụ `<Image source=... />` cùng kích thước `height`); màn hình không phải
 * sửa. Bị ẩn khỏi trình đọc màn hình (chỉ trang trí).
 */
export function WelcomeIllustration({ height }: WelcomeIllustrationProps) {
  const { tokens } = useTheme();
  const { brand, border, text } = tokens.color;
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
          borderRadius: tokens.radius.full,
          backgroundColor: brand.soft,
        }}
      />
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color={brand.hover} />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color={brand.softStrong} />
      </View>
      <View style={{ position: 'absolute', left: g.boxLarge.left, bottom: g.boxLarge.bottom }}>
        <Icon name="package-solid" size={g.boxLarge.size} color={border.field} />
      </View>
      <View style={{ position: 'absolute', left: g.boxSmall.left, bottom: g.boxSmall.bottom }}>
        <Icon name="package-solid" size={g.boxSmall.size} color={border.strong} />
      </View>
      <View style={{ position: 'absolute', right: g.shield.right, top: g.shield.top }}>
        <Icon name="brand-shield" size={g.shield.size} color={brand.primary} />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Icon name="check" size={g.shield.checkSize} color={text.onAction} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
