import {
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import type { ErrorCode } from '@/core/errors/codes';
import type { OrderSource } from '@/core/orders/order-source';
import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { Button, Icon, SourceIcon, Text, useTheme, type IconName } from '@/shared/ui';

import {
  BANNER_LINE_HEIGHT,
  FIELD_ERROR_FONT_SIZE,
  FIELD_ERROR_LINE_HEIGHT,
} from '../onboarding-layout';
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
  const { colors, spacing, radius } = useTheme();
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
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.brand : colors.fieldBorder,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          },
        ]}
      >
        <Icon name={icon} size={22} color={colors.inkMuted} />
        <View style={styles.fieldBody}>
          <Text variant="caption" style={{ color: colors.inkMuted }} numberOfLines={1}>
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
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="none"
            autoCorrect={false}
            {...inputProps}
            style={[styles.fieldInput, getInputResetStyle(), { color: colors.ink }]}
          />
        </View>
        {accessory}
      </Pressable>
      {!error && hint ? (
        <Text
          variant="caption"
          style={{ color: colors.inkMuted, marginTop: 6, marginLeft: 4 }}
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
  const { colors, spacing } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        {
          marginTop: 6,
          marginLeft: 4,
          gap: spacing.xs,
          alignItems: action ? 'center' : 'flex-start',
        },
      ]}
    >
      <View style={styles.fieldErrorIcon}>
        <Icon name="alert-triangle" size={16} color={colors.danger} />
      </View>
      <Text
        style={[
          styles.fieldErrorText,
          {
            color: colors.ink,
            fontSize: FIELD_ERROR_FONT_SIZE,
            lineHeight: FIELD_ERROR_LINE_HEIGHT,
          },
        ]}
      >
        {message}
      </Text>
      {action ? (
        <Pressable
          testID={action.testID}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={4}
          style={[styles.fieldErrorAction, { minHeight: touch, minWidth: touch }]}
        >
          <Text bold style={{ color: colors.brand, fontSize: FIELD_ERROR_FONT_SIZE }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Nối câu đầu + câu sau thành một chuỗi (lỗi dưới ô nhập không in đậm). */
export function errorText(message: ErrorMessage): string {
  return message.hint ? `${message.title} ${message.hint}` : message.title;
}

/** Thông báo lỗi: `title` là câu đầu (in đậm), `hint` là câu sau (có thể không có). */
export interface ErrorMessage {
  title: string;
  hint?: string;
}

/** Lấy chữ của mã lỗi từ `errors:<mã>`: chuỗi đơn (một câu) hoặc `{ title, hint }` (hai câu). */
export function resolveErrorMessage(t: TFunction, code: ErrorCode): ErrorMessage {
  const raw: unknown = t(`errors:${code}`, { returnObjects: true });
  if (raw && typeof raw === 'object') {
    const { title, hint } = raw as { title?: unknown; hint?: unknown };
    return {
      title: typeof title === 'string' ? title : code,
      ...(typeof hint === 'string' ? { hint } : {}),
    };
  }
  return { title: typeof raw === 'string' ? raw : code };
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
  const { colors, spacing, radius } = useTheme();
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
          backgroundColor: colors.dangerSoft,
          borderColor: colors.danger,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.md,
        },
      ]}
    >
      <View style={[styles.bannerRow, { gap: spacing.sm }]}>
        <View style={styles.bannerIcon}>
          <Icon name="alert-triangle" size={20} color={colors.danger} />
        </View>
        <Text style={[styles.bannerText, { color: colors.ink }]}>
          <Text bold style={{ color: colors.ink }}>
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
  const { colors } = useTheme();
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
                backgroundColor: state === 'todo' ? colors.fieldBorder : colors.brand,
              },
            ]}
          >
            {state === 'done' ? <Icon name="check" size={12} color={colors.onBrand} /> : null}
            {state === 'current' ? (
              <View style={[styles.nodeDot, { backgroundColor: colors.onBrand }]} />
            ) : null}
          </View>
          <View
            style={[
              styles.progressLine,
              { backgroundColor: state === 'done' ? colors.brand : colors.borderSubtle },
            ]}
          />
        </View>
      ))}
      <Text
        variant="caption"
        bold
        style={{ color: colors.inkMuted, marginLeft: 8 }}
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
  const { colors, radius, spacing } = useTheme();
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
          backgroundColor: colors.surface,
          borderColor: checked ? colors.brand : colors.borderSubtle,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          gap: spacing.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <SourceIcon source={source} />
      <Text style={styles.sourceLabel} color="ink">
        {label}
      </Text>
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.brand : colors.surface,
            borderColor: checked ? colors.brand : '#B6C6C0',
          },
        ]}
      >
        {checked ? <Icon name="check" size={16} color={colors.onBrand} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fieldWrap: { alignSelf: 'stretch' },
  fieldBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  fieldBody: { flex: 1, justifyContent: 'center', paddingVertical: 8 },
  fieldInput: { fontSize: 15, lineHeight: 22, padding: 0, margin: 0, minHeight: 22 },
  fieldError: { flexDirection: 'row' },
  fieldErrorIcon: { height: FIELD_ERROR_LINE_HEIGHT, justifyContent: 'center' },
  fieldErrorText: { flexShrink: 1 },
  fieldErrorAction: { justifyContent: 'center', paddingHorizontal: 8 },
  banner: { borderWidth: 1 },
  bannerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerIcon: { height: BANNER_LINE_HEIGHT, justifyContent: 'center' },
  bannerText: { flex: 1, fontSize: 15, lineHeight: BANNER_LINE_HEIGHT },
  progress: { flexDirection: 'row', alignItems: 'center', height: 28 },
  progressSegment: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  nodeActive: {
    width: 30,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTodo: { width: 18, height: 18, borderRadius: 9 },
  nodeDot: { width: 6, height: 6, borderRadius: 3 },
  progressLine: { flex: 1, height: 4, borderRadius: 2, marginHorizontal: 4 },
  sourceCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  sourceLabel: { flex: 1 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
