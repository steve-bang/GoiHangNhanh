import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { copyText } from '@/platform';
import { Text, useToast } from '@/shared/ui';
import { layout } from '@/core/theme';

import { CopyButton } from './CopyButton';

/**
 * Mã đơn + nút sao chép (ORD-07). Báo bằng thông báo ngắn CHỈ sau khi sao chép xong thật; lỗi báo rõ.
 * Mã đơn chỉ là chuỗi hiển thị/tìm kiếm, không phải ID (bất biến 1).
 */
export function CopyableOrderCode({ orderCode }: { orderCode: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const copy = async () => {
    if (await copyText(orderCode)) {
      toast.show(t('screens:orderDetail.copiedOrderCode'), { tone: 'success' });
    } else {
      toast.show(t('screens:preview.copyFailed'), { tone: 'error' });
    }
  };
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text variant="formLabel" color="inkMuted">
          {t('screens:orderDetail.orderCode')}
        </Text>
        <Text variant="formTitle" accessibilityRole="text" testID="detail-order-code">
          {orderCode}
        </Text>
      </View>
      <CopyButton
        testID="copy-order-code"
        label={t('screens:orderDetail.copyOrderCode')}
        onPress={() => void copy()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
});
