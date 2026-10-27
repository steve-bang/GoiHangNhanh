import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { OrderSource } from '@/core/orders/order-source';

import { palette } from '@/core/theme';

import { Icon, type IconName } from './Icon';

/** Kích thước mặc định (khớp ô nguồn bán ở màn Tạo hồ sơ shop). */
const DEFAULT_SIZE = 36;

/**
 * Logo thật (tệp trong `assets/images/sources`, nguồn gốc ở `docs/assets/brand/sources`). Không chỉnh sửa
 * logo; xem quy tắc dùng ở docs/engineering/layout.md.
 */
const LOGOS: Partial<Record<OrderSource, ImageSourcePropType>> = {
  shopee: require('../../../assets/images/sources/shopee.png') as ImageSourcePropType,
  tiktok_shop: require('../../../assets/images/sources/tiktok-shop.png') as ImageSourcePropType,
};

/** Nguồn chưa có logo: ô màu + ký hiệu trung tính (Lazada chờ logo; Khác = cửa hàng). */
// token-exception: màu trung tính của ô "nguồn khác", danh tính riêng của nhóm nguồn bán
const OTHER_TILE = { icon: 'store', tint: '#8FA3B8' } as const satisfies {
  icon: IconName;
  tint: string;
};
const FALLBACK_TILES: Partial<Record<OrderSource, { icon: IconName; tint: string }>> = {
  // token-exception: màu thương hiệu Lazada (danh tính bên thứ ba, không thuộc palette app)
  lazada: { icon: 'heart', tint: '#4B3FD8' },
  other: OTHER_TILE,
};

interface SourceIconProps {
  source: OrderSource;
  size?: number;
}

/**
 * Biểu tượng nguồn bán. Trang trí: luôn có nhãn chữ đi kèm nên ẩn khỏi trình đọc màn hình. Logo nằm
 * trong ô vuông bo góc nền trắng, viền mảnh để logo nền trắng và logo nền trong suốt trông đồng bộ.
 */
export function SourceIcon({ source, size = DEFAULT_SIZE }: SourceIconProps) {
  const radius = Math.round(size * 0.28);
  const logo = LOGOS[source];
  const hidden = {
    accessibilityElementsHidden: true,
    importantForAccessibility: 'no-hide-descendants',
  } as const;

  if (logo) {
    const padding = Math.max(2, Math.round(size * 0.1));
    return (
      <View
        testID={`source-icon-${source}`}
        {...hidden}
        style={[
          styles.box,
          styles.logoBox,
          { width: size, height: size, borderRadius: radius, padding },
        ]}
      >
        <Image
          testID={`source-icon-image-${source}`}
          source={logo}
          resizeMode="contain"
          style={styles.image}
        />
      </View>
    );
  }

  const tile = FALLBACK_TILES[source] ?? OTHER_TILE;
  return (
    <View
      testID={`source-icon-${source}`}
      {...hidden}
      style={[
        styles.box,
        { width: size, height: size, borderRadius: radius, backgroundColor: tile.tint },
      ]}
    >
      <Icon name={tile.icon} size={Math.round(size * 0.55)} color={palette.neutral[0]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  logoBox: {
    backgroundColor: palette.neutral[0],
    borderWidth: StyleSheet.hairlineWidth,
    // token-exception: viền mảnh quanh logo sàn, tông riêng không thuộc palette app
    borderColor: '#D5DDD9',
  },
  image: { width: '100%', height: '100%' },
});
