import { AppError, isAppError } from '@/core/errors/app-error';
import type { DisputeId, EvidenceId, OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import {
  migrateOrderDatabase,
  runSerializedOnDb,
  type CreatorUidProvider,
} from '@/features/orders';
import { newDisputeRecordId } from '@/platform/ids';
import type { SqlDatabase } from '@/platform/sql-database';

import { formatDisputeCode } from '../domain/dispute-rules';
import type { DisputeStore } from '../domain/dispute-store';
import type {
  Dispute,
  DisputeDetails,
  DisputeEvent,
  DisputeEventKind,
  DisputeEvidenceRef,
  DisputeStatus,
  DisputeSubject,
  IssueType,
} from '../domain/types';

interface Row {
  id: string;
  shop_id: string;
  seq: number;
  code: string;
  status: string;
  subject_kind: string;
  order_id: string | null;
  return_id: string | null;
  subject_label: string;
  opening_evidence_limit: number;
  issue_type: string;
  note: string;
  close_note: string;
  created_at_device: number;
  updated_at_device: number;
  closed_at_device: number | null;
  created_by: string | null;
}
interface EvidenceRow {
  evidence_id: string;
  added_at_device: number;
  by_uid: string | null;
}
interface EventRow {
  id: string;
  dispute_id: string;
  kind: string;
  note: string;
  at_device: number;
  by_uid: string | null;
}

const COLUMNS =
  'id, shop_id, seq, code, status, subject_kind, order_id, return_id, subject_label, opening_evidence_limit, issue_type, note, close_note, created_at_device, updated_at_device, closed_at_device, created_by';

const toSubject = (r: Row): DisputeSubject =>
  r.subject_kind === 'return'
    ? {
        kind: 'return',
        returnId: (r.return_id ?? '') as ReturnCaseId,
        label: r.subject_label,
        orderId: r.order_id as OrderId | null,
        openingEvidenceLimit: r.opening_evidence_limit === 1,
      }
    : { kind: 'order', orderId: (r.order_id ?? '') as OrderId, label: r.subject_label };

const toDispute = (r: Row): Dispute => ({
  id: r.id as DisputeId,
  shopId: r.shop_id as ShopId,
  seq: r.seq,
  code: r.code,
  status: r.status as DisputeStatus,
  subject: toSubject(r),
  issueType: r.issue_type as IssueType,
  note: r.note,
  closeNote: r.close_note,
  createdAtDevice: r.created_at_device,
  updatedAtDevice: r.updated_at_device,
  closedAtDevice: r.closed_at_device,
  ...(r.created_by ? { createdBy: r.created_by } : {}),
});

/**
 * Kho SQLite cho hồ sơ tranh chấp. Dùng chung kết nối và hàng đợi tuần tự với kho đơn. Lỗi cơ sở dữ
 * liệu đổi thành `DISPUTE_SAVE_FAILED` (log chỉ ghi loại lỗi). Mọi truy vấn kèm `shop_id` (bất biến 8).
 */
export function createSqliteDisputeStore(
  db: SqlDatabase,
  options: { creatorUid?: CreatorUidProvider } = {},
): DisputeStore {
  let ready: Promise<void> | null = null;
  const uid = (): string | null => options.creatorUid?.() ?? null;

  const guarded = <T>(task: () => Promise<T>): Promise<T> =>
    runSerializedOnDb(db, async () => {
      try {
        ready ??= migrateOrderDatabase(db);
        await ready;
        return await task();
      } catch (error) {
        if (isAppError(error)) throw error;
        logger.warn('disputes.store_failed', { reason: 'sqlite' });
        throw new AppError('DISPUTE_SAVE_FAILED', {}, { cause: error });
      }
    });

  const requireRow = async (shopId: ShopId, id: DisputeId): Promise<Row> => {
    const row = await db.getFirstAsync<Row>(
      `SELECT ${COLUMNS} FROM disputes WHERE id = ? AND shop_id = ?`,
      [id, shopId],
    );
    if (!row) throw new AppError('DISPUTE_SAVE_FAILED', { reason: 'not_found' });
    return row;
  };
  const requireOpen = async (shopId: ShopId, id: DisputeId): Promise<Row> => {
    const row = await requireRow(shopId, id);
    if (row.status === 'closed') throw new AppError('DISPUTE_CLOSED');
    return row;
  };

  const load = async (shopId: ShopId, id: DisputeId): Promise<DisputeDetails | null> => {
    const row = await db.getFirstAsync<Row>(
      `SELECT ${COLUMNS} FROM disputes WHERE id = ? AND shop_id = ?`,
      [id, shopId],
    );
    if (!row) return null;
    const [evidence, events] = await Promise.all([
      db.getAllAsync<EvidenceRow>(
        'SELECT evidence_id, added_at_device, by_uid FROM dispute_evidence WHERE dispute_id = ? AND shop_id = ? ORDER BY added_at_device, rowid',
        [id, shopId],
      ),
      db.getAllAsync<EventRow>(
        'SELECT id, dispute_id, kind, note, at_device, by_uid FROM dispute_events WHERE dispute_id = ? AND shop_id = ? ORDER BY at_device, rowid',
        [id, shopId],
      ),
    ]);
    return {
      dispute: toDispute(row),
      evidence: evidence.map((e): DisputeEvidenceRef => ({
        evidenceId: e.evidence_id as EvidenceId,
        addedAtDevice: e.added_at_device,
        ...(e.by_uid ? { by: e.by_uid } : {}),
      })),
      events: events.map((e): DisputeEvent => ({
        id: e.id,
        disputeId: e.dispute_id as DisputeId,
        kind: e.kind as DisputeEventKind,
        note: e.note,
        atDevice: e.at_device,
        ...(e.by_uid ? { by: e.by_uid } : {}),
      })),
    };
  };
  const loadOrThrow = async (shopId: ShopId, id: DisputeId): Promise<DisputeDetails> => {
    const found = await load(shopId, id);
    if (!found) throw new AppError('DISPUTE_SAVE_FAILED', { reason: 'not_found' });
    return found;
  };

  const writeEvent = (
    shopId: ShopId,
    id: DisputeId,
    kind: DisputeEventKind,
    note: string,
    at: number,
  ) =>
    db.runAsync(
      'INSERT INTO dispute_events (id, dispute_id, shop_id, kind, note, at_device, by_uid) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newDisputeRecordId(), id, shopId, kind, note, at, uid()],
    );
  const touch = (shopId: ShopId, id: DisputeId, at: number) =>
    db.runAsync('UPDATE disputes SET updated_at_device = ? WHERE id = ? AND shop_id = ?', [
      at,
      id,
      shopId,
    ]);

  return {
    createDispute: (input) =>
      guarded(async () => {
        await db.withTransactionAsync(async () => {
          const next = await db.getFirstAsync<{ next: number }>(
            'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM disputes WHERE shop_id = ?',
            [input.shopId],
          );
          const seq = next?.next ?? 1;
          const s = input.subject;
          await db.runAsync(
            `INSERT INTO disputes (${COLUMNS}) VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, NULL, ?)`,
            [
              input.id,
              input.shopId,
              seq,
              formatDisputeCode(seq),
              s.kind,
              s.orderId,
              s.kind === 'return' ? s.returnId : null,
              s.label,
              s.kind === 'return' && s.openingEvidenceLimit ? 1 : 0,
              input.issueType,
              input.note,
              input.createdAtDevice,
              input.createdAtDevice,
              uid(),
            ],
          );
          await writeEvent(input.shopId, input.id, 'created', input.note, input.createdAtDevice);
        });
        return loadOrThrow(input.shopId, input.id);
      }),
    getDispute: (shopId, id) => guarded(() => load(shopId, id)),
    listDisputes: (shopId, options = {}) =>
      guarded(async () => {
        const rows = await db.getAllAsync<Row & { evidence_count: number }>(
          `SELECT ${COLUMNS.split(', ')
            .map((c) => `d.${c}`)
            .join(', ')},
            (SELECT COUNT(*) FROM dispute_evidence e WHERE e.dispute_id = d.id) AS evidence_count
           FROM disputes d WHERE d.shop_id = ? ${options.status ? 'AND d.status = ?' : ''}
           ORDER BY d.updated_at_device DESC, d.id DESC LIMIT ?`,
          [shopId, ...(options.status ? [options.status] : []), options.limit ?? 200],
        );
        return rows.map((r) => ({ dispute: toDispute(r), evidenceCount: r.evidence_count }));
      }),
    addEvidence: (shopId, id, evidenceIds, nowDevice) =>
      guarded(async () => {
        await requireOpen(shopId, id);
        await db.withTransactionAsync(async () => {
          let added = 0;
          for (const evidenceId of new Set(evidenceIds)) {
            const exists = await db.getFirstAsync<{ n: number }>(
              'SELECT 1 AS n FROM dispute_evidence WHERE dispute_id = ? AND evidence_id = ?',
              [id, evidenceId],
            );
            if (exists) continue;
            await db.runAsync(
              'INSERT INTO dispute_evidence (dispute_id, shop_id, evidence_id, added_at_device, by_uid) VALUES (?, ?, ?, ?, ?)',
              [id, shopId, evidenceId, nowDevice, uid()],
            );
            added += 1;
          }
          if (added > 0) {
            await writeEvent(shopId, id, 'evidence_added', String(added), nowDevice);
            await touch(shopId, id, nowDevice);
          }
        });
        return loadOrThrow(shopId, id);
      }),
    addNote: (shopId, id, note, nowDevice) =>
      guarded(async () => {
        await requireOpen(shopId, id);
        await db.withTransactionAsync(async () => {
          await writeEvent(shopId, id, 'note_added', note, nowDevice);
          await touch(shopId, id, nowDevice);
        });
        return loadOrThrow(shopId, id);
      }),
    closeDispute: (shopId, id, note, nowDevice) =>
      guarded(async () => {
        await requireOpen(shopId, id);
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            "UPDATE disputes SET status = 'closed', close_note = ?, closed_at_device = ?, updated_at_device = ? WHERE id = ? AND shop_id = ?",
            [note, nowDevice, nowDevice, id, shopId],
          );
          await writeEvent(shopId, id, 'closed', note, nowDevice);
        });
        return loadOrThrow(shopId, id);
      }),
    listHeldEvidenceIds: (shopId) =>
      guarded(async () => {
        const rows = await db.getAllAsync<{ evidence_id: string }>(
          `SELECT DISTINCT e.evidence_id FROM dispute_evidence e
           JOIN disputes d ON d.id = e.dispute_id
           WHERE e.shop_id = ? AND d.status = 'open'`,
          [shopId],
        );
        return rows.map((r) => r.evidence_id as EvidenceId);
      }),
  };
}
