import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getMinTouchTarget } from '@/platform';
import { EVIDENCE_STATUS_PRESENTATION, type EvidenceStatusLabel } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { toneColors, type IconTone } from './tone';
import { useTheme } from './theme';

type StatusCardKind =
  | {
      /** Trạng thái bằng chứng: màu/biểu tượng lấy từ `semantic.status`, tiêu đề mặc định từ i18n. */
      status: EvidenceStatusLabel;
      tone?: never;
      icon?: never;
    }
  | {
      /** Thẻ thông tin khác (ví dụ lưu trữ, hạn lưu): tông + biểu tượng do bên gọi chọn. */
      tone: IconTone;
      icon: IconName;
      status?: never;
    };

type StatusCardProps = StatusCardKind & {
  /**
   * Bắt buộc với `tone`; với `status` mặc định là nhãn chuẩn docs/09 mục 3. KHÔNG đổi sang chữ
   * mạnh hơn trạng thái thật (ví dụ "đã sao lưu" khi chưa được máy chủ xác nhận).
   */
  title?: string;
  description?: string;
  /** 0-100. Chỉ truyền khi đo được; có thì hiện thanh tiến độ + phần trăm. */
  progress?: number;
  testID?: string;
};

/**
 * Thẻ trạng thái dạng ngang: biểu tượng + tiêu đề + mô tả (+ thanh tiến độ). Luôn có chữ và biểu
 * tượng, màu không là tín hiệu duy nhất. Hôm nay CHỈ dựng và test; app thật không hiển thị khi
 * chưa có dữ liệu thật (Q-21i).
 */
export function StatusCard(props: StatusCardProps) {
  const { description, progress, testID } = props;
  const { t } = useTranslation();
  const { tokens } = useTheme();

  let fg: string;
  let bg: string;
  let icon: IconName;
  let title: string;
  if (props.status) {
    const presentation = EVIDENCE_STATUS_PRESENTATION[props.status];
    ({ fg, bg } = tokens.status[presentation.statusToken]);
    icon = presentation.icon;
    title = props.title ?? t(presentation.labelKey);
  } else {
    ({ fg, bg } = toneColors(tokens, props.tone));
    icon = props.icon;
    title = props.title ?? '';
  }
  const percent =
    progress === undefined ? undefined : Math.min(100, Math.max(0, Math.round(progress)));
  const spoken = [title, description, percent === undefined ? undefined : `${percent}%`]
    .filter(Boolean)
    .join('. ');
  const side = tokens.component.tile.md;

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      style={[
        styles.row,
        {
          minHeight: getMinTouchTarget(),
          gap: tokens.space.md,
          padding: tokens.space.md,
          backgroundColor: tokens.color.surface.raised,
          borderColor: tokens.color.border.default,
          borderWidth: tokens.borderWidth.thin,
          borderRadius: tokens.radius.md,
        },
      ]}
    >
      <View
        style={[
          styles.icon,
          { width: side, height: side, backgroundColor: bg, borderRadius: tokens.radius.full },
        ]}
      >
        <Icon name={icon} size={22} color={fg} />
      </View>
      <View style={[styles.body, { gap: tokens.space.xs }]}>
        <Text bold>{title}</Text>
        {percent !== undefined ? (
          <View style={[styles.row, { gap: tokens.space.sm }]}>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={[
                styles.track,
                {
                  height: tokens.component.progress.height,
                  backgroundColor: tokens.color.border.field,
                  borderRadius: tokens.radius.full,
                },
              ]}
            >
              <View
                style={{
                  width: `${percent}%`,
                  height: '100%',
                  backgroundColor: tokens.status.uploading.fg,
                  borderRadius: tokens.radius.full,
                }}
              />
            </View>
            <Text variant="caption" bold style={{ color: fg }}>{`${percent}%`}</Text>
          </View>
        ) : null}
        {description ? (
          <Text variant="caption" style={{ color: fg }}>
            {description}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  track: { flex: 1, overflow: 'hidden' },
});
