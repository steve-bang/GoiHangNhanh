import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LocalVideoPlayer, recordingExists, resolveRecordingUri } from '@/platform';
import { Card, EmptyState, EvidenceStatusBadge, Text, useTheme } from '@/shared/ui';

import {
  formatDuration,
  formatFileSize,
  localPlaybackOf,
  shortHash,
  toDisplayStatus,
  type EvidenceFile,
  type LocalPlayback,
} from '../domain';

export interface EvidenceDetailRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface EvidenceDetailViewProps {
  readonly file: Pick<
    EvidenceFile,
    'id' | 'kind' | 'state' | 'localPath' | 'sizeBytes' | 'durationMs' | 'sha256Client'
  >;
  /** Tên loại bằng chứng (ví dụ "Video đóng gói"), do màn gọi đặt theo nhóm. */
  readonly kindLabel: string;
  /** Giờ THIẾT BỊ lúc ghi, đã định dạng (không phải thời gian máy chủ, bất biến 11). */
  readonly capturedAtLabel: string;
  /** Liên kết đơn/kiện/phiên của tệp (theo ID lưu trong bản ghi tệp, không suy từ mã đơn). */
  readonly links: readonly EvidenceDetailRow[];
}

/**
 * Nội dung UI-E04 Chi tiết bằng chứng (V1-17): phát video/hiện ảnh TỪ TỆP TRÊN MÁY NÀY, nhãn trạng thái
 * tệp thật (docs/09 mục 3 qua `toDisplayStatus`), thông tin tệp và liên kết. CHỈ ĐỌC: không có nút sửa,
 * xóa, cắt hay ghi đè (bất biến 4). Tệp không còn trên máy thì nói thẳng, không hứa xem từ máy chủ (v1
 * chưa có URL xem, Q-24a). Màn gọi lo việc nạp bản ghi theo `evidenceId` và cô lập shop.
 */
export function EvidenceDetailView({
  file,
  kindLabel,
  capturedAtLabel,
  links,
}: EvidenceDetailViewProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const display = toDisplayStatus(file.state);
  const { state, localPath } = file;
  const playback = useMemo(
    () => localPlaybackOf({ state, localPath }, recordingExists),
    [state, localPath],
  );
  // Câu giải thích của nhãn nói "bản trên thiết bị vẫn được giữ"; tệp đã mất thì chỉ giữ câu của
  // trạng thái do máy chủ xác nhận, không nói điều sai về tệp trên máy.
  const showHint =
    display.kind === 'label' &&
    (playback === 'available' || display.label === 'uploaded' || display.label === 'verified');
  const info: EvidenceDetailRow[] = [
    { key: 'kind', label: t('evidence:detail.info.kind'), value: kindLabel },
    { key: 'capturedAt', label: t('evidence:detail.info.capturedAt'), value: capturedAtLabel },
    ...(file.kind === 'video' && file.durationMs !== null
      ? [
          {
            key: 'duration',
            label: t('evidence:detail.info.duration'),
            value: formatDuration(file.durationMs),
          },
        ]
      : []),
    ...(file.sizeBytes !== null
      ? [
          {
            key: 'size',
            label: t('evidence:detail.info.size'),
            value: formatFileSize(file.sizeBytes),
          },
        ]
      : []),
    ...links,
  ];

  return (
    <>
      <EvidenceMedia file={file} playback={playback} />
      <Card compact testID="evidence-detail-status">
        <View style={{ gap: tokens.space.xs }}>
          {display.kind === 'label' ? (
            <>
              <EvidenceStatusBadge compact status={display.label} testID="evidence-detail-badge" />
              {showHint ? (
                <Text variant="formBody" color="inkMuted" testID="evidence-detail-hint">
                  {t(`evidence:statusHint.${display.label}`)}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="formButton" color="ink" testID="evidence-detail-capture">
              {t(`evidence:capture.${display.phase}`)}
            </Text>
          )}
        </View>
      </Card>
      <Card compact testID="evidence-detail-info">
        <View style={{ gap: tokens.space.sm }}>
          {info.map((row) => (
            <View
              key={row.key}
              style={[styles.row, { gap: tokens.space.sm }]}
              testID={`evidence-detail-${row.key}`}
            >
              <Text variant="formLabel" color="inkMuted" style={styles.label}>
                {row.label}
              </Text>
              <Text variant="formBody" color="ink" style={styles.value}>
                {row.value}
              </Text>
            </View>
          ))}
          {file.sha256Client ? (
            <View style={{ gap: tokens.space.xxs }} testID="evidence-detail-hash">
              <View style={[styles.row, { gap: tokens.space.sm }]}>
                <Text variant="formLabel" color="inkMuted" style={styles.label}>
                  {t('evidence:detail.info.hash')}
                </Text>
                <Text
                  variant="formBody"
                  color="ink"
                  style={styles.value}
                  accessibilityLabel={file.sha256Client}
                >
                  {shortHash(file.sha256Client)}
                </Text>
              </View>
              <Text variant="caption" color="textMuted">
                {t('evidence:detail.hashNote')}
              </Text>
            </View>
          ) : null}
        </View>
      </Card>
      <Text variant="caption" color="textMuted" testID="evidence-detail-readonly">
        {t('evidence:detail.readOnly')}
      </Text>
    </>
  );
}

/** Khung xem: trình phát/ảnh khi tệp còn trên máy; ngược lại là trạng thái trung thực, không đoán. */
function EvidenceMedia({
  file,
  playback,
}: {
  file: EvidenceDetailViewProps['file'];
  playback: LocalPlayback;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const [playFailed, setPlayFailed] = useState(false);
  const noun = file.kind === 'video' ? 'video' : 'photo';

  if (playback !== 'available' || playFailed) {
    const variant =
      playback === 'capturing' ? 'capturing' : playback === 'missing' ? 'missing' : 'playFailed';
    return (
      <Card compact testID={`evidence-media-${variant}`}>
        <EmptyState
          compact
          iconCircle
          icon={variant === 'capturing' ? 'clock' : 'alert-triangle'}
          title={t(`evidence:detail.media.${variant}Title.${noun}`)}
          message={t(`evidence:detail.media.${variant}Message`)}
        />
      </Card>
    );
  }

  const uri = resolveRecordingUri(file.localPath ?? '');
  const frame = {
    backgroundColor: tokens.color.camera.background,
    borderRadius: tokens.radius.md,
  };
  return (
    <View style={[styles.frame, frame]} testID="evidence-media-available">
      {file.kind === 'video' ? (
        <LocalVideoPlayer
          key={uri}
          uri={uri}
          style={styles.fill}
          testID="evidence-video-player"
          accessibilityLabel={t('evidence:detail.media.videoLabel')}
          onError={() => setPlayFailed(true)}
        />
      ) : (
        <Image
          testID="evidence-photo"
          source={{ uri }}
          style={styles.fill}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessibilityLabel={t('evidence:detail.media.photoLabel')}
          onError={() => setPlayFailed(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // token-exception: tỉ lệ khung xem video/ảnh dọc (quay điện thoại cầm dọc); không phải số thiết kế.
  frame: { width: '100%', aspectRatio: 3 / 4, overflow: 'hidden' },
  fill: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  label: { flex: 2 },
  value: { flex: 3 },
});
