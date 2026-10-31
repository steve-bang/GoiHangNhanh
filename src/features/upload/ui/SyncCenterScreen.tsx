import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useConnectivity, useRouteParams } from '@/platform';
import {
  Button,
  EmptyState,
  ErrorState,
  FilterChips,
  ListGroup,
  Screen,
  SkeletonCard,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

import {
  describeSyncJob,
  inForeignGroup,
  DONE_LIST_LIMIT,
  SYNC_FILTERS,
  type SyncFilter,
  type SyncJob,
  type SyncJobView,
} from '../domain';
import { SyncJobCard } from './SyncJobCard';
import { useSyncActions } from './use-sync-actions';
import { useSyncJobs, useSyncJobStores } from './use-sync-jobs';
import { useUploadNetworkGate, WifiOnlySwitch } from './wifi-only';

interface Row {
  readonly job: SyncJob;
  readonly view: SyncJobView;
}

/**
 * UI-F01 Trung tâm đồng bộ (đặc tả A07, V1-08). Tệp THẬT trên máy của shop đang dùng (bằng chứng đóng
 * gói + ảnh/video hàng hoàn), bốn bộ lọc theo docs/09: Đang tải lên, Chờ tải lên, Lỗi, Đã tải lên. Nhãn
 * theo trạng thái tệp (`describeSyncJob` -> `toDisplayStatus`), "Đã tải lên" chỉ khi máy chủ đã xác lập.
 * Thử lại cho tệp đủ điều kiện (R-3), Kiểm tra lại cho tệp máy chủ nhận lâu chưa xác minh. Tệp do tài
 * khoản khác tạo hiện riêng, không có nút. KHÔNG có "Xóa tất cả" (UI-F01). Câu đầu nói đúng: ứng dụng
 * chỉ tải khi đang mở, không hứa tải nền (bất biến 11). Công tắc "Chỉ tải khi có Wi‑Fi" ở đầu màn (V1-09);
 * đang chờ Wi‑Fi thì câu đầu và lý do từng tệp nói rõ, nhãn trạng thái tệp giữ nguyên.
 */
export function SyncCenterScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { online } = useConnectivity();
  const waitingWifi = useUploadNetworkGate() === 'waiting_wifi';
  // Tham số `filter` (ô "Lỗi – cần xử lý" ở Trang chủ mở thẳng bộ lọc Lỗi, V1-10); giá trị lạ bị bỏ qua.
  const requested = useRouteParams().filter;
  const [filter, setFilter] = useState<SyncFilter>(
    SYNC_FILTERS.find((key) => key === requested) ?? 'uploading',
  );
  const stores = useSyncJobStores();
  const { state, reload } = useSyncJobs(filter === 'uploaded');
  const { retry, recheck, busy } = useSyncActions(stores, reload);

  const rows = useMemo(() => {
    if (state.kind !== 'ready') return null;
    const now = state.loadedAt;
    const describe = (jobs: readonly SyncJob[]): Row[] =>
      jobs.flatMap((job) => {
        const view = describeSyncJob(job, { online, now, waitingWifi });
        return view ? [{ job, view }] : [];
      });
    return { pending: describe(state.pending), done: state.done ? describe(state.done) : null };
  }, [state, online, waitingWifi]);

  const count = (key: SyncFilter) =>
    rows ? rows.pending.filter((r) => r.view.filter === key).length : 0;
  const options: ChipOption<SyncFilter>[] = SYNC_FILTERS.map((key) => {
    const label = t(`screens:sync.filter.${key}`);
    const n = key === 'uploaded' ? 0 : count(key);
    return { key, label: n > 0 ? t('screens:sync.filterCount', { label, count: n }) : label };
  });

  // "Đã tải lên" nạp riêng khi chọn: chưa nạp xong thì hiện đang đọc, không hiện "rỗng".
  const doneLoading = filter === 'uploaded' && rows !== null && rows.done === null;
  const source = filter === 'uploaded' ? (rows?.done ?? []) : (rows?.pending ?? []);
  const visible = source.filter((r) => r.view.filter === filter);
  const own = visible.filter((r) => !inForeignGroup(r.job, r.view));
  const foreign = visible.filter((r) => inForeignGroup(r.job, r.view));
  const retryable = own.filter((r) => r.view.action === 'retry').map((r) => r.job);

  const card = ({ job, view }: Row) => (
    <SyncJobCard
      key={job.key}
      job={job}
      view={view}
      busy={busy.has(job.key)}
      navigation={navigation}
      onRetry={(j) => void retry([j])}
      onRecheck={(j) => void recheck(j)}
    />
  );

  return (
    <Screen title={t('nav:titles.UI-F01')} onBack={navigation.back} testID="screen-UI-F01">
      <Text color="textMuted" testID="sync-note">
        {t(
          !online
            ? 'screens:sync.offline'
            : waitingWifi
              ? 'screens:sync.waitingWifi'
              : 'screens:sync.note',
        )}
      </Text>
      <ListGroup>
        <WifiOnlySwitch />
      </ListGroup>
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} size="compact" />
      {state.kind === 'loading' || doneLoading ? (
        <View style={{ gap: tokens.space.md }}>
          <Text variant="formBody" color="textMuted" accessibilityLiveRegion="polite">
            {t('screens:sync.loading')}
          </Text>
          <SkeletonCard />
        </View>
      ) : null}
      {state.kind === 'error' ? (
        <ErrorState
          title={t('screens:sync.loadError')}
          onRetry={() => void reload()}
          retryLabel={t('screens:sync.reload')}
          testID="sync-load-error"
        />
      ) : null}
      {rows ? (
        <>
          {retryable.length > 1 ? (
            <Button
              variant="secondary"
              label={t('screens:sync.retryAll', { count: retryable.length })}
              onPress={() => void retry(retryable)}
              testID="sync-retry-all"
            />
          ) : null}
          <View style={{ gap: tokens.space.md }}>{own.map(card)}</View>
          {foreign.length > 0 ? (
            <View style={{ gap: tokens.space.md }} testID="sync-foreign-group">
              <Text variant="cardTitle">{t('screens:sync.foreignTitle')}</Text>
              <Text variant="formBody" color="textMuted">
                {t('screens:sync.foreignHint')}
              </Text>
              {foreign.map(card)}
            </View>
          ) : null}
          {filter === 'uploaded' && state.kind === 'ready' && state.doneTotal > DONE_LIST_LIMIT ? (
            <Text variant="caption" color="textMuted">
              {t('screens:sync.doneLimit', { count: DONE_LIST_LIMIT })}
            </Text>
          ) : null}
          {visible.length === 0 && !doneLoading ? (
            <EmptyState
              title={t('screens:sync.emptyTitle')}
              message={t('screens:sync.emptyMessage')}
              actionLabel={t('screens:sync.emptyAction')}
              onAction={() => navigation.push(ROUTES.orders)}
            />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
