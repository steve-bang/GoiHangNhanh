import type { ComponentProps } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './Button';
import type { IconName } from './Icon';
import { IconTile } from './IconTile';
import type { IconTone } from './tone';
import { Text } from './Text';
import { AppThemeScope, useTheme } from './theme';

interface ConfirmDialogBaseProps {
  visible: boolean;
  title: string;
  /** Nêu rõ hậu quả và dữ liệu bị ảnh hưởng (docs/09 mục 6). */
  message: string;
  cancelLabel: string;
  onCancel: () => void;
  /** Hành động xác nhận gây mất dữ liệu/khó đảo ngược: nút xác nhận màu đỏ (đỏ chỉ cho trường hợp này). */
  destructive?: boolean;
  /**
   * Nút nào là nút CHÍNH nổi bật (đặt trên cùng). Mặc định: nút an toàn (hủy) khi `destructive`,
   * ngược lại là nút xác nhận. Khi lối an toàn là "ở lại" (ví dụ rời màn quay), truyền `cancel`.
   */
  primary?: 'confirm' | 'cancel';
  /** Dòng phụ nhỏ, mờ dưới nội dung (ví dụ lời trấn an về dữ liệu). */
  detail?: string;
  /** Nút xác nhận phá hủy dạng viền/chữ đỏ (thứ yếu) thay vì nền đỏ đặc. Chỉ có tác dụng khi `destructive`. */
  confirmOutlined?: boolean;
  /** Biểu tượng tròn đầu hộp thoại; có thì tiêu đề và nội dung căn giữa (board 07). */
  icon?: IconName;
  iconTone?: IconTone;
  /** `row`: hai nút cạnh nhau (hủy bên trái, xác nhận bên phải). Mặc định `column` như cũ. */
  actionsLayout?: 'column' | 'row';
  /**
   * Nút xác nhận hiện nhưng vô hiệu (mờ, không bấm được): dùng khi hành động bị chặn nhưng người dùng cần
   * thấy việc gì đang bị chặn (board 07 khung 7c). Không có tác dụng với `hideConfirm`. Mặc định `false`.
   */
  confirmDisabled?: boolean;
  /** Mã kiểm thử cho phần nội dung và cho nút xác nhận (màn dùng cho test; không ảnh hưởng hiển thị). */
  messageTestID?: string;
  confirmTestID?: string;
}

/**
 * Hộp thoại thường có hai nút. Hộp thoại CHỈ CHẶN (không có hành động xác nhận, ví dụ "đang quay video")
 * dùng `hideConfirm`: chỉ còn nút `cancelLabel` (nút chính), không nhận `confirmLabel`/`onConfirm`.
 */
type ConfirmDialogProps = ConfirmDialogBaseProps &
  (
    | {
        /** Nhãn CỤ THỂ cho cả hai nút; cấm "OK"/"Tiếp tục" mơ hồ khi có thể nêu hành động. */
        confirmLabel: string;
        onConfirm: () => void;
        hideConfirm?: false;
      }
    | { hideConfirm: true; confirmLabel?: never; onConfirm?: never }
  );

/** Hộp thoại xác nhận, chỉ dùng cho hành động quan trọng (xóa, đóng hồ sơ, rời phiên quay). */
function ConfirmDialogBody({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  hideConfirm = false,
  confirmDisabled = false,
  messageTestID,
  confirmTestID,
  destructive = false,
  detail,
  confirmOutlined = false,
  icon,
  iconTone = 'brand',
  actionsLayout = 'column',
  primary = destructive ? 'cancel' : 'confirm',
}: ConfirmDialogProps) {
  const { tokens } = useTheme();
  const confirmIdProps = {
    ...(confirmTestID ? { testID: confirmTestID } : {}),
    ...(confirmDisabled ? { disabled: true } : {}),
  };
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
            {icon ? (
              <View style={styles.centeredBox}>
                <IconTile icon={icon} tone={iconTone} size="lg" shape="circle" />
              </View>
            ) : null}
            <Text
              variant="sectionTitle"
              accessibilityRole="header"
              {...(icon ? { style: styles.centered } : {})}
            >
              {title}
            </Text>
            <Text {...(icon ? { style: styles.centered } : {})} testID={messageTestID}>
              {message}
            </Text>
            {detail ? (
              <Text
                variant="caption"
                color="textMuted"
                {...(icon ? { style: styles.centered } : {})}
              >
                {detail}
              </Text>
            ) : null}
            {hideConfirm ? (
              <View style={{ marginTop: tokens.space.sm }}>
                <Button label={cancelLabel} onPress={onCancel} variant="primary" />
              </View>
            ) : actionsLayout === 'row' ? (
              <View
                style={[styles.actionsRow, { gap: tokens.space.sm, marginTop: tokens.space.sm }]}
              >
                <View style={styles.flexOne}>
                  <Button
                    label={cancelLabel}
                    onPress={onCancel}
                    variant={primary === 'cancel' ? 'primary' : 'secondary'}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Button
                    label={confirmLabel ?? ''}
                    {...confirmIdProps}
                    onPress={onConfirm ?? onCancel}
                    variant={
                      destructive ? 'destructive' : primary === 'confirm' ? 'primary' : 'secondary'
                    }
                    {...(destructive && confirmOutlined ? { outlined: true } : {})}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: tokens.space.sm, marginTop: tokens.space.sm }}>
                {primary === 'cancel' ? (
                  <>
                    <Button label={cancelLabel} onPress={onCancel} variant="primary" />
                    <Button
                      label={confirmLabel ?? ''}
                      {...confirmIdProps}
                      onPress={onConfirm ?? onCancel}
                      variant={destructive ? 'destructive' : 'secondary'}
                      {...(destructive && confirmOutlined ? { outlined: true } : {})}
                    />
                  </>
                ) : (
                  <>
                    <Button
                      label={confirmLabel ?? ''}
                      {...confirmIdProps}
                      onPress={onConfirm ?? onCancel}
                      variant={destructive ? 'destructive' : 'primary'}
                    />
                    <Button label={cancelLabel} onPress={onCancel} variant="secondary" />
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  centered: { textAlign: 'center' },
  centeredBox: { alignItems: 'center' },
  actionsRow: { flexDirection: 'row', alignItems: 'stretch' },
  flexOne: { flex: 1 },
});

/**
 * Luôn trong phạm vi giao diện app: thành phần này (cùng nút bên trong) có thể hiện ngoài `Screen` (màn
 * camera, hộp thoại gốc) nên tự bọc `AppThemeScope` để `Button`/`Text` nhận bảng màu của app.
 */
export function ConfirmDialog(props: ComponentProps<typeof ConfirmDialogBody>) {
  return (
    <AppThemeScope>
      <ConfirmDialogBody {...props} />
    </AppThemeScope>
  );
}
