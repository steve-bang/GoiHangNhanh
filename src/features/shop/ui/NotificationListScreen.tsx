import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import { EmptyState, Screen } from '@/shared/ui';

/**
 * Tab Thông báo UI-I07 (D-16: không bỏ tab). v1 KHÔNG gửi thông báo (không đẩy, không hộp thư), nên màn
 * nói đúng sự thật thay vì "Tính năng sắp có", và chỉ nơi xem lỗi tải lên thật: Trung tâm đồng bộ
 * (v1-release-plan mục 2.3, V1-10).
 */
export function NotificationListScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen title={t('nav:titles.UI-I07')} inTabs testID="screen-UI-I07">
      <EmptyState
        icon="notifications"
        title={t('screens:notificationList.title')}
        message={t('screens:notificationList.message')}
        actionLabel={t('screens:notificationList.openSync')}
        onAction={() => navigation.push(ROUTES.sync)}
      />
    </Screen>
  );
}
