import { AppError } from '@/core/errors/app-error';
import type { DisputeId, EvidenceId, ShopId } from '@/core/ids';
import type { CreatorUidProvider } from '@/features/orders';
import { newDisputeRecordId } from '@/platform/ids';

import { formatDisputeCode } from '../domain/dispute-rules';
import type { DisputeStore } from '../domain/dispute-store';
import type {
  Dispute,
  DisputeDetails,
  DisputeEvent,
  DisputeEventKind,
  DisputeEvidenceRef,
} from '../domain/types';

const by = (uid: string | null): { by?: string } => (uid ? { by: uid } : {});
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

interface Row {
  dispute: Dispute;
  evidence: DisputeEvidenceRef[];
  events: DisputeEvent[];
}

/** Kho trong bộ nhớ (Jest, bản web). Mất khi đóng app; cùng hợp đồng với kho SQLite. */
export function createMemoryDisputeStore(
  options: { creatorUid?: CreatorUidProvider } = {},
): DisputeStore {
  const uid = (): string | null => options.creatorUid?.() ?? null;
  const rows = new Map<DisputeId, Row>();
  const lastSeq = new Map<ShopId, number>();

  const rowOf = (shopId: ShopId, id: DisputeId): Row => {
    const row = rows.get(id);
    if (!row || row.dispute.shopId !== shopId) {
      throw new AppError('DISPUTE_SAVE_FAILED', { reason: 'not_found' });
    }
    return row;
  };
  const openRow = (shopId: ShopId, id: DisputeId): Row => {
    const row = rowOf(shopId, id);
    if (row.dispute.status === 'closed') throw new AppError('DISPUTE_CLOSED');
    return row;
  };
  const event = (row: Row, kind: DisputeEventKind, note: string, at: number) => {
    row.events.push({
      id: newDisputeRecordId(),
      disputeId: row.dispute.id,
      kind,
      note,
      atDevice: at,
      ...by(uid()),
    } satisfies DisputeEvent);
    row.dispute = { ...row.dispute, updatedAtDevice: at };
  };
  const view = (row: Row): DisputeDetails => copy(row);

  return {
    createDispute: async (input) => {
      if (rows.has(input.id)) throw new AppError('DISPUTE_SAVE_FAILED', { reason: 'duplicate' });
      const seq = (lastSeq.get(input.shopId) ?? 0) + 1;
      lastSeq.set(input.shopId, seq);
      const owner = uid();
      const dispute: Dispute = {
        id: input.id,
        shopId: input.shopId,
        seq,
        code: formatDisputeCode(seq),
        status: 'open' as const,
        subject: input.subject,
        issueType: input.issueType,
        note: input.note,
        closeNote: '',
        createdAtDevice: input.createdAtDevice,
        updatedAtDevice: input.createdAtDevice,
        closedAtDevice: null,
        ...(owner ? { createdBy: owner } : {}),
      };
      const row: Row = { dispute, evidence: [], events: [] };
      event(row, 'created', input.note, input.createdAtDevice);
      rows.set(input.id, row);
      return view(row);
    },
    getDispute: async (shopId, id) => {
      const row = rows.get(id);
      return row && row.dispute.shopId === shopId ? view(row) : null;
    },
    listDisputes: async (shopId, options = {}) =>
      [...rows.values()]
        .filter(
          (r) =>
            r.dispute.shopId === shopId &&
            (options.status === undefined || r.dispute.status === options.status),
        )
        .sort(
          (a, b) =>
            b.dispute.updatedAtDevice - a.dispute.updatedAtDevice ||
            (a.dispute.id < b.dispute.id ? 1 : -1),
        )
        .slice(0, options.limit ?? 200)
        .map((r) => copy({ dispute: r.dispute, evidenceCount: r.evidence.length })),
    addEvidence: async (shopId, id, evidenceIds, nowDevice) => {
      const row = openRow(shopId, id);
      const added = [...new Set(evidenceIds)].filter(
        (e) => !row.evidence.some((x) => x.evidenceId === e),
      );
      for (const evidenceId of added) {
        row.evidence.push({
          evidenceId,
          addedAtDevice: nowDevice,
          ...by(uid()),
        } satisfies DisputeEvidenceRef);
      }
      if (added.length > 0) event(row, 'evidence_added', String(added.length), nowDevice);
      return view(row);
    },
    addNote: async (shopId, id, note, nowDevice) => {
      const row = openRow(shopId, id);
      event(row, 'note_added', note, nowDevice);
      return view(row);
    },
    closeDispute: async (shopId, id, note, nowDevice) => {
      const row = openRow(shopId, id);
      row.dispute = {
        ...row.dispute,
        status: 'closed',
        closeNote: note,
        closedAtDevice: nowDevice,
      };
      event(row, 'closed', note, nowDevice);
      return view(row);
    },
    listHeldEvidenceIds: async (shopId) => {
      const held = new Set<EvidenceId>();
      for (const r of rows.values()) {
        if (r.dispute.shopId === shopId && r.dispute.status === 'open') {
          for (const e of r.evidence) held.add(e.evidenceId);
        }
      }
      return [...held];
    },
  };
}
