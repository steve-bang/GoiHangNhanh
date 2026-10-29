import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon, Text, useTheme } from '@/shared/ui';

/**
 * Quyền lợi nêu ở UI-H01 và chi tiết gói: CHỈ các nguyên tắc lưu trữ đã có trong docs/06 (thời hạn theo gói,
 * giữ bằng chứng đang tranh chấp, hạ cấp không xóa ngay). Không nêu quyền lợi chưa có cơ sở (board 07 vẽ
 * "Hỗ trợ 24/7", "Đối chiếu đơn hàng": D2, Q-21c). Khi gói có dữ liệu thật, danh sách này do dữ liệu gói quyết.
 */
export const PLAN_BENEFIT_KEYS = ['retention', 'dispute', 'downgrade'] as const;

/** `plain`: dấu tích trần (khung 8); `circle`: dấu tích trong vòng tròn (khung 9). */
export function PlanBenefitList({ mark, testID }: { mark: 'plain' | 'circle'; testID?: string }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View testID={testID} style={{ gap: tokens.space.md }}>
      {PLAN_BENEFIT_KEYS.map((key) => (
        <View
          key={key}
          testID={`plan-benefit-${key}`}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.space.md }}
        >
          <Icon
            name={mark === 'circle' ? 'check-circle' : 'check'}
            size={20}
            color={tokens.color.brand.primary}
          />
          <Text style={{ flex: 1, flexShrink: 1 }}>{t(`personal:planScreen.benefits.${key}`)}</Text>
        </View>
      ))}
    </View>
  );
}
