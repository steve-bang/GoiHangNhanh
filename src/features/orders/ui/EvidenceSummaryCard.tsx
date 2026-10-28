import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { layout } from '@/core/theme';
import { Card, IconTile, Text, useTheme } from '@/shared/ui';

import type { EvidenceCounts, OrderEvidenceSummary } from '../domain';
import { OrderEvidenceBadge } from './OrderEvidenceBadge';

/**
 * Khối Bằng chứng của đơn (ORD-07): MỘT trạng thái ở mức đơn (`summarizeOrderEvidence`). Hôm nay chưa
 * có tệp thật nên luôn "Chưa có video đóng gói."; số video/ảnh chỉ hiện khi `counts` có dữ liệu thật,
 * không bao giờ là số minh họa. Không có nhãn "đã đồng bộ" nếu trạng thái không do máy chủ xác nhận.
 */
export function EvidenceSummaryCard({
  summary,
  counts,
}: {
  summary: OrderEvidenceSummary;
  counts: EvidenceCounts | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  return (
    <Card compact>
      <View style={styles.row}>
        <IconTile icon="shield-check" size="md" />
        <View style={[styles.flex, { gap: tokens.space.xs }]}>
          <Text variant="formButton" color="ink" accessibilityRole="header">
            {t('screens:orderDetail.evidence')}
          </Text>
          {summary.kind === 'none' ? (
            <Text variant="formBody" color="ink" testID="detail-no-evidence">
              {t('screens:orderDetail.noEvidence')}
            </Text>
          ) : (
            <>
              <OrderEvidenceBadge summary={summary} />
              {counts ? (
                <Text variant="formBody" color="inkMuted" testID="detail-evidence-counts">
                  {t('screens:orderDetail.evidenceCounts', {
                    videos: counts.videos,
                    photos: counts.photos,
                  })}
                </Text>
              ) : null}
            </>
          )}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: layout.space.md },
});
