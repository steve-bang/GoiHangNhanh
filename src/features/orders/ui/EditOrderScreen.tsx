import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId, OrderLineId } from '@/core/ids';
import type { OrderSource } from '@/core/orders/order-source';
import {
  getMinTouchTarget,
  newOrderLineId,
  useAppNavigation,
  useConfirmBeforeLeave,
  useRouteParams,
} from '@/platform';
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  Skeleton,
  SourceIcon,
  Text,
  TextField,
  useTheme,
  useToast,
} from '@/shared/ui';
import { layout } from '@/core/theme';

import { useCurrentShopId, useOrderStore } from '../data';
import {
  buildOrderEdit,
  classifyMatches,
  hasDuplicates,
  isEditUnchanged,
  suggestProductNames,
  suggestVariants,
  toCodeKey,
  type DraftError,
  type OrderDetails,
  type OrderLine,
} from '../domain';
import { OrderMatchSheet } from './OrderMatchSheet';
import { OrderSourcePicker } from './OrderSourcePicker';
import { INPUT_LIMITS, lineErrorText, trackingErrorText } from './draft-error-text';
import { QuickOrderLineEditor, type LineInput } from './QuickOrderLineEditor';
import { useOrderDetail } from './use-order-detail';
import { useOrderLookup } from './use-order-lookup';

const HISTORY_LIMIT = 200;

/**
 * UI-E02 (route con `/orders/[orderId]/edit`, ORD-08) Sửa thông tin đơn: nguồn bán, mã vận đơn, các
 * dòng sản phẩm. Mã đơn KHÓA (chỉ đọc). CHỈ sửa được khi đơn CHƯA có phiên đóng gói nào (bất biến 7:
 * chưa có lịch sử thay đổi nên đơn đã quay chưa sửa được; người dùng đã quyết định chưa làm lịch sử,
 * decisions.md Q-22ah). Không có ghi chú/tên shop (đơn không có trường). Đơn không còn hoặc thuộc shop
 * khác = "không tìm thấy" (không lộ dữ liệu); đổi shop thì form đóng.
 */
export function EditOrderScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const { state, reload } = useOrderDetail(params.orderId as OrderId | undefined);
  const header = {
    form: true,
    contentGap: tokens.space.md,
    title: t('nav:subTitles.orderEdit'),
    onBack: navigation.back,
    testID: 'screen-UI-E02-edit',
  } as const;

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <Text variant="formBody" accessibilityLiveRegion="polite" color="inkMuted">
          {t('screens:orderEdit.loading')}
        </Text>
        <Skeleton height={tokens.component.tile.lg} />
      </Screen>
    );
  }
  if (state.kind === 'notFound') {
    return (
      <Screen {...header}>
        <View testID="order-edit-not-found">
          <EmptyState
            compact
            iconCircle
            title={t('screens:orderDetail.notFoundTitle')}
            message={t('screens:orderDetail.notFound')}
            actionLabel={t('screens:orderDetail.backToList')}
            onAction={navigation.back}
          />
        </View>
      </Screen>
    );
  }
  if (state.kind === 'error') {
    return (
      <Screen {...header}>
        <ErrorState
          variant="card"
          testID="order-edit-error"
          title={t('screens:orderDetail.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      </Screen>
    );
  }
  if (state.sessions.length > 0) return <LockedView header={header} />;
  return <EditForm header={header} details={state.details} />;
}

function LockedView({ header }: { header: EditHeader }) {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  return (
    <Screen {...header}>
      <View testID="order-edit-locked">
        <EmptyState
          compact
          iconCircle
          icon="info"
          title={t('screens:orderEdit.lockedTitle')}
          message={t('screens:orderEdit.lockedMessage')}
          actionLabel={t('screens:orderDetail.backToList')}
          onAction={navigation.back}
        />
      </View>
    </Screen>
  );
}

interface EditHeader {
  readonly form: true;
  readonly contentGap: number;
  readonly title: string;
  readonly onBack: () => void;
  readonly testID: string;
}

let lineKeySeq = 0;
const nextKey = () => (lineKeySeq += 1);

function EditForm({ header, details }: { header: EditHeader; details: OrderDetails }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const toast = useToast();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const touch = getMinTouchTarget();
  const { order } = details;
  const match = useOrderLookup();

  // Dòng trong form: `key` chỉ để vẽ; `savedIds` nối key với ID dòng đã lưu (dòng mới không có ID).
  const [initial] = useState(() => {
    const savedIds = new Map<number, OrderLineId>();
    const lines: LineInput[] = details.lines.map((l) => {
      const key = nextKey();
      savedIds.set(key, l.id);
      return { key, name: l.name, variant: l.variant ?? '', quantity: l.quantity };
    });
    if (lines.length === 0) lines.push({ key: nextKey(), name: '', variant: '', quantity: 1 });
    return { lines, savedIds };
  });
  const [source, setSource] = useState<OrderSource>(order.source);
  const [tracking, setTracking] = useState(order.trackingCode ?? '');
  const [lines, setLines] = useState<LineInput[]>(initial.lines);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [history, setHistory] = useState<readonly OrderLine[]>([]);
  const [fieldError, setFieldError] = useState<DraftError | null>(null);
  const [saveError, setSaveError] = useState<ErrorCode | 'blocked' | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const shopIdRef = useRef(shopId);
  useEffect(() => {
    shopIdRef.current = shopId;
  }, [shopId]);
  // ID dòng mới sinh MỘT lần cho mỗi dòng (key) để thử lại không tạo ID khác.
  const newIdsRef = useRef(new Map<number, OrderLineId>());

  useEffect(() => {
    let alive = true;
    store
      .listRecentLines(shopId, HISTORY_LIMIT)
      .then((rows) => alive && setHistory(rows))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [shopId, store]);

  const draft = () => ({
    source,
    trackingCode: tracking,
    lines: lines.map((l) => ({
      id: initial.savedIds.get(l.key) ?? null,
      name: l.name,
      variant: l.variant,
      quantity: l.quantity,
    })),
  });
  const lineIdFor = (key: number): OrderLineId => {
    const known = newIdsRef.current.get(key);
    if (known) return known;
    const fresh = newOrderLineId();
    newIdsRef.current.set(key, fresh);
    return fresh;
  };
  /** Dựng bản sửa; dòng mới dùng ID cố định theo key (idempotent khi thử lại). */
  const buildEdit = () => {
    const d = draft();
    let n = 0;
    const newKeys = lines.filter((l) => !initial.savedIds.has(l.key)).map((l) => l.key);
    return buildOrderEdit(details, d, {
      lineId: () => lineIdFor(newKeys[n++] as number),
      nowDevice: Date.now(),
    });
  };

  // Chỉ để tính trạng thái nút Lưu/dirty lúc render: ID dòng mới là giá trị tạm (không đọc ref khi render).
  const built = buildOrderEdit(details, draft(), {
    lineId: () => 'tam' as OrderLineId,
    nowDevice: 0,
  });
  const unchanged = built.ok && isEditUnchanged(details, built.edit);
  const dirty = !unchanged;

  const [exit, setExit] = useState<'back' | null>(null);
  useConfirmBeforeLeave(dirty && !saving && exit === null, () => setLeaveOpen(true));
  useEffect(() => {
    if (exit === 'back') navigation.back();
  }, [exit, navigation]);

  const patchLine = (key: number, patch: Partial<Omit<LineInput, 'key'>>) => {
    setFieldError(null);
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const save = async (force = false) => {
    if (savingRef.current) return; // chống bấm đúp
    const result = buildEdit();
    if (!result.ok) {
      setFieldError(result.error);
      return;
    }
    if (isEditUnchanged(details, result.edit)) {
      setExit('back');
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const shop = shopIdRef.current; // shop tại thời điểm bấm Lưu
      const { edit } = result;
      const codesChanged = edit.source !== order.source || edit.trackingCode !== order.trackingCode;
      if (!force && codesChanged) {
        const found = await store.findOrdersByCodes(shop, {
          orderCodeKey: toCodeKey(order.orderCode),
          ...(edit.trackingCode ? { trackingCodeKey: toCodeKey(edit.trackingCode) } : {}),
        });
        const others = found.filter((o) => o.id !== order.id);
        const dupes = classifyMatches(others, {
          orderCode: order.orderCode,
          source: edit.source,
          trackingCode: edit.trackingCode,
        });
        if (hasDuplicates(dupes)) {
          const items = [
            ...dupes.sameOrder.map((o) => ({ order: o, reasons: ['orderCode' as const] })),
            ...dupes.sameTracking
              .filter((o) => !dupes.sameOrder.some((s) => s.id === o.id))
              .map((o) => ({ order: o, reasons: ['trackingCode' as const] })),
          ];
          await match.showDuplicates(order.orderCode, shop, items);
          return;
        }
      }
      await store.updateOrder(shop, order.id, edit);
      match.reset();
      toast.show(t('screens:orderEdit.saved'), { tone: 'success' });
      setExit('back');
    } catch (caught) {
      const code = isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED';
      setSaveError(code === 'ORDER_HAS_SESSION' || code === 'ORDER_NOT_FOUND' ? 'blocked' : code);
      if (code === 'ORDER_NOT_FOUND' || code === 'ORDER_HAS_SESSION') {
        // Đơn đã bắt đầu quay hoặc không còn: quay về chi tiết (chi tiết nạp lại và nói đúng lý do).
        setExit('back');
      }
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const activeLine = lines.find((l) => l.key === activeKey) ?? null;
  const trackingError = trackingErrorText(t, fieldError);

  const requestClose = () => (dirty ? setLeaveOpen(true) : navigation.back());

  return (
    <Screen
      {...header}
      onBack={requestClose}
      footer={
        <>
          {saveError && saveError !== 'blocked' ? (
            <Card compact tone="danger" testID="order-edit-save-error">
              <Text variant="formBody" accessibilityRole="alert">
                {saveError === 'ORDER_SAVE_FAILED'
                  ? t('screens:orderEdit.saveFailed')
                  : t(`errors:${saveError}`)}
              </Text>
            </Card>
          ) : null}
          <View style={[styles.footerRow, { gap: tokens.space.sm }]}>
            <View style={styles.flex}>
              <Button
                testID="order-edit-cancel"
                size="compact"
                variant="secondary"
                label={t('screens:orderEdit.cancel')}
                disabled={saving}
                onPress={requestClose}
              />
            </View>
            <View style={styles.flex}>
              <Button
                testID="order-edit-save"
                size="compact"
                label={t('screens:orderEdit.save')}
                loading={saving}
                disabled={saving || (built.ok && unchanged)}
                onPress={() => void save()}
              />
            </View>
          </View>
        </>
      }
    >
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="formLabel" color="inkMuted">
          {t('screens:orderDetail.orderCode')}
        </Text>
        <View
          testID="order-edit-code"
          accessible
          accessibilityLabel={`${order.orderCode}. ${t('screens:orderEdit.codeLocked')}`}
          style={[
            styles.locked,
            {
              minHeight: Math.max(touch, layout.component.field.minHeight),
              backgroundColor: tokens.color.surface.muted,
              borderRadius: tokens.radius.md,
              paddingHorizontal: tokens.space.md,
            },
          ]}
        >
          <Text variant="formButton" color="inkMuted">
            {order.orderCode}
          </Text>
        </View>
        <Text variant="caption" color="textMuted">
          {t('screens:orderEdit.codeLocked')}
        </Text>
      </View>

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
          const added: LineInput = { key: nextKey(), name: '', variant: '', quantity: 1 };
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
      <OrderMatchSheet
        state={match.state}
        onClose={match.reset}
        onRetry={() => void save()}
        onCreateAnyway={() => void save(true)}
        createAnywayLabel={t('screens:orderEdit.saveAnyway')}
        duplicateMessage={t('screens:orderEdit.duplicateMessage')}
      />
      <ConfirmDialog
        visible={leaveOpen}
        title={t('screens:orderEdit.leave.title')}
        message={t('screens:orderEdit.leave.message')}
        cancelLabel={t('screens:orderEdit.leave.stay')}
        confirmLabel={t('screens:orderEdit.leave.discard')}
        destructive
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          setExit('back');
        }}
        confirmTestID="order-edit-leave-confirm"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footerRow: { flexDirection: 'row', alignItems: 'center' },
  locked: { justifyContent: 'center' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: layout.borderWidth.thin },
  addLine: { flexDirection: 'row', alignItems: 'center' },
});
