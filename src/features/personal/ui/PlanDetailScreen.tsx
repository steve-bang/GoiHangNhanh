import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  Card,
  Icon,
  IconTile,
  ListGroup,
  ListItem,
  Screen,
  StatusBadge,
  Text,
  useTheme,
} from '@/shared/ui';

import { PlanBenefitList } from './PlanBenefits';
import { UpgradeAction } from './UpgradeAction';

/**
 * Chi tiết gói (PER-08; board 07 khung 9), route con của UI-H01. Cùng nguồn trung thực với UI-H01: tên gói
 * "Chưa có thông tin" + "Sắp có", quyền lợi là nguyên tắc lưu trữ chung, thời hạn lưu "Chưa có thông tin",
 * "Nâng cấp gói" khóa, không giá. Không có "Xem tất cả" (không có đích: D27). Hàng "Lịch sử thanh toán" là lối
 * vào duy nhất tới khung 10 (board không vẽ lối vào: câu hỏi cho designer, decisions.md Q-21v).
 */
export function PlanDetailScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={t('nav:subTitles.planDetail')}
      onBack={navigation.back}
      testID="screen-UI-H01-detail"
      contentGap={tokens.space.lg}
    >
      <Card tone="brand" testID="plan-detail-card">
        <View style={{ gap: tokens.space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
            <IconTile icon="clipboard" size="lg" />
            <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.sm }}>
              <Text variant="sectionTitle" testID="plan-detail-name">
                {t('personal:planScreen.title')}
              </Text>
              <StatusBadge label={t('personal:status.comingSoon')} testID="plan-detail-status" />
            </View>
          </View>
          <View style={{ gap: tokens.space.md }}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('personal:planScreen.detail.benefitsTitle')}
            </Text>
            <PlanBenefitList mark="circle" testID="plan-detail-benefits" />
            <Text variant="caption" color="textMuted" testID="plan-detail-note">
              {t('personal:planScreen.benefitsNote')}
            </Text>
          </View>
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="sectionTitle" accessibilityRole="header">
              {t('personal:planScreen.detail.retentionTitle')}
            </Text>
            <View
              testID="plan-detail-retention"
              style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}
            >
              <Icon name="info" size={18} color={tokens.color.text.secondary} />
              <Text color="textMuted" style={{ flex: 1, flexShrink: 1 }}>
                {t('personal:planScreen.detail.retentionValue')}
              </Text>
            </View>
          </View>
        </View>
      </Card>
      <UpgradeAction variant="primary" testID="plan-detail-upgrade" />
      <ListGroup>
        <ListItem
          leadingIcon="receipt"
          title={t('personal:planScreen.detail.historyAction')}
          titleWeight="regular"
          onPress={() => navigation.push(ROUTES.paymentHistory)}
          testID="plan-detail-history"
        />
      </ListGroup>
    </Screen>
  );
}
