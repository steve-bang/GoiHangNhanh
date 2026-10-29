import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getMinTouchTarget } from '@/platform';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface ListItemProps {
  title: string;
  subtitle?: string;
  leadingIcon?: IconName;
  /** Phần dẫn đầu tùy ý (ví dụ `Avatar`); thay `leadingIcon` nếu có. Trang trí, không mang nghĩa riêng. */
  leading?: ReactNode;
  /** `regular` cho hàng menu (tên người/cửa hàng giữ in đậm). Mặc định `bold` như cũ. */
  titleWeight?: 'bold' | 'regular';
  /** Tiêu đề màu hành động (`action.link`), dùng cho lời mời hành động như "Thêm họ tên". */
  actionTitle?: boolean;
  /** Phần tử bên phải (nhãn trạng thái, giá trị...). Tự chịu trách nhiệm trợ năng. */
  trailing?: ReactNode;
  /** Có `onPress` thì cả hàng là một nút và có mũi tên (trừ khi `showChevron={false}`). */
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  /** Hành động phá hủy (ví dụ Đăng xuất): chữ đỏ. Đỏ chỉ dùng cho trường hợp này. */
  destructive?: boolean;
  /** Mặc định đọc `title` + `subtitle`; truyền khi `trailing` mang thông tin cần đọc kèm. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * Một hàng danh sách/menu: biểu tượng - tiêu đề (+ phụ đề) - phần bên phải. Cao tối thiểu bằng vùng
 * chạm, KHÔNG cố định chiều cao để không vỡ khi chữ lớn; chữ tự xuống dòng.
 */
export function ListItem({
  title,
  subtitle,
  leadingIcon,
  leading,
  titleWeight = 'bold',
  actionTitle = false,
  trailing,
  onPress,
  showChevron,
  disabled = false,
  destructive = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListItemProps) {
  const { tokens } = useTheme();
  const interactive = onPress !== undefined;
  const chevron = showChevron ?? interactive;
  const titleColor = destructive
    ? tokens.color.feedback.danger.fg
    : actionTitle
      ? tokens.color.action.link
      : tokens.color.text.primary;
  const label = accessibilityLabel ?? [title, subtitle].filter(Boolean).join('. ');

  const content = (
    <>
      {leading ?? null}
      {!leading && leadingIcon ? (
        <Icon
          name={leadingIcon}
          size={22}
          color={destructive ? tokens.color.feedback.danger.fg : tokens.color.text.secondary}
        />
      ) : null}
      <View style={styles.text}>
        <Text bold={titleWeight === 'bold'} style={{ color: titleColor }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="forward" size={18} color={tokens.color.text.secondary} /> : null}
    </>
  );
  const rowStyle = {
    minHeight: getMinTouchTarget(),
    gap: tokens.space.md,
    paddingVertical: tokens.space.sm,
    paddingHorizontal: tokens.space.lg,
  } as const;

  if (!interactive) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={[styles.row, rowStyle, disabled ? { opacity: tokens.opacity.disabled } : null]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      {...(accessibilityHint ? { accessibilityHint } : {})}
      style={({ pressed }) => [
        styles.row,
        rowStyle,
        { opacity: disabled ? tokens.opacity.disabled : pressed ? tokens.opacity.pressed : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, flexShrink: 1 },
});
