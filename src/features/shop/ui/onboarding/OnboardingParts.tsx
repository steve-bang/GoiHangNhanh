import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ErrorCode } from '@/core/errors/codes';
import { resolveErrorMessage, type ErrorMessage } from '@/core/i18n/error-message';
import type { OrderSource } from '@/core/orders/order-source';
import { layout, typography } from '@/core/theme';
import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { Button, Icon, SourceIcon, Text, useTheme, type IconName } from '@/shared/ui';

import { BANNER_LINE_HEIGHT, FIELD_ERROR_LINE_HEIGHT } from '../onboarding-layout';
import type { StepState } from '../onboarding-progress';
import { useScrollIntoView } from './OnboardingScaffold';

interface IconFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  icon: IconName;
  placeholder?: string;
  error?: string | undefined;
  /** Gợi ý nhỏ dưới ô; ẩn khi có lỗi. */
  hint?: string | undefined;
  /** Nút ngay trong dòng lỗi (ví dụ "Đăng nhập" khi email đã có tài khoản). */
  errorAction?: { label: string; onPress: () => void; testID?: string } | undefined;
  /** Phần bên phải ô (ví dụ nút hiện/ẩn mật khẩu). */
  accessory?: ReactNode;
  height: number;
  inputRef: RefObject<TextInputHandle | null>;
  inputProps?: TextInputProps;
  testID?: string;
}

/**
 * Ô nhập có biểu tượng bên trái, nhãn nhỏ luôn hiện phía trên giá trị (mockup UI-A03). Chạm vào bất
 * kỳ chỗ nào của ô đều focus vào ô nhập. Lỗi hiện dưới ô, kèm chữ (màu không là tín hiệu duy nhất).
 */
/** Kiểu tay cầm của ô nhập (để `focus()` từ ngoài). */
export type TextInputHandle = ComponentRef<typeof TextInput>;

export function IconField({
  label,
  value,
  onChangeText,
  onBlur,
  icon,
  placeholder,
  error,
  hint,
  errorAction,
  accessory,
  height,
  inputRef,
  inputProps,
  testID,
}: IconFieldProps) {
  const { tokens } = useTheme();
  const { color } = tokens;
  const wrapperRef = useRef<ComponentRef<typeof View>>(null);
  const scrollIntoView = useScrollIntoView();
  const [focused, setFocused] = useState(false);
  // Lỗi mới hiện lúc bàn phím đang mở: cuộn để lỗi không bị bàn phím che.
  useEffect(() => {
    if (error && focused) scrollIntoView(wrapperRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi lỗi đổi
  }, [error]);
  return (
    <View ref={wrapperRef} collapsable={false} style={styles.fieldWrap}>
      <Pressable
        accessible={false}
        onPress={() => inputRef.current?.focus()}
        style={[
          styles.fieldBox,
          {
            minHeight: height,
            backgroundColor: color.surface.raised,
            borderColor: error
              ? color.feedback.danger.fg
              : focused
                ? color.brand.primary
                : color.border.field,
            // Viền đậm khi focus/lỗi; đệm ngang bù phần viền dày thêm để chữ không xê dịch.
            borderWidth: error || focused ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
            paddingHorizontal:
              error || focused
                ? tokens.space.lg - (tokens.borderWidth.emphasis - tokens.borderWidth.thin)
                : tokens.space.lg,
            borderRadius: tokens.radius.lg,
            gap: tokens.space.md,
          },
        ]}
      >
        <Icon name={icon} size={tokens.icon.md} color={color.text.subtle} />
        <View style={styles.fieldBody}>
          <Text variant="caption" style={{ color: color.text.subtle }} numberOfLines={1}>
            {label}
          </Text>
          <TextInput
            ref={inputRef}
            testID={testID}
            accessibilityLabel={label}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => {
              setFocused(true);
              scrollIntoView(wrapperRef);
            }}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            placeholder={placeholder}
            placeholderTextColor={color.text.subtle}
            autoCapitalize="none"
            autoCorrect={false}
            {...inputProps}
            style={[styles.fieldInput, getInputResetStyle(), { color: color.text.strong }]}
          />
        </View>
        {accessory}
      </Pressable>
      {!error && hint ? (
        <Text
          variant="caption"
          style={{
            color: color.text.subtle,
            marginTop: tokens.space.tight,
            marginLeft: tokens.space.xs,
          }}
          testID={testID ? `${testID}-hint` : undefined}
        >
          {hint}
        </Text>
      ) : null}
      {error ? (
        <FieldError
          message={error}
          action={errorAction}
          testID={testID ? `${testID}-error` : undefined}
        />
      ) : null}
    </View>
  );
}

/** Dòng lỗi dưới một ô nhập: biểu tượng + chữ (+ nút hành động), `role=alert` để đọc khi hiện. */
export function FieldError({
  message,
  action,
  testID,
}: {
  message: string;
  action?: { label: string; onPress: () => void; testID?: string } | undefined;
  testID?: string | undefined;
}) {
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        {
          marginTop: tokens.space.tight,
          marginLeft: tokens.space.xs,
          gap: tokens.space.xs,
          alignItems: action ? 'center' : 'flex-start',
        },
      ]}
    >
      <View style={styles.fieldErrorIcon}>
        <Icon name="alert-triangle" size={tokens.icon.sm} color={tokens.color.feedback.danger.fg} />
      </View>
      <Text variant="formBody" style={[styles.fieldErrorText, { color: tokens.color.text.strong }]}>
        {message}
      </Text>
      {action ? (
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={tokens.space.xs}
          style={[styles.fieldErrorAction, { minHeight: touch, minWidth: touch }]}
        >
          <Text variant="formBody" bold style={{ color: tokens.color.action.link }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Khung lỗi chung của form (mạng, hệ thống): nền hồng rất nhạt, chữ tối, chỉ biểu tượng và viền màu
 * đỏ. Câu đầu in đậm. Có `onRetry` thì hiện nút "Thử lại". Trình đọc màn hình đọc khi khung hiện.
 */
export function FormErrorBanner({
  code,
  onRetry,
  action,
  message: override,
}: {
  code: ErrorCode;
  onRetry?: () => void;
  /** Nút hành động riêng (ví dụ "Gửi lại mã"); thay cho "Thử lại". */
  action?: { label: string; onPress: () => void; testID?: string };
  /** Câu chữ riêng của màn (thay cho `errors:<mã>`), dùng khi cùng mã cần lời khác theo ngữ cảnh. */
  message?: ErrorMessage;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const scrollIntoView = useScrollIntoView();
  const bannerRef = useRef<ComponentRef<typeof View>>(null);
  const message = override ?? resolveErrorMessage(t, code);
  // Khung lỗi vừa hiện lúc bàn phím còn mở: cuộn để thấy nó (và nút Thử lại).
  useEffect(() => {
    scrollIntoView(bannerRef);
  }, [code, scrollIntoView]);
  return (
    <View
      ref={bannerRef}
      collapsable={false}
      testID="form-error"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.banner,
        {
          backgroundColor: tokens.color.feedback.danger.bg,
          borderColor: tokens.color.feedback.danger.fg,
          borderRadius: tokens.radius.md,
          padding: tokens.space.md,
          gap: tokens.space.md,
        },
      ]}
    >
      <View style={[styles.bannerRow, { gap: tokens.space.sm }]}>
        <View style={styles.bannerIcon}>
          <Icon
            name="alert-triangle"
            size={tokens.icon.md}
            color={tokens.color.feedback.danger.fg}
          />
        </View>
        <Text variant="body" style={[styles.bannerText, { color: tokens.color.text.strong }]}>
          <Text bold style={{ color: tokens.color.text.strong }}>
            {message.title}
          </Text>
          {message.hint ? ` ${message.hint}` : ''}
        </Text>
      </View>
      {action ? (
        <Button
          testID={action.testID ?? 'form-error-action'}
          variant="secondary"
          label={action.label}
          onPress={action.onPress}
        />
      ) : onRetry ? (
        <Button
          testID="form-error-retry"
          variant="secondary"
          label={t('common:actions.retry')}
          onPress={onRetry}
        />
      ) : null}
    </View>
  );
}

interface StepProgressProps {
  segments: readonly StepState[];
  current: number;
  total: number;
}

/**
 * Thanh tiến trình theo bước của luồng thật (Tạo tài khoản, Thông tin shop, Hoàn tất): mỗi bước một
 * nút nối bằng đường kẻ; bước đã xong/đang làm tô xanh, bước chưa tới màu xám. Chữ "2/3" bên phải.
 */
export function StepProgress({ segments, current, total }: StepProgressProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { color } = tokens;
  return (
    <View
      testID="step-progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('screens:createShop.progressLabel', { current, total })}
      accessibilityValue={{ min: 1, max: total, now: current }}
      style={styles.progress}
    >
      {segments.map((state, index) => (
        <View key={index} style={styles.progressSegment}>
          <View
            testID={`step-node-${index + 1}-${state}`}
            style={[
              state === 'todo' ? styles.nodeTodo : styles.nodeActive,
              {
                backgroundColor: state === 'todo' ? color.border.field : color.brand.primary,
              },
            ]}
          >
            {state === 'done' ? <Icon name="check" size={12} color={color.text.onAction} /> : null}
            {state === 'current' ? (
              <View style={[styles.nodeDot, { backgroundColor: color.text.onAction }]} />
            ) : null}
          </View>
          <View
            style={[
              styles.progressLine,
              { backgroundColor: state === 'done' ? color.brand.primary : color.border.default },
            ]}
          />
        </View>
      ))}
      <Text
        variant="caption"
        bold
        style={{ color: color.text.subtle, marginLeft: tokens.space.sm }}
        importantForAccessibility="no"
      >
        {t('screens:createShop.progressValue', { current, total })}
      </Text>
    </View>
  );
}

interface SourceCardProps {
  source: OrderSource;
  label: string;
  checked: boolean;
  onToggle: () => void;
  height: number;
}

/** Thẻ chọn nguồn bán có ô tích (chọn nhiều). Cả thẻ là một vùng chạm kiểu checkbox. */
export function SourceCard({ source, label, checked, onToggle, height }: SourceCardProps) {
  const { tokens } = useTheme();
  const { color } = tokens;
  return (
    <Pressable
      testID={`source-${source}`}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.sourceCard,
        {
          minHeight: Math.max(height, getMinTouchTarget()),
          backgroundColor: color.surface.raised,
          borderColor: checked ? color.brand.primary : color.border.default,
          // Thẻ đang chọn: viền đậm; đệm ngang bù phần viền dày thêm để nội dung không xê dịch.
          borderWidth: checked ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
          paddingHorizontal: checked
            ? tokens.space.md - (tokens.borderWidth.emphasis - tokens.borderWidth.thin)
            : tokens.space.md,
          borderRadius: tokens.radius.md,
          gap: tokens.space.md,
          opacity: pressed ? tokens.opacity.pressed : 1,
        },
      ]}
    >
      <SourceIcon source={source} />
      <Text style={[styles.sourceLabel, { color: color.text.strong }]}>{label}</Text>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? color.brand.primary : color.surface.raised,
            borderColor: checked ? color.brand.primary : color.border.strong,
          },
        ]}
      >
        {checked ? <Icon name="check" size={tokens.icon.sm} color={color.text.onAction} /> : null}
      </View>
    </Pressable>
  );
}

/** Nút bước của thanh tiến trình: cao bằng biểu tượng nhỏ; nút đang/đã làm dài thêm thành viên thuốc. */
const STEP_NODE = layout.icon.sm;

const styles = StyleSheet.create({
  fieldWrap: { alignSelf: 'stretch' },
  fieldBox: { flexDirection: 'row', alignItems: 'center' },
  fieldBody: { flex: 1, justifyContent: 'center', paddingVertical: layout.space.sm },
  // Ô nhập không dùng được `Text`: lấy cỡ chữ variant `body` (TextInput không co theo `Text`).
  fieldInput: {
    ...typography.body,
    padding: 0,
    margin: 0,
    minHeight: typography.body.lineHeight,
  },
  fieldError: { flexDirection: 'row' },
  fieldErrorIcon: { height: FIELD_ERROR_LINE_HEIGHT, justifyContent: 'center' },
  fieldErrorText: { flexShrink: 1 },
  fieldErrorAction: { justifyContent: 'center', paddingHorizontal: layout.space.sm },
  banner: { borderWidth: layout.borderWidth.thin },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerIcon: { height: BANNER_LINE_HEIGHT, justifyContent: 'center' },
  bannerText: { flex: 1 },
  progress: { flexDirection: 'row', alignItems: 'center', minHeight: layout.component.tile.sm },
  progressSegment: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  nodeActive: {
    width: STEP_NODE + layout.space.md,
    height: STEP_NODE,
    borderRadius: layout.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTodo: { width: STEP_NODE, height: STEP_NODE, borderRadius: layout.radius.full },
  nodeDot: {
    width: layout.space.tight,
    height: layout.space.tight,
    borderRadius: layout.radius.full,
  },
  progressLine: {
    flex: 1,
    height: layout.space.xs,
    borderRadius: layout.radius.full,
    marginHorizontal: layout.space.xs,
  },
  sourceCard: { flexDirection: 'row', alignItems: 'center' },
  sourceLabel: { flex: 1 },
  checkbox: {
    width: layout.component.checkbox.size,
    height: layout.component.checkbox.size,
    borderRadius: layout.radius.sm,
    borderWidth: layout.borderWidth.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
