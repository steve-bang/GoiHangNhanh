import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './theme';

interface CameraPermissionSheetProps {
  visible: boolean;
  /** `blocked`: đã từ chối hẳn, chỉ bật lại được trong Cài đặt; `askable`: có thể xin lại. */
  status: 'askable' | 'blocked';
  onClose: () => void;
  onRequest: () => void;
  onOpenSettings: () => void;
  /** `scan`: quét mã (mặc định); `record`: xem trước/quay từ UI-C01. Quyết định tiêu đề và câu khi bị chặn. */
  purpose?: 'scan' | 'record';
  /** Lý do xin quyền theo ngữ cảnh (quét mã khác xem trước khi quay); mặc định là lý do của màn quét. */
  reason?: string;
  testID?: string;
  allowTestID?: string;
}

/**
 * Hộp thoại xin quyền camera dùng chung (màn quét UI-B02, bắt đầu quay từ UI-C01). Không tự gọi
 * hệ điều hành: nơi dùng truyền hành động, nên thay thư viện camera không đụng tới đây.
 */
export function CameraPermissionSheet({
  visible,
  status,
  onClose,
  onRequest,
  onOpenSettings,
  purpose = 'scan',
  reason,
  testID,
  allowTestID,
}: CameraPermissionSheetProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const blocked = status === 'blocked';
  const key = purpose === 'record' ? 'record' : 'scan';
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t(
        blocked
          ? 'screens:scan.permission.blockedTitle'
          : purpose === 'record'
            ? 'screens:scan.permission.recordAskTitle'
            : 'screens:scan.permission.askTitle',
      )}
    >
      <View testID={testID} style={{ gap: tokens.space.md }}>
        <Text>
          {blocked
            ? t(
                key === 'record'
                  ? 'screens:scan.permission.recordBlockedMessage'
                  : 'screens:scan.permission.blockedMessage',
              )
            : (reason ?? t('screens:scan.permission.askReason'))}
        </Text>
        <Button
          {...(allowTestID ? { testID: allowTestID } : {})}
          label={t(
            blocked ? 'screens:scan.permission.blockedAction' : 'screens:scan.permission.askAction',
          )}
          onPress={blocked ? onOpenSettings : onRequest}
        />
      </View>
    </BottomSheet>
  );
}
