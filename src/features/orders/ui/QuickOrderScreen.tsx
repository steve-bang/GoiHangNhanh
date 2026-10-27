import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { ORDER_SOURCES, type OrderSource } from '@/core/orders/order-source';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  FilterChips,
  QuantityStepper,
  Screen,
  SourceIcon,
  Text,
  TextField,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

/**
 * Bước sau khi tạo đơn nhanh. O-19 (số màn trước camera) CHƯA chốt: tạm đi qua Xem nhanh đơn
 * (UI-C01) như đặc tả A02 -> A03. Khi O-19 chốt (ví dụ bỏ hẳn bước này cho đơn vừa tạo) chỉ đổi hằng số này.
 */
const AFTER_CREATE_ROUTE = ROUTES.orderPreview;

/**
 * UI-B04 Tạo hồ sơ đơn nhanh (đặc tả A02). Dữ liệu tối giản: mã đơn + nguồn bán (+ mã vận đơn) để
 * định danh; sản phẩm/variant/số lượng chỉ để đối chiếu, KHÔNG bắt buộc (D-10). Nguồn bán mặc định
 * "Khác / chưa xác định" thay vì đoán. Số lượng mặc định 1 (docs/09 mục 5.5, A.8). Tên và variant là
 * hai trường riêng (A.7). Gợi ý theo lịch sử shop chưa có (cần dữ liệu thật). Chưa lưu gì.
 */
export function QuickOrderScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();

  const [orderCode, setOrderCode] = useState(params.code ?? '');
  const [source, setSource] = useState<OrderSource>('other');
  const [trackingCode, setTrackingCode] = useState('');
  const [productName, setProductName] = useState('');
  const [variant, setVariant] = useState('');
  const [quantity, setQuantity] = useState(1);

  const sourceOptions: ChipOption<OrderSource>[] = ORDER_SOURCES.map((key) => ({
    key,
    label: t(`common:sources.${key}`),
    leading: <SourceIcon source={key} size={22} />,
  }));
  const canSave = orderCode.trim().length > 0;

  const goNext = (withProduct: boolean) => {
    const next: Record<string, string> = { code: orderCode.trim(), source };
    if (trackingCode.trim()) next.tracking = trackingCode.trim();
    if (withProduct && productName.trim()) {
      next.name = productName.trim();
      if (variant.trim()) next.variant = variant.trim();
      next.quantity = String(quantity);
    }
    navigation.push(AFTER_CREATE_ROUTE, next);
  };

  return (
    <Screen
      title={t('nav:titles.UI-B04')}
      onBack={navigation.back}
      inTabs
      testID="screen-UI-B04"
      footer={
        <>
          <Button
            label={t('screens:quickOrder.saveAndRecord')}
            disabled={!canSave}
            onPress={() => goNext(true)}
          />
          <Button
            variant="secondary"
            label={t('screens:quickOrder.skipProducts')}
            disabled={!canSave}
            onPress={() => goNext(false)}
          />
        </>
      }
    >
      <Text color="textMuted">{t('screens:quickOrder.notFound')}</Text>
      <TextField
        testID="quick-order-code"
        label={t('screens:quickOrder.orderCode')}
        value={orderCode}
        onChangeText={setOrderCode}
        autoCapitalize="characters"
      />
      <View style={{ gap: spacing.sm }}>
        <Text bold>{t('screens:quickOrder.source')}</Text>
        <FilterChips options={sourceOptions} selectedKey={source} onSelect={setSource} />
      </View>
      <TextField
        label={t('screens:quickOrder.trackingCode')}
        value={trackingCode}
        onChangeText={setTrackingCode}
        autoCapitalize="characters"
      />
      <TextField
        label={t('screens:quickOrder.productName')}
        placeholder={t('screens:quickOrder.productNamePlaceholder')}
        value={productName}
        onChangeText={setProductName}
        autoCapitalize="sentences"
      />
      <TextField
        label={t('screens:quickOrder.variant')}
        placeholder={t('screens:quickOrder.variantPlaceholder')}
        value={variant}
        onChangeText={setVariant}
        autoCapitalize="sentences"
      />
      <View style={{ gap: spacing.sm }}>
        <Text bold>{t('screens:quickOrder.quantity')}</Text>
        <QuantityStepper value={quantity} onChange={setQuantity} />
      </View>
    </Screen>
  );
}
