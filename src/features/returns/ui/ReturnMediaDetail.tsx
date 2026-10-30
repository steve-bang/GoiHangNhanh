import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { EvidenceId } from '@/core/ids';
import {
  EvidenceDetailShell,
  EvidenceDetailView,
  type EvidenceDetailRow,
} from '@/features/evidence';
import { formatDeviceDateTime, useCurrentUid } from '@/features/orders';
import { useRouteParams } from '@/platform';
import { Card, StatusBadge, Text, useTheme } from '@/shared/ui';

import {
  evidenceLimits,
  hasOpeningEvidenceLimit,
  returnMediaUploader,
  type EvidenceLimit,
} from '../domain';
import { useLinkedOrderCode } from './use-linked-order';
import { useReturnMediaDetail } from './use-return-media-detail';

/** Lý do hạn chế liên quan tới quá trình mở kiện (cùng điều kiện với `hasOpeningEvidenceLimit`). */
const OPENING_LIMITS: readonly EvidenceLimit[] = [
  'no_opening_video',
  'interrupted_opening_video',
  'opened_before_recording',
];

export interface ReturnMediaDetailProps {
  readonly returnId: string | undefined;
  readonly mediaId: string | undefined;
  readonly title: string;
  /** testID của màn (route riêng hoặc route mở từ tranh chấp). */
  readonly testID: string;
}

/**
 * UI-E04 cho ảnh kiện / video mở kiện của MỘT hồ sơ hàng hoàn (V1-17b): cùng nội dung chỉ đọc của
 * `EvidenceDetailView` (không cache, không tự phát, không sửa/xóa/cắt/chia sẻ). Hồ sơ có hạn chế bằng chứng
 * mở kiện thì mang nhãn "Hạn chế bằng chứng" kèm lý do (docs/05 B07, không được ẩn). KHÔNG đọc hay hiện vị
 * trí/tọa độ ảnh (Q-26k).
 */
export function ReturnMediaDetail({ returnId, mediaId, title, testID }: ReturnMediaDetailProps) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const uid = useCurrentUid();
  const { state, reload } = useReturnMediaDetail(returnId, mediaId);
  const sourceOrderId = state.kind === 'ready' ? state.details.returnCase.sourceOrderId : null;
  const orderCode = useLinkedOrderCode(sourceOrderId);
  const shell = {
    title,
    inTabs: false,
    notFoundMessage: t('evidence:detail.notFoundInReturn'),
    testID,
  } as const;

  if (state.kind !== 'ready') {
    return <EvidenceDetailShell {...shell} pending={state.kind} onRetry={reload} />;
  }
  const { media, details } = state;
  const { returnCase } = details;
  const limited = hasOpeningEvidenceLimit(returnCase);
  const reasons = evidenceLimits(details, null).filter((l) => OPENING_LIMITS.includes(l));
  const links: EvidenceDetailRow[] = [
    { key: 'return', label: t('evidence:detail.info.returnCase'), value: returnCase.code },
    {
      key: 'order',
      label: t('evidence:detail.info.sourceOrder'),
      value:
        sourceOrderId === null
          ? t('evidence:detail.notLinked')
          : (orderCode ?? t('evidence:detail.unknown')),
    },
  ];

  return (
    <EvidenceDetailShell {...shell}>
      {limited ? (
        <Card compact tone="warning" testID="return-media-limited">
          <View style={{ gap: tokens.space.xs }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <StatusBadge label={t('returns:review.limitedBadge')} tone="warning" icon="alert" />
            </View>
            {reasons.map((reason) => (
              <Text key={reason} variant="formBody">
                {t(`returns:review.limits.${reason}`)}
              </Text>
            ))}
          </View>
        </Card>
      ) : null}
      <EvidenceDetailView
        // Chỉ truyền trường của tệp: vị trí (Q-26k) không bao giờ tới màn này.
        file={{
          id: media.id as EvidenceId,
          kind: media.kind,
          state: media.state,
          localPath: media.localPath,
          sizeBytes: media.sizeBytes,
          durationMs: null,
          sha256Client: media.sha256Client,
        }}
        kindLabel={t(`evidence:detail.returnKind.${media.kind}`)}
        capturedAtLabel={formatDeviceDateTime(media.createdAtDevice)}
        links={links}
        uploader={returnMediaUploader(media, returnCase, uid)}
      />
    </EvidenceDetailShell>
  );
}

/** Route `/returns/[returnId]/media/[mediaId]` (V1-17b). */
export function ReturnMediaDetailScreen() {
  const { t } = useTranslation();
  const params = useRouteParams();
  return (
    <ReturnMediaDetail
      returnId={params.returnId}
      mediaId={params.mediaId}
      title={t('nav:subTitles.returnMediaDetail')}
      testID="screen-UI-E04-mediaId"
    />
  );
}
