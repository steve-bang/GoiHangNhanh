import { StyleSheet, View } from 'react-native';

import { Icon, useTheme } from '@/shared/ui';

/**
 * Hình minh họa của ba màn khôi phục mật khẩu (UI-A07 ổ khóa, UI-A08 điện thoại + mã, UI-A09 ổ khóa
 * có dấu tick), dựng bằng View + biểu tượng sẵn có, tĩnh. Mọi kích thước = giá trị thiết kế x
 * (height / 150): một tham số duy nhất. THAY BẰNG HÌNH THẬT chỉ ở tệp này; màn hình không phải sửa.
 * Ẩn khỏi trình đọc màn hình (chỉ trang trí).
 *
 * Màu theo token thương hiệu (Bright Orange, D-20) để hợp tông với phần còn lại của app: thân khóa và
 * biểu tượng `brand.primary`, quai/viền đậm `brand.pressed`, lá `brand.hover`/`brand.primary`, nền
 * đốm `brand.soft`, chi tiết trắng `text.onAction` (trên nền cam) / `surface.raised` (màn điện thoại).
 */
/** Số chấm trang trí trong bong bóng "mã đã gửi" (thay chữ "***": hình không mang chữ). */
const MASKED_DOTS = 3;
const DESIGN_HEIGHT = 150;
const FRAME_WIDTH = 240;

function Frame({
  height,
  testID,
  children,
}: {
  height: number;
  testID: string;
  children: React.ReactNode;
}) {
  const u = height / DESIGN_HEIGHT;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: FRAME_WIDTH * u, height }]}
    >
      {children}
    </View>
  );
}

/** Bảng màu của hình (đọc qua `tokens`, không viết hex). */
function useIllustrationColors() {
  const { color } = useTheme().tokens;
  return {
    blob: color.brand.soft,
    leafA: color.brand.hover,
    leafB: color.brand.primary,
    body: color.brand.primary,
    dark: color.brand.pressed,
    onBody: color.text.onAction,
    screen: color.surface.raised,
  };
}

function Blob({ u }: { u: number }) {
  const c = useIllustrationColors();
  return (
    <View
      style={{
        position: 'absolute',
        left: 30 * u,
        top: 24 * u,
        width: 180 * u,
        height: 120 * u,
        borderRadius: 90 * u,
        backgroundColor: c.blob,
      }}
    />
  );
}

function Leaves({ u }: { u: number }) {
  const c = useIllustrationColors();
  return (
    <>
      <View style={{ position: 'absolute', left: 28 * u, bottom: 12 * u }}>
        <Icon name="leaf" size={46 * u} color={c.leafA} />
      </View>
      <View style={{ position: 'absolute', right: 26 * u, bottom: 8 * u }}>
        <Icon name="leaf" size={40 * u} color={c.leafB} />
      </View>
    </>
  );
}

/** Ổ khóa: thân màu thương hiệu + quai; `mark` là lỗ khóa hoặc dấu tick. */
function Padlock({ u, mark }: { u: number; mark: 'keyhole' | 'check' }) {
  const c = useIllustrationColors();
  const bodyW = 78 * u;
  const bodyH = 64 * u;
  const shackleW = 50 * u;
  const stroke = 9 * u;
  return (
    <View
      style={{
        position: 'absolute',
        left: (FRAME_WIDTH * u - bodyW) / 2,
        top: 14 * u,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: shackleW,
          height: 46 * u,
          borderWidth: stroke,
          borderBottomWidth: 0,
          borderTopLeftRadius: shackleW / 2,
          borderTopRightRadius: shackleW / 2,
          borderColor: c.dark,
          marginBottom: -4 * u,
        }}
      />
      <View
        style={{
          width: bodyW,
          height: bodyH,
          borderRadius: 14 * u,
          backgroundColor: c.body,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {mark === 'check' ? (
          <Icon name="check" size={40 * u} color={c.onBody} />
        ) : (
          <>
            <View
              style={{
                width: 14 * u,
                height: 14 * u,
                borderRadius: 7 * u,
                backgroundColor: c.onBody,
              }}
            />
            <View
              style={{
                width: 5 * u,
                height: 16 * u,
                backgroundColor: c.onBody,
                marginTop: -2 * u,
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

/** UI-A07: ổ khóa có lỗ khóa, lá hai bên, máy bay giấy (mã sắp được gửi). */
export function LockIllustration({ height }: { height: number }) {
  const c = useIllustrationColors();
  const u = height / DESIGN_HEIGHT;
  return (
    <Frame height={height} testID="forgot-illustration">
      <Blob u={u} />
      <Leaves u={u} />
      <Padlock u={u} mark="keyhole" />
      <View style={{ position: 'absolute', right: 34 * u, top: 40 * u }}>
        <Icon name="send" size={26 * u} color={c.body} />
      </View>
    </Frame>
  );
}

/** UI-A09: ổ khóa có dấu tick và vài tia sáng (mật khẩu mới đã sẵn sàng). */
export function LockCheckIllustration({ height }: { height: number }) {
  const c = useIllustrationColors();
  const u = height / DESIGN_HEIGHT;
  return (
    <Frame height={height} testID="new-password-illustration">
      <Blob u={u} />
      <Leaves u={u} />
      <Padlock u={u} mark="check" />
      <View style={{ position: 'absolute', right: 40 * u, top: 18 * u }}>
        <Icon name="sparkle" size={22 * u} color={c.body} />
      </View>
      <View style={{ position: 'absolute', right: 26 * u, top: 60 * u }}>
        <Icon name="sparkle" size={14 * u} color={c.leafA} />
      </View>
    </Frame>
  );
}

/** UI-A08: điện thoại có khiên + bong bóng ba chấm (mã xác minh được gửi tới). */
export function PhoneCodeIllustration({ height }: { height: number }) {
  const c = useIllustrationColors();
  const u = height / DESIGN_HEIGHT;
  const phoneW = 80 * u;
  return (
    <Frame height={height} testID="otp-illustration">
      <Blob u={u} />
      <View
        style={{
          position: 'absolute',
          left: (FRAME_WIDTH * u - phoneW) / 2 - 8 * u,
          top: 8 * u,
          width: phoneW,
          height: 132 * u,
          borderRadius: 14 * u,
          borderWidth: 4 * u,
          borderColor: c.dark,
          backgroundColor: c.screen,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="brand-shield-check" size={44 * u} color={c.body} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: 40 * u,
          top: 92 * u,
          paddingHorizontal: 12 * u,
          height: 30 * u,
          borderRadius: 10 * u,
          backgroundColor: c.body,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 5 * u,
        }}
      >
        {Array.from({ length: MASKED_DOTS }, (_, i) => (
          <View
            key={i}
            style={{
              width: 7 * u,
              height: 7 * u,
              borderRadius: 3.5 * u,
              backgroundColor: c.onBody,
            }}
          />
        ))}
      </View>
      <View style={{ position: 'absolute', left: 34 * u, top: 44 * u }}>
        <Icon name="sparkle" size={14 * u} color={c.leafA} />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({ frame: { alignSelf: 'center' } });
