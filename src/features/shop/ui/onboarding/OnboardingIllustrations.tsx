import { StyleSheet, View } from 'react-native';

import { Icon, useTheme, type Theme } from '@/shared/ui';

import { getSetupDoneGeometry, getShieldClipboardGeometry } from '../onboarding-layout';

/**
 * Hình minh họa của ba màn thiết lập, dựng bằng View + biểu tượng sẵn có (tĩnh, không thư viện
 * animation). THAY BẰNG HÌNH THẬT chỉ ở tệp này (ví dụ `<Image />` cùng kích thước `height`); màn
 * hình không phải sửa. Bị ẩn khỏi trình đọc màn hình (chỉ trang trí). Màu lấy từ token (tông Bright
 * Orange, trung tính ấm cho hộp/bảng ghi, điểm nhấn xanh dương cho pháo giấy), không viết mã màu.
 */

type ThemeColor = Theme['tokens']['color'];

/** Bảng màu minh họa suy từ token (không phải màu trạng thái). */
function illustrationPalette(color: ThemeColor) {
  return {
    ground: color.brand.soft,
    box: color.illustration.carton,
    boxDark: color.illustration.cartonShade,
    leafA: color.brand.hover,
    leafB: color.brand.softStrong,
    paper: color.surface.raised,
    paperLine: color.border.field,
    confetti: [color.brand.primary, color.brand.softStrong, color.accent.blue.fg] as const,
  };
}

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
  const { tokens } = useTheme();
  const p = illustrationPalette(tokens.color);
  const lineHeight = Math.max(tokens.borderWidth.emphasis, height * 0.04);
  return (
    <View
      style={{
        width,
        height,
        borderRadius: width * 0.12,
        backgroundColor: p.paper,
        borderWidth: Math.max(tokens.borderWidth.emphasis, width * 0.04),
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
            backgroundColor: p.paperLine,
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
  const { tokens } = useTheme();
  return (
    <View>
      <Icon name="brand-shield" size={size} color={tokens.color.brand.primary} />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Icon name="check" size={checkSize} color={tokens.color.text.onAction} />
      </View>
    </View>
  );
}

/** Khiên + bảng ghi + lá ở đáy màn đăng ký (UI-A03). `height` là chiều cao khung. */
export function ShieldClipboardIllustration({ height }: { height: number }) {
  const { tokens } = useTheme();
  const p = illustrationPalette(tokens.color);
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
          borderRadius: tokens.radius.full,
          backgroundColor: p.ground,
        }}
      />
      <View style={{ position: 'absolute', left: g.clipboard.left, top: g.clipboard.top }}>
        <Clipboard
          width={g.clipboard.width}
          height={g.clipboard.height}
          rotate={5}
          frame={tokens.color.brand.hover}
        />
      </View>
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color={p.leafA} />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color={p.leafB} />
      </View>
      <View style={{ position: 'absolute', left: g.shield.left, top: g.shield.top }}>
        <Shield size={g.shield.size} checkSize={g.shield.checkSize} />
      </View>
    </View>
  );
}

/** Hình lớn ở màn hoàn tất (UI-A06): khiên, hộp hàng, bảng ghi, lá, pháo giấy tĩnh. */
export function SetupDoneIllustration({ height }: { height: number }) {
  const { tokens } = useTheme();
  const p = illustrationPalette(tokens.color);
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
          borderRadius: tokens.radius.full,
          backgroundColor: p.ground,
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
            backgroundColor: p.confetti[piece.tone],
            transform: [{ rotate: `${piece.rotate}deg` }],
          }}
        />
      ))}
      <View style={{ position: 'absolute', left: g.clipboard.left, top: g.clipboard.top }}>
        <Clipboard
          width={g.clipboard.width}
          height={g.clipboard.height}
          rotate={8}
          frame={tokens.color.brand.pressed}
        />
      </View>
      <View style={{ position: 'absolute', left: g.leafLeft.left, bottom: g.leafLeft.bottom }}>
        <Icon name="leaf" size={g.leafLeft.size} color={p.leafA} />
      </View>
      <View style={{ position: 'absolute', right: g.leafRight.right, bottom: g.leafRight.bottom }}>
        <Icon name="leaf" size={g.leafRight.size} color={p.leafB} />
      </View>
      <View style={{ position: 'absolute', left: g.shield.left, top: g.shield.top }}>
        <Shield size={g.shield.size} checkSize={g.shield.checkSize} />
      </View>
      <View style={{ position: 'absolute', left: g.boxLarge.left, bottom: g.boxLarge.bottom }}>
        <Icon name="package-solid" size={g.boxLarge.size} color={p.box} />
      </View>
      <View style={{ position: 'absolute', left: g.boxSmall.left, bottom: g.boxSmall.bottom }}>
        <Icon name="package-solid" size={g.boxSmall.size} color={p.boxDark} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { alignSelf: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
});
