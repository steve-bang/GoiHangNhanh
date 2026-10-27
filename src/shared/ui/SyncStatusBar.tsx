import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from './Card';
import { EvidenceStatusBadge } from './EvidenceStatusBadge';
import { Text } from './Text';
import { layout } from '@/core/theme';

/** Số tệp theo ba nhóm cần theo dõi. Nhóm có 0 tệp không hiển thị. */
export interface SyncCounts {
  uploading: number;
  waiting_upload: number;
  error: number;
}

interface SyncStatusBarProps {
  counts: SyncCounts;
  onPress: () => void;
}

const ORDER = ['error', 'waiting_upload', 'uploading'] as const;

/**
 * Thanh/khối trạng thái đồng bộ (UI-B01: chỉ hiện khi có lỗi hoặc tệp đang chờ). Dùng đúng nhãn
 * docs/09 mục 3 thay cho "Đã đồng bộ"/"Đã xử lý" mơ hồ (mockup 02, A.9) và không hứa tự hoàn tất:
 * tải nền bị hệ điều hành giới hạn (CLAUDE.md #11).
 */
export function SyncStatusBar({ counts, onPress }: SyncStatusBarProps) {
  const { t } = useTranslation();
  const visible = ORDER.filter((key) => counts[key] > 0);
  if (visible.length === 0) return null;
  return (
    <Card
      onPress={onPress}
      tone={counts.error > 0 ? 'danger' : 'warning'}
      accessibilityLabel={`${t('common:syncBar.title')}. ${t('common:syncBar.action')}`}
    >
      <View style={styles.column}>
        <Text variant="sectionTitle">{t('common:syncBar.title')}</Text>
        {visible.map((key) => (
          <View key={key} style={styles.row}>
            <EvidenceStatusBadge status={key} />
            <Text bold>{String(counts[key])}</Text>
          </View>
        ))}
        <Text variant="caption" color="textMuted">
          {t('common:syncBar.hint')}
        </Text>
        <Text bold color="brand">
          {t('common:syncBar.action')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  column: { gap: layout.space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: layout.space.md,
  },
});
