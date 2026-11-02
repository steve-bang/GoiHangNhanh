import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { formatFileSize } from '@/features/evidence';
import { resumeRoute } from '@/features/returns';
import { EVIDENCE_STATUS_PRESENTATION } from '@/core/theme';
import { getMinTouchTarget, type AppNavigation } from '@/platform';
import { Button, Card, EvidenceStatusBadge, Icon, Text, useTheme } from '@/shared/ui';

import type { SyncJob, SyncJobView } from '../domain';

/** Chữ hiển thị của một tệp: tên hồ sơ, loại + dung lượng, lý do cạnh nhãn. */
export function useSyncJobText(job: SyncJob, view: SyncJobView) {
  const { t } = useTranslation();
  const { record } = job;
  let recordLabel: string;
  if (record.kind === 'pack' && record.orderCode) {
    recordLabel =
      record.packageIndex !== null
        ? t('screens:sync.record.pack', { code: record.orderCode, index: record.packageIndex })
        : t('screens:sync.record.packNoIndex', { code: record.orderCode });
  } else if (record.kind === 'return' && record.caseCode) {
    recordLabel = t('screens:sync.record.return', { code: record.caseCode });
  } else {
    recordLabel = t('screens:sync.record.unknown');
  }
  const kind = t(`screens:sync.kind.${job.kind}`);
  const size =
    job.sizeBytes !== null && job.sizeBytes > 0
      ? t('screens:sync.size', { kind, size: formatFileSize(job.sizeBytes) })
      : kind;
  const reason = view.foreign
    ? t(`evidence:uploaderNote.${view.foreign}`)
    : view.reason
      ? t(`screens:sync.reason.${view.reason}`)
      : undefined;
  return { recordLabel, size, reason };
}

/** Mở hồ sơ chứa tệp: đơn (UI-E03) hoặc hồ sơ hàng hoàn (màn theo trạng thái hồ sơ, như D01). */
export function openSyncRecord(navigation: AppNavigation, job: SyncJob): (() => void) | null {
  const { record } = job;
  if (record.kind === 'pack') {
    return () => navigation.push(ROUTES.orderEvidence, { orderId: record.orderId });
  }
  if (!record.caseStatus) return null;
  const status = record.caseStatus;
  return () => navigation.push(resumeRoute(status), { returnId: record.returnId });
}

/**
 * Thẻ một tệp ở UI-F01: tên hồ sơ, loại + dung lượng, nhãn trạng thái chuẩn (docs/09 mục 3) + lý do,
 * nút Thử lại / Kiểm tra lại khi đủ điều kiện (`SyncJobView.action`), Chi tiết (UI-F02) hoặc Mở hồ sơ.
 * Không có nút xóa (UI-F01: không có "Xóa tất cả").
 */
export function SyncJobCard({
  job,
  view,
  busy,
  navigation,
  onRetry,
  onRecheck,
}: {
  job: SyncJob;
  view: SyncJobView;
  busy: boolean;
  navigation: AppNavigation;
  onRetry: (job: SyncJob) => void;
  onRecheck: (job: SyncJob) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { recordLabel, size, reason } = useSyncJobText(job, view);
  const open = openSyncRecord(navigation, job);
  const done = view.filter === 'uploaded';
  // Chạm vào phần thông tin của thẻ để mở chi tiết lỗi (UI-F02) hoặc hồ sơ chứa tệp; nút Thử lại / Kiểm tra
  // lại là phần tử riêng bên dưới. Nhãn trợ năng gộp: hồ sơ, loại + dung lượng, trạng thái kèm lý do.
  const target = done ? open : () => navigation.push(ROUTES.syncError, { jobId: job.key });
  const targetLabel = t(done ? 'screens:sync.openRecord' : 'screens:sync.details');
  const spoken = [
    recordLabel,
    size,
    [t(EVIDENCE_STATUS_PRESENTATION[view.label].labelKey), reason].filter(Boolean).join('. '),
  ].join('. ');
  const info = (
    <View style={{ gap: tokens.space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
        <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.xs }}>
          <Text variant="cardTitle">{recordLabel}</Text>
          <Text variant="formBody" color="textMuted">
            {size}
          </Text>
        </View>
        {target ? (
          <Icon name="forward" size={tokens.icon.md} color={tokens.color.text.secondary} />
        ) : null}
      </View>
      <EvidenceStatusBadge
        status={view.label}
        {...(reason ? { reason } : {})}
        testID={`sync-job-status-${job.key}`}
      />
    </View>
  );
  return (
    <Card testID={`sync-job-${job.key}`}>
      <View style={{ gap: tokens.space.sm }}>
        {target ? (
          <Pressable
            onPress={target}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            accessibilityHint={targetLabel}
            testID={done ? `sync-job-open-${job.key}` : `sync-job-details-${job.key}`}
            style={({ pressed }) => ({
              minHeight: getMinTouchTarget(),
              opacity: pressed ? tokens.opacity.pressed : 1,
            })}
          >
            {info}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={spoken}>
            {info}
          </View>
        )}
        {view.action === 'retry' ? (
          <Button
            label={t('screens:sync.retry')}
            onPress={() => onRetry(job)}
            disabled={busy}
            loading={busy}
            testID={`sync-job-retry-${job.key}`}
          />
        ) : null}
        {view.action === 'recheck' ? (
          <Button
            label={t('screens:sync.recheck')}
            onPress={() => onRecheck(job)}
            disabled={busy}
            loading={busy}
            testID={`sync-job-recheck-${job.key}`}
          />
        ) : null}
      </View>
    </Card>
  );
}
