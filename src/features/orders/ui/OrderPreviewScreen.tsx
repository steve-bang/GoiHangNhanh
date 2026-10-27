import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId, OrderLineId, PackageId } from '@/core/ids';
import {
  copyText,
  getMinTouchTarget,
  newPackageId,
  useAppNavigation,
  useRouteParams,
} from '@/platform';
import {
  Button,
  Card,
  FilterChips,
  Icon,
  ProductLineList,
  QuantityStepper,
  Screen,
  Skeleton,
  SourceIcon,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

import { useCurrentShopId, useOrderStore } from '../data';
import { buildNextPackage, type OrderDetails, type PackingSession } from '../domain';
import { CopyButton } from './CopyButton';
import { HeaderHelpButton } from './HeaderHelpButton';
import { useStartPacking } from './use-start-packing';

type CopyTarget = 'orderCode' | 'trackingCode';

/**
 * UI-C01 Xác nhận đơn trước khi quay (đặc tả A03; mockup 03). Mở bằng ID đơn nội bộ (`orderId`), mã
 * đơn chỉ để hiển thị (bất biến 1). Màn này vừa là chỗ nhìn lại đơn để phát hiện quét nhầm, vừa là
 * nút bắt đầu: KHÔNG thêm hộp thoại xác nhận riêng. Nhãn *Chưa khai báo sản phẩm* CHỈ khi chưa có
 * dòng nào (docs/09 5.5 A.6) và không chặn quay. Sửa số lượng ngay trên dòng; mỗi kiện có ID riêng.
 * Bắt đầu = xin quyền camera nếu thiếu, tạo phiên + ảnh chụp đơn, rồi mới sang màn quay.
 */
export function OrderPreviewScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const start = useStartPacking();
  const touch = getMinTouchTarget();
  const orderId = params.orderId as OrderId | undefined;

  const [state, setState] = useState<
    | { kind: 'loading' }
    | { kind: 'notFound' }
    | { kind: 'error'; code: ErrorCode }
    | { kind: 'ready'; details: OrderDetails; sessions: PackingSession[] }
  >({ kind: 'loading' });
  const [packageId, setPackageId] = useState<PackageId | null>(null);
  const [editError, setEditError] = useState<ErrorCode | null>(null);
  const [copied, setCopied] = useState<CopyTarget | 'failed' | null>(null);
  const editing = useRef(false);

  const load = useCallback(async () => {
    if (!orderId) {
      setState({ kind: 'notFound' });
      return null;
    }
    try {
      const details = await store.getOrder(shopId, orderId);
      if (!details) {
        setState({ kind: 'notFound' });
        return null;
      }
      const sessions = await store.listSessionsOfOrder(shopId, orderId);
      setState({ kind: 'ready', details, sessions });
      return details;
    } catch (caught) {
      setState({
        kind: 'error',
        code: isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED',
      });
      return null;
    }
  }, [orderId, shopId, store]);

  useEffect(() => {
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tải đơn từ kho cục bộ khi mở màn
    void load().then((details) => {
      if (alive && details) setPackageId((current) => current ?? details.packages[0]?.id ?? null);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  const copy = async (target: CopyTarget, text: string) => {
    const ok = await copyText(text);
    setCopied(ok ? target : 'failed');
  };

  const changeQuantity = async (lineId: OrderLineId, quantity: number) => {
    if (editing.current) return;
    editing.current = true;
    setEditError(null);
    try {
      await store.updateLineQuantity(shopId, lineId, quantity);
      await load();
    } catch (caught) {
      setEditError(isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED');
      // đơn vừa có phiên ở nơi khác: tải lại để khóa bộ chỉnh số lượng
      await load();
    } finally {
      editing.current = false;
    }
  };

  const addPackage = async (details: OrderDetails) => {
    if (editing.current) return;
    editing.current = true;
    setEditError(null);
    try {
      const pkg = buildNextPackage(details, {
        ids: { packageId: newPackageId },
        nowDevice: Date.now(),
      });
      await store.addPackage(shopId, pkg);
      await load();
      setPackageId(pkg.id);
    } catch (caught) {
      setEditError(isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED');
    } finally {
      editing.current = false;
    }
  };

  const header = {
    title: t('nav:titles.UI-C01'),
    onBack: navigation.back,
    headerRight: <HeaderHelpButton />,
    testID: 'screen-UI-C01',
    form: true,
  };

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <Text accessibilityLiveRegion="polite" color="textMuted">
          {t('screens:preview.loading')}
        </Text>
        <Skeleton height={96} />
      </Screen>
    );
  }
  if (state.kind !== 'ready') {
    return (
      <Screen {...header}>
        <Text accessibilityRole="alert" testID="preview-unavailable">
          {t(state.kind === 'notFound' ? 'screens:preview.notFound' : `errors:${state.code}`)}
        </Text>
      </Screen>
    );
  }

  const { details, sessions } = state;
  // Đơn đã có phiên: số lượng chỉ đọc (kho cũng từ chối; chưa có lịch sử thay đổi, bất biến 7).
  const quantityLocked = sessions.length > 0;
  const { order, lines, packages } = details;
  const packageOptions: ChipOption<PackageId>[] = packages.map((p) => ({
    key: p.id,
    label: t('screens:preview.package', { index: p.index }),
  }));
  const selectedPackage = packageId ?? packages[0]?.id ?? null;

  return (
    <Screen
      {...header}
      footer={
        <>
          {start.error || editError ? (
            <Card tone="danger" testID="preview-error">
              <Text accessibilityRole="alert">
                {t(`errors:${start.error ?? editError ?? 'ORDER_SAVE_FAILED'}`)}
              </Text>
            </Card>
          ) : null}
          <Button
            testID="preview-start"
            size="compact"
            label={t('screens:preview.startRecording')}
            disabled={!selectedPackage}
            loading={start.busy}
            onPress={() => {
              if (selectedPackage) start.begin(order.id, selectedPackage);
            }}
          />
        </>
      }
    >
      {params.notice === 'not_recorded' ? (
        <Card tone="warning" testID="preview-not-recorded">
          <Text accessibilityRole="alert">{t('screens:preview.notRecordedNotice')}</Text>
        </Card>
      ) : null}

      <View
        accessibilityRole="summary"
        style={[
          styles.banner,
          {
            backgroundColor: colors.successSoft,
            borderColor: colors.success,
            borderRadius: radius.md,
            padding: spacing.md,
            gap: spacing.md,
          },
        ]}
      >
        <Icon name="check-circle" size={26} color={colors.success} />
        <View style={styles.flex}>
          <Text variant="formButton" style={{ color: colors.success }}>
            {t('screens:preview.banner.title')}
          </Text>
          <Text variant="caption" color="inkMuted">
            {t('screens:preview.banner.message')}
          </Text>
        </View>
      </View>

      <Card style={{ borderColor: colors.fieldBorder }}>
        <View style={{ gap: spacing.md }}>
          <View style={styles.copyRow}>
            <View style={styles.flex}>
              <Text variant="formLabel" color="inkMuted">
                {t('screens:preview.orderCode')}
              </Text>
              <Text
                variant="formTitle"
                accessibilityRole="text"
                color="ink"
                testID="preview-order-code"
              >
                {order.orderCode}
              </Text>
            </View>
            <CopyButton
              testID="copy-order-code"
              label={t('screens:preview.copyOrderCode')}
              onPress={() => void copy('orderCode', order.orderCode)}
            />
          </View>
          <View style={[styles.copyRow, { gap: spacing.sm }]}>
            <SourceIcon source={order.source} size={28} />
            <View style={styles.flex}>
              <Text variant="caption" color="ink">
                {t('screens:preview.source')}
              </Text>
              <Text variant="formButton" color="ink">
                {t(`common:sources.${order.source}`)}
              </Text>
            </View>
          </View>
          {order.trackingCode ? (
            <View style={styles.copyRow}>
              <View style={styles.flex}>
                <Text variant="formLabel" color="inkMuted">
                  {t('screens:preview.trackingCode')}
                </Text>
                <Text variant="formTitle" accessibilityRole="text" color="ink">
                  {order.trackingCode}
                </Text>
              </View>
              <CopyButton
                testID="copy-tracking-code"
                label={t('screens:preview.copyTrackingCode')}
                onPress={() => void copy('trackingCode', order.trackingCode ?? '')}
              />
            </View>
          ) : null}
          {copied ? (
            <Text
              testID="copy-feedback"
              variant="caption"
              color={copied === 'failed' ? 'danger' : 'success'}
              accessibilityLiveRegion="polite"
            >
              {t(copied === 'failed' ? 'screens:preview.copyFailed' : 'screens:preview.copied')}
            </Text>
          ) : null}
        </View>
      </Card>

      <View style={{ gap: spacing.md }}>
        <Text variant="formTitle" accessibilityRole="header" color="ink">
          {t('screens:preview.products')}
        </Text>
        {lines.length === 0 ? (
          <>
            <ProductLineList lines={[]} />
            <Text variant="formBody" color="inkMuted">
              {t('screens:preview.undeclaredHint')}
            </Text>
          </>
        ) : (
          <>
            {quantityLocked ? (
              <Text variant="caption" color="inkMuted" testID="preview-quantity-locked">
                {t('screens:preview.quantityLocked')}
              </Text>
            ) : null}
            {lines.map((line) => (
              <View
                key={line.id}
                testID={`preview-line-${line.id}`}
                style={[styles.line, { gap: spacing.md }]}
              >
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: colors.brandSoft, borderRadius: radius.md },
                  ]}
                >
                  <Icon name="package" size={26} color={colors.brand} />
                </View>
                <View style={[styles.flex, { gap: spacing.sm }]}>
                  <View>
                    <Text variant="formButton" color="ink">
                      {line.name}
                    </Text>
                    {line.variant ? (
                      <Text variant="formBody" color="inkMuted">
                        {line.variant}
                      </Text>
                    ) : null}
                    <Text variant="caption" color="inkMuted">
                      {t('common:productLines.userEntered')}
                    </Text>
                  </View>
                  {quantityLocked ? (
                    <Text variant="formBody" color="ink" testID={`preview-quantity-${line.id}`}>
                      {t('screens:preview.quantityValue', { count: line.quantity })}
                    </Text>
                  ) : (
                    <View accessibilityLabel={t('screens:preview.quantityOf', { name: line.name })}>
                      <QuantityStepper
                        value={line.quantity}
                        onChange={(quantity) => void changeQuantity(line.id, quantity)}
                      />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="formTitle" accessibilityRole="header" color="ink">
          {t('screens:preview.packages')}
        </Text>
        <FilterChips
          appearance="solid"
          options={packageOptions}
          selectedKey={selectedPackage ?? ('' as PackageId)}
          onSelect={setPackageId}
          trailing={
            <Pressable
              testID="preview-add-package"
              accessibilityRole="button"
              onPress={() => void addPackage(details)}
              style={[styles.addPackage, { minHeight: touch, gap: spacing.xs }]}
            >
              <Icon name="add" size={18} color={colors.brand} />
              <Text variant="formButton" style={{ color: colors.brand }}>
                {t('screens:preview.addPackage')}
              </Text>
            </Pressable>
          }
        />
      </View>

      <View
        style={[
          styles.reminder,
          { backgroundColor: colors.infoSoft, borderRadius: radius.md, padding: spacing.md },
        ]}
      >
        <Text variant="caption" color="inkMuted">
          {t('screens:preview.reminder')}
        </Text>
      </View>
      {start.permissionSheet}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { flexDirection: 'row' },
  thumb: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  addPackage: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  reminder: {},
});
