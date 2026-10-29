import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { formatDeviceDateTime } from '@/features/orders';
import { shareText, useAppNavigation, useRouteParams } from '@/platform';
import { Button, Card, ErrorState, Screen, StatusBadge, Text, useTheme } from '@/shared/ui';

import { exportNotices, type DisputeDetails } from '../domain';
import { DisputeLoadState } from './DisputeLoadState';
import { FileStatus, useFileStatusText } from './FileStatus';
import { useDispute } from './use-dispute';
import { useDisputeFiles } from './use-dispute-files';

/**
 * UI-G04 Xem trước và xuất. Liệt kê ĐÚNG những gì có trong hồ sơ (thông tin, thời điểm theo giờ thiết bị,
 * trạng thái từng tệp) và nêu rõ điều thiếu/hạn chế. KHÔNG bao giờ gắn nhãn "đầy đủ" (chưa có chính sách
 * bộ bằng chứng bắt buộc, CLAUDE.md #11) và không kết luận nguyên nhân. Hồ sơ hoàn có hạn chế bằng chứng
 * luôn mang nhãn "Hạn chế bằng chứng" (Q-26h). Phiên bản này chỉ chia sẻ được bản tóm tắt văn bản; gói tệp
 * video/ảnh chưa có.
 */
export function DisputeExportScreen() {
  const params = useRouteParams();
  const { state, reload, shopId } = useDispute(params.disputeId);
  if (state.kind !== 'ready') {
    return <DisputeLoadState uiCode="UI-G04" state={state} onRetry={reload} />;
  }
  return <ExportBody details={state.details} shopId={shopId} />;
}

function ExportBody({
  details,
  shopId,
}: {
  details: DisputeDetails;
  shopId: DisputeDetails['dispute']['shopId'];
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const statusText = useFileStatusText();
  const { dispute } = details;
  const { state, reload } = useDisputeFiles(shopId, dispute.subject.orderId);
  const chosen =
    state.kind === 'ready'
      ? state.files
          .filter((f) => details.evidence.some((e) => e.evidenceId === f.id))
          .sort((a, b) => a.createdAtDevice - b.createdAtDevice)
      : [];
  const notices = state.kind === 'ready' ? exportNotices(details, chosen) : [];
  const subject = t(`disputes:subject.${dispute.subject.kind}`, { code: dispute.subject.label });

  const share = () => {
    const lines = [
      t('disputes:export.text.title', { code: dispute.code }),
      t('disputes:export.text.subject', { subject }),
      t('disputes:export.text.issue', { issue: t(`disputes:issue.${dispute.issueType}`) }),
      ...(dispute.note ? [t('disputes:export.text.note', { note: dispute.note })] : []),
      t('disputes:export.text.status', { status: t(`disputes:status.${dispute.status}`) }),
      t('disputes:export.text.created', { time: formatDeviceDateTime(dispute.createdAtDevice) }),
      ...notices.map((n) =>
        t('disputes:export.text.limited', { notice: t(`disputes:export.notice_${n}`) }),
      ),
      t('disputes:export.text.filesHeader', { count: chosen.length }),
      ...chosen.map((f) =>
        t('disputes:export.text.file', {
          kind: t(`disputes:select.${f.kind}`),
          time: formatDeviceDateTime(f.createdAtDevice),
          state: statusText(f.state),
        }),
      ),
      t('disputes:export.text.footer'),
    ];
    void shareText(lines.join('\n'));
  };

  return (
    <Screen
      form
      title={t('nav:titles.UI-G04')}
      onBack={navigation.back}
      testID="screen-UI-G04"
      footer={
        <>
          <Button
            testID="dispute-share"
            label={t('disputes:export.share')}
            disabled={state.kind !== 'ready'}
            onPress={share}
          />
          <Text variant="caption" color="textMuted">
            {t('disputes:export.shareHint')}
          </Text>
        </>
      }
    >
      <Text variant="formBody" color="inkMuted">
        {t('disputes:export.intro')}
      </Text>
      <Card compact testID="dispute-export-summary">
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="sectionTitle" accessibilityRole="header">
            {t('disputes:export.summary')}
          </Text>
          <Text bold>{dispute.code}</Text>
          <Text variant="formBody">{subject}</Text>
          <Text variant="formBody">{t(`disputes:issue.${dispute.issueType}`)}</Text>
          {dispute.note ? <Text variant="formBody">{dispute.note}</Text> : null}
          <Text variant="caption" color="textMuted">
            {t('disputes:export.text.created', {
              time: formatDeviceDateTime(dispute.createdAtDevice),
            })}
          </Text>
          {notices.includes('opening_evidence_limit') ? (
            <View style={{ alignSelf: 'flex-start' }} testID="dispute-export-limited">
              <StatusBadge label={t('disputes:common.limited')} tone="warning" icon="alert" />
            </View>
          ) : null}
        </View>
      </Card>
      {state.kind === 'error' ? (
        <ErrorState
          variant="card"
          testID="dispute-export-error"
          title={t('disputes:select.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      ) : null}
      {notices.length > 0 ? (
        <Card compact tone="warning" testID="dispute-export-notices">
          <View style={{ gap: tokens.space.xs }}>
            <Text bold accessibilityRole="header">
              {t('disputes:export.noticesTitle')}
            </Text>
            {notices.map((n) => (
              <Text key={n} variant="formBody" testID={`dispute-notice-${n}`}>
                {t(`disputes:export.notice_${n}`)}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
      <Text variant="sectionTitle" accessibilityRole="header">
        {t('disputes:export.files')}
      </Text>
      {chosen.length === 0 && state.kind === 'ready' ? (
        <Text variant="formBody" color="textMuted" testID="dispute-export-no-files">
          {t('disputes:export.noFiles')}
        </Text>
      ) : (
        chosen.map((f) => (
          <Card key={f.id} compact testID={`dispute-export-file-${f.id}`}>
            <View style={{ gap: tokens.space.xs }}>
              <Text
                bold
              >{`${t(`disputes:select.${f.kind}`)} · ${formatDeviceDateTime(f.createdAtDevice)}`}</Text>
              <FileStatus state={f.state} />
            </View>
          </Card>
        ))
      )}
      <Text variant="caption" color="textMuted">
        {t('disputes:export.packagePending')}
      </Text>
    </Screen>
  );
}
