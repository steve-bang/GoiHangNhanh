import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { toOrderSource } from '@/core/orders/order-source';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  FilterChips,
  ProductLineList,
  Screen,
  Text,
  useTheme,
  type ChipOption,
  type ProductLine,
} from '@/shared/ui';

/**
 * UI-C01 Xem nhanh đơn trước khi quay (đặc tả A03): màn này vừa là chỗ nhìn lại đơn để phát hiện
 * quét nhầm, vừa là nút Bắt đầu quay - KHÔNG thêm hộp thoại xác nhận riêng. Mã đơn + nguồn bán nổi
 * bật. Nhãn *Chưa khai báo sản phẩm* chỉ hiện khi chưa có dòng nào và không chặn quay. Thông tin
 * lấy từ tham số route do màn tạo đơn nhanh truyền sang (dữ liệu người dùng nhập, chưa lưu).
 * "Bắt đầu quay" sau này là bước tạo phiên (ID phiên + kiện được tạo TRƯỚC khi mở camera).
 */
export function OrderPreviewScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const [packageIndex, setPackageIndex] = useState('1');
  const [packageCount, setPackageCount] = useState(1);

  const orderCode = params.code ?? '';
  const sourceKey = toOrderSource(params.source);
  const lines: ProductLine[] = params.name
    ? [
        {
          id: 'entered-line-1',
          name: params.name,
          ...(params.variant ? { variant: params.variant } : {}),
          quantity: Number(params.quantity ?? '1') || 1,
        },
      ]
    : [];

  const packageOptions: ChipOption<string>[] = Array.from({ length: packageCount }, (_, i) => ({
    key: String(i + 1),
    label: t('screens:preview.package', { index: i + 1 }),
  }));

  return (
    <Screen
      title={t('nav:titles.UI-C01')}
      onBack={navigation.back}
      inTabs
      testID="screen-UI-C01"
      footer={
        <Button
          icon="camera"
          label={t('screens:preview.startRecording')}
          onPress={() =>
            navigation.push(ROUTES.packRecord, { code: orderCode, package: packageIndex })
          }
        />
      }
    >
      <Card tone="brand">
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="textMuted">
            {t('screens:preview.orderCode')}
          </Text>
          <Text variant="screenTitle">{orderCode}</Text>
          <Text bold>{t(`common:sources.${sourceKey}`)}</Text>
          {params.tracking ? (
            <Text color="textMuted">{`${t('screens:preview.trackingCode')}: ${params.tracking}`}</Text>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: spacing.md }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('screens:preview.products')}
        </Text>
        <ProductLineList lines={lines} />
        {lines.length === 0 ? (
          <Text color="textMuted">{t('screens:preview.undeclaredHint')}</Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="sectionTitle" accessibilityRole="header">
          {t('screens:preview.packages')}
        </Text>
        <FilterChips
          options={packageOptions}
          selectedKey={packageIndex}
          onSelect={setPackageIndex}
        />
        <Button
          variant="secondary"
          icon="add"
          label={t('screens:preview.addPackage')}
          onPress={() => setPackageCount((count) => count + 1)}
        />
      </View>
    </Screen>
  );
}
