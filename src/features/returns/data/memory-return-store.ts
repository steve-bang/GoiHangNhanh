import { AppError } from '@/core/errors/app-error';
import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import { stampCreator, type CreatorUidProvider } from '@/features/orders';

import {
  assertCanConfirm,
  assertNoRecordedVideo,
  checkOpeningVideoRecordable,
  formatReturnCode,
  statusAfterExterior,
  statusAfterLines,
  statusAfterVideoStep,
} from '../domain/return-rules';
import {
  applyMediaEvent,
  applyMediaLocation,
  assertMediaDeletable,
  isMediaSavedLocally,
  type DeleteMediaResult,
  type ReturnMedia,
} from '../domain/media';
import type {
  NewDiscrepancy,
  NewReceivedLine,
  NewReturnInput,
  ReturnStore,
} from '../domain/return-store';
import type {
  Discrepancy,
  ReceivedLine,
  ReturnCase,
  ReturnDetails,
  ReturnEvent,
  ReturnEventKind,
  ReturnLinkEvent,
  ReturnSummary,
} from '../domain/types';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface Row {
  returnCase: ReturnCase;
  links: ReturnLinkEvent[];
  lines: ReceivedLine[];
  discrepancies: Discrepancy[];
  events: ReturnEvent[];
}

/**
 * Kho trong bộ nhớ (Jest, bản web chụp ảnh giao diện). Mất khi app đóng: KHÔNG dùng để giữ dữ liệu
 * thật. Cùng hợp đồng với kho SQLite (return-store.contract.ts).
 */
export function createMemoryReturnStore(
  options: {
    creatorUid?: CreatorUidProvider;
    /**
     * Ảnh đã nằm trong hồ sơ tranh chấp nào chưa (kho SQLite tự tra bảng `dispute_evidence`; kho bộ nhớ
     * không biết kho tranh chấp nên nhận qua đây). Không truyền = chưa có tranh chấp nào.
     */
    isHeldByDispute?: (shopId: ShopId, mediaId: string) => boolean | Promise<boolean>;
  } = {},
): ReturnStore {
  const uid = (): string | null => options.creatorUid?.() ?? null;
  const rows = new Map<ReturnCaseId, Row>();
  const lastSeq = new Map<ShopId, number>();
  const media = new Map<string, ReturnMedia>();
  const published = new Map<ReturnCaseId, number>();

  const checkMediaDeletable = async (shopId: ShopId, id: string): Promise<DeleteMediaResult> => {
    const current = media.get(id);
    if (!current || current.shopId !== shopId) return { ok: false, error: 'MEDIA_NOT_FOUND' };
    assertMediaDeletable({
      returnConfirmed: rowOf(shopId, current.returnId).returnCase.status === 'confirmed',
      media: current,
      inDispute: (await options.isHeldByDispute?.(shopId, id)) ?? false,
    });
    return { ok: true, media: copy(current) };
  };
  const rowOf = (shopId: ShopId, id: ReturnCaseId): Row => {
    const row = rows.get(id);
    if (!row || row.returnCase.shopId !== shopId) {
      throw new AppError('RETURN_SAVE_FAILED', { reason: 'not_found' });
    }
    return row;
  };
  /** Bản sao hồ sơ kèm mốc đã đăng bản neo (như cột `remote_synced_at_device` của SQLite). */
  const caseOf = (row: Row): ReturnCase => {
    const at = published.get(row.returnCase.id);
    const base = copy(row.returnCase);
    return at === undefined ? base : { ...base, anchorPublishedAtDevice: at };
  };
  const details = (row: Row): ReturnDetails => ({ ...copy(row), returnCase: caseOf(row) });
  const toLine = (
    returnId: ReturnCaseId,
    line: NewReceivedLine,
    position: number,
  ): ReceivedLine => ({
    id: line.id,
    returnId,
    position,
    name: line.name,
    variant: line.variant,
    receivedQuantity: line.receivedQuantity,
    condition: line.condition,
    note: line.note,
    expected: line.expected,
  });
  const event = (row: Row, id: string, kind: ReturnEventKind, atDevice: number): void => {
    const u = uid();
    row.events.push({ id, returnId: row.returnCase.id, kind, atDevice, ...(u ? { by: u } : {}) });
  };
  const touch = (row: Row, patch: Partial<ReturnCase>, atDevice: number): void => {
    row.returnCase = { ...row.returnCase, ...patch, updatedAtDevice: atDevice };
  };
  const discrepancyOf = (
    returnId: ReturnCaseId,
    d: NewDiscrepancy,
    atDevice: number,
  ): Discrepancy => {
    const u = uid();
    return {
      id: d.id,
      returnId,
      lineId: d.lineId,
      kind: d.kind,
      note: d.note,
      atDevice,
      ...(u ? { by: u } : {}),
    };
  };
  const linkOf = (
    returnId: ReturnCaseId,
    link: { linkId: string; orderId: OrderId; basis: ReturnLinkEvent['basis'] },
    atDevice: number,
  ): ReturnLinkEvent => {
    const u = uid();
    return {
      id: link.linkId,
      returnId,
      orderId: link.orderId,
      basis: link.basis,
      atDevice,
      ...(u ? { by: u } : {}),
    };
  };
  const summarize = (row: Row): ReturnSummary => ({
    returnCase: caseOf(row),
    discrepancyCount: row.discrepancies.length,
  });
  const newestFirst = (a: ReturnSummary, b: ReturnSummary) =>
    b.returnCase.updatedAtDevice - a.returnCase.updatedAtDevice ||
    (b.returnCase.id < a.returnCase.id ? -1 : 1);

  return {
    async createReturn(input: NewReturnInput) {
      if (rows.has(input.id)) throw new AppError('RETURN_SAVE_FAILED', { reason: 'duplicate_id' });
      const seq = (lastSeq.get(input.shopId) ?? 0) + 1;
      lastSeq.set(input.shopId, seq);
      const unsigned: ReturnCase = {
        id: input.id,
        shopId: input.shopId,
        seq,
        code: formatReturnCode(seq),
        status: 'receiving',
        sourceOrderId: input.link?.orderId ?? null,
        observedCode: input.observedCode,
        exterior: null,
        openedBefore: null,
        openingVideo: null,
        finalNote: '',
        confirmedAtDevice: null,
        createdAtDevice: input.atDevice,
        updatedAtDevice: input.atDevice,
      };
      const base = stampCreator(unsigned, uid());
      const row: Row = {
        returnCase: base,
        links: input.link ? [linkOf(input.id, input.link, input.atDevice)] : [],
        lines: input.lines.map((l, i) => toLine(input.id, l, i)),
        discrepancies: [],
        events: [],
      };
      event(row, input.eventId, 'created', input.atDevice);
      rows.set(input.id, row);
      return details(row);
    },
    async getReturn(shopId, id) {
      const row = rows.get(id);
      return row && row.returnCase.shopId === shopId ? details(row) : null;
    },
    async listReturns(shopId, limit) {
      return [...rows.values()]
        .filter((r) => r.returnCase.shopId === shopId)
        .map(summarize)
        .sort(newestFirst)
        .slice(0, limit);
    },
    async findReturns(shopId, query) {
      return [...rows.values()]
        .filter((r) => r.returnCase.shopId === shopId)
        .filter(
          (r) =>
            (query.orderId !== undefined && r.returnCase.sourceOrderId === query.orderId) ||
            (query.observedCodeKey !== undefined &&
              r.returnCase.observedCode !== null &&
              r.returnCase.observedCode.trim().replace(/\s+/g, ' ').toUpperCase() ===
                query.observedCodeKey),
        )
        .map(summarize)
        .sort(newestFirst);
    },
    async saveExterior(shopId, id, input) {
      const row = rowOf(shopId, id);
      const status = statusAfterExterior(row.returnCase.status);
      const at = input.exterior.recordedAtDevice;
      touch(
        row,
        { status, exterior: copy(input.exterior), openedBefore: copy(input.openedBefore) },
        at,
      );
      event(row, input.eventId, 'exterior_saved', at);
      if (input.openedBefore) {
        event(row, input.openedEventId, 'opened_before_marked', input.openedBefore.markedAtDevice);
      }
      return details(row);
    },
    async saveOpeningVideoRecorded(shopId, id, input) {
      const row = rowOf(shopId, id);
      const status = statusAfterVideoStep(row.returnCase.status);
      const video = media.get(input.mediaId);
      if (
        !video ||
        video.shopId !== shopId ||
        video.returnId !== id ||
        video.kind !== 'video' ||
        !isMediaSavedLocally(video)
      ) {
        throw new AppError('RETURN_SAVE_FAILED', { reason: 'video_media' });
      }
      if (checkOpeningVideoRecordable(row.returnCase.openingVideo, input.mediaId) === 'same') {
        return details(row);
      }
      touch(
        row,
        {
          status,
          openingVideo: {
            kind: 'recorded',
            mediaId: input.mediaId,
            atDevice: input.atDevice,
            interrupted: input.interrupted,
          },
        },
        input.atDevice,
      );
      event(row, input.eventId, 'opening_video_recorded', input.atDevice);
      return details(row);
    },
    async saveOpeningVideoMissing(shopId, id, input) {
      const row = rowOf(shopId, id);
      const status = statusAfterVideoStep(row.returnCase.status);
      assertNoRecordedVideo(row.returnCase.openingVideo);
      touch(
        row,
        {
          status,
          openingVideo: { kind: 'missing', reason: input.reason, atDevice: input.atDevice },
        },
        input.atDevice,
      );
      event(row, input.eventId, 'opening_video_missing', input.atDevice);
      return details(row);
    },
    async saveLines(shopId, id, input) {
      const row = rowOf(shopId, id);
      const status = statusAfterLines(row.returnCase.status);
      const lineIds = new Set(input.lines.map((l) => l.id));
      if (input.discrepancies.some((d) => d.lineId !== null && !lineIds.has(d.lineId))) {
        throw new AppError('RETURN_SAVE_FAILED', { reason: 'discrepancy_line' });
      }
      row.lines = input.lines.map((l, i) => toLine(id, l, i));
      row.discrepancies = input.discrepancies.map((d) => discrepancyOf(id, d, input.atDevice));
      touch(row, { status }, input.atDevice);
      event(row, input.eventId, 'lines_saved', input.atDevice);
      return details(row);
    },
    async confirmReturn(shopId, id, input) {
      const row = rowOf(shopId, id);
      assertCanConfirm(row.returnCase.status, row.lines.length);
      touch(
        row,
        { status: 'confirmed', finalNote: input.finalNote, confirmedAtDevice: input.atDevice },
        input.atDevice,
      );
      event(row, input.eventId, 'confirmed', input.atDevice);
      return details(row);
    },
    async linkSourceOrder(shopId, id, input) {
      const row = rowOf(shopId, id);
      if (row.returnCase.sourceOrderId !== null) throw new AppError('RETURN_ORDER_CONFLICT');
      row.links.push(linkOf(id, input, input.atDevice));
      if (row.lines.length === 0) {
        row.lines = input.expectedLines.map((l, i) => toLine(id, l, i));
      }
      // Hồ sơ đã xác nhận vẫn được liên kết sau (có lịch sử); không đổi trạng thái.
      touch(row, { sourceOrderId: input.orderId }, input.atDevice);
      event(row, input.eventId, 'linked', input.atDevice);
      return details(row);
    },
    async createMedia(input) {
      const row = rowOf(input.shopId, input.returnId);
      const existing = media.get(input.id);
      if (existing) {
        if (existing.returnId !== input.returnId || existing.shopId !== input.shopId) {
          throw new AppError('RETURN_SAVE_FAILED', { reason: 'media_conflict' });
        }
        return copy(existing);
      }
      if (row.returnCase.status === 'confirmed') throw new AppError('RETURN_ALREADY_CONFIRMED');
      const u = uid();
      const created: ReturnMedia = {
        id: input.id,
        shopId: input.shopId,
        returnId: input.returnId,
        kind: input.kind,
        state: 'recording',
        localPath: null,
        sizeBytes: null,
        sha256Client: null,
        location: null,
        attemptCount: 0,
        nextAttemptAtDevice: null,
        lastErrorCode: null,
        createdAtDevice: input.atDevice,
        updatedAtDevice: input.atDevice,
        ...(u ? { createdBy: u } : {}),
      };
      media.set(input.id, created);
      return copy(created);
    },
    async applyMediaEvent(shopId, id, event, atDevice, patch) {
      const current = media.get(id);
      if (!current || current.shopId !== shopId) return { ok: false, error: 'MEDIA_NOT_FOUND' };
      const result = applyMediaEvent(current, event, atDevice, patch);
      if (!result.ok) return result;
      media.set(id, result.media);
      return { ok: true, media: copy(result.media) };
    },
    async setMediaLocation(shopId, id, location) {
      const current = media.get(id);
      if (!current || current.shopId !== shopId) return { ok: false, error: 'MEDIA_NOT_FOUND' };
      const result = applyMediaLocation(current, location);
      if (!result.ok) return result;
      media.set(id, result.media);
      return { ok: true, media: copy(result.media) };
    },
    checkMediaDeletable,
    async deleteMedia(shopId, id, atDevice, eventId) {
      const checked = await checkMediaDeletable(shopId, id);
      if (!checked.ok) return checked;
      const row = rowOf(shopId, checked.media.returnId);
      media.delete(id);
      touch(row, {}, atDevice);
      event(row, eventId, 'photo_deleted', atDevice);
      return checked;
    },
    async listReturnsPendingRemote(shopId, limit, uid) {
      return [...rows.values()]
        .map((r) => r.returnCase)
        .filter(
          (c) =>
            c.shopId === shopId &&
            c.createdBy === uid &&
            !published.has(c.id) &&
            [...media.values()].some(
              (m) => m.returnId === c.id && m.shopId === shopId && isMediaSavedLocally(m),
            ),
        )
        .sort((a, b) => a.createdAtDevice - b.createdAtDevice || (a.id < b.id ? -1 : 1))
        .slice(0, limit)
        .map(copy);
    },
    async markReturnPublished(shopId, id, atDevice) {
      rowOf(shopId, id);
      if (!published.has(id)) published.set(id, atDevice);
    },
    async listMediaForUpload(shopId, states, uid) {
      if (!uid) return [];
      return [...media.values()]
        .filter(
          (m) =>
            m.shopId === shopId &&
            m.createdBy === uid &&
            states.includes(m.state) &&
            published.has(m.returnId),
        )
        .sort((a, b) => a.createdAtDevice - b.createdAtDevice)
        .map(copy);
    },
    async listUnfinishedMedia() {
      const unfinished = ['recording', 'saving_local', 'local_save_failed'];
      return [...media.values()]
        .filter((m) => unfinished.includes(m.state))
        .sort((a, b) => a.createdAtDevice - b.createdAtDevice)
        .map(copy);
    },
    async listMedia(shopId, returnId) {
      return [...media.values()]
        .filter((m) => m.shopId === shopId && m.returnId === returnId)
        .sort((a, b) => a.createdAtDevice - b.createdAtDevice)
        .map(copy);
    },
  };
}
