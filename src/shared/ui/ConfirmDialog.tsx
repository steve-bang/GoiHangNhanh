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
  const { tokens } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: tokens.color.overlay.scrim, padding: tokens.space.xl },
        ]}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: tokens.color.surface.raised,
            borderRadius: tokens.radius.lg,
            padding: tokens.space.xl,
            maxHeight: '90%',
          }}
        >
          <ScrollView contentContainerStyle={{ gap: tokens.space.md }}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {title}
            </Text>
            <Text>{message}</Text>
            <View style={{ gap: tokens.space.sm, marginTop: tokens.space.sm }}>
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
