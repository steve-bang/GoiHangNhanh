import { useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';
import { useAppNavigation } from '@/platform';
import {
  ILLUSTRATIVE_RETURN_CASES,
  type IllustrativeReturnStage,
} from '@/shared/fixtures/illustrative-data';
import {
  Button,
  Card,
  EmptyState,
  EvidenceStatusBadge,
  FilterChips,
  Screen,
  SearchField,
  Text,
  useTheme,
  type ChipOption,
} from '@/shared/ui';

type StageFilter = 'all' | IllustrativeReturnStage;

const STAGES: readonly IllustrativeReturnStage[] = [
  'receiving',
  'checking',
  'checked',
  'discrepancy',
  'unsynced',
];

/**
 * UI-D01 Danh sách hàng hoàn (đặc tả B01). Tìm theo mã đơn/vận đơn/mã hoàn; lọc theo giai đoạn;
 * CTA *Tiếp nhận hàng hoàn*. Hồ sơ không có đơn gốc hiện "Chưa liên kết đơn gốc" (không tự ghép,
 * CLAUDE.md #5). Dữ liệu minh họa. Danh sách bộ lọc theo docs/09 UI-D01 (docs/05 B01 liệt kê bộ lọc
 * hơi khác: cần BA thống nhất - ghi ở decisions.md).
 */
export function ReturnsListScreen() {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StageFilter>('all');

  const options: ChipOption<StageFilter>[] = [
    { key: 'all', label: t('screens:returns.filterAll') },
    ...STAGES.map((key) => ({ key, label: t(`screens:returns.filter.${key}`) })),
  ];
  const needle = query.trim().toLowerCase();
  const visible = ILLUSTRATIVE_RETURN_CASES.filter(
    (item) =>
      (filter === 'all' || item.stage === filter) &&
      (needle === '' ||
        item.code.toLowerCase().includes(needle) ||
        (item.originalOrderCode ?? '').toLowerCase().includes(needle)),
  );

  return (
    <Screen
      title={t('nav:titles.UI-D01')}
      onBack={navigation.back}
      illustrative
      testID="screen-UI-D01"
      footer={
        <Button
          label={t('screens:returns.receive')}
          onPress={() => navigation.push(ROUTES.returnFindOrder)}
        />
      }
    >
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('screens:returns.search')}
      />
      <FilterChips options={options} selectedKey={filter} onSelect={setFilter} size="compact" />
      <View style={{ gap: tokens.space.md }}>
        {visible.map((item) => (
          <Card key={item.id}>
            <View style={{ gap: tokens.space.xs }}>
              <Text variant="cardTitle">{item.code}</Text>
              <Text variant="formBody" color="textMuted">
                {item.originalOrderCode ?? t('screens:returns.unlinked')}
              </Text>
              <Text
                variant="caption"
                color="textMuted"
              >{`${t(`screens:returns.filter.${item.stage}`)} · ${item.dateLabel}`}</Text>
              <EvidenceStatusBadge status={item.status} />
            </View>
          </Card>
        ))}
      </View>
      {visible.length === 0 ? (
        <EmptyState
          title={t('screens:returns.emptyTitle')}
          message={t('screens:returns.emptyMessage')}
          actionLabel={t('screens:returns.receive')}
          onAction={() => navigation.push(ROUTES.returnFindOrder)}
        />
      ) : null}
    </Screen>
  );
}
