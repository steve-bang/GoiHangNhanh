import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

export interface ProductLine {
  /** ID nội bộ của dòng (không phải mã đơn/SKU). */
  id: string;
  name: string;
  variant?: string;
  quantity: number;
}

interface ProductLineListProps {
  lines: readonly ProductLine[];
}

/**
 * Dòng sản phẩm khai báo của đơn. Mỗi variant là một dòng riêng, không gộp (CLAUDE.md #10). Nhãn
 * *Chưa khai báo sản phẩm* CHỈ hiện khi chưa có dòng nào (docs/09 mục 5.5, A.6). Giá trị do người
 * dùng nhập được ghi nguồn, không trình bày như dữ liệu từ sàn.
 */
export function ProductLineList({ lines }: ProductLineListProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();

  if (lines.length === 0) {
    return (
      <View
        accessible
        accessibilityLabel={t('common:productLines.undeclared')}
        style={[
          styles.undeclared,
          {
            backgroundColor: colors.warningSoft,
            borderColor: colors.warning,
            borderRadius: radius.sm,
            padding: spacing.md,
          },
        ]}
      >
        <Icon name="info" color={colors.warning} />
        <Text bold style={{ color: colors.warning, flexShrink: 1 }}>
          {t('common:productLines.undeclared')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      {lines.map((line) => (
        <View
          key={line.id}
          accessible
          accessibilityLabel={t('common:productLines.accessibility', {
            name: line.name,
            variant: line.variant ?? '-',
            count: line.quantity,
          })}
          style={styles.row}
        >
          <View style={styles.rowText}>
            <Text bold>{line.name}</Text>
            {line.variant ? <Text color="textMuted">{line.variant}</Text> : null}
            <Text variant="caption" color="textMuted">
              {t('common:productLines.userEntered')}
            </Text>
          </View>
          <Text bold>{t('common:productLines.quantity', { count: line.quantity })}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  undeclared: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1, gap: 2 },
});
