import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { ROUTES } from '@/core/navigation';
import { Avatar, ListItem } from '@/shared/ui';

import type { UserProfile } from '../domain/types';

/**
 * Hàng hồ sơ trên UI-I01: chữ cái đầu, họ tên (in đậm) và email; bấm mở Sửa họ tên (route con,
 * decisions.md Q-19k). Chưa có họ tên thì tiêu đề là lời mời "Thêm họ tên" (màu hành động), không bịa
 * tên từ email. Đặt trong `ListGroup`.
 */
export function ProfileSummaryCard({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const hasName = profile.displayName !== null;
  return (
    <ListItem
      leading={<Avatar name={profile.displayName} size="lg" />}
      title={profile.displayName ?? t('personal:profile.addName')}
      subtitle={profile.email}
      actionTitle={!hasName}
      accessibilityHint={t('personal:profile.editHint')}
      onPress={() => navigation.push(ROUTES.editProfile)}
      testID="profile-summary"
    />
  );
}
