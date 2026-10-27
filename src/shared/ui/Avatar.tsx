import { StyleSheet, View } from 'react-native';

import { layout } from '@/core/theme';

import { getInitials } from './avatar-initials';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface AvatarProps {
  /** Họ tên để lấy chữ cái đầu; trống/null thì hiện biểu tượng người dùng (không bịa chữ từ email). */
  name?: string | null;
  size?: 'md' | 'lg' | 'xl';
  /** `square` (bo góc) cho cửa hàng, `circle` (mặc định) cho người. */
  shape?: 'circle' | 'square';
  /** Mặc định trang trí (ẩn khỏi trình đọc màn hình) vì tên luôn có chữ đi kèm gần đó. */
  accessibilityLabel?: string;
  testID?: string;
}

/** Ảnh đại diện dạng chữ cái đầu. Chưa hỗ trợ ảnh tải lên (chưa có đặc tả). */
export function Avatar({
  name,
  size = 'lg',
  shape = 'circle',
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const { tokens } = useTheme();
  const dimension = layout.component.tile[size === 'md' ? 'md' : size === 'lg' ? 'lg' : 'xl'];
  const initials = getInitials(name);
  return (
    <View
      testID={testID}
      {...(accessibilityLabel
        ? { accessible: true, accessibilityLabel }
        : { accessible: false, importantForAccessibility: 'no-hide-descendants' as const })}
      style={[
        styles.circle,
        {
          width: dimension,
          height: dimension,
          borderRadius: shape === 'square' ? tokens.radius.md : dimension / 2,
          backgroundColor: tokens.color.brand.soft,
        },
      ]}
    >
      {initials ? (
        <Text variant="sectionTitle" bold style={{ color: tokens.color.brand.deep }}>
          {initials}
        </Text>
      ) : (
        <Icon name="user" size={dimension / 2} color={tokens.color.brand.deep} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
