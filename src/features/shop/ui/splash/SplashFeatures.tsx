import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text, useTheme } from '@/shared/ui';

import { FEATURE_LABEL_FONT_SIZE, FONT_CAPS, type SplashLayout } from './splash-layout';

type FeatureKey = 'record' | 'cloud' | 'orders' | 'protect';
const FEATURES: readonly FeatureKey[] = ['record', 'cloud', 'orders', 'protect'];

/** Biểu tượng của từng tính năng (khung 24 x 24), vẽ bằng SVG theo ảnh thiết kế. */
function FeatureGlyph({ kind, color, hole }: { kind: FeatureKey; color: string; hole: string }) {
  switch (kind) {
    case 'record':
      return (
        <>
          <Path
            fill={color}
            d="M8.5 5 L9.6 3.4 Q10 3 10.6 3 H13.4 Q14 3 14.4 3.4 L15.5 5 H18 Q20.5 5 20.5 7.5 V16.5 Q20.5 19 18 19 H6 Q3.5 19 3.5 16.5 V7.5 Q3.5 5 6 5 Z"
          />
          <Circle cx={12} cy={11.8} r={3.6} fill={hole} />
          <Circle cx={12} cy={11.8} r={2} fill={color} />
        </>
      );
    case 'orders':
      return (
        <>
          <Path fill={color} fillOpacity={0.78} d="M12 2.8 L20 7 L12 11.2 L4 7 Z" />
          <Path fill={color} d="M4 8.2 L11.2 12.2 V21 L4 17 Z" />
          <Path fill={color} fillOpacity={0.9} d="M20 8.2 L12.8 12.2 V21 L20 17 Z" />
          <Rect x={10.6} y={5.6} width={2.8} height={2.4} rx={0.6} fill={hole} />
        </>
      );
    case 'cloud':
    case 'protect':
      return (
        <>
          <Path
            fill={color}
            d="M12 2.5 L19.5 5 V11 C19.5 15.8 16.2 19.6 12 21.5 C7.8 19.6 4.5 15.8 4.5 11 V5 Z"
          />
          <Path
            d="M8.6 11.8 L11 14.2 L15.6 9.4"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

function FeatureDisc({ kind, size }: { kind: FeatureKey; size: number }) {
  const { colors } = useTheme();
  const glyph = size * 0.5;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={`disc-${kind}`} cx="50%" cy="38%" r="62%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.55" stopColor={colors.splashFeatureDisc} />
            <Stop offset="1" stopColor="#D2EEDF" />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={49} fill={`url(#disc-${kind})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <FeatureGlyph
            kind={kind}
            color={colors.splashFeatureIcon}
            hole={colors.splashFeatureDisc}
          />
        </Svg>
      </View>
    </View>
  );
}

/**
 * Hàng 4 tính năng của Splash (Quay video đóng gói, Lưu trữ đám mây, Quản lý đơn hàng, Bảo vệ
 * quyền lợi): chữ theo thiết kế (người dùng duyệt, decisions.md Q-15). Biểu tượng là trang trí, ẩn
 * khỏi trình đọc màn hình. Nhãn >= 12dp và phóng theo cỡ chữ hệ thống (tới `FONT_CAPS.feature`).
 */
export function SplashFeatures({ layout }: { layout: SplashLayout['header'] }) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { disc, gap, lineHeight } = layout.feature;
  return (
    <View testID="splash-features" style={[styles.row, { paddingHorizontal: spacing.lg }]}>
      {FEATURES.map((key, index) => (
        <View key={key} style={styles.cell}>
          {index > 0 ? (
            <View
              style={[
                styles.divider,
                { height: disc * 1.3, top: disc * 0.1, backgroundColor: colors.splashDivider },
              ]}
            />
          ) : null}
          <FeatureDisc kind={key} size={disc} />
          <Text
            testID={`splash-feature-${key}`}
            maxFontSizeMultiplier={FONT_CAPS.feature}
            style={{
              marginTop: gap,
              fontSize: FEATURE_LABEL_FONT_SIZE,
              lineHeight,
              textAlign: 'center',
              fontWeight: '500',
              color: colors.splashFeatureLabel,
            }}
          >
            {t(`screens:splash.features.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignSelf: 'stretch' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  center: { alignItems: 'center', justifyContent: 'center' },
  divider: { position: 'absolute', left: 0, width: StyleSheet.hairlineWidth * 2 },
});
