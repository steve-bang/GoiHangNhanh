import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { OrderId } from '@/core/ids';
import { resolveErrorMessage, errorText } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { toCodeKey, type OrderDetails } from '@/features/orders';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  Icon,
  Screen,
  SourceIcon,
  StatusBadge,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';

import type { LinkBasis, ReturnSummary } from '../domain';
import { ReturnLoadState } from './ReturnLoadState';
import { resumeRoute } from './return-routes';
import { useReturnCase } from './use-return-case';
import { useReturnOps, type OrderCandidate, type OrderLookupResult } from './use-return-ops';

type Phase =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'error' }
  | { kind: 'result'; result: Exclude<OrderLookupResult, { kind: 'invalid' }> };

type Selection = { kind: 'order'; orderId: OrderId } | { kind: 'unlinked' };

/**
 * UI-D02 Tìm đơn gốc (đặc tả B02). Nhập mã trên kiện hoàn: không có / đúng một / nhiều đơn khớp, KHÔNG
 * tự chọn hộ và KHÔNG tự ghép đơn "gần giống" (CLAUDE.md #5). Luôn có lối "Không xác định được đơn gốc"
 * (hồ sơ chưa liên kết, liên kết sau được, có lịch sử). Đã có hồ sơ cho đơn/mã này thì báo trước
 * (`RETURN_CODE_DUPLICATE`) và cho mở hồ sơ cũ hoặc xác nhận đây là lần tiếp nhận khác (một đơn có thể
 * có nhiều lượt hoàn). Có `returnId` ở tham số route: chế độ liên kết SAU cho hồ sơ chưa có đơn gốc.
 */
export function ReturnFindOrderScreen() {
  const params = useRouteParams();
  const linkId = params.returnId;
  return linkId ? <LinkLaterScreen returnId={linkId} /> : <FindOrderBody mode="new" />;
}

function LinkLaterScreen({ returnId }: { returnId: string }) {
  const { state, reload } = useReturnCase(returnId);
  if (state.kind !== 'ready')
    return <ReturnLoadState uiCode="UI-D02" state={state} onRetry={reload} />;
  return (
    <FindOrderBody
      mode="link"
      returnId={state.details.returnCase.id}
      code={state.details.returnCase.code}
      linked={state.details.returnCase.sourceOrderId !== null}
    />
  );
}

type BodyProps =
  { mode: 'new' } | { mode: 'link'; returnId: string; code: string; linked: boolean };

function FindOrderBody(props: BodyProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const ops = useReturnOps();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [chosen, setChosen] = useState<OrderId | null>(null);
  const [duplicates, setDuplicates] = useState<{
    items: readonly ReturnSummary[];
    pending: Selection;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);

  const candidates: readonly OrderCandidate[] =
    phase.kind === 'result' && phase.result.kind === 'found' ? phase.result.candidates : [];
  const only = candidates.length === 1 ? candidates[0] : undefined;
  const selectedId = only ? only.details.order.id : chosen;
  const selected = candidates.find((c) => c.details.order.id === selectedId);
  const typedCode = code.trim();

  const search = async () => {
    setFailure(null);
    setDuplicates(null);
    setChosen(null);
    setCodeError(null);
    setPhase({ kind: 'searching' });
    try {
      const result = await ops.lookupOrders(code);
      if (result.kind === 'invalid') {
        setCodeError(t('returns:find.invalidCode'));
        setPhase({ kind: 'idle' });
        return;
      }
      setPhase({ kind: 'result', result });
    } catch (error) {
      logger.warn('returns.lookup_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setPhase({ kind: 'error' });
    }
  };

  const finish = (details: { returnCase: { id: string } }) =>
    navigation.replace(ROUTES.returnExterior, { returnId: details.returnCase.id });

  const create = async (selection: Selection, basis: Exclude<LinkBasis, 'linked_later'>) => {
    setBusy(true);
    setFailure(null);
    try {
      let source: { details: OrderDetails; basis: Exclude<LinkBasis, 'linked_later'> } | null =
        null;
      if (selection.kind === 'order') {
        const found = selected?.details.order.id === selection.orderId ? selected.details : null;
        if (!found) throw new Error('candidate_missing');
        source = { details: found, basis };
      }
      const created = await ops.createReturn({
        observedCode: typedCode === '' ? null : typedCode,
        source,
      });
      finish(created);
    } catch (error) {
      logger.warn('returns.create_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setFailure(isAppError(error) ? error.code : 'RETURN_SAVE_FAILED');
      setBusy(false);
    }
  };

  /** Kiểm tra trùng trước khi tạo: đã có hồ sơ cho đơn/mã này thì hỏi lại, không tạo ngầm. */
  const proceed = async (selection: Selection, basis: Exclude<LinkBasis, 'linked_later'>) => {
    setBusy(true);
    setFailure(null);
    try {
      const existing = await ops.findOpenReturns(
        selection.kind === 'order'
          ? { orderId: selection.orderId }
          : typedCode === ''
            ? {}
            : { observedCodeKey: toCodeKey(typedCode) },
      );
      if (existing.length > 0) {
        setDuplicates({ items: existing, pending: selection });
        setBusy(false);
        return;
      }
    } catch (error) {
      logger.warn('returns.duplicate_check_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      setFailure('RETURN_SAVE_FAILED');
      setBusy(false);
      return;
    }
    await create(selection, basis);
  };

  const basisFor = (): Exclude<LinkBasis, 'linked_later'> =>
    candidates.length > 1 ? 'chosen_from_candidates' : 'code_match_confirmed';

  const link = async () => {
    if (props.mode !== 'link' || !selected) return;
    setBusy(true);
    setFailure(null);
    try {
      await ops.linkLater(props.returnId as never, selected.details);
      navigation.back();
    } catch (error) {
      logger.warn('returns.link_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setFailure(isAppError(error) ? error.code : 'RETURN_SAVE_FAILED');
      setBusy(false);
    }
  };

  const failureText = failure ? errorText(resolveErrorMessage(t, failure)) : null;

  if (props.mode === 'link' && props.linked) {
    return (
      <Screen title={t('nav:titles.UI-D02')} onBack={navigation.back} testID="screen-UI-D02">
        <View testID="return-already-linked">
          <EmptyState
            icon="info"
            title={t('returns:find.alreadyLinked')}
            message={t('errors:RETURN_ORDER_CONFLICT')}
            actionLabel={t('returns:common.backToList')}
            onAction={() => navigation.reset(ROUTES.returns)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      form
      title={t('nav:titles.UI-D02')}
      onBack={navigation.back}
      testID="screen-UI-D02"
      footer={
        phase.kind === 'result' ? (
          <>
            {props.mode === 'link' ? (
              <Button
                testID="return-link-order"
                label={t('returns:find.linkAction')}
                disabled={!selected || busy}
                loading={busy}
                onPress={() => void link()}
              />
            ) : (
              <>
                <Button
                  testID="return-use-order"
                  label={t('returns:find.useOrder')}
                  disabled={!selected || busy}
                  loading={busy}
                  onPress={() =>
                    selectedId && void proceed({ kind: 'order', orderId: selectedId }, basisFor())
                  }
                />
                <Button
                  testID="return-unlinked"
                  variant="secondary"
                  label={t('returns:find.unlinkedAction')}
                  disabled={busy}
                  onPress={() => void proceed({ kind: 'unlinked' }, 'code_match_confirmed')}
                />
              </>
            )}
          </>
        ) : props.mode === 'new' ? (
          <Button
            testID="return-unlinked"
            variant="secondary"
            label={t('returns:find.unlinkedAction')}
            disabled={busy}
            onPress={() => void proceed({ kind: 'unlinked' }, 'code_match_confirmed')}
          />
        ) : undefined
      }
    >
      <Text variant="formBody" color="inkMuted">
        {props.mode === 'link'
          ? t('returns:find.linkMode', { code: props.code })
          : t('returns:find.intro')}
      </Text>
      <TextField
        compact
        testID="return-code"
        label={t('returns:find.codeLabel')}
        placeholder={t('returns:find.codePlaceholder')}
        value={code}
        onChangeText={(value) => {
          setCode(value);
          setCodeError(null);
        }}
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={() => void search()}
        {...(codeError ? { error: codeError } : {})}
      />
      <Button
        testID="return-search"
        variant="secondary"
        size="compact"
        icon="search"
        label={phase.kind === 'searching' ? t('returns:find.searching') : t('returns:find.search')}
        loading={phase.kind === 'searching'}
        onPress={() => void search()}
      />
      {failureText ? (
        <Text
          variant="formBody"
          accessibilityRole="alert"
          testID="return-find-error"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {failureText}
        </Text>
      ) : null}
      {phase.kind === 'error' ? (
        <Text
          variant="formBody"
          accessibilityRole="alert"
          testID="return-search-error"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {t('returns:find.searchError')}
        </Text>
      ) : null}
      {phase.kind === 'result' ? (
        <ResultSection
          result={phase.result}
          candidates={candidates}
          selectedId={selectedId}
          onSelect={setChosen}
          unlinkedMode={props.mode === 'new'}
        />
      ) : null}
      {duplicates ? (
        <DuplicateCard
          items={duplicates.items}
          onOpen={(item) =>
            navigation.push(resumeRoute(item.returnCase.status), { returnId: item.returnCase.id })
          }
          onAnother={() => void create(duplicates.pending, basisFor())}
          busy={busy}
        />
      ) : null}
    </Screen>
  );
}

function ResultSection({
  result,
  candidates,
  selectedId,
  onSelect,
  unlinkedMode,
}: {
  result: Extract<OrderLookupResult, { kind: 'none' | 'found' }>;
  candidates: readonly OrderCandidate[];
  selectedId: OrderId | null;
  onSelect: (id: OrderId) => void;
  unlinkedMode: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  if (result.kind === 'none') {
    return (
      <Card compact testID="return-lookup-none" tone="default">
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="formButton" accessibilityRole="header">
            {t('returns:find.noneTitle')}
          </Text>
          <Text variant="formBody" color="inkMuted">
            {unlinkedMode ? t('returns:find.noneMessage') : t('errors:SOURCE_ORDER_NOT_FOUND')}
          </Text>
        </View>
      </Card>
    );
  }
  const many = candidates.length > 1;
  return (
    <View style={{ gap: tokens.space.sm }} testID="return-lookup-found">
      <Text variant="formButton" accessibilityRole="header">
        {many
          ? t('returns:find.manyTitle', { count: candidates.length })
          : t('returns:find.oneTitle')}
      </Text>
      {many ? (
        <Text variant="formBody" color="inkMuted">
          {t('returns:find.manyMessage')}
        </Text>
      ) : null}
      {candidates.map((candidate) => (
        <CandidateCard
          key={candidate.details.order.id}
          candidate={candidate}
          selected={candidate.details.order.id === selectedId}
          selectable={many}
          onSelect={() => onSelect(candidate.details.order.id)}
        />
      ))}
      <Text variant="caption" color="textMuted">
        {t('returns:find.enteredNote')}
      </Text>
    </View>
  );
}

function CandidateCard({
  candidate,
  selected,
  selectable,
  onSelect,
}: {
  candidate: OrderCandidate;
  selected: boolean;
  selectable: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { order, lines } = candidate.details;
  const first = lines[0];
  const productLine = first
    ? [first.name, first.variant].filter(Boolean).join(' · ')
    : t('returns:find.noProducts');
  return (
    <Card
      compact
      testID={`return-candidate-${order.id}`}
      {...(selectable ? { onPress: onSelect } : {})}
      accessibilityLabel={`${order.orderCode}. ${productLine}`}
      style={{
        borderColor: selected ? tokens.color.brand.primary : tokens.color.border.default,
        borderWidth: selected ? tokens.borderWidth.emphasis : tokens.borderWidth.thin,
      }}
    >
      <View style={{ flexDirection: 'row', gap: tokens.space.md, alignItems: 'center' }}>
        <SourceIcon source={order.source} size={tokens.component.tile.md} />
        <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.xxs }}>
          <Text variant="cardTitle">{order.orderCode}</Text>
          <Text variant="formBody" color="inkMuted" numberOfLines={2}>
            {productLine}
          </Text>
          {lines.length > 1 ? (
            <Text variant="caption" color="textMuted">
              {t('returns:find.moreProducts', { count: lines.length - 1 })}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs }}>
            {candidate.reasons.map((reason) => (
              <StatusBadge
                key={reason}
                label={t(`returns:find.matchBy.${reason}`)}
                tone="neutral"
              />
            ))}
          </View>
        </View>
        {selectable ? (
          <Icon
            name={selected ? 'check-circle' : 'forward'}
            size={tokens.icon.lg}
            color={selected ? tokens.color.brand.primary : tokens.color.text.tertiary}
          />
        ) : null}
      </View>
    </Card>
  );
}

function DuplicateCard({
  items,
  onOpen,
  onAnother,
  busy,
}: {
  items: readonly ReturnSummary[];
  onOpen: (item: ReturnSummary) => void;
  onAnother: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Card compact tone="warning" testID="return-duplicate">
      <View style={{ gap: tokens.space.sm }}>
        <Text variant="formButton" accessibilityRole="header">
          {t('returns:find.duplicateTitle')}
        </Text>
        <Text variant="formBody">{t('returns:find.duplicateMessage')}</Text>
        {items.slice(0, 3).map((item) => (
          <Button
            key={item.returnCase.id}
            testID={`return-open-existing-${item.returnCase.id}`}
            variant="secondary"
            size="slim"
            label={t('returns:find.openExisting', { code: item.returnCase.code })}
            onPress={() => onOpen(item)}
          />
        ))}
        <Button
          testID="return-another"
          size="compact"
          label={t('returns:find.another')}
          loading={busy}
          disabled={busy}
          onPress={onAnother}
        />
      </View>
    </Card>
  );
}
