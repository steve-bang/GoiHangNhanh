import { useEffect, useReducer, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { SocialProvider } from '@/core/config/feature-flags';
import { layout } from '@/core/theme';
import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { Icon, Text, useTheme, type IconName } from '@/shared/ui';

import { OTP_LENGTH, remainingSeconds } from '../../domain/otp';
import { TIP_BODY_VARIANT, TIP_CARD_PADDING, RULES_CARD_PADDING } from '../auth-layout';
import { useScrollIntoView } from './OnboardingScaffold';
import type { TextInputHandle } from './OnboardingParts';

/** Nút hiện/ẩn mật khẩu nằm trong ô nhập (nhãn truy cập đổi theo trạng thái). */
export function PasswordToggle({
  shown,
  onToggle,
  testID,
  showLabel,
  hideLabel,
}: {
  shown: boolean;
  onToggle: () => void;
  testID: string;
  showLabel: string;
  hideLabel: string;
}) {
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={shown ? hideLabel : showLabel}
      onPress={onToggle}
      hitSlop={6}
      style={[styles.eye, { minWidth: touch, minHeight: touch }]}
    >
      <Icon
        name={shown ? 'eye-off' : 'eye'}
        size={tokens.icon.lg}
        color={tokens.color.text.subtle}
      />
    </Pressable>
  );
}

/** Thẻ "Mẹo" nền cam nhạt: biểu tượng, tiêu đề, nội dung và trái tim nhỏ góc dưới (theo thiết kế). */
export function TipCard({
  icon,
  title,
  body,
  testID,
}: {
  icon: IconName;
  title: string;
  body: string;
  testID: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.tip,
        {
          backgroundColor: tokens.color.brand.soft,
          borderRadius: tokens.radius.lg,
          padding: TIP_CARD_PADDING,
          gap: tokens.space.md,
        },
      ]}
    >
      <View style={styles.tipIcon}>
        <Icon name={icon} size={tokens.icon.lg} color={tokens.color.brand.primary} />
      </View>
      <View style={styles.tipText}>
        <Text bold style={{ color: tokens.color.brand.onSoft }}>
          {title}
        </Text>
        <Text variant={TIP_BODY_VARIANT} style={{ color: tokens.color.text.subtle }}>
          {body}
        </Text>
      </View>
      <View style={styles.tipHeart}>
        <Icon name="heart" size={tokens.icon.sm} color={tokens.color.brand.primary} />
      </View>
    </View>
  );
}

/**
 * Khối "Mật khẩu nên có": một dòng "Ít nhất 8 ký tự", tích màu thành công khi đạt (theo thời gian
 * thực); chưa đạt thì tích viền xám. Màu không là tín hiệu duy nhất: chữ đổi đậm/nhạt và có nhãn truy cập.
 */
export function RequirementCard({
  title,
  label,
  met,
  accessibilityLabel,
  testID,
}: {
  title: string;
  label: string;
  accessibilityLabel: string;
  met: boolean;
  testID: string;
}) {
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.rules,
        {
          backgroundColor: tokens.color.brand.soft,
          borderRadius: tokens.radius.md,
          padding: RULES_CARD_PADDING,
        },
      ]}
    >
      <Text variant="caption" style={{ color: tokens.color.text.subtle }}>
        {title}
      </Text>
      <View style={styles.ruleRow}>
        <Icon
          name="check-circle"
          size={tokens.icon.md}
          color={met ? tokens.color.feedback.success.fg : tokens.color.border.strong}
        />
        <Text
          testID={`${testID}-length-${met ? 'met' : 'unmet'}`}
          style={{ color: met ? tokens.color.text.strong : tokens.color.text.subtle }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Banner thành công nhẹ (nền xanh lá nhạt, tích xanh lá); chữ tối. `role=alert` để đọc khi hiện. */
export function SuccessBanner({ message, testID }: { message: string; testID: string }) {
  const { tokens } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.success,
        {
          backgroundColor: tokens.color.feedback.success.bg,
          borderColor: tokens.color.feedback.success.fg,
          borderRadius: tokens.radius.md,
          padding: tokens.space.md,
          gap: tokens.space.sm,
        },
      ]}
    >
      <Icon name="check-circle" size={tokens.icon.md} color={tokens.color.feedback.success.fg} />
      <Text style={[styles.successText, { color: tokens.color.text.strong }]}>{message}</Text>
    </View>
  );
}

/** Hàng nút đăng nhập mạng xã hội chỉ có biểu tượng (có nhãn truy cập), theo thiết kế. */
export function SocialIconRow({
  providers,
  disabled,
  onPress,
  labelOf,
  minHeight,
}: {
  providers: readonly SocialProvider[];
  disabled: boolean;
  onPress: (provider: SocialProvider) => void;
  labelOf: (provider: SocialProvider) => string;
  minHeight: number;
}) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.socialRow, { gap: tokens.space.md }]}>
      {providers.map((provider) => (
        <Pressable
          key={provider}
          testID={`signin-social-${provider}`}
          accessibilityRole="button"
          accessibilityLabel={labelOf(provider)}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onPress(provider)}
          style={({ pressed }) => [
            styles.social,
            {
              minHeight: Math.max(getMinTouchTarget(), minHeight),
              backgroundColor: tokens.color.surface.raised,
              borderColor: tokens.color.border.field,
              borderRadius: tokens.radius.md,
              opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1,
            },
          ]}
        >
          <Icon name={provider} size={tokens.icon.lg} color={tokens.color.text.strong} />
        </Pressable>
      ))}
    </View>
  );
}

interface OtpBoxesProps {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  hasError: boolean;
  editable: boolean;
  box: { width: number; height: number; gap: number };
  inputRef: RefObject<TextInputHandle | null>;
  testID: string;
  /** Rời ô (để báo thiếu số). */
  onBlur?: () => void;
  /** Phím Xong/Return trên bàn phím. */
  onSubmitEditing?: () => void;
}

/**
 * Một ô nhập THẬT (trong suốt, phủ kín) được vẽ thành 6 ô số: bàn phím số, dán được, gợi ý mã tự
 * điền của hệ điều hành. Chữ số dùng biến thể `numeric` (cùng bề rộng). Ô hiện tại có viền nhấn; ô lỗi viền đỏ. Việc lọc chữ số và giới hạn 6 số do
 * `onChangeText` của màn hình làm (hàm `sanitizeOtp`); ô này cố ý không có `maxLength`.
 */
export function OtpBoxes({
  value,
  onChangeText,
  label,
  hasError,
  editable,
  box,
  inputRef,
  testID,
  onBlur,
  onSubmitEditing,
}: OtpBoxesProps) {
  const { tokens } = useTheme();
  const scrollIntoView = useScrollIntoView();
  const wrapperRef = useRef<ComponentRef<typeof View>>(null);
  const [focused, setFocused] = useState(false);
  const current = Math.min(value.length, OTP_LENGTH - 1);
  return (
    <View
      ref={wrapperRef}
      collapsable={false}
      style={{ height: box.height }}
      testID={`${testID}-boxes`}
    >
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.boxRow, { gap: box.gap }]}
      >
        {Array.from({ length: OTP_LENGTH }, (_, i) => {
          const isCurrent = focused && i === current;
          return (
            <View
              key={i}
              testID={`${testID}-cell-${i}`}
              style={[
                styles.cell,
                {
                  width: box.width,
                  height: box.height,
                  borderRadius: tokens.radius.md,
                  backgroundColor: tokens.color.surface.raised,
                  borderWidth:
                    isCurrent || hasError ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
                  borderColor: hasError
                    ? tokens.color.feedback.danger.fg
                    : isCurrent
                      ? tokens.color.brand.primary
                      : tokens.color.border.field,
                },
              ]}
            >
              <Text variant="numeric" style={{ color: tokens.color.text.strong }}>
                {value[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={inputRef}
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        // KHÔNG đặt maxLength: hệ điều hành sẽ cắt chuỗi dán ("123 456" -> "123 45") TRƯỚC khi
        // `sanitizeOtp` kịp bỏ dấu cách/gạch ngang. Màn hình lọc chữ số rồi tự cắt còn 6.
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoCorrect={false}
        autoCapitalize="none"
        caretHidden
        autoFocus
        selectionColor="transparent"
        onFocus={() => {
          setFocused(true);
          scrollIntoView(wrapperRef);
        }}
        onBlur={() => {
          setFocused(false);
          onBlur?.();
        }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="done"
        style={[StyleSheet.absoluteFill, styles.hiddenInput, getInputResetStyle()]}
      />
    </View>
  );
}

/**
 * Giây còn lại tới mốc `deadline` (ms; null = không đếm). Tính lại từ mốc thời gian mỗi giây (không
 * cộng dồn), nên không trôi khi app bị treo hoặc timer bị trễ.
 */
export function useCountdown(deadline: number | null): number {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (deadline === null || Date.now() >= deadline) return;
    // Chỉ để vẽ lại mỗi giây; giá trị luôn tính từ mốc `deadline` lúc vẽ.
    const id = setInterval(() => {
      tick();
      if (Date.now() >= deadline) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [deadline]);
  // Đồng hồ là nguồn ngoài: cần giá trị mới ở mỗi lần vẽ (interval ở trên chỉ kích hoạt vẽ lại).
  // eslint-disable-next-line react-hooks/purity
  return deadline === null ? 0 : remainingSeconds(deadline, Date.now());
}

const styles = StyleSheet.create({
  // Kéo nút mắt sát mép phải ô nhập (bù đệm ngang của ô), vùng chạm vẫn đủ lớn.
  eye: { alignItems: 'center', justifyContent: 'center', marginRight: -layout.space.sm },
  tip: { flexDirection: 'row', alignItems: 'flex-start' },
  tipIcon: { paddingTop: layout.space.xxs },
  tipText: { flex: 1, gap: layout.space.xxs },
  tipHeart: { alignSelf: 'flex-end' },
  rules: { gap: layout.space.tight },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
  success: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: layout.borderWidth.thin },
  successText: { flex: 1 },
  socialRow: { flexDirection: 'row' },
  social: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: layout.borderWidth.thin,
  },
  boxRow: { flexDirection: 'row', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  hiddenInput: {
    // token-exception: ô nhập thật gần như trong suốt (không phải 0) để hệ điều hành vẫn cho focus, dán và tự điền mã
    opacity: 0.02,
    color: 'transparent',
  },
});
