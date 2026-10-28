import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Button, Card, Screen, StatusBadge, Text, useTheme } from '@/shared/ui';

import { PlanBenefitList } from './PlanBenefits';
import { UpgradeAction } from './UpgradeAction';

/**
 * UI-H01 Gói dịch vụ (PER-08; board 07 khung 8). Chưa có nguồn dữ liệu gói (O-06, O-16) nên tên gói và
 * thời hạn là "Chưa có thông tin", huy hiệu "Sắp có"; KHÔNG bịa "Gói tiêu chuẩn"/"Đang hoạt động" (D2, Q-21c).
 * "Quyền lợi" chỉ nêu nguyên tắc lưu trữ đã có trong docs/06. "Chi tiết gói" mở route con; "Nâng cấp gói" khóa
 * vì chưa có thanh toán (D3). Khi có dữ liệu gói thật, thêm `getSubscription` vào `AccountGateway` rồi thay các
 * giá trị tĩnh ở đây; các trạng thái hết hạn/sắp hết hạn chỉ dựng khi có ngày thật (D12).
 */
export function PlanScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const soon = t('personal:status.comingSoon');
  return (
    <Screen
      title={t('nav:titles.UI-H01')}
      onBack={navigation.back}
      testID="screen-UI-H01"
      contentGap={tokens.space.lg}
    >
      <Card testID="plan-current-card">
        <View style={{ gap: tokens.space.lg }}>
          <View style={{ gap: tokens.space.xs }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: tokens.space.md,
              }}
            >
              <Text variant="sectionTitle" style={{ flex: 1, flexShrink: 1 }} testID="plan-name">
                {t('personal:planScreen.title')}
              </Text>
              <StatusBadge label={soon} testID="plan-status" />
            </View>
            <Text color="textMuted" testID="plan-retention">
              {t('personal:planScreen.retention')}
            </Text>
          </View>
          <View style={{ gap: tokens.space.md }}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('personal:planScreen.benefitsTitle')}
            </Text>
            <PlanBenefitList mark="plain" testID="plan-benefits" />
            <Text variant="caption" color="textMuted" testID="plan-benefits-note">
              {t('personal:planScreen.benefitsNote')}
            </Text>
          </View>
        </View>
      </Card>
      <View style={{ gap: tokens.space.md }}>
        <Button
          label={t('personal:planScreen.detailAction')}
          onPress={() => navigation.push(ROUTES.planDetail)}
          testID="plan-detail-action"
        />
        <UpgradeAction variant="secondary" testID="plan-upgrade" />
      </View>
    </Screen>
  );
}
