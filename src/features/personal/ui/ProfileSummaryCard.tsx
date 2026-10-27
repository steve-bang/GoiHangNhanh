import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Text, useTheme } from '@/shared/ui';

import type { UserProfile } from '../domain/types';

/**
 * Thẻ hồ sơ trên UI-I01: chữ cái đầu, họ tên (hoặc "Chưa có họ tên", không bịa tên từ email) và email.
 * Chỉ đọc: sửa họ tên chờ mã UI (decisions.md Q-19k).
 */
export function ProfileSummaryCard({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Card testID="profile-summary">
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}
        accessible
        accessibilityLabel={[
          profile.displayName ?? t('personal:profile.noName'),
          profile.email,
        ].join('. ')}
      >
        <Avatar name={profile.displayName} size="lg" />
        <View style={{ flex: 1, gap: tokens.space.xs }}>
          <Text variant="sectionTitle" testID="profile-name">
            {profile.displayName ?? t('personal:profile.noName')}
          </Text>
          <Text color="textMuted" testID="profile-email">
            {profile.email}
          </Text>
        </View>
      </View>
    </Card>
  );
}
