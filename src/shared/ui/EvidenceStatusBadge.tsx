import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  EVIDENCE_STATUS_PRESENTATION,
  type ColorRole,
  type EvidenceStatusLabel,
} from '@/core/theme';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './theme';

interface EvidenceStatusBadgeProps {
  status: EvidenceStatusLabel;
  /** Lý do đang chờ (ví dụ "Đang chờ mạng") - docs/09 mục 3 yêu cầu ghi lý do cho "Chờ tải lên". */
  reason?: string;
  /** 0-100, chỉ hiển thị khi `status === 'uploading'` và đo được (không bịa tiến độ). */
  progressPercent?: number;
  testID?: string;
}

const SOFT_BACKGROUND: Partial<Record<ColorRole, ColorRole>> = {
  brand: 'brandSoft',
  success: 'successSoft',
  warning: 'warningSoft',
  danger: 'dangerSoft',
  textMuted: 'surface',
};

/**
 * Nhãn trạng thái bằng chứng, 6 nhãn thống nhất toàn app (docs/09 mục 3). Luôn có CHỮ + BIỂU
 * TƯỢNG + viền (màu không là tín hiệu duy nhất). Nhãn/biểu tượng/màu lấy từ
 * `EVIDENCE_STATUS_PRESENTATION`; không tự đặt ở nơi khác. *Đã lưu trên máy* dùng biểu tượng
 * thiết bị và màu trung tính, KHÔNG dùng tick hay màu thành công.
 */
export function EvidenceStatusBadge({
  status,
  reason,
  progressPercent,
  testID,
}: EvidenceStatusBadgeProps) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const presentation = EVIDENCE_STATUS_PRESENTATION[status];
  const foreground = colors[presentation.colorRole];
  const background = colors[SOFT_BACKGROUND[presentation.colorRole] ?? 'surface'];

  const label = t(presentation.labelKey);
  const progress =
    status === 'uploading' && progressPercent !== undefined
      ? ` ${Math.round(progressPercent)}%`
      : '';
  const spoken = [label + progress, reason].filter(Boolean).join('. ');

  return (
    <View testID={testID} accessible accessibilityLabel={spoken} style={styles.wrapper}>
      <View
        style={[
          styles.pill,
          {
            borderColor: foreground,
            backgroundColor: background,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          },
        ]}
      >
        <Icon name={presentation.icon} size={16} color={foreground} />
        <Text variant="caption" bold style={{ color: foreground }}>
          {label + progress}
        </Text>
      </View>
      {reason ? (
        <Text variant="caption" color="textMuted">
          {reason}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-start', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1 },
});
