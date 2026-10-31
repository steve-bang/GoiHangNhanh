import { Image, StyleSheet, View } from 'react-native';

import { ILLUSTRATION_MAX_HEIGHT } from './welcome-layout';

/**
 * Ảnh minh họa 3D của màn Chào mừng (hộp hàng, điện thoại đang quay, mã vạch, khiên xác nhận, biểu
 * tượng Shopee/TikTok/Lazada). Ảnh GIỮ NGUYÊN, chỉ cắt biên trong suốt và nén WebP; logo sàn nằm sẵn
 * trong ảnh nên không vẽ đè hay chỉnh sửa. Thay ảnh: ghi đè `assets/images/welcome/welcome-hero.webp`
 * (cùng tỉ lệ) hoặc đổi `WELCOME_HERO_IMAGE`. Bản gốc: `docs/assets/brand/welcome/`.
 * Ẩn khỏi trình đọc màn hình (chỉ trang trí).
 */
const SOURCE = require('../../../../assets/images/welcome/welcome-hero.webp') as number;

/** Kích thước điểm ảnh của tệp (rộng x cao); chỉ dùng để giữ tỉ lệ khi co theo chiều cao khả dụng. */
// token-exception: kích thước điểm ảnh của tệp ảnh, không phải giá trị thiết kế
export const WELCOME_HERO_IMAGE = { width: 800, height: 1010 } as const;

interface WelcomeHeroProps {
  /** Chiều cao khả dụng; ảnh tự co theo (màn nhỏ), không vượt `ILLUSTRATION_MAX_HEIGHT`. */
  height: number;
}

export function WelcomeHero({ height }: WelcomeHeroProps) {
  const h = Math.min(height, ILLUSTRATION_MAX_HEIGHT);
  const w = (h * WELCOME_HERO_IMAGE.width) / WELCOME_HERO_IMAGE.height;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.frame}
      testID="welcome-illustration"
    >
      <Image
        source={SOURCE}
        accessible={false}
        testID="welcome-hero-image"
        style={{ width: w, height: h }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({ frame: { alignSelf: 'center' } });
