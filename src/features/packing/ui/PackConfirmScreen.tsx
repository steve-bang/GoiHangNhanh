import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Icon, Screen, Text, useTheme } from '@/shared/ui';

import { RECORDER_ENABLED } from '../domain';
import { PackNotRecorded } from './PackNotRecorded';
import { usePackSession } from './use-pack-session';

/**
 * UI-C04 Kết thúc và xác nhận video (đặc tả A06). Chỉ có nghĩa khi đã ghi tệp thật
 * (`RECORDER_ENABLED=true`): khi đó trạng thái là *Đã lưu trên máy* (không tick, không màu thành công)
 * và thông báo "Video đã lưu trên thiết bị. Đang chờ tải lên máy chủ." (docs/09 mục 5.5, A.1). Khi chưa
 * có recorder (hiện tại) màn này KHÔNG được hiện badge hay câu "đã lưu" (chưa có tệp nào): chỉ báo
 * "chưa có video nào được lưu" (`PackNotRecorded`). Mở bằng `sessionId`; mã đơn lấy từ phiên (bất
 * biến 2). Thumbnail/thời lượng vẫn là minh họa. "Xem lại" và "Ghi thêm đoạn riêng" chưa có logic.
 */
export function PackConfirmScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const session = usePackSession();

  if (!RECORDER_ENABLED) {
    return (
      <PackNotRecorded
        title={t('nav:titles.UI-C04')}
        testID="screen-UI-C04"
        message={t('screens:confirm.nothingSaved')}
      />
    );
  }
  if (session === 'loading' || session === null) {
    return (
      <Screen title={t('nav:titles.UI-C04')} onBack={navigation.back} testID="screen-UI-C04">
        {session === null ? (
          <Text accessibilityRole="alert">{t('screens:confirm.sessionMissing')}</Text>
        ) : (
          <Text color="textMuted">{t('screens:preview.loading')}</Text>
        )}
      </Screen>
    );
  }

  return (
    <Screen
      title={t('nav:titles.UI-C04')}
      testID="screen-UI-C04"
      illustrative
      footer={
        <>
          <Button
            label={t('screens:confirm.save')}
            onPress={() => navigation.replace(ROUTES.packDone, { sessionId: session.id })}
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
          // token-exception: khung xem trước video giữ chỗ, chiều cao minh họa (chưa có video thật)
          minHeight: 180,
          backgroundColor: tokens.color.camera.background,
          borderRadius: tokens.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="camera" size={48} color={tokens.color.camera.onCamera} />
      </View>
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text>{`${t('screens:confirm.orderCode')}: ${session.snapshot.orderCode}`}</Text>
          <Text>{`${t('screens:confirm.duration')}: 00:00`}</Text>
          <EvidenceStatusBadge status="saved_on_device" />
          <Text>{t('screens:confirm.savedMessage')}</Text>
        </View>
      </Card>
    </Screen>
  );
}
