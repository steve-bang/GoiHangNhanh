import { useState } from 'react';
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
  testID?: string;
}

/**
 * KHUNG màn quay dùng chung cho đóng gói (UI-C03) và mở kiện hoàn (UI-D04): giao diện giống nhau
 * để giảm học (docs/09 nhóm D). Chưa có camera hay logic ghi: vùng xem trước là placeholder.
 *
 * Theo docs/09 mục 2 và docs/04 "Quy tắc chung": không có thanh tab (route nằm ngoài nhóm tab);
 * rời màn bằng nút X, nút Back hoặc cử chỉ đều đi qua hộp thoại cảnh báo; KHÔNG có nút thư viện ảnh
 * (O-02 chưa chốt), không bộ lọc/làm đẹp/chỉnh sửa.
 */
export function RecordingFrame({
  primaryCode,
  secondaryLabel,
  clockLabel,
  guidance,
  onStop,
  onEndSession,
  testID,
}: RecordingFrameProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [leaveDialogVisible, setLeaveDialogVisible] = useState(false);
  const { allowLeave } = useConfirmBeforeLeave(true, () => setLeaveDialogVisible(true));
  const touch = getMinTouchTarget();

  return (
    <View
      testID={testID}
      style={[
        styles.root,
        {
          backgroundColor: colors.cameraBackground,
          paddingTop: insets.top,
          paddingBottom: Math.max(insets.bottom, spacing.lg),
        },
      ]}
    >
      <StatusBar style="light" />
      <View style={[styles.top, { padding: spacing.lg, gap: spacing.md }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common:recording.close')}
          onPress={() => setLeaveDialogVisible(true)}
          style={[styles.close, { minWidth: touch, minHeight: touch }]}
        >
          <Icon name="close" size={28} color={colors.onCamera} />
        </Pressable>
        <View style={styles.identity}>
          <Text bold style={{ color: colors.onCamera }}>
            {primaryCode}
          </Text>
          <Text variant="caption" style={{ color: colors.onCamera }}>
            {secondaryLabel}
          </Text>
        </View>
        <View accessible accessibilityLabel={`${t('common:recording.clock')} ${clockLabel}`}>
          <Text bold style={{ color: colors.onCamera }}>
            {clockLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.preview, { padding: spacing.xl }]}>
        <Text style={[styles.previewText, { color: colors.onCamera }]}>
          {t('common:recording.cameraPlaceholder')}
        </Text>
      </View>

      <View style={[styles.bottom, { paddingHorizontal: spacing.lg, gap: spacing.lg }]}>
        <View
          style={[
            styles.guidance,
            { backgroundColor: colors.scrim, borderRadius: radius.md, padding: spacing.md },
          ]}
        >
          <Text style={[styles.previewText, { color: colors.onCamera }]}>{guidance}</Text>
        </View>
        <Pressable
          testID="recording-stop"
          accessibilityRole="button"
          accessibilityLabel={t('common:recording.stop')}
          onPress={onStop}
          style={styles.stopWrap}
        >
          <View style={[styles.stopRing, { borderColor: colors.onCamera }]}>
            <View style={[styles.stopInner, { backgroundColor: colors.onCamera }]}>
              <Icon name="stop" size={28} color={colors.cameraBackground} />
            </View>
          </View>
          <Text bold style={{ color: colors.onCamera }}>
            {t('common:recording.stop')}
          </Text>
        </Pressable>
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
  top: { flexDirection: 'row', alignItems: 'center' },
  close: { alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1 },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  previewText: { textAlign: 'center' },
  bottom: { alignItems: 'center' },
  guidance: { alignSelf: 'stretch' },
  stopWrap: { alignItems: 'center', gap: 8, minHeight: 96 },
  stopRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
