import { useTranslation } from 'react-i18next';

import type { EvidenceId } from '@/core/ids';
import { EvidenceDetailShell } from '@/features/evidence';
import { PackingEvidenceDetail } from '@/features/orders';
import { ReturnMediaDetail } from '@/features/returns';
import { useRouteParams } from '@/platform';

import type { DisputeDetails } from '../domain';
import { useDispute } from './use-dispute';
import { useDisputeFiles } from './use-dispute-files';

/**
 * Xem MỘT tệp của hồ sơ tranh chấp (V1-17b), mở từ G03. Route trung tính trong tranh chấp, nội dung
 * UI-E04 chỉ đọc. Hai lớp kiểm (bất biến 1, 8): (1) hồ sơ tranh chấp phải của shop hiện tại và tệp phải
 * nằm trong tập tệp CÓ THỂ CHỌN của hồ sơ (cùng nguồn với G03: tệp của đơn gắn với hồ sơ + ảnh/video của
 * hồ sơ hoàn), không chỉ tệp đã chọn, để xem trước rồi mới chọn;
 * (2) màn con kiểm lại tệp thuộc đơn / hồ sơ hoàn và shop. Lệch ở đâu cũng là "Không tìm thấy bằng chứng
 * này.", không lộ thông tin của tệp.
 */
export function DisputeEvidenceDetailScreen() {
  const { t } = useTranslation();
  const params = useRouteParams();
  const { state, reload } = useDispute(params.disputeId);
  const shell = {
    title: t('nav:subTitles.disputeEvidenceDetail'),
    inTabs: false,
    notFoundMessage: t('evidence:detail.notFoundInDispute'),
    testID: 'screen-UI-E04-evidenceId',
  } as const;
  if (state.kind === 'ready') {
    return (
      <DisputeFileDetail details={state.details} evidenceId={params.evidenceId} shell={shell} />
    );
  }
  return (
    <EvidenceDetailShell
      {...shell}
      pending={state.kind === 'missing' ? 'notFound' : state.kind}
      onRetry={reload}
    />
  );
}

function DisputeFileDetail({
  details,
  evidenceId,
  shell,
}: {
  details: DisputeDetails;
  evidenceId: string | undefined;
  shell: { title: string; inTabs: false; notFoundMessage: string; testID: string };
}) {
  const { dispute } = details;
  const orderId = dispute.subject.orderId;
  const returnId = dispute.subject.kind === 'return' ? dispute.subject.returnId : null;
  const { state, reload } = useDisputeFiles(dispute.shopId, orderId, returnId);
  if (state.kind !== 'ready') {
    return <EvidenceDetailShell {...shell} pending={state.kind} onRetry={reload} />;
  }
  const item = evidenceId ? state.files.find((f) => f.id === evidenceId) : undefined;
  if (!item) return <EvidenceDetailShell {...shell} pending="notFound" />;
  if (item.group === 'return') {
    return (
      <ReturnMediaDetail
        returnId={returnId ?? undefined}
        mediaId={item.id}
        title={shell.title}
        testID={shell.testID}
      />
    );
  }
  return (
    <PackingEvidenceDetail
      orderId={orderId ?? undefined}
      evidenceId={item.id as EvidenceId}
      title={shell.title}
      inTabs={false}
      testID={shell.testID}
    />
  );
}
