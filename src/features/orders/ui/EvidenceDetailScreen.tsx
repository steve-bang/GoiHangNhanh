import { useTranslation } from 'react-i18next';

import type { EvidenceId, OrderId } from '@/core/ids';
import {
  EvidenceDetailShell,
  EvidenceDetailView,
  shortId,
  uploaderRelation,
  type EvidenceDetailRow,
} from '@/features/evidence';
import { useRouteParams } from '@/platform';

import { useCurrentUid } from '../data';
import { formatDeviceDateTime, isSessionStatus } from '../domain';
import { useEvidenceDetail, type EvidenceDetailState } from './use-evidence-detail';

/**
 * UI-E04 Chi tiết bằng chứng (V1-17, Q-24a): mở MỘT tệp theo `evidenceId` trên đường dẫn của đơn, phát
 * video/hiện ảnh từ tệp trên máy này, chỉ đọc. Nội dung ở `EvidenceDetailView` (feature evidence); màn
 * này nạp dữ liệu, cô lập shop và dựng dòng liên kết đơn/kiện/phiên.
 */
export function EvidenceDetailScreen() {
  const { t } = useTranslation();
  const params = useRouteParams();
  return (
    <PackingEvidenceDetail
      orderId={params.orderId as OrderId | undefined}
      evidenceId={params.evidenceId as EvidenceId | undefined}
      title={t('nav:titles.UI-E04')}
      inTabs
    />
  );
}

export interface PackingEvidenceDetailProps {
  readonly orderId: OrderId | undefined;
  readonly evidenceId: EvidenceId | undefined;
  readonly title: string;
  /** Route nằm trong nhóm tab (UI-E04 gốc) hay ngoài (mở từ tranh chấp, V1-17b). */
  readonly inTabs: boolean;
  /** testID của màn (route con mở từ tranh chấp có testID riêng). */
  readonly testID?: string;
}

/**
 * Nội dung UI-E04 của MỘT tệp đóng gói theo `evidenceId` thuộc `orderId` (đơn phải khớp, cùng shop). Dùng
 * cho route UI-E04 trong tab Đơn hàng và route xem bằng chứng mở từ tranh chấp (V1-17b).
 */
export function PackingEvidenceDetail({
  orderId,
  evidenceId,
  title,
  inTabs,
  testID,
}: PackingEvidenceDetailProps) {
  const { t } = useTranslation();
  const uid = useCurrentUid();
  const { state, reload } = useEvidenceDetail(orderId, evidenceId);
  const shell = {
    title,
    inTabs,
    notFoundMessage: t('evidence:detail.notFound'),
    ...(testID ? { testID } : {}),
  } as const;

  if (state.kind !== 'ready') {
    return <EvidenceDetailShell {...shell} pending={state.kind} onRetry={reload} />;
  }
  return (
    <EvidenceDetailShell {...shell}>
      <EvidenceDetailView
        file={state.file}
        kindLabel={t(`screens:orderEvidence.kind.${state.file.group}.${state.file.kind}`)}
        capturedAtLabel={formatDeviceDateTime(state.file.createdAtDevice)}
        links={linkRows(state, t)}
        // Người tạo tệp đóng gói = người tạo PHIÊN; không còn phiên = không rõ (không đoán, V1-07).
        uploader={uploaderRelation(state.session?.createdBy, uid)}
      />
    </EvidenceDetailShell>
  );
}

type Translate = ReturnType<typeof useTranslation>['t'];

/** Dòng liên kết đơn/kiện/phiên, theo ID lưu trong bản ghi tệp (bất biến 2); thiếu thì "Chưa rõ", không đoán. */
function linkRows(
  state: Extract<EvidenceDetailState, { kind: 'ready' }>,
  t: Translate,
): EvidenceDetailRow[] {
  const { session, packageIndex, orderCode } = state;
  const status =
    session && isSessionStatus(session.sessionStatus)
      ? t(`evidence:detail.sessionStatus.${session.sessionStatus}`)
      : t('evidence:detail.unknown');
  return [
    { key: 'order', label: t('evidence:detail.info.order'), value: orderCode },
    {
      key: 'package',
      label: t('evidence:detail.info.package'),
      value:
        packageIndex === null
          ? t('evidence:detail.unknown')
          : t('evidence:detail.packageValue', { index: packageIndex }),
    },
    {
      key: 'session',
      label: t('evidence:detail.info.session'),
      value: session
        ? t('evidence:detail.sessionValue', {
            status,
            time: formatDeviceDateTime(session.startedAtDevice),
            id: shortId(session.id),
          })
        : t('evidence:detail.unknown'),
    },
  ];
}
