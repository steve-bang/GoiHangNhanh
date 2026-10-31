import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { layout } from '@/core/theme';

import { Icon } from './Icon';
import { useTheme } from './theme';

interface SearchFieldBaseProps {
  value: string;
  onChangeText: (value: string) => void;
  /** Vừa là gợi ý vừa là nhãn đọc màn hình (ví dụ "Tìm theo mã đơn hoặc mã vận đơn"). */
  placeholder: string;
  onSubmitEditing?: () => void;
  testID?: string;
  /** Cỡ gọn của nhóm màn form (chữ 14sp, cao tối thiểu bằng vùng chạm, viền xanh nhạt). */
  compact?: boolean;
}

/** Nút quét: `onScan` luôn đi kèm `scanLabel` (nhãn đọc màn hình), kiểm tra lúc biên dịch. */
type SearchFieldScanProps =
  | {
      /**
       * Có thì hiện nút quét mã ở cuối ô khi ô đang trống (mockup tab Đơn hàng, ORD-01); khi đã gõ chữ
       * thì nút xóa nội dung thế chỗ. Bên gọi tự mở màn quét; ô không biết gì về camera.
       */
      onScan: () => void;
      scanLabel: string;
      scanTestID?: string;
    }
  | { onScan?: undefined; scanLabel?: undefined; scanTestID?: undefined };

type SearchFieldProps = SearchFieldBaseProps & SearchFieldScanProps;

/** Ô tìm lớn có biểu tượng kính lúp, nút xóa nội dung và (tùy chọn) nút quét mã. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
  testID,
  compact = false,
  onScan,
  scanLabel,
  scanTestID,
}: SearchFieldProps) {
  const { t } = useTranslation();
  const { tokens, typography } = useTheme();
  const touch = getMinTouchTarget();
  return (
    <View
      style={[
        styles.row,
        {
          minHeight: compact ? touch : Math.max(touch, tokens.component.field.minHeight),
          backgroundColor: tokens.color.surface.raised,
          borderColor: compact ? tokens.color.border.field : tokens.color.border.default,
          borderRadius: tokens.radius.md,
          paddingLeft: tokens.space.md,
        },
      ]}
    >
      <Icon name="search" size={compact ? 20 : 22} color={tokens.color.text.secondary} />
      <TextInput
        testID={testID}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={tokens.color.text.secondary}
        returnKeyType="search"
        {...(onSubmitEditing ? { onSubmitEditing } : {})}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          compact ? typography.formBody : typography.body,
          styles.input,
          { color: tokens.color.text.primary },
        ]}
      />
      {value.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:actions.clearText')}
          onPress={() => onChangeText('')}
          style={[styles.clear, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="close" color={tokens.color.text.secondary} />
        </Pressable>
      ) : onScan ? (
        <Pressable
          testID={scanTestID}
          accessibilityRole="button"
          accessibilityLabel={scanLabel}
          onPress={onScan}
          style={[styles.clear, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="scan" color={tokens.color.brand.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.space.sm,
    borderWidth: layout.borderWidth.thin,
  },
  // `minWidth: 0`: ô nhập được co hẹp hơn bề rộng nội tại (react-native-web: thẻ `<input>` có bề rộng mặc
  // định nên đẩy nút quét ra ngoài viền ở màn 320 pt; V1-18).
  input: { flex: 1, minWidth: 0, paddingVertical: layout.space.sm },
  clear: { alignItems: 'center', justifyContent: 'center' },
});
