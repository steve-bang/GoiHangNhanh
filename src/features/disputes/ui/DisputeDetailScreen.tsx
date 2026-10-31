import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { formatDeviceDateTime } from '@/features/orders';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  ConfirmDialog,
  Screen,
  StatusBadge,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';

import { useDisputeStore } from '../data';
import type { DisputeDetails } from '../domain';
import { DisputeLoadState } from './DisputeLoadState';
import { useDispute } from './use-dispute';

/**
 * UI-G05 Chi tiết và đóng hồ sơ. Nêu vấn đề, đối tượng (đơn/hồ sơ hoàn), bằng chứng đã chọn, lịch sử.
 * Cho bổ sung bằng chứng/ghi chú khi hồ sơ còn mở, xem trước và xuất. Đóng hồ sơ cần xác nhận và KHÔNG xóa
 * bằng chứng hay lịch sử (bất biến 7, 9); chỉ bỏ trạng thái "giữ" của hồ sơ đó.
 */
export function DisputeDetailScreen() {
  const params = useRouteParams();
  const { state, reload, setDetails, shopId } = useDispute(params.disputeId);
  if (state.kind !== 'ready') {
    return <DisputeLoadState uiCode="UI-G05" state={state} onRetry={reload} />;
  }
  return <DetailBody details={state.details} shopId={shopId} onChange={setDetails} />;
}

function DetailBody({
  details,
  shopId,
  onChange,
}: {
  details: DisputeDetails;
  shopId: DisputeDetails['dispute']['shopId'];
  onChange: (d: DisputeDetails) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const store = useDisputeStore();
  const { dispute } = details;
  const closed = dispute.status === 'closed';
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);
  const subject = t(`disputes:subject.${dispute.subject.kind}`, { code: dispute.subject.label });
  const limited = dispute.subject.kind === 'return' && dispute.subject.openingEvidenceLimit;

  const run = async (task: () => Promise<DisputeDetails>) => {
    setBusy(true);
    setFailure(null);
    try {
      onChange(await task());
      return true;
    } catch (error) {
      logger.warn('disputes.update_failed', { reason: isAppError(error) ? error.code : 'unknown' });
      setFailure(isAppError(error) ? error.code : 'DISPUTE_SAVE_FAILED');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const saveNote = async () => {
    if (note.trim() === '') {
      setNoteError(true);
      return;
    }
    if (await run(() => store.addNote(shopId, dispute.id, note.trim(), Date.now()))) setNote('');
  };
  const close = async () => {
    setClosing(false);
    await run(() => store.closeDispute(shopId, dispute.id, '', Date.now()));
  };
  const params = { disputeId: dispute.id };

  return (
    <Screen
      form
      title={t('nav:titles.UI-G05')}
      onBack={navigation.back}
      testID="screen-UI-G05"
      footer={
        closed ? undefined : (
          <Button
            testID="dispute-close"
            variant="secondary"
            label={t('disputes:detail.close')}
            disabled={busy}
            onPress={() => setClosing(true)}
          />
        )
      }
    >
      <Card compact testID="dispute-header">
        <View style={{ gap: tokens.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
            <Text variant="sectionTitle" style={{ flex: 1 }} accessibilityRole="header">
              {dispute.code}
            </Text>
            <StatusBadge
              label={t(`disputes:status.${dispute.status}`)}
              tone={closed ? 'neutral' : 'info'}
            />
          </View>
          <Text variant="caption" color="textMuted">
            {t('disputes:detail.subject')}
          </Text>
          <Text bold>{subject}</Text>
          <Text variant="caption" color="textMuted">
            {t('disputes:detail.issue')}
          </Text>
          <Text variant="formBody">{t(`disputes:issue.${dispute.issueType}`)}</Text>
          <Text variant="caption" color="textMuted">
            {t('disputes:detail.note')}
          </Text>
          <Text variant="formBody">{dispute.note || t('disputes:detail.noNote')}</Text>
          {limited ? (
            <View style={{ alignSelf: 'flex-start' }} testID="dispute-detail-limited">
              <StatusBadge label={t('disputes:common.limited')} tone="warning" icon="alert" />
            </View>
          ) : null}
          {closed ? (
            <Text variant="caption" color="textMuted" testID="dispute-closed-hint">
              {`${t('disputes:detail.closedAt', { time: formatDeviceDateTime(dispute.closedAtDevice ?? dispute.updatedAtDevice) })}. ${t('disputes:detail.closedHint')}`}
            </Text>
          ) : null}
        </View>
      </Card>

      <Card compact testID="dispute-evidence-card">
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t('disputes:detail.evidence')}
          </Text>
          <Text variant="formBody" testID="dispute-evidence-count">
            {details.evidence.length > 0
              ? t('disputes:list.evidenceCount', { count: details.evidence.length })
              : t('disputes:detail.evidenceNone')}
          </Text>
          {!closed ? (
            <Button
              testID="dispute-detail-add-evidence"
              variant="secondary"
              label={t('disputes:detail.addEvidence')}
              onPress={() => navigation.push(ROUTES.disputeSelectEvidence, params)}
            />
          ) : null}
          <Button
            testID="dispute-detail-export"
            variant="secondary"
            label={t('disputes:detail.export')}
            onPress={() => navigation.push(ROUTES.disputeExport, params)}
          />
        </View>
      </Card>

      {!closed ? (
        <Card compact testID="dispute-note-card">
          <View style={{ gap: tokens.space.sm }}>
            <TextField
              testID="dispute-add-note"
              label={t('disputes:detail.noteLabel')}
              placeholder={t('disputes:detail.notePlaceholder')}
              value={note}
              onChangeText={(text) => {
                setNote(text);
                setNoteError(false);
              }}
              autoCapitalize="sentences"
              multiline
              maxLength={500}
              counterMax={500}
              {...(noteError ? { error: t('disputes:detail.noteEmpty') } : {})}
            />
            <Button
              testID="dispute-save-note"
              variant="secondary"
              label={t('disputes:detail.noteSave')}
              disabled={busy}
              onPress={() => void saveNote()}
            />
          </View>
        </Card>
      ) : null}

      <Card compact testID="dispute-history">
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="formButton" accessibilityRole="header">
            {t('disputes:detail.history')}
          </Text>
          {details.events.map((event) => (
            <View key={event.id} style={{ gap: tokens.space.xxs }} testID="dispute-history-item">
              <Text variant="formBody">
                {t(`disputes:detail.events.${event.kind}`)}
                {event.kind === 'note_added' || event.kind === 'closed'
                  ? event.note
                    ? `: ${event.note}`
                    : ''
                  : ''}
              </Text>
              <Text variant="caption" color="textMuted">
                {formatDeviceDateTime(event.atDevice)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
      {failure ? (
        <Text
          variant="formBody"
          testID="dispute-detail-error"
          accessibilityRole="alert"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {errorText(resolveErrorMessage(t, failure))}
        </Text>
      ) : null}
      <Text variant="caption" color="textMuted">
        {t('disputes:common.localOnly')}
      </Text>
      <ConfirmDialog
        visible={closing}
        title={t('disputes:detail.closeTitle')}
        message={t('disputes:detail.closeMessage')}
        confirmLabel={t('disputes:detail.closeConfirm')}
        cancelLabel={t('disputes:detail.closeCancel')}
        onConfirm={() => void close()}
        onCancel={() => setClosing(false)}
        confirmTestID="dispute-close-confirm"
      />
    </Screen>
  );
}
