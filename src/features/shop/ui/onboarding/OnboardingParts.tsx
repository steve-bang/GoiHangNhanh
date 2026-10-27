import { useRef, useState, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ErrorCode } from '@/core/errors/codes';
import { getInputResetStyle, getMinTouchTarget } from '@/platform';
import { Icon, Text, useTheme, type IconName } from '@/shared/ui';

import type { SellingSource } from '../../domain/types';
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
      {error ? (
        <Text
          variant="caption"
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, marginTop: 6, marginLeft: 4 }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Khối lỗi theo mẫu ba phần (điều gì xảy ra, ảnh hưởng, việc làm tiếp): chữ lấy từ `errors:<mã>`. */
export function FormErrorBanner({ code }: { code: ErrorCode }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      testID="form-error"
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.banner,
        {
          backgroundColor: colors.dangerSoft,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.sm,
        },
      ]}
    >
      <Icon name="alert-triangle" size={20} color={colors.danger} />
      <Text variant="caption" style={[styles.bannerText, { color: colors.danger }]}>
        {t(`errors:${code}`)}
      </Text>
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

/** Ô màu + ký hiệu cho từng nguồn bán. Chỉ là hình trang trí đơn giản, không dùng logo thương hiệu. */
export const SOURCE_TILES: Record<SellingSource, { icon: IconName; tint: string }> = {
  shopee: { icon: 'bag', tint: '#EE5A36' },
  tiktok_shop: { icon: 'music', tint: '#16181D' },
  lazada: { icon: 'heart', tint: '#4B3FD8' },
  other: { icon: 'store', tint: '#8FA3B8' },
};

interface SourceCardProps {
  source: SellingSource;
  label: string;
  checked: boolean;
  onToggle: () => void;
  height: number;
}

/** Thẻ chọn nguồn bán có ô tích (chọn nhiều). Cả thẻ là một vùng chạm kiểu checkbox. */
export function SourceCard({ source, label, checked, onToggle, height }: SourceCardProps) {
  const { colors, radius, spacing } = useTheme();
  const tile = SOURCE_TILES[source];
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
      <View style={[styles.sourceTile, { backgroundColor: tile.tint }]}>
        <Icon name={tile.icon} size={20} color="#FFFFFF" />
      </View>
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
  banner: { flexDirection: 'row', alignItems: 'flex-start' },
  bannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
  sourceTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
