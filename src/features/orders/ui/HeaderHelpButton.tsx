import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Icon, useTheme } from '@/shared/ui';

/** Nút `?` ở góc phải tiêu đề: mở Trợ giúp (mockup 03). */
export function HeaderHelpButton() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useAppNavigation();
  const touch = getMinTouchTarget();
  return (
    <Pressable
      testID="header-help"
      accessibilityRole="button"
      accessibilityLabel={t('screens:preview.help')}
      onPress={() => navigation.push(ROUTES.help)}
      style={{ minWidth: touch, minHeight: touch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name="help" size={26} color={colors.text} />
    </Pressable>
  );
}
