import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import {
  toCodeKey,
  useCurrentShopId,
  useOrderStore,
  validateCode,
  type OrderDetails,
} from '@/features/orders';
import { hasOpeningEvidenceLimit, useReturnStore, type ReturnSummary } from '@/features/returns';
import { newDisputeId, useAppNavigation, useRouteParams } from '@/platform';
import { Button, Card, Screen, StatusBadge, Text, TextField, useTheme } from '@/shared/ui';

import { useDisputeStore } from '../data';
import { ISSUE_TYPES, type DisputeSubject, type DisputeSummary, type IssueType } from '../domain';
import { RadioRow } from './RadioRow';
import { useDisputeSubject } from './use-dispute-subject';

/**
 * UI-G02 Tạo hồ sơ tranh chấp. Gắn với MỘT đơn hoặc MỘT hồ sơ hàng hoàn bằng ID (từ tham số route, hoặc
 * người dùng chọn: nhập mã đơn / chọn hồ sơ hoàn gần đây; nhiều đơn khớp thì để người dùng chọn đúng đơn,
 * không chọn hộ). Không bắt khai lại thông tin đã có. Hồ sơ hoàn có hạn chế bằng chứng thì nói rõ nhãn đi
 * theo. Đã có hồ sơ MỞ cho cùng đối tượng thì báo trước và cho mở hồ sơ cũ, vẫn tạo thêm được.
 */
export function DisputeNewScreen() {
  const params = useRouteParams();
  const subjectState = useDisputeSubject({ orderId: params.orderId, returnId: params.returnId });
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const [chosen, setChosen] = useState<DisputeSubject | null>(null);

  if (subjectState.kind === 'loading') {
    return (
      <Screen title={t('nav:titles.UI-G02')} onBack={navigation.back} testID="screen-UI-G02">
        <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
          {t('disputes:common.loading')}
        </Text>
      </Screen>
    );
  }
  if (subjectState.kind === 'missing' || subjectState.kind === 'error') {
    return (
      <Screen title={t('nav:titles.UI-G02')} onBack={navigation.back} testID="screen-UI-G02">
        <Text variant="formBody" testID="dispute-subject-missing" accessibilityRole="alert">
          {t('disputes:new.subjectMissing')}
        </Text>
      </Screen>
    );
  }
  const subject = subjectState.kind === 'ready' ? subjectState.subject : chosen;
  return subject ? (
    <IssueForm
      subject={subject}
      onChangeSubject={subjectState.kind === 'none' ? () => setChosen(null) : undefined}
    />
  ) : (
    <SubjectPicker onPick={setChosen} />
  );
}

type OrderPhase =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'error' }
  | { kind: 'invalid' }
  | { kind: 'none' }
  | { kind: 'found'; orders: readonly OrderDetails[] };

function SubjectPicker({ onPick }: { onPick: (subject: DisputeSubject) => void }) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const orders = useOrderStore();
  const returns = useReturnStore();
  const shopId = useCurrentShopId();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<OrderPhase>({ kind: 'idle' });
  const [recent, setRecent] = useState<readonly ReturnSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    returns
      .listReturns(shopId, 10)
      .then((items) => {
        if (!cancelled) setRecent(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [returns, shopId]);

  const find = async () => {
    const checked = validateCode(code);
    if (!checked.ok) {
      setPhase({ kind: 'invalid' });
      return;
    }
    setPhase({ kind: 'searching' });
    try {
      const key = toCodeKey(checked.code);
      const found = await orders.findOrdersByCodes(shopId, {
        orderCodeKey: key,
        trackingCodeKey: key,
      });
      const details: OrderDetails[] = [];
      for (const match of found) {
        const d = await orders.getOrder(shopId, match.id);
        if (d) details.push(d);
      }
      setPhase(details.length === 0 ? { kind: 'none' } : { kind: 'found', orders: details });
    } catch (error) {
      logger.warn('disputes.order_search_failed', {
        reason: error instanceof Error ? error.name : 'unknown',
      });
      setPhase({ kind: 'error' });
    }
  };

  const pickOrder = (d: OrderDetails) =>
    onPick({ kind: 'order', orderId: d.order.id, label: d.order.orderCode });
  const pickReturn = (item: ReturnSummary) =>
    onPick({
      kind: 'return',
      returnId: item.returnCase.id,
      label: item.returnCase.code,
      orderId: item.returnCase.sourceOrderId,
      openingEvidenceLimit: hasOpeningEvidenceLimit(item.returnCase),
    });
  const message =
    phase.kind === 'invalid'
      ? t('returns:find.invalidCode')
      : phase.kind === 'none'
        ? t('disputes:new.orderNotFound')
        : phase.kind === 'error'
          ? t('disputes:new.searchError')
          : null;

  return (
    <Screen form title={t('nav:titles.UI-G02')} onBack={navigation.back} testID="screen-UI-G02">
      <Text variant="sectionTitle" accessibilityRole="header">
        {t('disputes:new.pickTitle')}
      </Text>
      <Text variant="formBody" color="inkMuted">
        {t('disputes:new.pickIntro')}
      </Text>
      <TextField
        testID="dispute-order-code"
        label={t('disputes:new.orderCode')}
        placeholder={t('disputes:new.orderCodePlaceholder')}
        value={code}
        onChangeText={(text) => {
          setCode(text);
          setPhase({ kind: 'idle' });
        }}
        autoCapitalize="characters"
        returnKeyType="search"
        onSubmitEditing={() => void find()}
      />
      <Button
        testID="dispute-find-order"
        variant="secondary"
        label={
          phase.kind === 'searching' ? t('disputes:new.submitting') : t('disputes:new.findOrder')
        }
        disabled={phase.kind === 'searching'}
        onPress={() => void find()}
      />
      {message ? (
        <Text variant="formBody" testID="dispute-order-message" accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      {phase.kind === 'found' ? (
        <View style={{ gap: tokens.space.sm }} testID="dispute-order-results">
          {phase.orders.length > 1 ? (
            <Text variant="formBody" color="inkMuted">
              {t('disputes:new.orderMany')}
            </Text>
          ) : null}
          {phase.orders.map((d) => (
            <Card
              key={d.order.id}
              compact
              testID={`dispute-pick-order-${d.order.id}`}
              onPress={() => pickOrder(d)}
              accessibilityLabel={t('disputes:subject.order', { code: d.order.orderCode })}
            >
              <Text bold>{d.order.orderCode}</Text>
              {d.order.trackingCode ? (
                <Text variant="caption" color="textMuted">
                  {d.order.trackingCode}
                </Text>
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}
      <Text variant="sectionTitle" accessibilityRole="header">
        {t('disputes:new.recentReturns')}
      </Text>
      {recent.length === 0 ? (
        <Text variant="formBody" color="textMuted" testID="dispute-no-returns">
          {t('disputes:new.noReturns')}
        </Text>
      ) : (
        recent.map((item) => (
          <Card
            key={item.returnCase.id}
            compact
            testID={`dispute-pick-return-${item.returnCase.id}`}
            onPress={() => pickReturn(item)}
            accessibilityLabel={t('disputes:subject.return', { code: item.returnCase.code })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
              <Text bold style={{ flex: 1 }}>
                {item.returnCase.code}
              </Text>
              {hasOpeningEvidenceLimit(item.returnCase) ? (
                <StatusBadge label={t('disputes:common.limited')} tone="warning" icon="alert" />
              ) : null}
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}

function IssueForm({
  subject,
  onChangeSubject,
}: {
  subject: DisputeSubject;
  onChangeSubject: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const store = useDisputeStore();
  const shopId = useCurrentShopId();
  const [issue, setIssue] = useState<IssueType | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);
  const [needIssue, setNeedIssue] = useState(false);
  const [existing, setExisting] = useState<DisputeSummary | null>(null);

  const same = (s: DisputeSubject) =>
    s.kind === subject.kind &&
    (s.kind === 'order'
      ? subject.kind === 'order' && s.orderId === subject.orderId
      : subject.kind === 'return' && s.returnId === subject.returnId);

  useEffect(() => {
    let cancelled = false;
    store
      .listDisputes(shopId, { status: 'open' })
      .then((items) => {
        if (!cancelled) setExisting(items.find((i) => same(i.dispute.subject)) ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `same` chỉ phụ thuộc `subject`
  }, [store, shopId, subject]);

  const submit = async () => {
    if (!issue) {
      setNeedIssue(true);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      const created = await store.createDispute({
        id: newDisputeId(),
        shopId,
        subject,
        issueType: issue,
        note: note.trim(),
        createdAtDevice: Date.now(),
      });
      navigation.replace(ROUTES.disputeSelectEvidence, { disputeId: created.dispute.id });
    } catch (error) {
      logger.warn('disputes.create_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setFailure(isAppError(error) ? error.code : 'DISPUTE_SAVE_FAILED');
      setBusy(false);
    }
  };

  return (
    <Screen
      form
      title={t('nav:titles.UI-G02')}
      onBack={navigation.back}
      testID="screen-UI-G02"
      footer={
        <Button
          testID="dispute-submit"
          label={busy ? t('disputes:new.submitting') : t('disputes:new.submit')}
          loading={busy}
          disabled={busy}
          onPress={() => void submit()}
        />
      }
    >
      <Card compact testID="dispute-subject-card">
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="caption" color="textMuted">
            {t('disputes:detail.subject')}
          </Text>
          <Text bold>{t(`disputes:subject.${subject.kind}`, { code: subject.label })}</Text>
          {subject.kind === 'return' && subject.openingEvidenceLimit ? (
            <View style={{ gap: tokens.space.xs }} testID="dispute-limited-notice">
              <View style={{ alignSelf: 'flex-start' }}>
                <StatusBadge label={t('disputes:common.limited')} tone="warning" icon="alert" />
              </View>
              <Text variant="caption" color="textMuted">
                {t('disputes:new.limitedNotice')}
              </Text>
            </View>
          ) : null}
          {subject.kind === 'return' && subject.orderId === null ? (
            <Text variant="caption" color="textMuted" testID="dispute-no-order-notice">
              {t('disputes:new.noOrderNotice')}
            </Text>
          ) : null}
          {onChangeSubject ? (
            <Button
              testID="dispute-change-subject"
              variant="secondary"
              label={t('disputes:new.pickTitle')}
              onPress={onChangeSubject}
            />
          ) : null}
        </View>
      </Card>
      {existing ? (
        <Card compact tone="warning" testID="dispute-duplicate">
          <View style={{ gap: tokens.space.xs }}>
            <Text bold accessibilityRole="header">
              {t('disputes:new.duplicateTitle')}
            </Text>
            <Text variant="formBody">{t('disputes:new.duplicateMessage')}</Text>
            <Button
              testID="dispute-open-existing"
              variant="secondary"
              label={`${t('disputes:new.openExisting')} (${existing.dispute.code})`}
              onPress={() =>
                navigation.push(ROUTES.disputeDetail, { disputeId: existing.dispute.id })
              }
            />
          </View>
        </Card>
      ) : null}
      <Text variant="formButton" accessibilityRole="header">
        {t('disputes:new.issueLabel')}
      </Text>
      <View accessibilityRole="radiogroup" style={{ gap: tokens.space.xs }}>
        {ISSUE_TYPES.map((type) => (
          <RadioRow
            key={type}
            testID={`dispute-issue-${type}`}
            label={t(`disputes:issue.${type}`)}
            selected={issue === type}
            onPress={() => {
              setIssue(type);
              setNeedIssue(false);
            }}
          />
        ))}
      </View>
      {needIssue ? (
        <Text
          variant="formBody"
          testID="dispute-issue-error"
          accessibilityRole="alert"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {t('disputes:new.chooseIssue')}
        </Text>
      ) : null}
      <TextField
        testID="dispute-note"
        label={t('disputes:new.noteLabel')}
        placeholder={t('disputes:new.notePlaceholder')}
        value={note}
        onChangeText={setNote}
        autoCapitalize="sentences"
        multiline
        maxLength={500}
        counterMax={500}
      />
      {failure ? (
        <Text
          variant="formBody"
          testID="dispute-create-error"
          accessibilityRole="alert"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {errorText(resolveErrorMessage(t, failure))}
        </Text>
      ) : null}
    </Screen>
  );
}
