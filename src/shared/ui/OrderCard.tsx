import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { EvidenceStatusLabel } from '@/core/theme';

import { Card } from './Card';
import { EvidenceStatusBadge } from './EvidenceStatusBadge';
import { Text } from './Text';

interface OrderCardProps {
  /** Mã đơn chỉ là chuỗi tìm kiếm/hiển thị, không phải ID (CLAUDE.md bất biến #1). */
  orderCode: string;
  sourceLabel: string;
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
        <Text variant="body" color="textMuted">
          {`${sourceLabel} · ${dateLabel}`}
        </Text>
        <Text variant="body">{videos}</Text>
        {status ? <EvidenceStatusBadge status={status} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ column: { gap: 4 } });
