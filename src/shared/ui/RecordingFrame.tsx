import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getMinTouchTarget, useConfirmBeforeLeave } from '@/platform';

import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface RecordingFrameProps {
  /** Mã đơn/hồ sơ hiển thị cố định trên màn quay (chỉ để nhìn; liên kết thật dùng ID phiên). */
  primaryCode: string;
  /** Kiện hoặc loại hồ sơ. */
  secondaryLabel: string;
  clockLabel: string;
  guidance: string;
  /** Người dùng chọn "Dừng quay". */
  onStop: () => void;
  /** Người dùng xác nhận "Kết thúc phiên" trong hộp thoại cảnh báo rời màn. */
  onEndSession: () => void;
  /** Hình xem trước camera (`CameraPreview`), vẽ kín nền phía sau. Không có thì hiện `previewMessage`. */
  preview?: ReactNode;
  /** Chữ thay cho hình xem trước khi chưa có camera (mặc định: khung minh họa). */
  previewMessage?: string;
  /** Huy hiệu "Đang quay" (chấm đỏ + nhãn + đồng hồ). Chỉ truyền khi thật sự đang ghi, hoặc kèm `notice`. */
  badgeLabel?: string;
  /**
   * Dải báo trung thực dưới thanh trên (ví dụ "Bản thử giao diện: chưa ghi video"). Bắt buộc dùng
   * khi giao diện giống đang quay mà chưa ghi tệp (bất biến 3, 11; docs/04 A05).
   */
  notice?: string;
  /** Có `onToggleTorch` thì hiện nút đèn pin ở bên phải. */
  torch?: boolean;
  onToggleTorch?: () => void;
  testID?: string;
}

/**
 * Khung màn quay dùng chung cho đóng gói (UI-C03) và mở kiện hoàn (UI-D04) theo mockup 03: nền là
 * camera xem trước, nút X góc trái, thanh trên (huy hiệu + đồng hồ, mã đơn + kiện), đèn pin bên phải,
 * ô hướng dẫn mờ, nút dừng đỏ lớn ở giữa.
 *
 * Theo docs/09 mục 2 và docs/04 "Quy tắc chung": không có thanh tab (route nằm ngoài nhóm tab); rời
 * màn bằng nút X, nút Back hoặc cử chỉ đều đi qua hộp thoại cảnh báo; KHÔNG có nút thư viện ảnh
 * (O-02 chưa chốt) và không nút chụp ảnh (không có đặc tả), không bộ lọc/làm đẹp/chỉnh sửa.
 */
export function RecordingFrame({
  primaryCode,
  secondaryLabel,
  clockLabel,
  guidance,
  onStop,
  onEndSession,
  preview,
  previewMessage,
  badgeLabel,
  notice,
  torch = false,
  onToggleTorch,
  testID,
}: RecordingFrameProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
  const { allowLeave } = useConfirmBeforeLeave(true, () => setLeaveDialogVisible(true));
  const touch = getMinTouchTarget();
  const overlay = { backgroundColor: colors.cameraControl, borderRadius: radius.md } as const;

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.cameraBackground }]}>
      <StatusBar style="light" />
      <View style={StyleSheet.absoluteFill}>{preview}</View>

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={[styles.top, { gap: spacing.sm }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common:recording.close')}
            onPress={() => setLeaveDialogVisible(true)}
            style={[styles.close, { minWidth: touch, minHeight: touch }]}
          >
            <Icon name="close" size={28} color={colors.onCamera} />
          </Pressable>
          <View
            accessible
            accessibilityLabel={`${badgeLabel ? `${badgeLabel}, ` : ''}${t('common:recording.clock')} ${clockLabel}`}
            style={[
              styles.badge,
              overlay,
              { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.sm },
            ]}
          >
            {badgeLabel ? (
              <>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <Text variant="overlay" style={{ color: colors.onCamera }}>
                  {badgeLabel}
                </Text>
              </>
            ) : null}
            <Text variant="overlay" style={{ color: colors.onCamera }}>
              {clockLabel}
            </Text>
          </View>
          <View style={styles.spacer} />
          <View
            testID="recording-identity"
            style={[
              styles.identity,
              overlay,
              { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs + 2 },
            ]}
          >
            {primaryCode ? (
              <Text
                variant="overlay"
                numberOfLines={1}
                ellipsizeMode="middle"
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={{ color: colors.onCamera }}
              >
                {primaryCode}
              </Text>
            ) : null}
            <Text
              variant="overlay"
              numberOfLines={1}
              style={{ color: colors.onCamera, fontWeight: '400' }}
            >
              {secondaryLabel}
            </Text>
          </View>
        </View>

        {notice ? (
          <View
            testID="recording-notice"
            accessibilityRole="alert"
            style={[
              styles.notice,
              {
                backgroundColor: colors.warningSoft,
                borderRadius: radius.md,
                padding: spacing.sm,
                gap: spacing.sm,
                marginTop: spacing.sm,
              },
            ]}
          >
            <Icon name="info" size={18} color={colors.warning} />
            <Text variant="caption" bold style={[styles.noticeText, { color: colors.warning }]}>
              {notice}
            </Text>
          </View>
        ) : null}

        <View style={styles.middle}>
          {onToggleTorch ? (
            <Pressable
              testID="recording-torch"
              accessibilityRole="button"
              accessibilityState={{ selected: torch }}
              accessibilityLabel={t(torch ? 'screens:record.torchOff' : 'screens:record.torchOn')}
              onPress={onToggleTorch}
              style={[
                styles.torch,
                overlay,
                { width: Math.max(touch, 48), height: Math.max(touch, 48) },
              ]}
            >
              <Icon name={torch ? 'flash' : 'flash-off'} size={24} color={colors.onCamera} />
            </Pressable>
          ) : null}
          {!preview ? (
            <Text style={[styles.previewText, { color: colors.onCamera }]}>
              {previewMessage ?? t('common:recording.cameraPlaceholder')}
            </Text>
          ) : null}
        </View>

        <View style={[styles.bottom, { gap: spacing.lg }]}>
          <View
            style={[
              styles.guidance,
              { backgroundColor: colors.scrim, borderRadius: radius.md, padding: spacing.md },
            ]}
          >
            <Text variant="formBody" style={[styles.previewText, { color: colors.onCamera }]}>
              {guidance}
            </Text>
          </View>
          <Pressable
            testID="recording-stop"
            accessibilityRole="button"
            accessibilityLabel={t('common:recording.stop')}
            onPress={onStop}
            style={styles.stopWrap}
          >
            <View style={[styles.stopRing, { borderColor: colors.onCamera }]}>
              <View style={[styles.stopInner, { backgroundColor: colors.danger }]}>
                <Icon name="stop" size={28} color={colors.onCamera} />
              </View>
            </View>
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        visible={leaveDialogVisible}
        title={t('common:recording.leave.title')}
        message={t('common:recording.leave.message')}
        confirmLabel={t('common:recording.leave.end')}
        cancelLabel={t('common:recording.leave.keep')}
        primary="cancel"
        onCancel={() => setLeaveDialogVisible(false)}
        onConfirm={() => {
          setLeaveDialogVisible(false);
          allowLeave();
          onEndSession();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center' },
  close: { alignItems: 'center', justifyContent: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  spacer: { flex: 1 },
  identity: { flexShrink: 1, maxWidth: 160 },
  notice: { flexDirection: 'row', alignItems: 'center' },
  noticeText: { flex: 1 },
  middle: { flex: 1, alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 12 },
  torch: { alignItems: 'center', justifyContent: 'center' },
  previewText: { textAlign: 'center', alignSelf: 'stretch' },
  bottom: { alignItems: 'center' },
  guidance: { alignSelf: 'stretch' },
  stopWrap: { alignItems: 'center', minHeight: 88, justifyContent: 'center' },
  stopRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
