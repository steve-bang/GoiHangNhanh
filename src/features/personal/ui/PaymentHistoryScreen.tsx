import { useTranslation } from 'react-i18next';

import { useAppNavigation } from '@/platform';
import { EmptyState, Screen } from '@/shared/ui';

/**
 * Lịch sử thanh toán (PER-10; board 07 khung 10), route con của UI-H01. Ứng dụng chưa có thanh toán (O-16)
 * nên luôn trống: KHÔNG hóa đơn, nút tải hóa đơn hay giao dịch giả. Khi có nhà cung cấp thanh toán, danh sách
 * lấy từ kết quả thật của nhà cung cấp (docs/09 UI-H03).
 */
export function PaymentHistoryScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen
      title={t('nav:subTitles.paymentHistory')}
      onBack={navigation.back}
      testID="screen-UI-H01-payments"
    >
      <EmptyState
        icon="receipt"
        title={t('personal:planScreen.payments.emptyTitle')}
        message={t('personal:planScreen.payments.emptyMessage')}
      />
    </Screen>
  );
}
