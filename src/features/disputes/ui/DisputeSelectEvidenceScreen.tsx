import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isAppError } from '@/core/errors/app-error';
import type { ErrorCode } from '@/core/errors/codes';
import type { EvidenceId } from '@/core/ids';
import { errorText, resolveErrorMessage } from '@/core/i18n/error-message';
import { logger } from '@/core/logging/logger';
import { ROUTES } from '@/core/navigation';
import { formatDeviceDateTime } from '@/features/orders';
import { useAppNavigation, useRouteParams } from '@/platform';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Screen,
  SkeletonCard,
  StatusBadge,
  Text,
  useTheme,
} from '@/shared/ui';

import { useDisputeStore } from '../data';
import { evidenceCaution, type DisputeDetails } from '../domain';
import { DisputeLoadState } from './DisputeLoadState';
import { FileStatus } from './FileStatus';
import { useDispute } from './use-dispute';
import { useDisputeFiles, type DisputeFileItem } from './use-dispute-files';

/**
 * UI-G03 Chọn bằng chứng. Liệt kê video/ảnh của đơn gắn với hồ sơ (và ảnh kiện của chính hồ sơ hoàn, nhóm "Hàng hoàn") theo thời gian, chọn nhiều. Tệp chưa
 * lên máy chủ hoặc đang lỗi vẫn chọn được nhưng được cảnh báo (và ghi vào bản xuất). Tệp đã chọn được đánh
 * dấu "giữ" khi hồ sơ còn mở (bất biến 9). Không tự chọn hộ. Hồ sơ đã đóng không thêm được.
 */
export function DisputeSelectEvidenceScreen() {
  const params = useRouteParams();
  const { state, reload, setDetails, shopId } = useDispute(params.disputeId);
  if (state.kind !== 'ready') {
    return <DisputeLoadState uiCode="UI-G03" state={state} onRetry={reload} />;
  }
  return <SelectBody details={state.details} shopId={shopId} onSaved={setDetails} />;
}

function SelectBody({
  details,
  shopId,
  onSaved,
}: {
  details: DisputeDetails;
  shopId: DisputeDetails['dispute']['shopId'];
  onSaved: (d: DisputeDetails) => void;
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const navigation = useAppNavigation();
  const store = useDisputeStore();
  const { dispute } = details;
  const orderId = dispute.subject.orderId;
  const returnId = dispute.subject.kind === 'return' ? dispute.subject.returnId : null;
  const { state, reload, fetchFiles } = useDisputeFiles(shopId, orderId, returnId);
  const [picked, setPicked] = useState<ReadonlySet<EvidenceId>>(new Set());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | null>(null);
  const [staleCount, setStaleCount] = useState(0);
  const inDispute = useMemo(() => new Set(details.evidence.map((e) => e.evidenceId)), [details]);
  const closed = dispute.status === 'closed';

  const toggle = (id: EvidenceId, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const files: readonly DisputeFileItem[] =
    state.kind === 'ready'
      ? [...state.files].sort((a, b) => a.createdAtDevice - b.createdAtDevice)
      : [];
  const cautionPicked =
    state.kind === 'ready' && files.some((f) => picked.has(f.id) && evidenceCaution(f) !== null);

  const add = async () => {
    setBusy(true);
    setFailure(null);
    setStaleCount(0);
    try {
      // Danh sách đang hiển thị có thể cũ (ví dụ ảnh chụp nhầm vừa bị xóa): kiểm lại trong kho trước khi
      // ghi, không đưa id không còn tồn tại (hoặc không thuộc đơn/hồ sơ này, cùng shop) vào hồ sơ.
      const present = new Set((await fetchFiles()).files.map((f) => f.id));
      const gone = [...picked].filter((id) => !present.has(id));
      if (gone.length > 0) {
        setPicked((prev) => new Set([...prev].filter((id) => present.has(id))));
        setStaleCount(gone.length);
        reload();
        setBusy(false);
        return;
      }
      const next = await store.addEvidence(shopId, dispute.id, [...picked], Date.now());
      onSaved(next);
      navigation.replace(ROUTES.disputeDetail, { disputeId: dispute.id });
    } catch (error) {
      logger.warn('disputes.add_evidence_failed', {
        reason: isAppError(error) ? error.code : 'unknown',
      });
      setFailure(isAppError(error) ? error.code : 'DISPUTE_SAVE_FAILED');
      setBusy(false);
    }
  };

  const body = (() => {
    if (state.kind === 'loading') {
      return (
        <View style={{ gap: tokens.space.md }}>
          <Text variant="formBody" color="inkMuted" accessibilityLiveRegion="polite">
            {t('disputes:common.loading')}
          </Text>
          <SkeletonCard />
        </View>
      );
    }
    if (state.kind === 'error') {
      return (
        <ErrorState
          variant="card"
          testID="dispute-files-error"
          title={t('disputes:select.loadError')}
          retryLabel={t('common:actions.retry')}
          onRetry={reload}
        />
      );
    }
    if (files.length === 0) {
      return (
        <View testID="dispute-files-empty">
          <EmptyState
            compact
            icon="inbox"
            iconCircle
            title={t('disputes:select.noneTitle')}
            message={t(orderId ? 'disputes:select.none' : 'disputes:select.noneReturnNoOrder')}
          />
        </View>
      );
    }
    return (
      <View style={{ gap: tokens.space.sm }}>
        {files.map((file) => {
          const already = inDispute.has(file.id);
          const heldElsewhere = !already && state.held.has(file.id);
          const caution = evidenceCaution(file);
          return (
            <Card key={file.id} compact testID={`dispute-file-${file.id}`}>
              <View style={{ gap: tokens.space.xs }}>
                <Checkbox
                  testID={`dispute-file-check-${file.id}`}
                  label={`${t(`disputes:select.${file.kind}`)} · ${t(`disputes:select.group_${file.group}`)} · ${formatDeviceDateTime(file.createdAtDevice)}`}
                  checked={already || picked.has(file.id)}
                  disabled={already || closed}
                  onChange={(on) => toggle(file.id, on)}
                />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs }}>
                  <FileStatus state={file.state} />
                  {already ? (
                    <StatusBadge label={t('disputes:select.held')} tone="info" icon="lock" />
                  ) : null}
                  {heldElsewhere ? (
                    <StatusBadge
                      label={t('disputes:select.heldOther')}
                      tone="neutral"
                      icon="lock"
                    />
                  ) : null}
                </View>
                {caution ? (
                  <Text
                    variant="caption"
                    color="textMuted"
                    testID={`dispute-file-caution-${file.id}`}
                  >
                    {t(
                      caution === 'failed'
                        ? 'disputes:select.cautionFailed'
                        : 'disputes:select.cautionOnDevice',
                    )}
                  </Text>
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    );
  })();

  return (
    <Screen
      form
      title={t('nav:titles.UI-G03')}
      onBack={navigation.back}
      testID="screen-UI-G03"
      footer={
        closed ? undefined : (
          <Button
            testID="dispute-add-evidence"
            label={
              picked.size > 0
                ? t('disputes:select.add', { count: picked.size })
                : t('disputes:select.addNone')
            }
            loading={busy}
            disabled={busy || picked.size === 0}
            onPress={() => void add()}
          />
        )
      }
    >
      <Text variant="formBody" color="inkMuted">
        {closed ? t('disputes:select.closedNotice') : t('disputes:select.intro')}
      </Text>
      {cautionPicked ? (
        <Card compact tone="warning" testID="dispute-caution-banner">
          <Text variant="formBody">{t('disputes:select.cautionBanner')}</Text>
        </Card>
      ) : null}
      {body}
      {staleCount > 0 ? (
        <Text variant="formBody" testID="dispute-select-stale" accessibilityRole="alert">
          {t('disputes:select.stale', { count: staleCount })}
        </Text>
      ) : null}
      {failure ? (
        <Text
          variant="formBody"
          testID="dispute-select-error"
          accessibilityRole="alert"
          style={{ color: tokens.color.feedback.danger.fg }}
        >
          {errorText(resolveErrorMessage(t, failure))}
        </Text>
      ) : null}
    </Screen>
  );
}
