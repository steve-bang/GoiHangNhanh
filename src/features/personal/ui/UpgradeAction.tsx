import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button, Text, useTheme } from '@/shared/ui';

/**
 * Nút "Nâng cấp gói" bị KHÓA: chưa có thanh toán (O-16, Q-21c), nên không điều hướng và có dòng giải thích
 * "Sắp có". Nút vô hiệu được trình đọc màn hình báo là không dùng được; dòng chữ nêu lý do.
 */
export function UpgradeAction({
  variant,
  testID,
}: {
  variant: 'primary' | 'secondary';
  testID: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <View style={{ gap: tokens.space.xs }}>
      <Button
        label={t('personal:planScreen.upgradeAction')}
        variant={variant}
        disabled
        accessibilityHint={t('personal:planScreen.upgradeSoon')}
        onPress={() => undefined}
        testID={testID}
      />
      <Text variant="caption" color="textMuted" testID={`${testID}-soon`}>
        {t('personal:planScreen.upgradeSoon')}
      </Text>
    </View>
  );
}
