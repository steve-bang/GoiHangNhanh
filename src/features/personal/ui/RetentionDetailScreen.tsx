import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { Card, Icon, IconTile, Screen, Text, useTheme } from '@/shared/ui';

/**
 * Chi tiết thời hạn lưu (PER-12; board 07 khung 12), route con của UI-I01 (Q-21b). Câu v1 trung thực
 * (v1-release-plan.md mục 1.2, O-06/O-16; decisions.md Q-29 / V1-18): v1 miễn phí, KHÔNG có gói, KHÔNG có
 * thời hạn lưu và KHÔNG có Function tự xóa theo hạn, nên màn nói đúng điều đó thay cho "theo gói"/"Chưa có
 * thông tin". Bỏ ba hàng theo loại bằng chứng của board (không có thời hạn theo loại; "Ảnh giao hàng" không
 * có trong v1). Thẻ cảnh báo: tệp trên máy mất khi gỡ ứng dụng (Q-24a, Q-24d: không vào sao lưu hệ điều
 * hành). KHÔNG hứa "lưu vĩnh viễn".
 */
export function RetentionDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={t('nav:subTitles.retentionDetail')}
      onBack={navigation.back}
      testID="screen-UI-I01-retention"
      contentGap={tokens.space.lg}
    >
      <Card testID="retention-plan">
        <View
          accessible
          accessibilityLabel={`${t('personal:retentionDetail.planEyebrow')}: ${t('personal:retentionDetail.planName')}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}
        >
          <IconTile icon="clock" size="lg" />
          <View style={{ flex: 1, flexShrink: 1 }}>
            <Text variant="caption" color="textMuted">
              {t('personal:retentionDetail.planEyebrow')}
            </Text>
            <Text bold testID="retention-plan-name">
              {t('personal:retentionDetail.planName')}
            </Text>
          </View>
        </View>
      </Card>
      <Card compact testID="retention-note">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm }}>
          <Icon name="info" size={18} color={tokens.color.accent.blue.fg} />
          <Text variant="caption" style={{ flex: 1, flexShrink: 1 }}>
            {t('personal:retentionDetail.note')}
          </Text>
        </View>
      </Card>
      <Card compact tone="warning" testID="retention-device-note">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm }}>
          <Icon name="alert-triangle" size={18} color={tokens.color.feedback.warning.fg} />
          <Text variant="caption" style={{ flex: 1, flexShrink: 1 }}>
            {t('personal:retentionDetail.deviceNote')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
