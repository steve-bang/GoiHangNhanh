import { useEffect, useReducer, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import type { SocialProvider } from '@/core/config/feature-flags';
import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { Icon, Text, useTheme, type IconName } from '@/shared/ui';

import { OTP_LENGTH, remainingSeconds } from '../../domain/otp';
import { TIP_CARD_PADDING, RULES_CARD_PADDING } from '../auth-layout';
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
  const { colors } = useTheme();
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
      <Icon name={shown ? 'eye-off' : 'eye'} size={22} color={colors.inkMuted} />
    </Pressable>
  );
}

/** Thẻ "Mẹo" nền xanh nhạt: biểu tượng, tiêu đề, nội dung và trái tim nhỏ góc dưới (theo thiết kế). */
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
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.tip,
        {
          backgroundColor: colors.brandSoft,
          borderRadius: radius.lg,
          padding: TIP_CARD_PADDING,
          gap: spacing.md,
        },
      ]}
    >
      <View style={styles.tipIcon}>
        <Icon name={icon} size={26} color={colors.brand} />
      </View>
      <View style={styles.tipText}>
        <Text bold style={{ color: colors.brand }}>
          {title}
        </Text>
        <Text style={{ color: colors.inkMuted, fontSize: 13, lineHeight: 18 }}>{body}</Text>
      </View>
      <View style={styles.tipHeart}>
        <Icon name="heart" size={14} color={colors.brand} />
      </View>
    </View>
  );
}

/** Khối "Mật khẩu nên có": một dòng "Ít nhất 8 ký tự", tích xanh khi đạt (theo thời gian thực). */
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
  const { colors, radius } = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.rules,
        { backgroundColor: colors.brandSoft, borderRadius: radius.md, padding: RULES_CARD_PADDING },
      ]}
    >
      <Text variant="caption" style={{ color: colors.inkMuted }}>
        {title}
      </Text>
      <View style={styles.ruleRow}>
        <Icon name="check-circle" size={18} color={met ? colors.brand : colors.fieldBorder} />
        <Text
          testID={`${testID}-length-${met ? 'met' : 'unmet'}`}
          style={{ color: met ? colors.ink : colors.inkMuted }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** Banner thành công nhẹ (nền xanh nhạt, tích xanh); chữ tối. `role=alert` để đọc khi hiện. */
export function SuccessBanner({ message, testID }: { message: string; testID: string }) {
  const { colors, radius, spacing } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.success,
        {
          backgroundColor: colors.successSoft,
          borderColor: colors.success,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon name="check-circle" size={20} color={colors.success} />
      <Text style={styles.successText}>{message}</Text>
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
  const { colors, radius, spacing } = useTheme();
  return (
    <View style={[styles.socialRow, { gap: spacing.md }]}>
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
              backgroundColor: colors.surface,
              borderColor: colors.fieldBorder,
              borderRadius: radius.md,
              opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Icon name={provider} size={22} color={colors.ink} />
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
  box: { width: number; height: number; gap: number; fontSize: number };
  inputRef: RefObject<TextInputHandle | null>;
  testID: string;
  /** Rời ô (để báo thiếu số). */
  onBlur?: () => void;
  /** Phím Xong/Return trên bàn phím. */
  onSubmitEditing?: () => void;
}

/**
 * Một ô nhập THẬT (trong suốt, phủ kín) được vẽ thành 6 ô số: bàn phím số, dán được, gợi ý mã tự
 * điền của hệ điều hành. Ô hiện tại có viền nhấn; ô lỗi viền đỏ. Việc lọc chữ số và giới hạn 6 số do
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
  const { colors, radius } = useTheme();
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
                  borderRadius: radius.md,
                  backgroundColor: colors.surface,
                  borderWidth: isCurrent || hasError ? 2 : 1,
                  borderColor: hasError
                    ? colors.danger
                    : isCurrent
                      ? colors.brand
                      : colors.fieldBorder,
                },
              ]}
            >
              <Text
                bold
                style={{ color: colors.ink, fontSize: box.fontSize, lineHeight: box.fontSize + 6 }}
              >
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
  eye: { alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  tip: { flexDirection: 'row', alignItems: 'flex-start' },
  tipIcon: { paddingTop: 2 },
  tipText: { flex: 1, gap: 2 },
  tipHeart: { alignSelf: 'flex-end' },
  rules: { gap: 6 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  success: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1 },
  successText: { flex: 1 },
  socialRow: { flexDirection: 'row' },
  social: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  boxRow: { flexDirection: 'row', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  hiddenInput: { opacity: 0.02, color: 'transparent' },
});
