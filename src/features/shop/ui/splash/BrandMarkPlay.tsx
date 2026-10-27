import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/shared/ui';

/**
 * Logo khiên có mũi tên play của màn Splash (UI-A01), vẽ lại bằng SVG theo ảnh thiết kế
 * `docs/assets/ui/06-splash-design.png`: nửa trái sáng, nửa phải tối (nếp gấp), mũi tên play trắng
 * bo tròn. Bản TẠM: khi có tệp logo chuẩn, thay NỘI DUNG của thành phần này (hoặc cả tệp); nguồn
 * SVG tương ứng ở `docs/assets/brand/splash/brand-mark-play.svg` (sửa hai nơi cùng lúc). Các màn khác
 * vẫn dùng `BrandMark` cũ; đồng bộ logo toàn app là việc sau (decisions.md Q-15).
 *
 * Trang trí: ẩn khỏi trình đọc màn hình (tên app do màn hình gắn nhãn).
 */
const VIEW_BOX = { width: 140, height: 156 } as const;

export function BrandMarkPlay({ width }: { width: number }) {
  const { colors } = useTheme();
  const height = (width * VIEW_BOX.height) / VIEW_BOX.width;
  return (
    <Svg
      testID="splash-logo"
      width={width}
      height={height}
      viewBox={`0 0 ${VIEW_BOX.width} ${VIEW_BOX.height}`}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <LinearGradient id="markLeft" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#047356" />
          <Stop offset="1" stopColor={colors.splashLogo} />
        </LinearGradient>
        <LinearGradient id="markGlint" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path
        fill="url(#markLeft)"
        d="M70 0 L4 22 Q0 24 0 28 L0 88 C0 128 35 146 68 155 Q70 156 70 155.5 Z"
      />
      <Path
        fill={colors.splashLogoDark}
        d="M70 0 L136 22 Q140 24 140 28 L140 88 C140 128 105 146 72 155 Q70 156 70 155.5 Z"
      />
      <Path fill="url(#markGlint)" d="M52.7 47.7 L101 74.3 L52.7 101 Z" />
      <Path
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={16}
        strokeLinejoin="round"
        d="M52.7 47.7 L101 74.3 L52.7 101 Z"
      />
    </Svg>
  );
}
