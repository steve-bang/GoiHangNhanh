import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { FILE_STATES } from '@/features/evidence';
import { formatDeviceDateTime, useCurrentShopId, useCurrentUid } from '@/features/orders';
import { useAppNavigation, useConnectivity, useRouteParams, useScreenFocused } from '@/platform';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  EvidenceStatusBadge,
  Screen,
  SkeletonCard,
  Text,
  useTheme,
} from '@/shared/ui';

import {
  describeSyncJob,
  loadSyncJob,
  noActionNote,
  parseSyncJobKey,
  PENDING_SYNC_STATES,
  type SyncJob,
  type SyncJobView,
} from '../domain';
import { useUploadQueueControl } from '../data';
import { openSyncRecord, useSyncJobText } from './SyncJobCard';
import { useSyncActions } from './use-sync-actions';
import { useUploadNetworkGate } from './wifi-only';
import { useSyncJobStores } from './use-sync-jobs';

/** UI-F02 mở cho tệp còn việc đồng bộ hoặc đã nhận mà chưa xác minh; `verified` = không còn cần xử lý. */
const DETAIL_STATES = [...PENDING_SYNC_STATES, FILE_STATES.UPLOADED];

type WhereKey = 'local' | 'localUnreadable' | 'changed' | 'missing' | 'partial' | 'server';

/** Dữ liệu còn ở đâu (UI-F02: "nêu dữ liệu còn ở đâu"). */
function whereOf(job: SyncJob, view: SyncJobView): WhereKey {
  if (job.state === FILE_STATES.UPLOADED) return 'server';
  if (view.reason === 'fileMissing' || view.reason === 'unrecoverable') return 'missing';
  if (view.reason === 'fileUnreadable') return 'localUnreadable';
  if (view.reason === 'fileChanged') return 'changed';
  if (view.reason === 'localSaveFailed') return 'partial';
  return 'local';
}

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error' }
  | { readonly kind: 'gone' }
  | { readonly kind: 'ready'; readonly job: SyncJob; readonly loadedAt: number };

/**
 * UI-F02 Chi tiết lỗi đồng bộ (V1-08). Mở bằng khóa tệp (`pack:<id>` / `return:<id>`), chỉ trong shop
 * đang dùng (tệp shop khác = không có). Nói chuyện gì xảy ra, dữ liệu đang ở đâu, việc làm tiếp: Thử lại
 * khi đủ điều kiện (R-3), Kiểm tra lại cho tệp máy chủ nhận lâu chưa xác minh, Mở hồ sơ. Lỗi không thử
 * lại được thì nói rõ tệp vẫn được giữ; không bắt quay lại khi tệp gốc còn nguyên.
 */
export function SyncErrorScreen() {
  const { t } = useTranslation();
  const navigation = useAppNavigation();
  const params = useRouteParams();
  const shopId = useCurrentShopId();
  const uid = useCurrentUid();
  const focused = useScreenFocused();
  const { online } = useConnectivity();
  const waitingWifi = useUploadNetworkGate() === 'waiting_wifi';
  const control = useUploadQueueControl();
  const stores = useSyncJobStores();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const ticket = useRef(0);
  const target = parseSyncJobKey(params.jobId);

  const reload = useCallback(async () => {
    const mine = ++ticket.current;
    if (!target) {
      setState({ kind: 'gone' });
      return;
    }
    try {
      const job = await loadSyncJob(stores, shopId, uid, target, DETAIL_STATES);
      if (mine !== ticket.current) return;
      setState(job ? { kind: 'ready', job, loadedAt: Date.now() } : { kind: 'gone' });
    } catch {
      if (mine === ticket.current) setState({ kind: 'error' });
    }
    // `target` đổi theo chuỗi `params.jobId`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, shopId, uid, params.jobId]);

  useEffect(() => {
    if (!focused) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nạp từ kho cục bộ khi mở/lấy lại focus
    void reload();
    return control.subscribe(() => void reload());
  }, [focused, reload, control]);

  const { retry, recheck, busy } = useSyncActions(stores, reload);
  const header = {
    title: t('nav:titles.UI-F02'),
    onBack: navigation.back,
    testID: 'screen-UI-F02',
  };

  if (state.kind === 'loading') {
    return (
      <Screen {...header}>
        <SkeletonCard />
      </Screen>
    );
  }
  if (state.kind === 'error') {
    return (
      <Screen {...header}>
        <ErrorState
          title={t('screens:sync.loadError')}
          onRetry={() => void reload()}
          retryLabel={t('screens:sync.reload')}
        />
      </Screen>
    );
  }
  const view =
    state.kind === 'ready'
      ? describeSyncJob(state.job, { online, now: state.loadedAt, waitingWifi })
      : null;
  if (state.kind === 'gone' || !view) {
    return (
      <Screen {...header}>
        <EmptyState
          title={t('screens:sync.detail.notFoundTitle')}
          message={t('screens:sync.detail.notFoundMessage')}
          actionLabel={t('screens:sync.detail.back')}
          onAction={() => navigation.replace(ROUTES.sync)}
        />
      </Screen>
    );
  }
  return (
    <SyncErrorBody
      job={state.job}
      view={view}
      busy={busy.has(state.job.key)}
      onRetry={(job) => void retry([job])}
      onRecheck={(job) => void recheck(job)}
    />
  );
}

/** Nội dung UI-F02 khi đã đọc được tệp. */
function SyncErrorBody({
  job,
  view,
  busy,
  onRetry,
  onRecheck,
}: {
  job: SyncJob;
  view: SyncJobView;
  busy: boolean;
  onRetry: (job: SyncJob) => void;
  onRecheck: (job: SyncJob) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { recordLabel, size, reason } = useSyncJobText(job, view);
  const open = openSyncRecord(navigation, job);
  const note = noActionNote(job, view);
  const noActionKey =
    note === 'foreign'
      ? 'screens:sync.detail.foreignNoAction'
      : note === 'cannotRetry'
        ? 'screens:sync.detail.noAction'
        : null;
  return (
    <Screen title={t('nav:titles.UI-F02')} onBack={navigation.back} testID="screen-UI-F02">
      <Card>
        <View style={{ gap: tokens.space.sm }}>
          <Text variant="cardTitle">{recordLabel}</Text>
          <Text variant="formBody" color="textMuted">
            {size}
          </Text>
          <EvidenceStatusBadge status={view.label} testID="sync-detail-status" />
        </View>
      </Card>
      {reason ? (
        <View style={{ gap: tokens.space.xs }}>
          <Text variant="cardTitle">{t('screens:sync.detail.causeTitle')}</Text>
          <Text testID="sync-detail-cause">{reason}</Text>
        </View>
      ) : null}
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="cardTitle">{t('screens:sync.detail.whereTitle')}</Text>
        <Text testID="sync-detail-where">
          {t(`screens:sync.detail.where.${whereOf(job, view)}`)}
        </Text>
      </View>
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="formBody" color="textMuted">
          {t('screens:sync.detail.info.attempts', { count: job.attemptCount })}
        </Text>
        <Text variant="formBody" color="textMuted">
          {t('screens:sync.detail.info.updated', {
            time: formatDeviceDateTime(job.updatedAtDevice),
          })}
        </Text>
      </View>
      {view.action === 'retry' ? (
        <Button
          label={t('screens:sync.retry')}
          onPress={() => onRetry(job)}
          disabled={busy}
          loading={busy}
          testID="sync-detail-retry"
        />
      ) : null}
      {view.action === 'recheck' ? (
        <Button
          label={t('screens:sync.recheck')}
          onPress={() => onRecheck(job)}
          disabled={busy}
          loading={busy}
          testID="sync-detail-recheck"
        />
      ) : null}
      {noActionKey ? (
        <Text color="textMuted" testID="sync-detail-no-action">
          {t(noActionKey)}
        </Text>
      ) : null}
      {open ? (
        <Button
          variant="secondary"
          label={t('screens:sync.openRecord')}
          onPress={open}
          testID="sync-detail-open"
        />
      ) : null}
    </Screen>
  );
}
