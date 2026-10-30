import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId, OrderLineId, PackageId } from '@/core/ids';
import { ROUTES } from '@/core/navigation';
import { toOrderSource, type OrderSource } from '@/core/orders/order-source';
import {
  getMinTouchTarget,
  newOrderId,
  newOrderLineId,
  newPackageId,
  useAppNavigation,
  useConfirmBeforeLeave,
  useRouteParams,
} from '@/platform';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  Icon,
  ProductLineList,
  Screen,
  SourceIcon,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import { useCurrentShopId, useOrderStore } from '../data';
import {
  buildOrder,
  classifyMatches,
  hasDuplicates,
  suggestProductNames,
  suggestVariants,
  toCodeKey,
  type DraftError,
  type IdFactory,
  type OrderDetails,
  type OrderDraft,
  type OrderLine,
} from '../domain';
import { HeaderHelpButton } from './HeaderHelpButton';
import { OrderMatchSheet } from './OrderMatchSheet';
import { OrderSourcePicker } from './OrderSourcePicker';
import { INPUT_LIMITS, lineErrorText, trackingErrorText } from './draft-error-text';
import { QuickOrderLineEditor, type LineInput } from './QuickOrderLineEditor';
import { useOrderLookup } from './use-order-lookup';

/** Số dòng lịch sử đọc để gợi ý (đủ cho vài chục đơn gần nhất; đọc một lần khi mở màn). */
const HISTORY_LIMIT = 200;

interface IdSet {
  orderId: OrderId;
  packageId: PackageId;
  lineIds: OrderLineId[];
}

/** Nội dung nhập (mã, nguồn, mã vận đơn, dòng) của hai bản đơn có giống nhau không (bỏ qua ID/thời gian). */
function sameContent(a: OrderDetails, b: OrderDetails): boolean {
  return (
    a.order.orderCode === b.order.orderCode &&
    a.order.source === b.order.source &&
    a.order.trackingCode === b.order.trackingCode &&
    a.lines.length === b.lines.length &&
    a.lines.every((l, i) => {
      const o = b.lines[i];
      return o && l.name === o.name && l.variant === o.variant && l.quantity === o.quantity;
    })
  );
}

type FieldError = DraftError | { kind: 'code_required' };
type Step = 'form' | 'confirm';

let lineKeySeq = 0;
/** Khóa React của dòng nhập (chỉ để vẽ danh sách; không phải ID lưu trữ). */
const newLine = (): LineInput => ({ key: (lineKeySeq += 1), name: '', variant: '', quantity: 1 });

/**
 * UI-B04 Tạo đơn nhanh (ORD-05) + bước Xác nhận (ORD-06) trong CÙNG màn (docs/engineering/
 * orders-tab-ui-pr4-plan.md). Luồng đã duyệt (Q-22a): Tiếp tục (chỉ kiểm tra, CHƯA lưu) -> Xác nhận ->
 * Tạo đơn hàng (lưu một lần) -> Chi tiết đơn. Đơn lưu độc lập với quay; Quay đóng gói nằm ở chi tiết.
 * - ID đơn/kiện sinh MỘT lần khi mở form, ID dòng lấy từ bể cố định: thử lại không tạo hai bản ghi.
 * - Shop lấy LÚC BẤM Tạo (`shopIdRef`), không lúc mở form (bất biến 8).
 * - Dữ liệu tối giản: mã đơn + nguồn (+ mã vận đơn); sản phẩm KHÔNG bắt buộc (bất biến 10).
 * - Trùng mã đơn+nguồn hoặc mã vận đơn: hiện đơn đã có (`OrderMatchSheet` chế độ duplicate), không
 *   gộp, không tạo đè (bất biến 5).
 */
export function QuickOrderScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const touch = getMinTouchTarget();

  const [initialCode] = useState(() => params.code ?? '');
  const [initialSource] = useState(() => toOrderSource(params.source));
  const [orderCode, setOrderCode] = useState(initialCode);
  const [source, setSource] = useState<OrderSource>(initialSource);
  const [tracking, setTracking] = useState('');
  const [showTracking, setShowTracking] = useState(false);
  const [lines, setLines] = useState<LineInput[]>(() => [newLine()]);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [history, setHistory] = useState<readonly OrderLine[]>([]);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [saveError, setSaveError] = useState<ErrorCode | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const match = useOrderLookup();

  // Shop MỚI NHẤT của phiên, đọc lúc bấm Tạo (không dùng giá trị lúc mở form).
  const shopIdRef = useRef(shopId);
  useEffect(() => {
    shopIdRef.current = shopId;
  }, [shopId]);
  // ID sinh MỘT lần cho cả lần tạo này (thử lại dùng lại đúng các ID này).
  // Bộ ID của lần tạo này; chỉ đọc/ghi trong handler (không trong render). Xoay bộ mới khi nội dung
  // đổi sau một lần lưu đã xong (xem `createOrder`) để không ghi đè đơn đã lưu.
  const idSetRef = useRef<IdSet | null>(null);
  const getIdSet = (): IdSet => {
    idSetRef.current ??= { orderId: newOrderId(), packageId: newPackageId(), lineIds: [] };
    return idSetRef.current;
  };

  useEffect(() => {
    let alive = true;
    store
      .listRecentLines(shopId, HISTORY_LIMIT)
      .then((rows) => alive && setHistory(rows))
      // Không có lịch sử thì chỉ mất gợi ý; việc tạo đơn vẫn chạy bình thường.
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [shopId, store]);

  const dirty =
    orderCode !== initialCode ||
    source !== initialSource ||
    tracking.trim().length > 0 ||
    lines.length > 1 ||
    lines.some((l) => l.name.trim().length > 0 || l.variant.trim().length > 0 || l.quantity !== 1);
  // Chặn rời màn (Back, cử chỉ, `replace`) khi có dữ liệu chưa lưu; tạo xong thì `allowLeave`.
  // Đi tiếp (tạo xong / chọn bỏ thay đổi) đặt `exit` để TẮT chặn rồi mới điều hướng ở effect bên dưới:
  // gọi điều hướng ngay trong cùng lượt sẽ vẫn bị chặn vì chặn chỉ tắt sau lần render kế.
  const [exit, setExit] = useState<{ kind: 'detail'; orderId: OrderId } | { kind: 'back' } | null>(
    null,
  );
  useConfirmBeforeLeave(dirty && !saving && exit === null, () => setLeaveOpen(true));
  useEffect(() => {
    if (!exit) return;
    if (exit.kind === 'detail') navigation.replace(ROUTES.orderDetail, { orderId: exit.orderId });
    else navigation.back();
  }, [exit, navigation]);

  const requestClose = () => {
    if (step === 'confirm') {
      setStep('form');
      return;
    }
    if (dirty) setLeaveOpen(true);
    else navigation.back();
  };

  const patchLine = (key: number, patch: Partial<Omit<LineInput, 'key'>>) => {
    setFieldError(null);
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  /** Bộ sinh ID MỚI cho mỗi lần dựng: ID đơn/kiện cố định, ID dòng lấy lần lượt từ bể cố định. */
  const makeIds = (): IdFactory => {
    let n = 0;
    const set = getIdSet();
    return {
      orderId: () => set.orderId,
      packageId: () => set.packageId,
      lineId: () => {
        const pool = set.lineIds;
        while (pool.length <= n) pool.push(newOrderLineId());
        const id = pool[n] as OrderLineId;
        n += 1;
        return id;
      },
    };
  };
  const draft: OrderDraft = { orderCode, source, trackingCode: tracking, lines };

  /** ORD-05 Tiếp tục: chỉ KIỂM TRA, chưa lưu gì. */
  const goConfirm = () => {
    setSaveError(null);
    if (orderCode.trim().length === 0) {
      setFieldError({ kind: 'code_required' });
      return;
    }
    const built = buildOrder(draft, { shopId, ids: makeIds(), nowDevice: Date.now() });
    if (!built.ok) {
      setFieldError(built.error);
      return;
    }
    setFieldError(null);
    setStep('confirm');
  };

  /**
   * ORD-06 Tạo đơn hàng: kiểm trùng, lưu MỘT lần, mở chi tiết. `force` (nút *Vẫn tạo đơn mới* ở hộp
   * trùng) bỏ qua kiểm trùng nhưng vẫn dùng đúng ID đã sinh nên bấm lại không tạo thêm bản ghi.
   */
  const createOrder = async (force = false) => {
    if (savingRef.current) return; // chống bấm đúp: không tạo đơn hai lần
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const shop = shopIdRef.current; // shop tại thời điểm bấm
      let built = buildOrder(draft, { shopId: shop, ids: makeIds(), nowDevice: Date.now() });
      if (!built.ok) {
        setFieldError(built.error);
        setStep('form');
        return;
      }
      // Lần trước đã lưu xong nhưng kết quả bị mất (hoặc đã lưu rồi người dùng quay lại sửa):
      // - nội dung y hệt: không tạo bản thứ hai, chỉ mở đơn đó;
      // - nội dung đã đổi: KHÔNG mở bản cũ (sẽ bỏ phần vừa sửa) và KHÔNG ghi đè nó: xoay sang bộ ID
      //   mới; đơn đã lưu sẽ hiện ở kiểm trùng bên dưới để người dùng tự quyết (không mất dữ liệu).
      const already = await store.getOrder(shop, built.details.order.id);
      if (already && sameContent(already, built.details)) {
        setExit({ kind: 'detail', orderId: already.order.id });
        return;
      }
      if (already) {
        idSetRef.current = null;
        built = buildOrder(draft, { shopId: shop, ids: makeIds(), nowDevice: Date.now() });
        if (!built.ok) return;
      }
      const { order } = built.details;
      if (!force) {
        const matches = await store.findOrdersByCodes(shop, {
          orderCodeKey: toCodeKey(order.orderCode),
          ...(order.trackingCode ? { trackingCodeKey: toCodeKey(order.trackingCode) } : {}),
        });
        const found = classifyMatches(matches, order);
        if (hasDuplicates(found)) {
          const items = [
            ...found.sameOrder.map((o) => ({ order: o, reasons: ['orderCode' as const] })),
            ...found.sameTracking
              .filter((o) => !found.sameOrder.some((s) => s.id === o.id))
              .map((o) => ({ order: o, reasons: ['trackingCode' as const] })),
          ];
          await match.showDuplicates(order.orderCode, shop, items);
          return;
        }
      }
      await store.saveNewOrder(built.details);
      match.reset();
      setExit({ kind: 'detail', orderId: order.id });
    } catch (caught) {
      setSaveError(isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const activeLine = lines.find((l) => l.key === activeKey) ?? null;
  const trackingError = trackingErrorText(t, fieldError);
  const codeErrorText =
    fieldError?.kind === 'code_required'
      ? t('screens:quickOrder.codeRequired')
      : fieldError?.kind === 'invalid_code'
        ? t('screens:quickOrder.invalidCode')
        : undefined;

  const cancelButton = (
    <Pressable
      testID="quick-cancel"
      accessibilityRole="button"
      onPress={() => (dirty ? setLeaveOpen(true) : navigation.back())}
      style={{ minHeight: touch, minWidth: touch, alignItems: 'center', justifyContent: 'center' }}
    >
      <Text variant="formButton" style={{ color: tokens.color.action.link }}>
        {t('screens:quickOrder.cancel')}
      </Text>
    </Pressable>
  );

  const leaveDialog = (
    <ConfirmDialog
      visible={leaveOpen}
      title={t('screens:quickOrder.leave.title')}
      message={t('screens:quickOrder.leave.message')}
      cancelLabel={t('screens:quickOrder.leave.stay')}
      confirmLabel={t('screens:quickOrder.leave.discard')}
      destructive
      onCancel={() => setLeaveOpen(false)}
      onConfirm={() => {
        setLeaveOpen(false);
        setExit({ kind: 'back' });
      }}
      confirmTestID="quick-leave-confirm"
    />
  );

  if (step === 'confirm') {
    return (
      <Screen
        title={t('screens:quickOrder.confirmTitle')}
        onBack={requestClose}
        testID="screen-UI-B04-confirm"
        form
        footer={
          <>
            {saveError ? (
              <Card compact tone="danger" testID="save-error">
                <Text variant="formBody" accessibilityRole="alert">
                  {saveError === 'ORDER_SAVE_FAILED'
                    ? t('screens:quickOrder.createFailed')
                    : t(`errors:${saveError}`)}
                </Text>
              </Card>
            ) : null}
            <Button
              testID="quick-create"
              size="compact"
              label={t('screens:quickOrder.createOrder')}
              loading={saving}
              disabled={saving}
              onPress={() => void createOrder()}
            />
            <Button
              testID="quick-back-edit"
              size="slim"
              variant="secondary"
              label={t('screens:quickOrder.backToEdit')}
              disabled={saving}
              onPress={() => setStep('form')}
            />
          </>
        }
      >
        <Text variant="formBody" color="inkMuted">
          {t('screens:quickOrder.confirmIntro')}
        </Text>
        <View style={{ gap: tokens.space.md }}>
          <View>
            <Text variant="formLabel" color="inkMuted">
              {t('screens:quickOrder.orderCode')}
            </Text>
            <Text variant="formTitle" testID="confirm-order-code">
              {orderCode.trim()}
            </Text>
          </View>
          <View style={styles.sourceLine}>
            <SourceIcon source={source} size={tokens.component.tile.sm} />
            <View style={styles.flex}>
              <Text variant="formLabel" color="inkMuted">
                {t('screens:quickOrder.sourceLabel')}
              </Text>
              <Text variant="formButton" color="ink" testID="confirm-source">
                {t(`common:sources.${source}`)}
              </Text>
            </View>
          </View>
          {tracking.trim().length > 0 ? (
            <View>
              <Text variant="formLabel" color="inkMuted">
                {t('screens:quickOrder.confirmTracking')}
              </Text>
              <Text variant="formButton" color="ink" testID="confirm-tracking">
                {tracking.trim()}
              </Text>
            </View>
          ) : null}
          <View style={{ gap: tokens.space.sm }}>
            <Text variant="formButton" color="ink" accessibilityRole="header">
              {t('screens:quickOrder.product')}
            </Text>
            <ProductLineList
              compact
              lines={lines
                .filter((l) => l.name.trim().length > 0)
                .map((l) => ({
                  id: String(l.key),
                  name: l.name.trim(),
                  ...(l.variant.trim() ? { variant: l.variant.trim() } : {}),
                  quantity: l.quantity,
                }))}
            />
          </View>
          <Text variant="caption" color="textMuted" testID="quick-user-entered">
            {t('screens:quickOrder.userEntered')}
          </Text>
        </View>
        <OrderMatchSheet
          state={match.state}
          onClose={match.reset}
          onRetry={() => void createOrder()}
          onCreateAnyway={() => void createOrder(true)}
        />
        {leaveDialog}
      </Screen>
    );
  }

  return (
    <Screen
      title={t('screens:quickOrder.title')}
      onBack={requestClose}
      headerRight={
        <View style={styles.headerRight}>
          <HeaderHelpButton />
          {cancelButton}
        </View>
      }
      testID="screen-UI-B04"
      form
      footer={
        <Button
          testID="quick-continue"
          size="compact"
          label={t('screens:quickOrder.continue')}
          onPress={goConfirm}
        />
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('screens:quickOrder.intro')}
      </Text>

      <TextField
        testID="quick-order-code"
        compact
        label={t('screens:quickOrder.orderCode')}
        placeholder={t('screens:quickOrder.orderCodePlaceholder')}
        value={orderCode}
        onChangeText={(value) => {
          setFieldError(null);
          setOrderCode(value);
        }}
        autoCapitalize="characters"
        maxLength={INPUT_LIMITS.code}
        {...(codeErrorText ? { error: codeErrorText } : {})}
        trailing={
          <Pressable
            testID="quick-scan"
            accessibilityRole="button"
            accessibilityLabel={t('screens:quickOrder.scanCode')}
            onPress={() => navigation.replace(ROUTES.scan)}
            style={[styles.iconButton, { minWidth: touch, minHeight: touch }]}
          >
            <Icon name="scan" size={24} color={tokens.color.text.strong} />
          </Pressable>
        }
      />

      <View style={{ gap: tokens.space.xs }}>
        <Text variant="formLabel" color="inkMuted">
          {t('screens:quickOrder.sourceLabel')}
        </Text>
        <Pressable
          testID="source-change"
          accessibilityRole="button"
          accessibilityLabel={t('screens:quickOrder.sourceA11y', {
            name: t(`common:sources.${source}`),
          })}
          accessibilityHint={t('screens:quickOrder.sourceChange')}
          onPress={() => setSourceOpen(true)}
          style={[
            styles.sourceRow,
            {
              minHeight: Math.max(touch, layout.component.field.minHeight),
              backgroundColor: tokens.color.surface.raised,
              borderColor: tokens.color.border.field,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.space.md,
              gap: tokens.space.md,
            },
          ]}
        >
          <SourceIcon source={source} size={tokens.component.tile.sm} />
          <Text variant="formButton" color="ink" style={styles.flex}>
            {t(`common:sources.${source}`)}
          </Text>
          <Icon name="forward" size={20} color={tokens.color.text.secondary} />
        </Pressable>
      </View>

      {lines.map((line, index) => (
        <QuickOrderLineEditor
          key={line.key}
          index={index}
          total={lines.length}
          line={line}
          nameError={lineErrorText(t, fieldError, index, 'name')}
          variantError={lineErrorText(t, fieldError, index, 'variant')}
          quantityError={lineErrorText(t, fieldError, index, 'quantity')}
          nameSuggestions={
            activeLine?.key === line.key ? suggestProductNames(history, line.name) : []
          }
          variantSuggestions={
            activeLine?.key === line.key ? suggestVariants(history, line.name) : []
          }
          onActivate={() => setActiveKey(line.key)}
          onChange={(patch) => patchLine(line.key, patch)}
          onRemove={
            lines.length > 1
              ? () => setLines((current) => current.filter((l) => l.key !== line.key))
              : undefined
          }
        />
      ))}

      <Pressable
        testID="quick-add-line"
        accessibilityRole="button"
        onPress={() => {
          const added = newLine();
          setLines((current) => [...current, added]);
          setActiveKey(added.key);
        }}
        style={[styles.addLine, { minHeight: touch, gap: tokens.space.sm }]}
      >
        <Icon name="add" size={18} color={tokens.color.brand.primary} />
        <Text variant="formButton" style={{ color: tokens.color.action.link }}>
          {t('screens:quickOrder.addLine')}
        </Text>
      </Pressable>

      {showTracking ? (
        <TextField
          testID="quick-tracking"
          compact
          label={t('screens:quickOrder.trackingCode')}
          value={tracking}
          onChangeText={(value) => {
            setFieldError(null);
            setTracking(value);
          }}
          autoCapitalize="characters"
          maxLength={INPUT_LIMITS.tracking}
          {...(trackingError ? { error: trackingError } : {})}
        />
      ) : (
        <Pressable
          testID="quick-add-tracking"
          accessibilityRole="button"
          onPress={() => setShowTracking(true)}
          style={[styles.addLine, { minHeight: touch, gap: tokens.space.sm }]}
        >
          <Icon name="add" size={18} color={tokens.color.brand.primary} />
          <Text variant="formButton" style={{ color: tokens.color.action.link }}>
            {t('screens:quickOrder.addTracking')}
          </Text>
        </Pressable>
      )}

      <BottomSheet
        compact
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title={t('screens:quickOrder.sourceSheetTitle')}
      >
        <OrderSourcePicker
          value={source}
          onChange={(next) => {
            setSource(next);
            setSourceOpen(false);
          }}
        />
      </BottomSheet>
      {leaveDialog}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: layout.borderWidth.thin },
  sourceLine: { flexDirection: 'row', alignItems: 'center', gap: layout.space.md },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  addLine: { flexDirection: 'row', alignItems: 'center' },
});
