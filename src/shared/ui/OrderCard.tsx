import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { OrderSource } from '@/core/orders/order-source';
import type { EvidenceStatusLabel } from '@/core/theme';
import { layout } from '@/core/theme';

import { Card } from './Card';
import { EvidenceStatusBadge } from './EvidenceStatusBadge';
import { SourceIcon } from './SourceIcon';
import { Text } from './Text';

interface OrderCardProps {
  /** Mã đơn chỉ là chuỗi tìm kiếm/hiển thị, không phải ID (CLAUDE.md bất biến #1). */
  orderCode: string;
  sourceLabel: string;
  /** Có thì hiện logo nguồn bán nhỏ cạnh nhãn chữ (trang trí). */
  source?: OrderSource;
  dateLabel: string;
  videoCount: number;
  status?: EvidenceStatusLabel;
  onPress?: () => void;
  testID?: string;
}

/** Thẻ đơn: mã, nguồn bán, ngày, số video, một trạng thái bằng chứng. Không nhồi thêm trường (UI-E01). */
export function OrderCard({
  orderCode,
  sourceLabel,
  source,
  dateLabel,
  videoCount,
  status,
  onPress,
  testID,
}: OrderCardProps) {
  const { t } = useTranslation();
  const videos =
    videoCount > 0
      ? t('common:orderCard.videoCount', { count: videoCount })
      : t('common:orderCard.noVideo');
  return (
    <Card
      testID={testID}
      {...(onPress ? { onPress } : {})}
      accessibilityLabel={`${orderCode}, ${sourceLabel}, ${dateLabel}, ${videos}`}
    >
      <View style={styles.column}>
        <Text variant="sectionTitle">{orderCode}</Text>
        <View style={styles.sourceRow}>
          {source ? <SourceIcon source={source} size={20} /> : null}
          <Text variant="body" color="textMuted" style={styles.sourceText}>
            {`${sourceLabel} · ${dateLabel}`}
          </Text>
        </View>
        <Text variant="body">{videos}</Text>
        {status ? <EvidenceStatusBadge status={status} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  column: { gap: layout.space.xs },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: layout.space.sm },
  sourceText: { flexShrink: 1 },
});
