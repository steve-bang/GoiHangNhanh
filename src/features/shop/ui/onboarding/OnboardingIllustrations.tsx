import { StyleSheet, View } from 'react-native';

import { Icon, useTheme } from '@/shared/ui';

import { getSetupDoneGeometry, getShieldClipboardGeometry } from '../onboarding-layout';

/**
 * Hình minh họa của ba màn thiết lập, dựng bằng View + biểu tượng sẵn có (tĩnh, không thư viện
 * animation). THAY BẰNG HÌNH THẬT chỉ ở tệp này (ví dụ `<Image />` cùng kích thước `height`); màn
 * hình không phải sửa. Bị ẩn khỏi trình đọc màn hình (chỉ trang trí).
 */

const BOX = '#D9A566';
const BOX_DARK = '#C48A47';
const LEAF_A = '#5DAF7B';
const LEAF_B = '#8CCBA3';
const CONFETTI = ['#4FAE7A', '#F1D98B', '#2E9A6B'] as const;

function Clipboard({
  width,
  height,
  rotate,
  frame,
}: {
  width: number;
  height: number;
  rotate: number;
  frame: string;
}) {
  const lineHeight = Math.max(2, height * 0.04);
  return (
    <View
      style={{
        width,
        height,
        borderRadius: width * 0.12,
        backgroundColor: '#FFFFFF',
        borderWidth: Math.max(2, width * 0.04),
        borderColor: frame,
        transform: [{ rotate: `${rotate}deg` }],
        paddingTop: height * 0.2,
        paddingHorizontal: width * 0.16,
        gap: height * 0.075,
      }}
    >
      {[1, 0.8, 0.9, 0.7, 0.85].map((fraction, index) => (
        <View
          key={index}
          style={{
            width: `${fraction * 100}%`,
            height: lineHeight,
            borderRadius: lineHeight / 2,
            backgroundColor: '#C9D8D2',
          }}
        />
      ))}
      <View
        style={{
          position: 'absolute',
          top: -height * 0.07,
          alignSelf: 'center',
          width: width * 0.42,
          height: height * 0.12,
          borderRadius: height * 0.04,
          backgroundColor: frame,
        }}
      />
    </View>
  );
}

function Shield({ size, checkSize }: { size: number; checkSize: number }) {
  const { colors } = useTheme();
  return (
    <View>
      <Icon name="brand-shield" size={size} color={colors.brand} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Icon name="check" size={checkSize} color={colors.onBrand} />
      </View>
    </View>
  );
}

/** Khiên + bảng ghi + lá ở đáy màn đăng ký (UI-A03). `height` là chiều cao khung. */
export function ShieldClipboardIllustration({ height }: { height: number }) {
  const { colors } = useTheme();
  const g = getShieldClipboardGeometry(height);
  return (
    <View
      testID="signup-illustration"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: g.frame.width, height: g.frame.height }]}
    >
      <View
        style={{
          position: 'absolute',
          left: (g.frame.width - g.ground.width) / 2,
          bottom: g.ground.bottom,
          width: g.ground.width,
          height: g.ground.height,
          borderRadius: g.ground.height,
          backgroundColor: colors.welcomeBlob,
        }}
      />
      <View style={{ position: 'absolute', left: g.clipboard.left, top: g.clipboard.top }}>
        <Clipboard
          width={g.clipboard.width}
          height={g.clipboard.height}
          rotate={5}
          frame="#7FC49A"
        />
      </View>
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color={LEAF_A} />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color={LEAF_B} />
      </View>
      <View style={{ position: 'absolute', left: g.shield.left, top: g.shield.top }}>
        <Shield size={g.shield.size} checkSize={g.shield.checkSize} />
      </View>
    </View>
  );
}

/** Hình lớn ở màn hoàn tất (UI-A06): khiên, hộp hàng, bảng ghi, lá, pháo giấy tĩnh. */
export function SetupDoneIllustration({ height }: { height: number }) {
  const { colors } = useTheme();
  const g = getSetupDoneGeometry(height);
  return (
    <View
      testID="setup-illustration"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: g.frame.width, height: g.frame.height }]}
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
      {g.confetti.map((piece, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: piece.left,
            top: piece.top,
            width: piece.width,
            height: piece.height,
            borderRadius: Math.min(piece.width, piece.height) / 2,
            backgroundColor: CONFETTI[piece.tone],
            transform: [{ rotate: `${piece.rotate}deg` }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', left: g.clipboard.left, top: g.clipboard.top }}>
        <Clipboard
          width={g.clipboard.width}
          height={g.clipboard.height}
          rotate={8}
          frame="#2F8F66"
        />
      </View>
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color={LEAF_A} />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color={LEAF_B} />
      </View>
      <View style={{ position: 'absolute', left: g.shield.left, top: g.shield.top }}>
        <Shield size={g.shield.size} checkSize={g.shield.checkSize} />
      </View>
      <View style={{ position: 'absolute', left: g.boxLarge.left, bottom: g.boxLarge.bottom }}>
        <Icon name="package-solid" size={g.boxLarge.size} color={BOX} />
      </View>
      <View style={{ position: 'absolute', left: g.boxSmall.left, bottom: g.boxSmall.bottom }}>
        <Icon name="package-solid" size={g.boxSmall.size} color={BOX_DARK} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
