import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { ListItem, StatusBadge } from '@/shared/ui';

import type { MenuItem } from './account-menu';

/**
 * Một hàng menu của tab Cá nhân. Mục `coming_soon` bị khóa: không điều hướng, hiện nhãn "Sắp có" và
 * được đọc là "không dùng được" (đọc đủ tên + trạng thái, không chỉ dựa vào màu mờ).
 */
export function MenuRow({ item }: { item: MenuItem }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const label = t(item.labelKey);
  const soon = item.availability === 'coming_soon';
  const soonLabel = t('personal:status.comingSoon');
  return (
    <ListItem
      leadingIcon={item.icon}
      title={label}
      titleWeight="regular"
      onPress={() => navigation.push(item.route)}
      disabled={soon}
      showChevron={!soon}
      {...(soon
        ? {
            trailing: <StatusBadge label={soonLabel} />,
            accessibilityLabel: `${label}. ${soonLabel}`,
          }
        : {})}
      testID={`menu-${item.route.code}`}
    />
  );
}
