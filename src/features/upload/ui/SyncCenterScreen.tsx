import { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation, useConnectivity, useRouteParams } from '@/platform';
import {
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  Icon,
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
  type SyncReason,
  type SyncJobView,
} from '../domain';
import { SyncJobRow } from './SyncJobCard';
import { SyncSummaryCard } from './SyncSummaryCard';
import { useSyncActions } from './use-sync-actions';
import { useSyncJobs, useSyncJobStores } from './use-sync-jobs';
import { UploadSettingsRow, useUploadNetworkGate } from './wifi-only';

/**
 * Thứ tự chip theo ưu tiên việc cần làm (Lỗi trước). Chỉ là thứ tự HIỂN THỊ: `SYNC_FILTERS` của domain
 * giữ nguyên (route `?filter=` và bộ lọc mặc định không phụ thuộc thứ tự này).
 */
const CHIP_ORDER: readonly SyncFilter[] = ['error', 'uploading', 'waiting_upload', 'uploaded'];

/** Lý do cho biết tệp có thể không còn nguyên trên máy: khi có, không được nói "Tệp vẫn ở trên máy". */
const LOCAL_FILE_AT_RISK: readonly SyncReason[] = [
  'fileMissing',
  'fileUnreadable',
  'fileChanged',
  'localSaveFailed',
  'unrecoverable',
  'unknownAttention',
];

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
  // Bộ lọc người dùng chọn (hoặc do route chỉ định). Chưa chọn thì tự đặt MỘT lần khi danh sách tải xong:
  // có tệp lỗi thì mở thẳng "Lỗi" (việc cần xử lý trước), không thì "Đang tải lên" như cũ.
  const [chosen, setChosen] = useState<SyncFilter | null>(
    SYNC_FILTERS.find((key) => key === requested) ?? null,
  );
  const [auto, setAuto] = useState<SyncFilter | null>(null);
  const filter: SyncFilter = chosen ?? auto ?? 'uploading';
  const setFilter = setChosen;
  const [refreshing, setRefreshing] = useState(false);
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
  if (rows && chosen === null && auto === null) setAuto(count('error') > 0 ? 'error' : 'uploading');
  const refresh = () => {
    setRefreshing(true);
    void reload().finally(() => setRefreshing(false));
  };
  const waitingCount = count('uploading') + count('waiting_upload');
  const errorRows = rows ? rows.pending.filter((r) => r.view.filter === 'error') : [];
  const errorCount = errorRows.length;
  // Thử lại tất cả: mọi tệp lỗi của tài khoản này đủ điều kiện (R-3), không phụ thuộc bộ lọc đang chọn.
  const retryable = errorRows
    .filter((r) => r.view.action === 'retry' && !inForeignGroup(r.job, r.view))
    .map((r) => r.job);
  const stillOnDevice = !errorRows.some(
    (r) => r.view.reason !== null && LOCAL_FILE_AT_RISK.includes(r.view.reason),
  );
  // Chip một hàng, nhãn ngắn; quá hẹp thì cuộn ngang nhẹ thay vì xuống dòng (ngăn lệch hàng chip).
  const options: ChipOption<SyncFilter>[] = CHIP_ORDER.map((key) => {
    const label = t(`screens:sync.chip.${key}`);
    const n = key === 'uploaded' ? 0 : count(key);
    return { key, label: n > 0 ? t('screens:sync.filterCount', { label, count: n }) : label };
  });

  // "Đã tải lên" nạp riêng khi chọn: chưa nạp xong thì hiện đang đọc, không hiện "rỗng".
  const doneLoading = filter === 'uploaded' && rows !== null && rows.done === null;
  const source = filter === 'uploaded' ? (rows?.done ?? []) : (rows?.pending ?? []);
  const visible = source.filter((r) => r.view.filter === filter);
  const own = visible.filter((r) => !inForeignGroup(r.job, r.view));
  const foreign = visible.filter((r) => inForeignGroup(r.job, r.view));

  const row = ({ job, view }: Row) => (
    <SyncJobRow
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
    <Screen
      title={t('nav:titles.UI-F01')}
      onBack={navigation.back}
      testID="screen-UI-F01"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {rows ? (
        <SyncSummaryCard
          errorCount={errorCount}
          waitingCount={waitingCount}
          stillOnDevice={stillOnDevice}
          retryableCount={retryable.length}
          retrying={retryable.some((j) => busy.has(j.key))}
          onRetryAll={() => void retry(retryable)}
        />
      ) : null}
      {!online || waitingWifi ? (
        // Cảnh báo mạng đúng câu hiện có; mất mạng hay chờ Wi‑Fi thì tệp vẫn ở trên máy.
        <Card compact tone="warning">
          <View
            accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.md }}
          >
            <Icon
              name={online ? 'wifi' : 'wifi-off'}
              size={tokens.icon.lg}
              color={tokens.color.feedback.warning.fg}
            />
            <Text style={{ flex: 1, flexShrink: 1 }} testID="sync-note">
              {t(!online ? 'screens:sync.offline' : 'screens:sync.waitingWifi')}
            </Text>
          </View>
        </Card>
      ) : null}
      <ListGroup>
        <UploadSettingsRow />
      </ListGroup>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ paddingVertical: tokens.space.xs }}>
          <FilterChips options={options} selectedKey={filter} onSelect={setFilter} size="compact" />
        </View>
      </ScrollView>
      {state.kind === 'loading' || doneLoading ? (
        <View style={{ gap: tokens.space.md }}>
          <Text variant="formBody" color="textMuted" accessibilityLiveRegion="polite">
            {t('screens:sync.loading')}
          </Text>
          {/* Khối giữ chỗ ẩn khỏi trình đọc màn hình: chỉ nghe câu "Đang đọc danh sách tệp…" ở trên. */}
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <SkeletonCard />
          </View>
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
          {own.length > 0 ? <ListGroup>{own.map(row)}</ListGroup> : null}
          {foreign.length > 0 ? (
            <View style={{ gap: tokens.space.md }} testID="sync-foreign-group">
              <Text variant="cardTitle">{t('screens:sync.foreignTitle')}</Text>
              <Text variant="formBody" color="textMuted">
                {t('screens:sync.foreignHint')}
              </Text>
              <ListGroup>{foreign.map(row)}</ListGroup>
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
