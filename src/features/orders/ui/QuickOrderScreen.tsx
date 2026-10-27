import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { ROUTES } from '@/core/navigation';
import { ORDER_SOURCES, toOrderSource, type OrderSource } from '@/core/orders/order-source';
import {
  getMinTouchTarget,
  newOrderId,
  newOrderLineId,
  newPackageId,
  useAppNavigation,
  useRouteParams,
} from '@/platform';
import {
  BottomSheet,
  Button,
  Card,
  FilterChips,
  Icon,
  Screen,
  SourceIcon,
  Text,
  TextField,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

import { useCurrentShopId, useOrderStore } from '../data';
import {
  buildOrder,
  classifyMatches,
  hasDuplicates,
  suggestProductNames,
  suggestVariants,
  toCodeKey,
  validateCode,
  type DuplicateMatches,
  type OrderDraft,
  type OrderLine,
} from '../domain';
import { HeaderHelpButton } from './HeaderHelpButton';
import { QuickOrderLineEditor, type LineInput } from './QuickOrderLineEditor';
import { useStartPacking } from './use-start-packing';

/** Số dòng lịch sử đọc để gợi ý (đủ cho vài chục đơn gần nhất; đọc một lần khi mở màn). */
const HISTORY_LIMIT = 200;

type Action = 'confirm' | 'record';
type FieldError =
  | { kind: 'invalid_code' }
  | { kind: 'name_required'; lineIndex: number }
  | { kind: 'invalid_quantity'; lineIndex: number };

let lineKeySeq = 0;
/** Khóa React của dòng nhập (chỉ để vẽ danh sách; không phải ID lưu trữ). */
const newLine = (): LineInput => ({ key: (lineKeySeq += 1), name: '', variant: '', quantity: 1 });

const IDS = { orderId: newOrderId, lineId: newOrderLineId, packageId: newPackageId };

/**
 * UI-B04 Tạo đơn nhanh (đặc tả A02; mockup docs/assets/ui/03-quick-order-confirm-record.png). Lưu đơn
 * + dòng + kiện 1 trên máy (SQLite, ADR-017) rồi sang Xác nhận đơn, hoặc "Bỏ qua, quay ngay" (đơn
 * không dòng = *Chưa khai báo sản phẩm*, không chặn quay; O-19 vẫn mở). Dữ liệu tối giản: mã đơn +
 * nguồn bán (+ mã vận đơn); sản phẩm chỉ để đối chiếu và KHÔNG bắt buộc (D-10). Nguồn bán mặc định
 * "Khác / chưa xác định" thay vì đoán. Mã đã có thì hiện danh sách để người dùng chọn, không tự gộp,
 * không chọn kết quả đầu (bất biến 5, ADR-011).
 */
export function QuickOrderScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const store = useOrderStore();
  const shopId = useCurrentShopId();
  const start = useStartPacking();
  const touch = getMinTouchTarget();

  const [orderCode, setOrderCode] = useState(params.code ?? '');
  const [source, setSource] = useState<OrderSource>(toOrderSource(params.source));
  const [tracking, setTracking] = useState('');
  const [showTracking, setShowTracking] = useState(false);
  const [lines, setLines] = useState<LineInput[]>(() => [newLine()]);
  const [activeKey, setActiveKey] = useState<number | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [history, setHistory] = useState<readonly OrderLine[]>([]);
  const [fieldError, setFieldError] = useState<FieldError | null>(null);
  const [saveError, setSaveError] = useState<ErrorCode | null>(null);
  const [dupes, setDupes] = useState<{ found: DuplicateMatches; action: Action } | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

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

  const sourceOptions: ChipOption<OrderSource>[] = ORDER_SOURCES.map((key) => ({
    key,
    label: t(`common:sources.${key}`),
    leading: <SourceIcon source={key} size={22} />,
  }));
  const working = saving || start.busy;
  const canSubmit = validateCode(orderCode).ok && !working;

  const patchLine = (key: number, patch: Partial<Omit<LineInput, 'key'>>) => {
    setFieldError(null);
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const submit = async (action: Action, force: boolean) => {
    if (savingRef.current) return; // chống bấm đúp: không tạo đơn hai lần
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    setFieldError(null);
    try {
      const draft: OrderDraft = {
        orderCode,
        source,
        trackingCode: tracking,
        // "Bỏ qua, quay ngay" KHÔNG bỏ âm thầm dòng đã nhập: có dòng hợp lệ thì lưu; chưa nhập gì thì
        // đơn không dòng (*Chưa khai báo sản phẩm*). Dòng dở dang (có variant, thiếu tên) vẫn báo lỗi
        // như nút kia thay vì bị bỏ mất.
        lines,
      };
      const built = buildOrder(draft, { shopId, ids: IDS, nowDevice: Date.now() });
      if (!built.ok) {
        setFieldError(built.error);
        return;
      }
      const { order } = built.details;
      if (!force) {
        const matches = await store.findOrdersByCodes(order.shopId, {
          orderCodeKey: toCodeKey(order.orderCode),
          ...(order.trackingCode ? { trackingCodeKey: toCodeKey(order.trackingCode) } : {}),
        });
        const found = classifyMatches(matches, order);
        if (hasDuplicates(found)) {
          setDupes({ found, action });
          return;
        }
      }
      await store.saveNewOrder(built.details);
      setDupes(null);
      const packageId = built.details.packages[0]?.id;
      if (action === 'confirm' || !packageId) {
        navigation.push(ROUTES.orderPreview, { orderId: order.id });
      } else {
        start.begin(order.id, packageId);
      }
    } catch (caught) {
      setSaveError(isAppError(caught) ? caught.code : 'ORDER_SAVE_FAILED');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const activeLine = lines.find((l) => l.key === activeKey) ?? null;
  const duplicateOrders = dupes
    ? [
        ...dupes.found.sameOrder.map((order) => ({ order, kind: 'sameOrder' as const })),
        ...dupes.found.sameTracking
          .filter((o) => !dupes.found.sameOrder.some((s) => s.id === o.id))
          .map((order) => ({ order, kind: 'sameTracking' as const })),
      ]
    : [];

  const errorFor = (lineIndex: number, kind: 'name_required' | 'invalid_quantity') =>
    fieldError && fieldError.kind === kind && fieldError.lineIndex === lineIndex
      ? t(
          kind === 'name_required'
            ? 'screens:quickOrder.nameRequired'
            : 'screens:quickOrder.quantityInvalid',
        )
      : undefined;

  return (
    <Screen
      title={t('nav:titles.UI-B04')}
      onBack={navigation.back}
      headerRight={<HeaderHelpButton />}
      testID="screen-UI-B04"
      form
      footer={
        <>
          {saveError ? (
            <Card tone="danger" testID="save-error">
              <Text accessibilityRole="alert">{t(`errors:${saveError}`)}</Text>
            </Card>
          ) : null}
          {start.error ? (
            <Card tone="danger" testID="start-error">
              <Text accessibilityRole="alert">{t(`errors:${start.error}`)}</Text>
            </Card>
          ) : null}
          <Button
            testID="quick-save"
            size="compact"
            label={t('screens:quickOrder.saveAndConfirm')}
            disabled={!canSubmit}
            loading={saving}
            onPress={() => void submit('confirm', false)}
          />
          <Button
            testID="quick-skip"
            variant="secondary"
            size="slim"
            label={t('screens:quickOrder.skipAndRecord')}
            disabled={!canSubmit}
            onPress={() => void submit('record', false)}
          />
        </>
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('screens:quickOrder.intro')}
      </Text>

      <View style={{ gap: spacing.xs }}>
        <View
          style={[
            styles.sourceRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.fieldBorder,
              borderRadius: radius.md,
              paddingLeft: spacing.md,
              paddingRight: spacing.sm,
              gap: spacing.md,
            },
          ]}
        >
          <SourceIcon source={source} size={26} />
          <Text
            variant="formButton"
            color="ink"
            style={styles.flex}
            accessibilityLabel={t('screens:quickOrder.sourceA11y', {
              name: t(`common:sources.${source}`),
            })}
          >
            {t(`common:sources.${source}`)}
          </Text>
          <Pressable
            testID="source-change"
            accessibilityRole="button"
            accessibilityLabel={t('screens:quickOrder.changeSourceHint')}
            onPress={() => setSourceOpen(true)}
            style={[styles.pillHit, { minHeight: touch }]}
          >
            <View
              style={[styles.pill, { backgroundColor: colors.brandSoft, borderRadius: radius.lg }]}
            >
              <Text variant="caption" bold style={{ color: colors.brand }}>
                {t('screens:quickOrder.changeSource')}
              </Text>
            </View>
          </Pressable>
        </View>
        <Text variant="caption" color="inkMuted" testID="quick-user-entered">
          {t('screens:quickOrder.userEntered')}
        </Text>
      </View>

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
        {...(fieldError?.kind === 'invalid_code'
          ? { error: t('screens:quickOrder.invalidCode') }
          : {})}
        trailing={
          <Pressable
            testID="quick-scan"
            accessibilityRole="button"
            accessibilityLabel={t('screens:quickOrder.scanCode')}
            onPress={() => navigation.replace(ROUTES.scan)}
            style={[styles.iconButton, { minWidth: touch, minHeight: touch }]}
          >
            <Icon name="scan" size={24} color={colors.ink} />
          </Pressable>
        }
      />

      {lines.map((line, index) => (
        <QuickOrderLineEditor
          key={line.key}
          index={index}
          total={lines.length}
          line={line}
          nameError={errorFor(index, 'name_required')}
          quantityError={errorFor(index, 'invalid_quantity')}
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
        style={[styles.addLine, { minHeight: touch, gap: spacing.sm }]}
      >
        <Icon name="add" size={18} color={colors.brand} />
        <Text variant="formButton" style={{ color: colors.brand }}>
          {t('screens:quickOrder.addLine')}
        </Text>
      </Pressable>

      {showTracking ? (
        <TextField
          testID="quick-tracking"
          compact
          label={t('screens:quickOrder.trackingCode')}
          value={tracking}
          onChangeText={setTracking}
          autoCapitalize="characters"
        />
      ) : (
        <Pressable
          testID="quick-add-tracking"
          accessibilityRole="button"
          onPress={() => setShowTracking(true)}
          style={[styles.addLine, { minHeight: touch, gap: spacing.sm }]}
        >
          <Icon name="add" size={18} color={colors.brand} />
          <Text variant="formButton" style={{ color: colors.brand }}>
            {t('screens:quickOrder.addTracking')}
          </Text>
        </Pressable>
      )}

      {start.permissionSheet}

      <BottomSheet
        visible={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title={t('screens:quickOrder.sourceSheetTitle')}
      >
        <FilterChips
          options={sourceOptions}
          selectedKey={source}
          onSelect={(key) => {
            setSource(key);
            setSourceOpen(false);
          }}
        />
      </BottomSheet>

      <BottomSheet
        visible={dupes !== null}
        onClose={() => setDupes(null)}
        title={t('screens:quickOrder.duplicate.title')}
      >
        <View testID="duplicate-sheet" style={{ gap: spacing.md }}>
          <Text>{t('screens:quickOrder.duplicate.message')}</Text>
          {duplicateOrders.map(({ order, kind }) => (
            <Card key={order.id} tone="warning" testID={`duplicate-${order.id}`}>
              <View style={{ gap: spacing.sm }}>
                <Text variant="caption" color="textMuted">
                  {t(`screens:quickOrder.duplicate.${kind}`)}
                </Text>
                <Text bold>{order.orderCode}</Text>
                <Text>{t(`common:sources.${order.source}`)}</Text>
                {order.trackingCode ? (
                  <Text color="textMuted">
                    {t('screens:quickOrder.duplicate.tracking', { code: order.trackingCode })}
                  </Text>
                ) : null}
                <Button
                  variant="secondary"
                  label={t('screens:quickOrder.duplicate.useOrder')}
                  onPress={() => {
                    setDupes(null);
                    navigation.push(ROUTES.orderPreview, { orderId: order.id });
                  }}
                />
              </View>
            </Card>
          ))}
          <Button
            testID="duplicate-create-new"
            label={t('screens:quickOrder.duplicate.createNew')}
            onPress={() => {
              if (dupes) void submit(dupes.action, true);
            }}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  pillHit: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  addLine: { flexDirection: 'row', alignItems: 'center' },
});
