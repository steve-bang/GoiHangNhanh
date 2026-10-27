import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  ILLUSTRATIVE_SYNC_JOBS,
  type IllustrativeSyncFilter,
} from '@/shared/fixtures/illustrative-data';
import {
  Button,
  Card,
  EmptyState,
  EvidenceStatusBadge,
  FilterChips,
  Screen,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

const FILTERS: readonly IllustrativeSyncFilter[] = [
  'uploading',
  'waiting_upload',
  'error',
  'uploaded',
];

/**
 * UI-F01 Trung tâm đồng bộ (đặc tả A07). Bốn bộ lọc theo docs/09: Đang tải lên, Chờ tải lên, Lỗi,
 * Đã tải lên. Mỗi tệp: tên hồ sơ, dung lượng, tiến độ/lý do chờ. KHÔNG có "Xóa tất cả" (UI-F01).
 * Ghi chú đúng sự thật về tải nền (docs/09 mục 5.5, A.4), không hứa "tự động hoàn tất". Nút thử
 * lại hàng loạt/từng tệp chưa có (cần hàng đợi thật); hiện chỉ có "Chi tiết". Dữ liệu minh họa.
 */
export function SyncCenterScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const navigation = useAppNavigation();
  const [filter, setFilter] = useState<IllustrativeSyncFilter>('uploading');

  const options: ChipOption<IllustrativeSyncFilter>[] = FILTERS.map((key) => ({
    key,
    label: t(`screens:sync.filter.${key}`),
  }));
  const visible = ILLUSTRATIVE_SYNC_JOBS.filter((job) => job.status === filter);

  return (
    <Screen
      title={t('nav:titles.UI-F01')}
      onBack={navigation.back}
      illustrative
      testID="screen-UI-F01"
    >
      <Text color="textMuted">{t('screens:sync.note')}</Text>
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} />
      <View style={{ gap: spacing.md }}>
        {visible.map((job) => (
          <Card key={job.id}>
            <View style={{ gap: spacing.sm }}>
              <Text variant="sectionTitle">{job.recordLabel}</Text>
              <Text color="textMuted">{job.sizeLabel}</Text>
              <EvidenceStatusBadge
                status={job.status}
                {...(job.progressPercent !== undefined
                  ? { progressPercent: job.progressPercent }
                  : {})}
                {...(job.reason ? { reason: t('screens:sync.waitingNetwork') } : {})}
              />
              <Button
                variant="secondary"
                label={t('screens:sync.details')}
                onPress={() => navigation.push(ROUTES.syncError, { jobId: job.id })}
              />
            </View>
          </Card>
        ))}
      </View>
      {visible.length === 0 ? (
        <EmptyState
          title={t('screens:sync.emptyTitle')}
          message={t('screens:sync.emptyMessage')}
          actionLabel={t('screens:sync.emptyAction')}
          onAction={() => navigation.push(ROUTES.orders)}
        />
      ) : null}
    </Screen>
  );
}
