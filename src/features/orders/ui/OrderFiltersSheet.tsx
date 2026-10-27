import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ORDER_SOURCES, type OrderSource } from '@/core/orders/order-source';
import { BottomSheet, Button, FilterChips, Text, useTheme, type ChipOption } from '@/shared/ui';

import type { DeclarationFilter, OrderListFilters, PeriodFilter } from '../domain';

type PeriodKey = PeriodFilter | 'all';
type SourceKey = OrderSource | 'all';
type DeclarationKey = DeclarationFilter | 'all';

const PERIODS: readonly PeriodFilter[] = ['today', 'last7days', 'last30days'];
const DECLARATIONS: readonly DeclarationFilter[] = ['declared', 'undeclared'];

/**
 * Bộ lọc nâng cao (UI-E01): thời gian TẠO đơn, nguồn bán, trạng thái khai báo. Chỉnh trên bản nháp,
 * chỉ có hiệu lực khi bấm *Áp dụng*; *Đóng* bỏ bản nháp. "Tùy chọn" (khoảng ngày tự chọn) và lọc theo
 * trạng thái bằng chứng chưa làm (decisions.md Q-18). Danh sách nguồn bán chỉ là phân loại do người
 * dùng chọn khi tạo đơn, không ngụ ý có tích hợp sàn (bất biến 10).
 */
export function OrderFiltersSheet({
  visible,
  filters,
  onApply,
  onClose,
}: {
  visible: boolean;
  filters: OrderListFilters;
  onApply: (next: OrderListFilters) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [draft, setDraft] = useState(filters);

  // Mỗi lần mở lại, bản nháp bắt đầu từ bộ lọc đang áp dụng.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- đồng bộ bản nháp khi mở sheet
    if (visible) setDraft(filters);
  }, [visible, filters]);

  const periodOptions: ChipOption<PeriodKey>[] = [
    { key: 'all', label: t('screens:orders.filters.period.all') },
    ...PERIODS.map((key) => ({ key, label: t(`screens:orders.filters.period.${key}`) })),
  ];
  const sourceOptions: ChipOption<SourceKey>[] = [
    { key: 'all', label: t('screens:orders.filters.source.all') },
    ...ORDER_SOURCES.map((key) => ({ key, label: t(`common:sources.${key}`) })),
  ];
  const declarationOptions: ChipOption<DeclarationKey>[] = [
    { key: 'all', label: t('screens:orders.filters.declaration.all') },
    ...DECLARATIONS.map((key) => ({
      key,
      label: t(`screens:orders.filters.declaration.${key}`),
    })),
  ];

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('screens:orders.filters.title')}>
      <View testID="orders-filters-sheet" style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.sm }}>
          <Text bold accessibilityRole="header">
            {t('screens:orders.filters.period.title')}
          </Text>
          <FilterChips
            options={periodOptions}
            selectedKey={draft.period ?? 'all'}
            onSelect={(key) => setDraft({ ...draft, period: key === 'all' ? null : key })}
          />
          <Text variant="caption" color="textMuted">
            {t('screens:orders.filters.period.note')}
          </Text>
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text bold accessibilityRole="header">
            {t('screens:orders.filters.source.title')}
          </Text>
          <FilterChips
            options={sourceOptions}
            selectedKey={draft.source ?? 'all'}
            onSelect={(key) => setDraft({ ...draft, source: key === 'all' ? null : key })}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text bold accessibilityRole="header">
            {t('screens:orders.filters.declaration.title')}
          </Text>
          <FilterChips
            options={declarationOptions}
            selectedKey={draft.declaration ?? 'all'}
            onSelect={(key) => setDraft({ ...draft, declaration: key === 'all' ? null : key })}
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Button
            testID="orders-filters-apply"
            label={t('screens:orders.filters.apply')}
            onPress={() => onApply(draft)}
          />
          <Button
            testID="orders-filters-clear"
            variant="secondary"
            label={t('screens:orders.filters.clear')}
            onPress={() => setDraft({ ...draft, period: null, source: null, declaration: null })}
          />
        </View>
      </View>
    </BottomSheet>
  );
}
