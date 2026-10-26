import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Screen, Text, useTheme } from '@/shared/ui';

/**
 * UI-C06 Hoàn tất đóng gói (đặc tả A08). Chưa tải xong thì nói đúng: "Video đã lưu trên thiết bị,
 * đang chờ đồng bộ"; không dùng biểu tượng/màu gợi ý đã sao lưu (A08). Cho làm đơn tiếp theo ngay,
 * không chờ tải lên. KHUNG: nội dung minh họa.
 */
export function PackDoneScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={t('nav:titles.UI-C06')}
      testID="screen-UI-C06"
      illustrative
      footer={
        <>
          <Button
            label={t('screens:packDone.next')}
            onPress={() => navigation.replace(ROUTES.scan)}
          />
          <Button
            variant="secondary"
            label={t('screens:packDone.viewEvidence')}
            onPress={() => navigation.replace(ROUTES.orders)}
          />
        </>
      }
    >
      <Card>
        <View style={{ gap: spacing.sm }}>
          <Text>{t('screens:packDone.summary')}</Text>
          <Text>{`${t('screens:packDone.videoCount')}: 1`}</Text>
          <EvidenceStatusBadge status="saved_on_device" />
        </View>
      </Card>
    </Screen>
  );
}
