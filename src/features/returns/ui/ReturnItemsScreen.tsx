import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { getMinTouchTarget, newReturnRecordId, useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  FilterChips,
  Screen,
  StatusBadge,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';

import {
  compareLine,
  suggestDiscrepancyKinds,
  type DiscrepancyKind,
  type LineComparison,
  type LineCondition,
  type ReturnDetails,
} from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { resumeRoute } from './return-routes';
import { useReturnCase } from './use-return-case';
import { toEditableLines, useReturnOps, type EditableLine } from './use-return-ops';

const MAX_QUANTITY = 99999;
const CONDITIONS: readonly LineCondition[] = ['normal', 'damaged', 'missing_accessory', 'unknown'];
const KINDS: readonly DiscrepancyKind[] = [
  'missing',
  'excess',
  'wrong_item',
  'variant_differs',
  'damaged',
  'missing_accessory',
  'unknown',
  'other',
];

/** Dòng đang sửa + chuỗi số lượng nhập thô (cho phép gõ dở; chuyển thành số khi kiểm tra/lưu). */
type Row = Omit<EditableLine, 'quantity'> & { quantityText: string };

const toRow = (line: EditableLine): Row => {
  const { quantity, ...rest } = line;
  return { ...rest, quantityText: quantity === null ? '' : String(quantity) };
};

/** Số lượng hợp lệ: số nguyên 0..99.999 (0 là hợp lệ: không nhận được món đó). Rỗng là chưa nhập. */
function parseQuantity(text: string): { state: 'empty' | 'invalid' | 'ok'; value: number | null } {
  const trimmed = text.trim();
  if (trimmed === '') return { state: 'empty', value: null };
  if (!/^\d+$/.test(trimmed)) return { state: 'invalid', value: null };
  const value = Number(trimmed);
  return value <= MAX_QUANTITY ? { state: 'ok', value } : { state: 'invalid', value: null };
}

const blankRow = (): Row => ({
  id: newReturnRecordId(),
  name: '',
  variant: '',
  quantityText: '',
  condition: null,
  note: '',
  expected: null,
  kinds: [],
  discrepancyNote: '',
});

/**
 * UI-D05 Kiểm tra hàng thực nhận (đặc tả B06). Mỗi dòng đơn gốc thành một dòng với dữ liệu dự kiến là
 * BẢN SAO (không bị ghi đè); số lượng thực nhận để TRỐNG, người dùng nhập (không mặc định bằng dự kiến,
 * không tự kết luận). Chưa liên kết đơn: "Chưa có dữ liệu đối chiếu" chứ không phải dự kiến 0. Thêm
 * được hàng ngoài dự kiến; hai variant không gộp. Sai lệch do người dùng chọn (có gợi ý theo số lượng
 * và tình trạng), không tự quy trách nhiệm.
 */
export function ReturnItemsScreen() {
  const params = useRouteParams();
  const { state, reload } = useReturnCase(params.returnId);
  if (state.kind !== 'ready') {
    return <ReturnLoadState uiCode="UI-D05" state={state} onRetry={reload} />;
  }
  return <ItemsForm details={state.details} />;
}

function ItemsForm({ details }: { details: ReturnDetails }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const { returnCase } = details;
  const [rows, setRows] = useState<Row[]>(() => {
    const saved = toEditableLines(details).map(toRow);
    return saved.length > 0 ? saved : returnCase.sourceOrderId === null ? [blankRow()] : [];
  });
  const [opened, setOpened] = useState<ReadonlySet<string>>(
    () => new Set(rows.filter((r) => r.kinds.length > 0).map((r) => r.id)),
  );
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);

  // Không nhảy cóc bước: chưa ghi tình trạng bên ngoài/video thì về bước đó; đã xác nhận thì sang màn xem.
  const redirect =
    returnCase.status === 'receiving' ||
    returnCase.status === 'opening' ||
    returnCase.status === 'confirmed'
      ? resumeRoute(returnCase.status)
      : null;
  useEffect(() => {
    if (redirect) navigation.replace(redirect, { returnId: returnCase.id });
  }, [redirect, navigation, returnCase.id]);

  const update = (id: string, patch: Partial<Row>) =>
    setRows((current) => current.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const problems = useMemo(
    () =>
      rows.map((row) => ({
        name: row.name.trim() === '',
        quantity: parseQuantity(row.quantityText).state,
      })),
    [rows],
  );
  const hasProblem = rows.length === 0 || problems.some((p) => p.name || p.quantity !== 'ok');

  const submit = async () => {
    setShowErrors(true);
    if (hasProblem) return;
    setBusy(true);
    setFailure(null);
    try {
      await ops.saveLines(
        returnCase.id,
        rows.map(({ quantityText, ...line }) => ({
          ...line,
          quantity: parseQuantity(quantityText).value,
        })),
      );
      navigation.push(ROUTES.returnReview, { returnId: returnCase.id });
      setBusy(false);
    } catch (error) {
      logger.warn('returns.lines_save_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      setFailure(isAppError(error) ? error.code : 'RETURN_SAVE_FAILED');
      setBusy(false);
    }
  };

  const summaryError = showErrors
    ? rows.length === 0
      ? t('returns:items.noLines')
      : hasProblem
        ? t('returns:items.incomplete')
        : null
    : null;

  return (
    <Screen
      form
      title={t('nav:titles.UI-D05')}
      onBack={navigation.back}
      testID="screen-UI-D05"
      footer={
        <Button
          testID="return-items-continue"
          label={t('returns:items.continue')}
          loading={busy}
          disabled={busy}
          onPress={() => void submit()}
        />
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('returns:items.intro')}
      </Text>
      {returnCase.sourceOrderId === null ? (
        <Card compact tone="default" testID="return-no-reference">
          <Text variant="formBody">{t('returns:items.noReference')}</Text>
        </Card>
      ) : null}
      {rows.map((row, index) => (
        <LineCard
          key={row.id}
          row={row}
          comparisonBase={returnCase.sourceOrderId !== null}
          showErrors={showErrors}
          problem={problems[index]}
          discrepancyOpen={opened.has(row.id)}
          onToggleDiscrepancy={() =>
            setOpened((current) => {
              const next = new Set(current);
              if (next.has(row.id)) next.delete(row.id);
              else next.add(row.id);
              return next;
            })
          }
          onChange={(patch) => update(row.id, patch)}
          onRemove={
            row.expected === null
              ? () => setRows((c) => c.filter((r) => r.id !== row.id))
              : undefined
          }
        />
      ))}
      <Button
        testID="return-add-line"
        variant="secondary"
        size="compact"
        icon="add"
        label={t('returns:items.addLine')}
        onPress={() => setRows((current) => [...current, blankRow()])}
      />
      {summaryError ? (
        <Text
          variant="formBody"
          accessibilityRole="alert"
          testID="return-items-summary-error"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {summaryError}
        </Text>
      ) : null}
      {failure ? (
        <Text
          variant="formBody"
          accessibilityRole="alert"
          testID="return-items-error"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {errorText(resolveErrorMessage(t, failure))}
        </Text>
      ) : null}
    </Screen>
  );
}

const COMPARISON_TONE: Record<
  Exclude<LineComparison, 'unentered' | 'no_reference'>,
  'neutral' | 'warning'
> = {
  matched: 'neutral',
  short: 'warning',
  excess: 'warning',
};

function LineCard({
  row,
  comparisonBase,
  showErrors,
  problem,
  discrepancyOpen,
  onToggleDiscrepancy,
  onChange,
  onRemove,
}: {
  row: Row;
  comparisonBase: boolean;
  showErrors: boolean;
  problem: { name: boolean; quantity: 'empty' | 'invalid' | 'ok' } | undefined;
  discrepancyOpen: boolean;
  onToggleDiscrepancy: () => void;
  onChange: (patch: Partial<Row>) => void;
  onRemove: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const parsed = parseQuantity(row.quantityText);
  const comparison = compareLine({ receivedQuantity: parsed.value, expected: row.expected });
  const suggestions = suggestDiscrepancyKinds({
    receivedQuantity: parsed.value,
    expected: row.expected,
    condition: row.condition,
  });
  const showDiscrepancy = discrepancyOpen || suggestions.length > 0 || row.kinds.length > 0;
  const qtyError =
    showErrors && problem && problem.quantity !== 'ok' ? t('returns:items.invalid') : undefined;
  const toggleKind = (kind: DiscrepancyKind) =>
    onChange({
      kinds: row.kinds.includes(kind) ? row.kinds.filter((k) => k !== kind) : [...row.kinds, kind],
    });

  return (
    <Card compact testID={`return-line-${row.id}`}>
      <View style={{ gap: tokens.space.sm }}>
        {row.expected ? (
          <View style={{ gap: tokens.space.xxs }}>
            <Text variant="cardTitle">{row.expected.name}</Text>
            {row.expected.variant ? (
              <Text variant="formBody" color="inkMuted">
                {row.expected.variant}
              </Text>
            ) : null}
            <Text variant="caption" color="textMuted" testID={`return-expected-${row.id}`}>
              {t('returns:items.expectedQty', { count: row.expected.quantity })}
            </Text>
          </View>
        ) : (
          <>
            {comparisonBase ? (
              <StatusBadge label={t('returns:items.extraLine')} tone="info" />
            ) : null}
            <TextField
              compact
              required
              testID={`return-line-name-${row.id}`}
              label={t('returns:items.nameLabel')}
              placeholder={t('returns:items.namePlaceholder')}
              value={row.name}
              onChangeText={(name) => onChange({ name })}
              maxLength={120}
              {...(showErrors && problem?.name ? { error: t('returns:items.incomplete') } : {})}
            />
            <TextField
              compact
              testID={`return-line-variant-${row.id}`}
              label={t('returns:items.variantLabel')}
              placeholder={t('returns:items.variantPlaceholder')}
              value={row.variant}
              onChangeText={(variant) => onChange({ variant })}
              maxLength={120}
            />
          </>
        )}
        <TextField
          compact
          required
          testID={`return-line-qty-${row.id}`}
          label={t('returns:items.qtyLabel')}
          value={row.quantityText}
          onChangeText={(quantityText) => onChange({ quantityText })}
          keyboardType="number-pad"
          maxLength={5}
          {...(qtyError ? { error: qtyError } : {})}
        />
        {comparison === 'matched' || comparison === 'short' || comparison === 'excess' ? (
          <View style={{ alignSelf: 'flex-start' }} testID={`return-compare-${row.id}`}>
            <StatusBadge
              label={t(`returns:items.compare.${comparison}`)}
              tone={COMPARISON_TONE[comparison]}
              icon={comparison === 'matched' ? 'check' : 'alert'}
            />
          </View>
        ) : null}
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="formLabel">{t('returns:items.conditionLabel')}</Text>
          <FilterChips<string>
            size="compact"
            options={CONDITIONS.map((key) => ({
              key,
              label: t(`returns:items.condition.${key}`),
            }))}
            selectedKey={row.condition ?? ''}
            onSelect={(key) => onChange({ condition: key as LineCondition })}
          />
        </View>
        <TextField
          compact
          testID={`return-line-note-${row.id}`}
          label={t('returns:items.noteLabel')}
          value={row.note}
          onChangeText={(note) => onChange({ note })}
          maxLength={300}
        />
        {showDiscrepancy ? (
          <View style={{ gap: tokens.space.sm }} testID={`return-discrepancy-${row.id}`}>
            <Text variant="formButton" accessibilityRole="header">
              {t('returns:items.discrepancyToggle')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.sm }}>
              {KINDS.map((kind) => (
                <KindChip
                  key={kind}
                  testID={`return-kind-${row.id}-${kind}`}
                  label={t(`returns:items.kinds.${kind}`)}
                  selected={row.kinds.includes(kind)}
                  suggested={suggestions.includes(kind)}
                  onPress={() => toggleKind(kind)}
                />
              ))}
            </View>
            {row.kinds.length > 0 ? (
              <>
                <Text variant="caption" color="textMuted">
                  {t('returns:items.discrepancyHint')}
                </Text>
                <TextField
                  compact
                  multiline
                  testID={`return-discrepancy-note-${row.id}`}
                  label={t('returns:items.discrepancyNoteLabel')}
                  value={row.discrepancyNote}
                  onChangeText={(discrepancyNote) => onChange({ discrepancyNote })}
                  maxLength={500}
                />
              </>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          {suggestions.length === 0 && row.kinds.length === 0 ? (
            <LinkButton
              testID={`return-discrepancy-toggle-${row.id}`}
              label={
                discrepancyOpen
                  ? t('returns:items.discrepancyHide')
                  : t('returns:items.discrepancyToggle')
              }
              onPress={onToggleDiscrepancy}
            />
          ) : (
            <View />
          )}
          {onRemove ? (
            <LinkButton
              testID={`return-line-remove-${row.id}`}
              label={t('returns:items.removeLine')}
              onPress={onRemove}
              destructive
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function LinkButton({
  label,
  onPress,
  testID,
  destructive = false,
}: {
  label: string;
  onPress: () => void;
  testID: string;
  destructive?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: getMinTouchTarget(), justifyContent: 'center' }}
    >
      <Text
        variant="formButtonSmall"
        style={{
          color: destructive ? tokens.color.feedback.danger.fg : tokens.color.action.link,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Chip chọn nhiều cho loại sai lệch: trạng thái chọn có nền + viền + báo cho trình đọc, không chỉ màu. */
function KindChip({
  label,
  selected,
  suggested,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  suggested: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={{ top: tokens.space.xs, bottom: tokens.space.xs }}
      style={{
        minHeight: getMinTouchTarget(),
        paddingHorizontal: tokens.space.md,
        justifyContent: 'center',
        borderRadius: tokens.radius.lg,
        borderWidth: selected ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
        borderColor: selected
          ? tokens.color.brand.primary
          : suggested
            ? tokens.status.interrupted.fg
            : tokens.color.border.field,
        backgroundColor: selected ? tokens.color.brand.soft : tokens.color.surface.raised,
      }}
    >
      <Text
        variant="formButton"
        style={{ color: selected ? tokens.color.brand.onSoft : tokens.color.text.primary }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
