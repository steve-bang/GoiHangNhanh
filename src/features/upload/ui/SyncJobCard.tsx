import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { formatFileSize } from '@/features/evidence';
import { resumeRoute } from '@/features/returns';
import { EVIDENCE_STATUS_PRESENTATION } from '@/core/theme';
import { getMinTouchTarget, type AppNavigation } from '@/platform';
import { Button, EvidenceStatusBadge, Icon, Text, useTheme } from '@/shared/ui';

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
 * Một hàng tệp ở UI-F01 (đặt trong `ListGroup`, không phải thẻ riêng): vạch màu mảnh bên trái theo trạng
 * thái, icon loại tệp, tên hồ sơ, loại + dung lượng, nhãn trạng thái chuẩn (docs/09 mục 3) kèm lý do (chính
 * là bước tiếp theo), nút NHỎ Thử lại / Kiểm tra lại khi đủ điều kiện (`SyncJobView.action`), chạm phần
 * thông tin để mở Chi tiết (UI-F02) hoặc Mở hồ sơ. Không có nút xóa (UI-F01: không có "Xóa tất cả").
 */
export function SyncJobRow({
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
  // Màu vạch lấy từ chính bảng trạng thái chuẩn; vạch chỉ trang trí, nghĩa luôn có chữ ở nhãn bên cạnh.
  const accent = tokens.status[EVIDENCE_STATUS_PRESENTATION[view.label].statusToken].fg;
  // Chạm vào phần thông tin để mở chi tiết lỗi (UI-F02) hoặc hồ sơ chứa tệp; nút Thử lại / Kiểm tra
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}>
        <Icon
          name={job.kind === 'video' ? 'camera' : 'image'}
          size={tokens.icon.lg}
          color={tokens.color.text.secondary}
        />
        <View style={{ flex: 1, flexShrink: 1, gap: tokens.space.xxs }}>
          <Text variant="cardTitle">{recordLabel}</Text>
          <Text variant="caption" color="textMuted">
            {size}
          </Text>
        </View>
        {target ? (
          <Icon name="forward" size={tokens.icon.md} color={tokens.color.text.secondary} />
        ) : null}
      </View>
      <EvidenceStatusBadge
        compact
        status={view.label}
        {...(reason ? { reason } : {})}
        testID={`sync-job-status-${job.key}`}
      />
    </View>
  );
  const actionLabel =
    view.action === 'retry'
      ? t('screens:sync.retry')
      : view.action === 'recheck'
        ? t('screens:sync.recheck')
        : null;
  return (
    <View
      testID={`sync-job-${job.key}`}
      style={{
        flexDirection: 'row',
        alignItems: 'stretch',
        opacity: busy ? tokens.opacity.busy : 1,
      }}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: tokens.borderWidth.ring, backgroundColor: accent }}
      />
      <View
        style={{
          flex: 1,
          flexShrink: 1,
          gap: tokens.space.sm,
          paddingVertical: tokens.space.md,
          paddingHorizontal: tokens.space.lg,
        }}
      >
        {target ? (
          <Pressable
            onPress={target}
            accessibilityRole="button"
            accessibilityLabel={spoken}
            accessibilityHint={targetLabel}
            accessibilityState={{ busy }}
            testID={done ? `sync-job-open-${job.key}` : `sync-job-details-${job.key}`}
            style={({ pressed }) => ({
              minHeight: getMinTouchTarget(),
              justifyContent: 'center',
              opacity: pressed ? tokens.opacity.pressed : 1,
            })}
          >
            {info}
          </Pressable>
        ) : (
          <View accessible accessibilityLabel={spoken} accessibilityState={{ busy }}>
            {info}
          </View>
        )}
        {actionLabel ? (
          // Nút nhỏ nằm trong hàng; nút chính của màn chỉ là "Thử lại tất cả" ở khối trạng thái tổng.
          <View style={{ alignSelf: 'flex-start' }}>
            <Button
              variant="secondary"
              size="slim"
              label={actionLabel}
              onPress={() => (view.action === 'retry' ? onRetry(job) : onRecheck(job))}
              disabled={busy}
              loading={busy}
              testID={
                view.action === 'retry'
                  ? `sync-job-retry-${job.key}`
                  : `sync-job-recheck-${job.key}`
              }
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
