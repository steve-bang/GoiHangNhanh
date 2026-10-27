import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, Screen, Text } from '@/shared/ui';

/**
 * Nội dung khi vào màn xác nhận/hoàn tất mà chưa có bộ ghi video thật (`RECORDER_ENABLED=false`),
 * ví dụ mở bằng liên kết sâu: chưa có tệp nào nên KHÔNG hiện trạng thái "đã lưu" hay thông báo
 * "video đã lưu" (bất biến 3, 11). Chỉ nói đúng điều đang xảy ra và cho đường quay về.
 */
export function PackNotRecorded({
  title,
  testID,
  message,
}: {
  title: string;
  testID: string;
  message: string;
}) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={title}
      testID={testID}
      onBack={navigation.back}
      footer={
        <Button
          label={t('screens:confirm.backHome')}
          onPress={() => navigation.replace(ROUTES.home)}
        />
      }
    >
      <Card tone="warning" testID="pack-not-recorded">
        <Text accessibilityRole="alert">{message}</Text>
      </Card>
    </Screen>
  );
}
