import { useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { ShopId } from '@/core/ids';
import { recordingExists, resolveRecordingUri, VideoPlayer } from '@/platform';
import {
  Card,
  EmptyState,
  ErrorState,
  EvidenceStatusBadge,
  SkeletonCard,
  Text,
  useTheme,
} from '@/shared/ui';

import {
  formatDuration,
  FILE_STATES,
  foreignUploadNote,
  formatFileSize,
  isServerConfirmed,
  localPlaybackOf,
  shortHash,
  toDisplayStatus,
  type EvidenceFile,
  type LocalPlayback,
  type UploaderRelation,
} from '../domain';
import { useEvidenceReadUrl } from './use-evidence-read-url';

export interface EvidenceDetailRow {
  readonly key: string;
  readonly label: string;
  readonly value: string;
}

export interface EvidenceDetailViewProps {
  /** Shop của tệp: để xin URL xem từ máy chủ khi tệp trên máy không còn (bất biến 8). */
  readonly shopId: ShopId;
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
  /**
   * Ai đã tạo tệp so với tài khoản đang đăng nhập (V1-07). Khác `current`: nhãn "Chờ tải lên" kèm lý do
   * máy này không tải tệp (Q-24g). Không truyền = `current`.
   */
  readonly uploader?: UploaderRelation;
}

/**
 * Nội dung UI-E04 Chi tiết bằng chứng (V1-17): phát video/hiện ảnh TỪ TỆP TRÊN MÁY NÀY, nhãn trạng thái
 * tệp thật (docs/09 mục 3 qua `toDisplayStatus`), thông tin tệp và liên kết. CHỈ ĐỌC: không có nút sửa,
 * xóa, cắt hay ghi đè (bất biến 4). Tệp không còn trên máy mà máy chủ đã xác nhận có bản thì xem qua URL ký
 * ngắn hạn (`getEvidenceReadUrl`); máy chủ chưa có bản thì nói thẳng là không xem được. Màn gọi lo việc nạp bản ghi theo `evidenceId` và cô lập shop.
 */
export function EvidenceDetailView({
  file,
  shopId,
  kindLabel,
  capturedAtLabel,
  links,
  uploader = 'current',
}: EvidenceDetailViewProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const display = toDisplayStatus(file.state, { uploader });
  const uploaderNote = foreignUploadNote(file.state, uploader);
  const { state, localPath } = file;
  const playback = useMemo(
    () => localPlaybackOf({ state, localPath }, recordingExists),
    [state, localPath],
  );
  const serverHas = isServerConfirmed(state);
  // Tệp không còn trên máy và máy chủ CHƯA xác nhận có bản: bằng chứng đã mất. Không hiện nhãn trạng thái
  // (ví dụ "Đã lưu trên máy" sẽ sai), chỉ hiện câu mất ở khung xem.
  const lost = playback === 'missing' && !serverHas;
  // Tệp trên máy hỏng/không phát được mà máy chủ có bản: `EvidenceMedia` chuyển sang xem từ máy chủ.
  // Câu giải thích của nhãn nói về tệp trên máy; tệp đã mất thì chỉ giữ câu của trạng thái máy chủ.
  const showHint = display.kind === 'label' && (playback === 'local' || serverHas);
  const noun = file.kind === 'video' ? 'video' : 'photo';
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
      <EvidenceMedia
        file={file}
        shopId={shopId}
        serverHas={serverHas}
        playback={playback}
        missingReason={state === FILE_STATES.HASH_MISMATCH ? 'mismatch' : 'lost'}
      />
      {lost ? null : (
        <Card compact testID="evidence-detail-status">
          <View style={{ gap: tokens.space.xs }}>
            {display.kind === 'label' ? (
              <>
                <EvidenceStatusBadge
                  compact
                  status={display.label}
                  testID="evidence-detail-badge"
                />
                {showHint ? (
                  <Text variant="formBody" color="inkMuted" testID="evidence-detail-hint">
                    {uploaderNote
                      ? t(`evidence:uploaderNote.${uploaderNote}`)
                      : display.label === 'saved_on_device'
                        ? t(`evidence:detail.savedOnDeviceHint.${noun}`)
                        : t(`evidence:statusHint.${display.label}`)}
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
      )}
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
      {/* Tệp đã mất khỏi máy thì không nói "tệp gốc không bị xóa". */}
      {playback === 'missing' || playback === 'cloud' ? null : (
        <Text variant="caption" color="textMuted" testID="evidence-detail-readonly">
          {t('evidence:detail.readOnly')}
        </Text>
      )}
    </>
  );
}

/**
 * Khung xem: tệp trên máy (ưu tiên) hoặc bản của máy chủ khi tệp không còn/không phát được; ngược lại là
 * trạng thái trung thực, không đoán. Xem từ máy chủ KHÔNG tải ngược về máy hay tạo lại tệp (bất biến 4).
 */
function EvidenceMedia({
  file,
  shopId,
  serverHas,
  playback,
  missingReason,
}: {
  file: EvidenceDetailViewProps['file'];
  shopId: ShopId;
  serverHas: boolean;
  playback: LocalPlayback;
  /**
   * Câu khi không xem được: `mismatch` = máy chủ có bản nhưng không khớp mã băm; `lost` = máy chủ chưa có
   * bản. (Máy chủ đã xác nhận thì nguồn là `cloud`, không bao giờ tới nhánh `missing`.)
   */
  missingReason: 'mismatch' | 'lost';
}) {
  const { t } = useTranslation();
  const [localFailed, setLocalFailed] = useState(false);
  const noun = file.kind === 'video' ? 'video' : 'photo';
  // Tệp trên máy phát lỗi: dùng bản máy chủ nếu đã xác nhận, ngược lại báo không phát được (như trước).
  const source: LocalPlayback =
    playback === 'local' && localFailed && serverHas ? 'cloud' : playback;
  const remote = useEvidenceReadUrl(shopId, file.id, source === 'cloud');

  if (source === 'capturing' || source === 'missing' || (source === 'local' && localFailed)) {
    const variant =
      source === 'capturing' ? 'capturing' : source === 'missing' ? 'missing' : 'playFailed';
    return (
      <Card compact testID={`evidence-media-${variant}`}>
        <EmptyState
          compact
          iconCircle
          icon={variant === 'capturing' ? 'clock' : 'alert-triangle'}
          title={t(`evidence:detail.media.${variant}Title.${noun}`)}
          message={
            variant === 'missing'
              ? t(`evidence:detail.media.missingMessage.${missingReason}`)
              : t(`evidence:detail.media.${variant}Message`)
          }
        />
      </Card>
    );
  }

  if (source === 'cloud') {
    if (remote.state.kind === 'error') {
      return (
        <ErrorState
          variant="card"
          testID="evidence-media-cloud-error"
          title={t(`evidence:detail.media.cloudError.${remote.state.reason}`)}
          onRetry={remote.retry}
        />
      );
    }
    if (remote.state.kind !== 'ready') {
      return (
        <View testID="evidence-media-cloud-loading">
          <SkeletonCard />
          <Text variant="caption" color="textMuted">
            {t('evidence:detail.media.cloudLoading')}
          </Text>
        </View>
      );
    }
    return (
      <>
        <MediaFrame testID="evidence-media-cloud">
          <MediaContent
            kind={file.kind}
            uri={remote.state.url}
            label={t('evidence:detail.media.cloudLabel')}
            onError={remote.reportPlayError}
          />
        </MediaFrame>
        <Text variant="caption" color="textMuted" testID="evidence-media-cloud-note">
          {t('evidence:detail.media.cloudNote')}
        </Text>
      </>
    );
  }

  return (
    <MediaFrame testID="evidence-media-available">
      <MediaContent
        kind={file.kind}
        uri={resolveRecordingUri(file.localPath ?? '')}
        label={t(`evidence:detail.media.${noun}Label`)}
        onError={() => setLocalFailed(true)}
      />
    </MediaFrame>
  );
}

function MediaFrame({ testID, children }: { testID: string; children: ReactNode }) {
  const { tokens } = useTheme();
  const frame = {
    backgroundColor: tokens.color.camera.background,
    borderRadius: tokens.radius.md,
  };
  return (
    <View style={[styles.frame, frame]} testID={testID}>
      {children}
    </View>
  );
}

function MediaContent({
  kind,
  uri,
  label,
  onError,
}: {
  kind: EvidenceDetailViewProps['file']['kind'];
  uri: string;
  label: string;
  onError: () => void;
}) {
  return kind === 'video' ? (
    <VideoPlayer
      key={uri}
      uri={uri}
      style={styles.fill}
      testID="evidence-video-player"
      accessibilityLabel={label}
      onError={onError}
    />
  ) : (
    <Image
      key={uri}
      testID="evidence-photo"
      // Ảnh từ máy chủ: `cache: 'reload'` chỉ có tác dụng trên iOS (nhạy cảm, không dùng lại đệm HTTP).
      // Android chưa bảo đảm không đệm: kiểm ở G-14.
      source={uri.startsWith('https://') ? { uri, cache: 'reload' } : { uri }}
      style={styles.fill}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessibilityLabel={label}
      onError={onError}
    />
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
