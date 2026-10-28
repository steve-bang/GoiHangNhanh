import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { Card, Icon, IconTile, ListGroup, ListItem, Screen, Text, useTheme } from '@/shared/ui';
import type { IconName } from '@/shared/ui';

const ROWS: readonly { key: 'videoPack' | 'photoDelivery' | 'photoReturn'; icon: IconName }[] = [
  { key: 'videoPack', icon: 'camera' },
  { key: 'photoDelivery', icon: 'package' },
  { key: 'photoReturn', icon: 'returns' },
];

/**
 * Chi tiết thời hạn lưu (PER-12; board 07 khung 12), route con của UI-I01 (Q-21b). Thời hạn lưu theo gói và
 * chưa có nguồn dữ liệu gói (O-06, O-16): tên gói và từng loại bằng chứng là "Chưa có thông tin", KHÔNG "Gói
 * tiêu chuẩn", ngày hay số ngày giả. Thẻ ghi chú KHÔNG hứa "dữ liệu vẫn xem được trên thiết bị" (D19: docs/06
 * chưa chốt xử lý khi hết hạn và bản cục bộ); chỉ nêu điều đã có trong docs/06 (giữ khi tranh chấp, hạ cấp
 * không xóa ngay).
 */
export function RetentionDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const noInfo = t('personal:retentionDetail.noInfo');
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
      <ListGroup>
        {ROWS.map(({ key, icon }) => {
          const title = t(`personal:retentionDetail.${key}`);
          return (
            <ListItem
              key={key}
              leadingIcon={icon}
              title={title}
              titleWeight="regular"
              accessibilityLabel={`${title}: ${noInfo}`}
              trailing={
                <Text color="textMuted" variant="caption">
                  {noInfo}
                </Text>
              }
              testID={`retention-row-${key}`}
            />
          );
        })}
      </ListGroup>
      <Card compact testID="retention-note">
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.sm }}>
          <Icon name="info" size={18} color={tokens.color.accent.blue.fg} />
          <Text variant="caption" style={{ flex: 1, flexShrink: 1 }}>
            {t('personal:retentionDetail.note')}
          </Text>
        </View>
      </Card>
    </Screen>
  );
}
