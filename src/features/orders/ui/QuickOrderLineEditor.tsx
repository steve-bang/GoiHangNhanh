import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Icon, QuantityStepper, Text, TextField, useTheme } from '@/shared/ui';

export interface LineInput {
  key: number;
  name: string;
  variant: string;
  quantity: number;
}

interface QuickOrderLineEditorProps {
  index: number;
  total: number;
  line: LineInput;
  nameError?: string | undefined;
  quantityError?: string | undefined;
  /** Gợi ý TÊN sản phẩm từ lịch sử đã nhập (chỉ hiện ở dòng đang soạn). */
  nameSuggestions: readonly string[];
  /** Variant gần đây của đúng sản phẩm đã chọn. */
  variantSuggestions: readonly string[];
  onActivate: () => void;
  onChange: (patch: Partial<Omit<LineInput, 'key'>>) => void;
  onRemove?: (() => void) | undefined;
}

/**
 * Một dòng sản phẩm của đơn nhanh (docs/04 A02): tên và variant là HAI ô riêng (docs/09 5.5 A.7),
 * số lượng mặc định 1 (A.8). Gợi ý chỉ lấy từ lịch sử đã nhập: chọn một tên thì điền tên rồi gợi ý
 * variant gần đây của tên đó; không bao giờ gộp variant.
 */
export function QuickOrderLineEditor({
  index,
  total,
  line,
  nameError,
  quantityError,
  nameSuggestions,
  variantSuggestions,
  onActivate,
  onChange,
  onRemove,
}: QuickOrderLineEditorProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const touch = getMinTouchTarget();
  const variantChoices = variantSuggestions.filter(
    (v) => v.toLowerCase() !== line.variant.trim().toLowerCase(),
  );

  return (
    <View testID={`line-${index}`} style={{ gap: spacing.md }}>
      {total > 1 ? (
        <View style={styles.titleRow}>
          <Text variant="formButton" accessibilityRole="header" style={styles.flex}>
            {t('screens:quickOrder.lineTitle', { index: index + 1 })}
          </Text>
          {onRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('screens:quickOrder.removeLine')}
              onPress={onRemove}
              style={[styles.iconButton, { minWidth: touch, minHeight: touch }]}
            >
              <Icon name="close" size={22} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <TextField
        testID={`line-name-${index}`}
        compact
        label={t('screens:quickOrder.product')}
        placeholder={t('screens:quickOrder.productPlaceholder')}
        value={line.name}
        onChangeText={(name) => onChange({ name })}
        onFocus={onActivate}
        autoCapitalize="sentences"
        {...(nameError ? { error: nameError } : {})}
        trailing={<Icon name="forward" size={20} color={colors.inkMuted} />}
      />

      {nameSuggestions.length > 0 ? (
        <View
          testID={`line-suggestions-${index}`}
          style={[
            styles.suggestions,
            { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm },
          ]}
        >
          <Text variant="caption" color="inkMuted" style={{ paddingHorizontal: spacing.sm }}>
            {t('screens:quickOrder.suggestions')}
          </Text>
          {nameSuggestions.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={() => onChange({ name, variant: '' })}
              style={[styles.suggestionRow, { minHeight: touch, paddingHorizontal: spacing.sm }]}
            >
              <View
                style={[styles.thumb, { backgroundColor: colors.surface, borderRadius: radius.sm }]}
              >
                <Icon name="package" size={18} color={colors.inkMuted} />
              </View>
              <Text variant="formBody" color="ink" style={styles.flex} numberOfLines={1}>
                {name}
              </Text>
              <Icon name="forward" size={18} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextField
        testID={`line-variant-${index}`}
        compact
        label={t('screens:quickOrder.variant')}
        placeholder={t('screens:quickOrder.variantPlaceholder')}
        value={line.variant}
        onChangeText={(variant) => onChange({ variant })}
        onFocus={onActivate}
        autoCapitalize="sentences"
        {...(line.variant.length > 0
          ? {
              trailing: (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('screens:quickOrder.clearVariant')}
                  onPress={() => onChange({ variant: '' })}
                  style={[styles.iconButton, { minWidth: touch, minHeight: touch }]}
                >
                  <Icon name="close" size={20} color={colors.textMuted} />
                </Pressable>
              ),
            }
          : {})}
      />

      {variantChoices.length > 0 ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="inkMuted">
            {t('screens:quickOrder.variantSuggestions')}
          </Text>
          <View style={[styles.chips, { gap: spacing.sm }]}>
            {variantChoices.map((variant) => (
              <Pressable
                key={variant}
                accessibilityRole="button"
                accessibilityLabel={variant}
                onPress={() => onChange({ variant })}
                style={[
                  styles.chip,
                  {
                    minHeight: touch,
                    borderRadius: radius.lg,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    paddingHorizontal: spacing.lg,
                  },
                ]}
              >
                <Text variant="formBody" color="ink">
                  {variant}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="formLabel" color="ink">
          {t('screens:quickOrder.quantity')}
        </Text>
        <QuantityStepper value={line.quantity} onChange={(quantity) => onChange({ quantity })} />
        {quantityError ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {quantityError}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  suggestions: { gap: 2 },
  thumb: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
