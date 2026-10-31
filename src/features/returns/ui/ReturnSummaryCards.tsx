import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ROUTES } from '@/core/navigation';

import { toCodeKey, useCurrentUid } from '@/features/orders';
import { foreignUploadNote, toDisplayStatus } from '@/features/evidence';
import { getMinTouchTarget, useAppNavigation } from '@/platform';
import { Card, EvidenceStatusBadge, Icon, Text, useTheme } from '@/shared/ui';

import {
  compareLine,
  describeLocation,
  evidenceLimits,
  isMediaSavedLocally,
  returnMediaUploader,
  summarizeMediaSync,
  type ReturnCase,
  type ReturnDetails,
  type ReturnMedia,
} from '../domain';
import { useReturnMedia } from './use-return-photos';

/** Thứ tự các nhóm đồng bộ trong tóm tắt ảnh: từ chắc chắn nhất đến cần xử lý. */
const SYNC_KEYS = [
  'verified',
  'uploaded',
  'uploading',
  'onDevice',
  'retrying',
  'attention',
] as const;

/** Một khối thông tin có tiêu đề (dùng chung cho màn xác nhận D06 và màn xem/hoàn tất D07). */
function Section({
  title,
  children,
  testID,
}: {
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Card compact {...(testID ? { testID } : {})}>
      <View style={{ gap: tokens.space.xs }}>
        <Text variant="formButton" accessibilityRole="header">
          {title}
        </Text>
        {children}
      </View>
    </Card>
  );
}

/**
 * Hàng bấm được mở UI-E04 của một ảnh/video hàng hoàn (V1-17b; mẫu hàng của UI-E03: chữ + mũi tên).
 * Chỉ đọc; chỉ hiện cho tệp đã lưu bền trên máy.
 */
function MediaOpenRow({
  label,
  testID,
  onPress,
}: {
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: tokens.space.sm,
          minHeight: getMinTouchTarget(),
        },
        pressed ? { opacity: tokens.opacity.pressed } : null,
      ]}
    >
      <Text variant="formBody" color="ink" style={{ flex: 1 }}>
        {label}
      </Text>
      <Icon name="forward" size={tokens.icon.md} color={tokens.color.text.secondary} />
    </Pressable>
  );
}

/**
 * Tóm tắt hồ sơ hàng hoàn: đơn gốc, tình trạng bên ngoài, video mở kiện, hàng thực nhận (so với bản sao
 * dự kiến), sai lệch đã ghi nhận và HẠN CHẾ BẰNG CHỨNG. Chỉ nêu điều đã ghi nhận, không kết luận nguyên
 * nhân hay bên chịu trách nhiệm (CLAUDE.md #5). Không bao giờ có dòng "đầy đủ bằng chứng" (#11).
 */
export function ReturnSummaryCards({
  details,
  orderCode,
}: {
  details: ReturnDetails;
  orderCode: string | null;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const { returnCase, lines, discrepancies } = details;
  const openMedia = (mediaId: string) =>
    navigation.push(ROUTES.returnMediaDetail, { returnId: returnCase.id, mediaId });
  const { photos, videos } = useReturnMedia(returnCase.id);
  const savedPhotos = photos === null ? [] : photos.filter(isMediaSavedLocally);
  const photoCount = photos === null ? null : savedPhotos.length;
  const sync = summarizeMediaSync(savedPhotos);
  const syncParts = SYNC_KEYS.filter((key) => sync[key] > 0).map((key) =>
    t(`returns:review.sync.${key}`, { count: sync[key] }),
  );
  const withLocation = savedPhotos.filter((m) => describeLocation(m).kind === 'has').length;
  // Ảnh máy này chưa tải được dưới tài khoản hiện tại (V1-07): nói lý do đầu tiên gặp, không im lặng.
  const uid = useCurrentUid();
  const photoNote =
    savedPhotos
      .map((m) => foreignUploadNote(m.state, returnMediaUploader(m, returnCase, uid)))
      .find((n) => n !== null) ?? null;
  const limits = evidenceLimits(details, photoCount);
  const recordedId =
    returnCase.openingVideo?.kind === 'recorded' ? returnCase.openingVideo.mediaId : null;
  const kindOf = (lineId: string | null) =>
    discrepancies.filter((d) => d.lineId === lineId).map((d) => t(`returns:items.kinds.${d.kind}`));

  return (
    <View style={{ gap: tokens.space.md }}>
      <Section title={t('returns:review.source')} testID="return-summary-source">
        <Text variant="formBody">
          {returnCase.sourceOrderId ? (orderCode ?? '…') : t('returns:review.sourceUnlinked')}
        </Text>
        {returnCase.observedCode &&
        (returnCase.sourceOrderId === null ||
          toCodeKey(returnCase.observedCode) !== toCodeKey(orderCode ?? '')) ? (
          <Text variant="caption" color="textMuted">
            {t('returns:review.observedCode', { code: returnCase.observedCode })}
          </Text>
        ) : null}
      </Section>

      <Section title={t('returns:review.exterior')} testID="return-summary-exterior">
        <Text variant="formBody">
          {(returnCase.exterior?.signs ?? [])
            .map((sign) => t(`returns:exterior.signs.${sign}`))
            .join(', ')}
        </Text>
        {returnCase.exterior?.note ? (
          <Text variant="formBody" color="inkMuted">
            {returnCase.exterior.note}
          </Text>
        ) : null}
        {returnCase.openedBefore ? (
          <Text variant="caption" color="textMuted">
            {`${t('returns:exterior.openedBeforeLabel')}: ${returnCase.openedBefore.reason}`}
          </Text>
        ) : null}
        {photoCount !== null && photoCount > 0 ? (
          <Text variant="caption" color="textMuted" testID="return-summary-photos">
            {t('returns:review.photosOnDevice', { count: photoCount })}
          </Text>
        ) : null}
        {photoCount !== null && photoCount > 0 && syncParts.length > 0 ? (
          <Text variant="caption" color="textMuted" testID="return-summary-photos-sync">
            {syncParts.join('; ')}
          </Text>
        ) : null}
        {photoCount !== null && photoCount > 0 ? (
          <Text variant="caption" color="textMuted" testID="return-summary-photos-location">
            {t('returns:review.photosLocation', { withLocation, count: photoCount })}
          </Text>
        ) : null}
        {photoNote ? (
          <Text variant="caption" color="textMuted" testID="return-summary-photos-uploader-note">
            {t(`evidence:uploaderNote.${photoNote}`)}
          </Text>
        ) : null}
        {savedPhotos.map((photo, index) => (
          <MediaOpenRow
            key={photo.id}
            testID={`return-summary-open-photo-${photo.id}`}
            label={t('returns:review.openPhoto', { index: index + 1 })}
            onPress={() => openMedia(photo.id)}
          />
        ))}
      </Section>

      <Section title={t('returns:review.video')} testID="return-summary-video">
        {returnCase.openingVideo?.kind === 'recorded' ? (
          <OpeningVideoStatus
            interrupted={returnCase.openingVideo.interrupted}
            openedBefore={returnCase.openedBefore !== null}
            returnCase={returnCase}
            video={videos?.find((m) => m.id === recordedId) ?? null}
            onOpen={openMedia}
          />
        ) : (
          <>
            <Text variant="formBody">
              {returnCase.openingVideo ? t('returns:review.videoMissing') : '…'}
            </Text>
            {returnCase.openingVideo?.kind === 'missing' ? (
              <Text variant="caption" color="textMuted" testID="return-video-reason">
                {t('returns:review.videoReason', {
                  reason: t(`returns:record.skipReasons.${returnCase.openingVideo.reason}`),
                })}
              </Text>
            ) : null}
          </>
        )}
      </Section>

      <Section title={t('returns:review.items')} testID="return-summary-items">
        {lines.map((line) => {
          const comparison = compareLine(line);
          const received = line.receivedQuantity;
          return (
            <View key={line.id} style={{ gap: tokens.space.xxs }}>
              <Text variant="formButton">
                {[line.name, line.variant].filter(Boolean).join(' · ')}
              </Text>
              <Text variant="formBody" color="inkMuted">
                {received === null
                  ? t('returns:items.qtyLabel')
                  : line.expected
                    ? t('returns:review.receivedOf', { received, expected: line.expected.quantity })
                    : t('returns:review.receivedOnly', { received })}
              </Text>
              {comparison === 'short' || comparison === 'excess' ? (
                <Text variant="caption" bold style={{ color: tokens.status.interrupted.fg }}>
                  {t(`returns:items.compare.${comparison}`)}
                </Text>
              ) : null}
              {kindOf(line.id).length > 0 ? (
                <Text variant="caption" color="textMuted">
                  {kindOf(line.id).join(', ')}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Section>

      <Section title={t('returns:review.discrepancies')} testID="return-summary-discrepancies">
        {discrepancies.length === 0 ? (
          <Text variant="formBody" color="inkMuted">
            {t('returns:review.noDiscrepancy')}
          </Text>
        ) : (
          discrepancies.map((d) => (
            <Text key={d.id} variant="formBody">
              {d.note
                ? `${t(`returns:items.kinds.${d.kind}`)}: ${d.note}`
                : t(`returns:items.kinds.${d.kind}`)}
            </Text>
          ))
        )}
      </Section>

      <Card compact tone="warning" testID="return-summary-limits">
        <View style={{ gap: tokens.space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.space.sm }}>
            <Icon name="alert" size={tokens.icon.md} color={tokens.status.interrupted.fg} />
            <Text variant="formButton" accessibilityRole="header">
              {t('returns:review.limitsTitle')}
            </Text>
          </View>
          {limits.map((limit) => (
            <Text key={limit} variant="formBody">
              {t(`returns:review.limits.${limit}`)}
            </Text>
          ))}
          <Text variant="caption" color="textMuted">
            {t('returns:review.limitsNote')}
          </Text>
        </View>
      </Card>
      <Text variant="caption" color="textMuted" testID="return-local-only">
        {t('returns:review.localOnly')}
      </Text>
    </View>
  );
}

/**
 * Video mở kiện đã quay: nói đúng điều đã xảy ra. Nhãn theo trạng thái tệp THẬT (chỉ "Đã xác minh" khi
 * máy chủ đã tính lại mã băm và khớp); video bị gián đoạn không được nhận là đầy đủ; kiện đã mở trước khi
 * quay thì video chỉ ghi lại tình trạng hiện tại, không phải quá trình mở (bất biến 6).
 */
function OpeningVideoStatus({
  interrupted,
  openedBefore,
  returnCase,
  video,
  onOpen,
}: {
  interrupted: boolean;
  openedBefore: boolean;
  returnCase: Pick<ReturnCase, 'createdBy' | 'anchorPublishedAtDevice'>;
  video: ReturnMedia | null;
  onOpen: (mediaId: string) => void;
}) {
  const { t } = useTranslation();
  // Video do tài khoản khác quay, hoặc trong hồ sơ chưa gửi của người khác: máy này chưa tải được dưới
  // tài khoản này, nói rõ lý do (V1-07, Q-24g).
  const uploader = returnMediaUploader(video ?? {}, returnCase, useCurrentUid());
  const display = video ? toDisplayStatus(video.state, { uploader }) : null;
  const note = video ? foreignUploadNote(video.state, uploader) : null;
  return (
    <>
      <Text variant="formBody" testID="return-video-recorded">
        {t(interrupted ? 'returns:review.videoInterrupted' : 'returns:review.videoRecorded')}
      </Text>
      {display?.kind === 'label' ? (
        <EvidenceStatusBadge compact status={display.label} testID="return-video-status" />
      ) : null}
      {note ? (
        <Text variant="caption" color="textMuted" testID="return-video-uploader-note">
          {t(`evidence:uploaderNote.${note}`)}
        </Text>
      ) : null}
      {openedBefore ? (
        <Text variant="caption" color="textMuted" testID="return-video-opened-before">
          {t('returns:review.videoOpenedBefore')}
        </Text>
      ) : null}
      {video && isMediaSavedLocally(video) ? (
        <MediaOpenRow
          testID="return-summary-open-video"
          label={t('returns:review.openVideo')}
          onPress={() => onOpen(video.id)}
        />
      ) : null}
    </>
  );
}
