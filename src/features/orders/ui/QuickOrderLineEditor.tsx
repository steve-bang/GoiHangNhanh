import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { Icon, QuantityStepper, Text, TextField, useTheme } from '@/shared/ui';
import { layout } from '@/core/theme';

import { INPUT_LIMITS } from './draft-error-text';

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
  variantError?: string | undefined;
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
  variantError,
  quantityError,
  nameSuggestions,
  variantSuggestions,
  onActivate,
  onChange,
  onRemove,
}: QuickOrderLineEditorProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const touch = getMinTouchTarget();
  const variantChoices = variantSuggestions.filter(
    (v) => v.toLowerCase() !== line.variant.trim().toLowerCase(),
  );

  return (
    <View testID={`line-${index}`} style={{ gap: tokens.space.md }}>
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
              <Icon name="close" size={22} color={tokens.color.text.secondary} />
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
        maxLength={INPUT_LIMITS.name}
        {...(nameError ? { error: nameError } : {})}
        trailing={<Icon name="forward" size={20} color={tokens.color.text.subtle} />}
      />

      {nameSuggestions.length > 0 ? (
        <View
          testID={`line-suggestions-${index}`}
          style={[
            styles.suggestions,
            {
              backgroundColor: tokens.color.surface.muted,
              borderRadius: tokens.radius.md,
              padding: tokens.space.sm,
            },
          ]}
        >
          <Text variant="caption" color="inkMuted" style={{ paddingHorizontal: tokens.space.sm }}>
            {t('screens:quickOrder.suggestions')}
          </Text>
          {nameSuggestions.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={name}
              onPress={() => onChange({ name, variant: '' })}
              style={[
                styles.suggestionRow,
                { minHeight: touch, paddingHorizontal: tokens.space.sm },
              ]}
            >
              <View
                style={[
                  styles.thumb,
                  { backgroundColor: tokens.color.surface.raised, borderRadius: tokens.radius.sm },
                ]}
              >
                <Icon name="package" size={18} color={tokens.color.text.subtle} />
              </View>
              <Text variant="formBody" color="ink" style={styles.flex} numberOfLines={1}>
                {name}
              </Text>
              <Icon name="forward" size={18} color={tokens.color.text.subtle} />
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
        maxLength={INPUT_LIMITS.variant}
        {...(variantError ? { error: variantError } : {})}
        {...(line.variant.length > 0
          ? {
              trailing: (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('screens:quickOrder.clearVariant')}
                  onPress={() => onChange({ variant: '' })}
                  style={[styles.iconButton, { minWidth: touch, minHeight: touch }]}
                >
                  <Icon name="close" size={20} color={tokens.color.text.secondary} />
                </Pressable>
              ),
            }
          : {})}
      />

      {variantChoices.length > 0 ? (
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="caption" color="inkMuted">
            {t('screens:quickOrder.variantSuggestions')}
          </Text>
          <View style={[styles.chips, { gap: tokens.space.sm }]}>
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
                    borderRadius: tokens.radius.lg,
                    borderColor: tokens.color.border.default,
                    backgroundColor: tokens.color.surface.raised,
                    paddingHorizontal: tokens.space.lg,
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

      <View style={{ gap: tokens.space.sm }}>
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
  suggestions: { gap: layout.space.xxs },
  thumb: {
    width: layout.component.tile.sm,
    height: layout.component.tile.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { alignItems: 'center', justifyContent: 'center', borderWidth: layout.borderWidth.thin },
});
