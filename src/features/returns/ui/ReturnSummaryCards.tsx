import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { toCodeKey } from '@/features/orders';
import { Card, Icon, Text, useTheme } from '@/shared/ui';

import {
  compareLine,
  describeLocation,
  evidenceLimits,
  isMediaSavedLocally,
  summarizeMediaSync,
  type ReturnDetails,
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
  const { returnCase, lines, discrepancies } = details;
  const { media } = useReturnMedia(returnCase.id);
  const savedPhotos = media === null ? [] : media.filter(isMediaSavedLocally);
  const photoCount = media === null ? null : savedPhotos.length;
  const sync = summarizeMediaSync(savedPhotos);
  const syncParts = SYNC_KEYS.filter((key) => sync[key] > 0).map((key) =>
    t(`returns:review.sync.${key}`, { count: sync[key] }),
  );
  const withLocation = savedPhotos.filter((m) => describeLocation(m).kind === 'has').length;
  const limits = evidenceLimits(details, photoCount);
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
      </Section>

      <Section title={t('returns:review.video')} testID="return-summary-video">
        <Text variant="formBody">
          {returnCase.openingVideo ? t('returns:review.videoMissing') : '…'}
        </Text>
        {returnCase.openingVideo ? (
          <Text variant="caption" color="textMuted" testID="return-video-reason">
            {t('returns:review.videoReason', {
              reason: t(`returns:record.skipReasons.${returnCase.openingVideo.reason}`),
            })}
          </Text>
        ) : null}
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
