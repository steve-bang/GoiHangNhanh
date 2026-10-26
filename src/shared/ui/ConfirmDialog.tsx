import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** Nêu rõ hậu quả và dữ liệu bị ảnh hưởng (docs/09 mục 6). */
  message: string;
  /** Nhãn CỤ THỂ cho cả hai nút; cấm "OK"/"Tiếp tục" mơ hồ khi có thể nêu hành động. */
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Hành động xác nhận gây mất dữ liệu/khó đảo ngược: nút xác nhận màu đỏ (đỏ chỉ cho trường hợp này). */
  destructive?: boolean;
  /**
   * Nút nào là nút CHÍNH nổi bật (đặt trên cùng). Mặc định: nút an toàn (hủy) khi `destructive`,
   * ngược lại là nút xác nhận. Khi lối an toàn là "ở lại" (ví dụ rời màn quay), truyền `cancel`.
   */
  primary?: 'confirm' | 'cancel';
}

/** Hộp thoại xác nhận, chỉ dùng cho hành động quan trọng (xóa, đóng hồ sơ, rời phiên quay). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  destructive = false,
  primary = destructive ? 'cancel' : 'confirm',
}: ConfirmDialogProps) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={[styles.root, { backgroundColor: colors.scrim, padding: spacing.xl }]}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.xl,
            maxHeight: '90%',
          }}
        >
          <ScrollView contentContainerStyle={{ gap: spacing.md }}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {title}
            </Text>
            <Text>{message}</Text>
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              {primary === 'cancel' ? (
                <>
                  <Button label={cancelLabel} onPress={onCancel} variant="primary" />
                  <Button
                    label={confirmLabel}
                    onPress={onConfirm}
                    variant={destructive ? 'destructive' : 'secondary'}
                  />
                </>
              ) : (
                <>
                  <Button
                    label={confirmLabel}
                    onPress={onConfirm}
                    variant={destructive ? 'destructive' : 'primary'}
                  />
                  <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
                </>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, justifyContent: 'center' } });
