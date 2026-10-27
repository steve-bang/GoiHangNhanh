import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';
import { layout } from '@/core/theme';

export interface ProductLine {
  /** ID nội bộ của dòng (không phải mã đơn/SKU). */
  id: string;
  name: string;
  variant?: string;
  quantity: number;
}

interface ProductLineListProps {
  lines: readonly ProductLine[];
  /** Chữ nhóm form (formButton/formBody) và khoảng cách nhỏ; dữ liệu không đổi. */
  compact?: boolean;
}

/**
 * Dòng sản phẩm khai báo của đơn. Mỗi variant là một dòng riêng, không gộp (CLAUDE.md #10). Nhãn
 * *Chưa khai báo sản phẩm* CHỈ hiện khi chưa có dòng nào (docs/09 mục 5.5, A.6). Giá trị do người
 * dùng nhập được ghi nguồn, không trình bày như dữ liệu từ sàn.
 */
export function ProductLineList({ lines, compact = false }: ProductLineListProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  if (lines.length === 0) {
    return (
      <View
        accessible
        accessibilityLabel={t('common:productLines.undeclared')}
        style={[
          styles.undeclared,
          {
            backgroundColor: tokens.color.feedback.warning.bg,
            borderColor: tokens.color.feedback.warning.fg,
            borderRadius: tokens.radius.sm,
            padding: compact ? tokens.space.sm : tokens.space.md,
          },
        ]}
      >
        <Icon name="info" size={compact ? 18 : 22} color={tokens.color.feedback.warning.fg} />
        <Text
          {...(compact ? { variant: 'formButton' as const } : { bold: true })}
          style={{ color: tokens.color.feedback.warning.fg, flexShrink: 1 }}
        >
          {t('common:productLines.undeclared')}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: compact ? tokens.space.sm : tokens.space.md }}>
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
            <Text {...(compact ? { variant: 'formButton' as const } : { bold: true })}>
              {line.name}
            </Text>
            {line.variant ? (
              <Text {...(compact ? { variant: 'formBody' as const } : {})} color="textMuted">
                {line.variant}
              </Text>
            ) : null}
            <Text variant="caption" color="textMuted">
              {t('common:productLines.userEntered')}
            </Text>
          </View>
          <Text {...(compact ? { variant: 'formButton' as const } : { bold: true })}>
            {t('common:productLines.quantity', { count: line.quantity })}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  undeclared: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.space.sm,
    borderWidth: layout.borderWidth.thin,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: layout.space.md },
  rowText: { flex: 1, gap: layout.space.xxs },
});
