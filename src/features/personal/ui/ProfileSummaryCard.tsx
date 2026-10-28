import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { Avatar, Card, ListItem } from '@/shared/ui';

import type { UserProfile } from '../domain/types';

/**
 * Thẻ hồ sơ trên UI-I01 (board 1a): chữ cái đầu, họ tên (in đậm), email; bấm mở Sửa họ tên (route
 * con, decisions.md Q-20k). Chỉ dùng khi ĐÃ có họ tên; chưa có thì màn dùng `ProfileNoName` (khung
 * 1e, Q-21e). KHÔNG hiện huy hiệu "Đã xác thực": hồ sơ chưa có dữ liệu xác thực email (Q-21m).
 */
export function ProfileSummaryCard({
  profile,
}: {
  profile: UserProfile & { readonly displayName: string };
}) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Card flush testID="profile-card">
      <ListItem
        leading={<Avatar name={profile.displayName} size="lg" />}
        title={profile.displayName}
        subtitle={profile.email}
        accessibilityHint={t('personal:profile.editHint')}
        onPress={() => navigation.push(ROUTES.editProfile)}
        testID="profile-summary"
      />
    </Card>
  );
}
