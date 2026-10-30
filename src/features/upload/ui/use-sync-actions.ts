import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { EvidenceId } from '@/core/ids';
import { useConnectivity } from '@/platform';
import { useToast } from '@/shared/ui';

import { userRetryEvent, type SyncJob, type SyncJobStores } from '../domain';
import { useUploadQueueControl } from '../data';
import { useUploadNetworkGate } from './wifi-only';

type RetryOutcome = 'queued' | 'changed' | 'failed';

/** Đưa MỘT tệp về hàng chờ qua máy trạng thái (`origin: 'device'`, chỉ tới `queued`). Không ném. */
async function retryOne(stores: SyncJobStores, job: SyncJob, now: number): Promise<RetryOutcome> {
  const step = userRetryEvent(job.state, job.lastErrorCode);
  if (!step) return 'changed';
  try {
    const result =
      job.record.kind === 'pack'
        ? await stores.files.applyEvent(
            job.shopId,
            job.id as EvidenceId,
            step.event,
            now,
            step.patch,
          )
        : await stores.returns.applyMediaEvent(job.shopId, job.id, step.event, now, step.patch);
    // Bị từ chối (tệp vừa đổi trạng thái, hoặc lỗi không thử lại được): không đổi gì.
    return result.ok ? 'queued' : 'changed';
  } catch {
    return 'failed';
  }
}

/**
 * Hành động của Trung tâm đồng bộ: Thử lại (một tệp hoặc tất cả tệp đủ điều kiện) và Kiểm tra lại (tệp
 * kẹt `uploaded`). Mỗi tệp chỉ có một thao tác chạy tại một thời điểm (bấm đúp không phát hai sự kiện).
 * Sau khi đưa về hàng chờ, gọi hàng đợi chạy MỘT lượt; mất mạng thì báo sẽ chạy khi có mạng. Không hứa
 * tải xong khi ứng dụng đóng (bất biến 11).
 */
export function useSyncActions(stores: SyncJobStores, reload: () => Promise<void>) {
  const { t } = useTranslation();
  const toast = useToast();
  const control = useUploadQueueControl();
  const { online } = useConnectivity();
  const waitingWifi = useUploadNetworkGate() === 'waiting_wifi';
  const running = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const claim = (keys: readonly string[]): string[] => {
    const free = keys.filter((k) => !running.current.has(k));
    for (const k of free) running.current.add(k);
    setBusy(new Set(running.current));
    return free;
  };
  const release = (keys: readonly string[]) => {
    for (const k of keys) running.current.delete(k);
    setBusy(new Set(running.current));
  };

  const retry = useCallback(
    async (jobs: readonly SyncJob[]) => {
      const keys = claim(jobs.map((j) => j.key));
      if (keys.length === 0) return;
      const targets = jobs.filter((j) => keys.includes(j.key));
      const now = Date.now();
      const outcomes: RetryOutcome[] = [];
      for (const job of targets) outcomes.push(await retryOne(stores, job, now));
      if (outcomes.includes('queued')) control.runNow();
      if (outcomes.includes('failed')) {
        toast.show(t('screens:sync.toast.retryFailed'), { tone: 'error' });
      } else if (!outcomes.includes('queued')) {
        toast.show(t('screens:sync.toast.retryChanged'), { tone: 'info' });
      } else {
        const message = !online ? 'retriedOffline' : waitingWifi ? 'retriedWaitingWifi' : 'retried';
        toast.show(t(`screens:sync.toast.${message}`), { tone: 'info' });
      }
      release(keys);
      await reload();
    },
    [stores, control, online, waitingWifi, reload, t, toast],
  );

  const recheck = useCallback(
    async (job: SyncJob) => {
      const keys = claim([job.key]);
      if (keys.length === 0) return;
      const result = await control.requestServerCheck(job.id);
      const message =
        result === 'requested'
          ? 'recheckRequested'
          : result === 'offline'
            ? 'recheckOffline'
            : result === 'unsupported'
              ? 'recheckUnavailable'
              : result === 'not_eligible'
                ? 'retryChanged'
                : 'recheckFailed';
      toast.show(t(`screens:sync.toast.${message}`), {
        tone: result === 'failed' ? 'error' : 'info',
      });
      release(keys);
      await reload();
    },
    [control, reload, t, toast],
  );

  return { retry, recheck, busy };
}
