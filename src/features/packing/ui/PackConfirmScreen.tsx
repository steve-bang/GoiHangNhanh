import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useRouteParams } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Icon, Screen, Text, useTheme } from '@/shared/ui';

/**
 * UI-C04 Kết thúc và xác nhận video (đặc tả A06). Trạng thái hiện là *Đã lưu trên máy* (không tick,
 * không màu thành công) và thông báo đúng điều đang xảy ra: "Video đã lưu trên thiết bị. Đang chờ
 * tải lên máy chủ." (docs/09 mục 5.5, A.1). KHUNG: chưa có video; thumbnail/thời lượng là minh họa.
 * "Xem lại" và "Ghi thêm đoạn riêng" chưa có logic nên đang tắt.
 */
export function PackConfirmScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();

  return (
    <Screen
      title={t('nav:titles.UI-C04')}
      testID="screen-UI-C04"
      illustrative
      footer={
        <>
          <Button
            label={t('screens:confirm.save')}
            onPress={() =>
              navigation.replace(ROUTES.packDone, params.code ? { code: params.code } : {})
            }
          />
          <Button
            variant="secondary"
            label={t('screens:confirm.review')}
            onPress={() => undefined}
            disabled
          />
          <Button
            variant="secondary"
            label={t('screens:confirm.addSegment')}
            onPress={() => undefined}
            disabled
          />
        </>
      }
    >
      <View
        accessible
        accessibilityLabel={t('screens:confirm.thumbnail')}
        style={{
          minHeight: 180,
          backgroundColor: colors.cameraBackground,
          borderRadius: radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={48} color={colors.onCamera} />
      </View>
      <Card>
        <View style={{ gap: spacing.sm }}>
          {params.code ? <Text>{`${t('screens:confirm.orderCode')}: ${params.code}`}</Text> : null}
          <Text>{`${t('screens:confirm.duration')}: 00:00`}</Text>
          <EvidenceStatusBadge status="saved_on_device" />
          <Text>{t('screens:confirm.savedMessage')}</Text>
        </View>
      </Card>
    </Screen>
  );
}
