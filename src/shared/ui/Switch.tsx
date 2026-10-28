import { Pressable, StyleSheet, Switch as RNSwitch, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { IconTile } from './IconTile';
import type { IconName } from './Icon';
import { Text } from './Text';
import type { IconTone } from './tone';
import { useTheme } from './theme';

interface SwitchProps {
  label: string;
  /** Giải thích ngắn dưới nhãn (ví dụ khi tùy chọn bị tắt do hệ điều hành). */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  /** Ô icon trang trí bên trái nhãn (board 07 khung 13). Không đặt thì giữ bố cục cũ. */
  icon?: IconName;
  iconTone?: IconTone;
  testID?: string;
}

/**
 * Công tắc bật/tắt có nhãn. Cả hàng là vùng chạm (đọc thành một công tắc, có trạng thái bật/tắt);
 * công tắc native bên trong chỉ để vẽ. Trạng thái luôn có chữ nhãn đi kèm, không chỉ màu.
 */
export function Switch({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  icon,
  iconTone,
  testID,
}: SwitchProps) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      {...(description ? { accessibilityHint: description } : {})}
      style={[
        styles.row,
        {
          minHeight: getMinTouchTarget(),
          gap: tokens.space.md,
          paddingVertical: tokens.space.sm,
          paddingHorizontal: tokens.space.lg,
          opacity: disabled ? tokens.opacity.disabled : 1,
        },
      ]}
    >
      {icon ? <IconTile icon={icon} {...(iconTone ? { tone: iconTone } : {})} /> : null}
      <View style={styles.text}>
        <Text bold>{label}</Text>
        {description ? (
          <Text variant="caption" color="textMuted">
            {description}
          </Text>
        ) : null}
      </View>
      <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants">
        <RNSwitch
          value={value}
          disabled={disabled}
          trackColor={{ false: tokens.color.border.default, true: tokens.color.action.primary }}
          thumbColor={tokens.color.surface.raised}
          ios_backgroundColor={tokens.color.border.default}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, flexShrink: 1 },
});
