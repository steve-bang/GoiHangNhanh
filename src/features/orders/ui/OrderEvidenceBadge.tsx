import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EvidenceStatusBadge, Icon, Text, useTheme } from '@/shared/ui';

import type { OrderEvidenceSummary } from '../domain';

/** Chữ của trạng thái ở mức đơn (cũng dùng làm nhãn đọc màn hình). */
export function useEvidenceSummaryText(summary: OrderEvidenceSummary): string {
  const { t } = useTranslation();
  switch (summary.kind) {
    case 'none':
      return t('common:orderCard.noVideo');
    case 'capture':
      return t(`evidence:capture.${summary.phase}`);
    case 'label':
      return t(`evidence:status.${summary.label}`);
  }
}

/**
 * Trạng thái bằng chứng của đơn: 6 nhãn chuẩn (docs/09 mục 3) qua `EvidenceStatusBadge`; "Chưa có
 * video" (mức đơn, không phải nhãn tệp) và hai pha ghi hình dùng khung riêng cùng kiểu (gọn: tab Đơn hàng dùng nhóm form, Q-18). Luôn có
 * chữ + biểu tượng; không hiện % tải lên trên thẻ.
 */
export function OrderEvidenceBadge({
  summary,
  testID,
}: {
  summary: OrderEvidenceSummary;
  testID?: string;
}) {
  const { colors, spacing, radius } = useTheme();
  const text = useEvidenceSummaryText(summary);
  if (summary.kind === 'label') {
    return <EvidenceStatusBadge compact status={summary.label} {...(testID ? { testID } : {})} />;
  }
  const tone = summary.kind === 'capture' ? colors.brand : colors.textMuted;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={text}
      style={[
        styles.pill,
        {
          borderColor: tone,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          paddingHorizontal: spacing.sm,
          paddingVertical: 2,
        },
      ]}
    >
      <Icon name="camera" size={14} color={tone} />
      <Text variant="caption" bold style={{ color: tone }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
});
