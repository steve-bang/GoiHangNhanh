import { AppError, isAppError } from '@/core/errors/app-error';
import type { OrderId, ReturnCaseId, ShopId } from '@/core/ids';
import { logger } from '@/core/logging/logger';
import {
  migrateOrderDatabase,
  runSerializedOnDb,
  type CreatorUidProvider,
} from '@/features/orders';
import type { SqlDatabase } from '@/platform/sql-database';

import {
  assertCanConfirm,
  formatReturnCode,
  statusAfterExterior,
  statusAfterLines,
  statusAfterVideoStep,
} from '../domain/return-rules';
import {
  applyMediaEvent,
  applyMediaLocation,
  assertMediaDeletable,
  type DeleteMediaResult,
  type LocationStatus,
  type ReturnMedia,
} from '../domain/media';
import type { NewReceivedLine, ReturnStore } from '../domain/return-store';
import type {
  Discrepancy,
  DiscrepancyKind,
  ExteriorSign,
  LineCondition,
  LinkBasis,
  OpenedBefore,
  OpeningVideo,
  ReceivedLine,
  ReturnCase,
  ReturnDetails,
  ReturnEvent,
  ReturnEventKind,
  ReturnExterior,
  ReturnLinkEvent,
  ReturnStatus,
  ReturnSummary,
} from '../domain/types';

interface CaseRow {
  id: string;
  shop_id: string;
  seq: number;
  code: string;
  status: string;
  source_order_id: string | null;
  observed_code: string | null;
  exterior_json: string | null;
  opened_before_json: string | null;
  opening_video_json: string | null;
  final_note: string;
  confirmed_at_device: number | null;
  created_at_device: number;
  updated_at_device: number;
  created_by: string | null;
}
interface LinkRow {
  id: string;
  return_id: string;
  order_id: string;
  basis: string;
  at_device: number;
  by_uid: string | null;
}
interface LineRow {
  id: string;
  return_id: string;
  position: number;
  name: string;
  variant: string | null;
  received_quantity: number | null;
  condition: string | null;
  note: string;
  expected_order_line_id: string | null;
  expected_name: string | null;
  expected_variant: string | null;
  expected_quantity: number | null;
}
interface DiscrepancyRow {
  id: string;
  return_id: string;
  line_id: string | null;
  kind: string;
  note: string;
  at_device: number;
  by_uid: string | null;
}
interface EventRow {
  id: string;
  return_id: string;
  kind: string;
  at_device: number;
  by_uid: string | null;
}

interface MediaRow {
  id: string;
  return_id: string;
  shop_id: string;
  kind: string;
  state: string;
  local_path: string | null;
  size_bytes: number | null;
  sha256_client: string | null;
  created_at_device: number;
  updated_at_device: number;
  created_by: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  location_at_device: number | null;
  location_status: string | null;
}
const MEDIA_COLUMNS =
  'id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client, created_at_device, updated_at_device, created_by, lat, lng, accuracy_m, location_at_device, location_status';
const toMedia = (r: MediaRow): ReturnMedia => ({
  id: r.id,
  shopId: r.shop_id as ShopId,
  returnId: r.return_id as ReturnCaseId,
  kind: 'photo',
  state: r.state as ReturnMedia['state'],
  localPath: r.local_path,
  sizeBytes: r.size_bytes,
  sha256Client: r.sha256_client,
  location:
    r.location_status === null
      ? null
      : {
          status: r.location_status as LocationStatus,
          lat: r.lat,
          lng: r.lng,
          accuracyM: r.accuracy_m,
          atDevice: r.location_at_device,
        },
  createdAtDevice: r.created_at_device,
  updatedAtDevice: r.updated_at_device,
  ...(r.created_by ? { createdBy: r.created_by } : {}),
});

const CASE_COLUMNS =
  'id, shop_id, seq, code, status, source_order_id, observed_code, exterior_json, opened_before_json, opening_video_json, final_note, confirmed_at_device, created_at_device, updated_at_device, created_by';

/** Đọc JSON đã lưu ở biên: sai dạng thì coi như không có (không ép kiểu mù; conventions mục 4). */
function parseJson<T>(
  json: string | null,
  check: (raw: Record<string, unknown>) => T | null,
): T | null {
  if (json === null) return null;
  try {
    const raw: unknown = JSON.parse(json);
    return raw && typeof raw === 'object' ? check(raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const parseExterior = (json: string | null): ReturnExterior | null =>
  parseJson(json, (r) =>
    Array.isArray(r.signs) && typeof r.note === 'string' && typeof r.recordedAtDevice === 'number'
      ? {
          signs: r.signs.filter((s): s is ExteriorSign => typeof s === 'string'),
          note: r.note,
          recordedAtDevice: r.recordedAtDevice,
        }
      : null,
  );
const parseOpenedBefore = (json: string | null): OpenedBefore | null =>
  parseJson(json, (r) =>
    typeof r.reason === 'string' && typeof r.markedAtDevice === 'number'
      ? { reason: r.reason, markedAtDevice: r.markedAtDevice }
      : null,
  );
const parseOpeningVideo = (json: string | null): OpeningVideo =>
  parseJson(json, (r) =>
    r.kind === 'missing' && typeof r.reason === 'string' && typeof r.atDevice === 'number'
      ? { kind: 'missing', reason: r.reason as 'user_skipped', atDevice: r.atDevice }
      : null,
  );

const toCase = (r: CaseRow): ReturnCase => ({
  id: r.id as ReturnCaseId,
  shopId: r.shop_id as ShopId,
  seq: r.seq,
  code: r.code,
  status: r.status as ReturnStatus,
  sourceOrderId: r.source_order_id as OrderId | null,
  observedCode: r.observed_code,
  exterior: parseExterior(r.exterior_json),
  openedBefore: parseOpenedBefore(r.opened_before_json),
  openingVideo: parseOpeningVideo(r.opening_video_json),
  finalNote: r.final_note,
  confirmedAtDevice: r.confirmed_at_device,
  createdAtDevice: r.created_at_device,
  updatedAtDevice: r.updated_at_device,
  ...(r.created_by ? { createdBy: r.created_by } : {}),
});
const toLink = (r: LinkRow): ReturnLinkEvent => ({
  id: r.id,
  returnId: r.return_id as ReturnCaseId,
  orderId: r.order_id as OrderId,
  basis: r.basis as LinkBasis,
  atDevice: r.at_device,
  ...(r.by_uid ? { by: r.by_uid } : {}),
});
const toLine = (r: LineRow): ReceivedLine => ({
  id: r.id,
  returnId: r.return_id as ReturnCaseId,
  position: r.position,
  name: r.name,
  variant: r.variant,
  receivedQuantity: r.received_quantity,
  condition: r.condition as LineCondition | null,
  note: r.note,
  expected:
    r.expected_name !== null && r.expected_quantity !== null
      ? {
          orderLineId: r.expected_order_line_id ?? '',
          name: r.expected_name,
          variant: r.expected_variant,
          quantity: r.expected_quantity,
        }
      : null,
});
const toDiscrepancy = (r: DiscrepancyRow): Discrepancy => ({
  id: r.id,
  returnId: r.return_id as ReturnCaseId,
  lineId: r.line_id,
  kind: r.kind as DiscrepancyKind,
  note: r.note,
  atDevice: r.at_device,
  ...(r.by_uid ? { by: r.by_uid } : {}),
});
const toEvent = (r: EventRow): ReturnEvent => ({
  id: r.id,
  returnId: r.return_id as ReturnCaseId,
  kind: r.kind as ReturnEventKind,
  atDevice: r.at_device,
  ...(r.by_uid ? { by: r.by_uid } : {}),
});

/**
 * Kho SQLite cho hồ sơ hàng hoàn. Dùng CHUNG kết nối và hàng đợi tuần tự với kho đơn (hai giao dịch
 * chồng nhau trên một kết nối sẽ lỗi). Lỗi cơ sở dữ liệu đổi thành `RETURN_SAVE_FAILED` (log chỉ ghi
 * loại lỗi, không ghi dữ liệu); `AppError` nghiệp vụ được giữ nguyên. Cô lập shop (bất biến 8): mọi
 * truy vấn kèm `shop_id`; ID của shop khác coi như không tồn tại.
 */
export function createSqliteReturnStore(
  db: SqlDatabase,
  options: { creatorUid?: CreatorUidProvider } = {},
): ReturnStore {
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
        logger.warn('returns.store_failed', { reason: 'sqlite' });
        throw new AppError('RETURN_SAVE_FAILED', {}, { cause: error });
      }
    });

  const requireCase = async (shopId: ShopId, id: ReturnCaseId): Promise<CaseRow> => {
    const row = await db.getFirstAsync<CaseRow>(
      `SELECT ${CASE_COLUMNS} FROM return_cases WHERE id = ? AND shop_id = ?`,
      [id, shopId],
    );
    if (!row) throw new AppError('RETURN_SAVE_FAILED', { reason: 'not_found' });
    return row;
  };

  const load = async (shopId: ShopId, id: ReturnCaseId): Promise<ReturnDetails | null> => {
    const row = await db.getFirstAsync<CaseRow>(
      `SELECT ${CASE_COLUMNS} FROM return_cases WHERE id = ? AND shop_id = ?`,
      [id, shopId],
    );
    if (!row) return null;
    const [links, lines, discrepancies, events] = await Promise.all([
      db.getAllAsync<LinkRow>(
        'SELECT id, return_id, order_id, basis, at_device, by_uid FROM return_link_events WHERE return_id = ? AND shop_id = ? ORDER BY at_device, rowid',
        [id, shopId],
      ),
      db.getAllAsync<LineRow>(
        'SELECT id, return_id, position, name, variant, received_quantity, condition, note, expected_order_line_id, expected_name, expected_variant, expected_quantity FROM return_lines WHERE return_id = ? AND shop_id = ? ORDER BY position',
        [id, shopId],
      ),
      db.getAllAsync<DiscrepancyRow>(
        'SELECT id, return_id, line_id, kind, note, at_device, by_uid FROM return_discrepancies WHERE return_id = ? AND shop_id = ? ORDER BY at_device, rowid',
        [id, shopId],
      ),
      db.getAllAsync<EventRow>(
        'SELECT id, return_id, kind, at_device, by_uid FROM return_events WHERE return_id = ? AND shop_id = ? ORDER BY at_device, rowid',
        [id, shopId],
      ),
    ]);
    return {
      returnCase: toCase(row),
      links: links.map(toLink),
      lines: lines.map(toLine),
      discrepancies: discrepancies.map(toDiscrepancy),
      events: events.map(toEvent),
    };
  };

  const mustLoad = async (shopId: ShopId, id: ReturnCaseId): Promise<ReturnDetails> => {
    const found = await load(shopId, id);
    if (!found) throw new AppError('RETURN_SAVE_FAILED', { reason: 'not_found' });
    return found;
  };

  /** Điều kiện xóa ảnh (Q-26j): đọc trạng thái hồ sơ và tra `dispute_evidence` (cùng CSDL, mọi hồ sơ tranh chấp kể cả đã đóng). */
  const assertDeletable = async (shopId: ShopId, row: MediaRow): Promise<ReturnMedia> => {
    const media = toMedia(row);
    const owner = await requireCase(shopId, media.returnId);
    const held = await db.getFirstAsync<{ n: number }>(
      'SELECT 1 AS n FROM dispute_evidence WHERE shop_id = ? AND evidence_id = ? LIMIT 1',
      [shopId, media.id],
    );
    assertMediaDeletable({
      returnConfirmed: owner.status === 'confirmed',
      media,
      inDispute: held !== null && held !== undefined,
    });
    return media;
  };

  const insertEvent = (
    shopId: ShopId,
    returnId: ReturnCaseId,
    eventId: string,
    kind: ReturnEventKind,
    atDevice: number,
  ) =>
    db.runAsync(
      'INSERT INTO return_events (id, return_id, shop_id, kind, at_device, by_uid) VALUES (?, ?, ?, ?, ?, ?)',
      [eventId, returnId, shopId, kind, atDevice, uid()],
    );

  const insertLines = async (
    shopId: ShopId,
    returnId: ReturnCaseId,
    lines: readonly NewReceivedLine[],
  ) => {
    let position = 0;
    for (const line of lines) {
      await db.runAsync(
        `INSERT INTO return_lines (id, return_id, shop_id, position, name, variant, received_quantity, condition, note,
           expected_order_line_id, expected_name, expected_variant, expected_quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          line.id,
          returnId,
          shopId,
          position,
          line.name,
          line.variant,
          line.receivedQuantity,
          line.condition,
          line.note,
          line.expected?.orderLineId ?? null,
          line.expected?.name ?? null,
          line.expected?.variant ?? null,
          line.expected?.quantity ?? null,
        ],
      );
      position += 1;
    }
  };

  const touch = (
    shopId: ShopId,
    id: ReturnCaseId,
    sets: string,
    params: readonly (string | number | null)[],
    atDevice: number,
  ) =>
    db.runAsync(
      `UPDATE return_cases SET ${sets}, updated_at_device = ? WHERE id = ? AND shop_id = ?`,
      [...params, atDevice, id, shopId],
    );

  const insertLink = (
    shopId: ShopId,
    returnId: ReturnCaseId,
    link: { linkId: string; orderId: OrderId; basis: LinkBasis },
    atDevice: number,
  ) =>
    db.runAsync(
      'INSERT INTO return_link_events (id, return_id, shop_id, order_id, basis, at_device, by_uid) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [link.linkId, returnId, shopId, link.orderId, link.basis, atDevice, uid()],
    );

  return {
    createReturn: (input) =>
      guarded(async () => {
        await db.withTransactionAsync(async () => {
          const next = await db.getFirstAsync<{ next: number }>(
            'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM return_cases WHERE shop_id = ?',
            [input.shopId],
          );
          const seq = next?.next ?? 1;
          const observed = input.observedCode;
          await db.runAsync(
            `INSERT INTO return_cases (id, shop_id, seq, code, status, source_order_id, observed_code, observed_code_key,
               created_at_device, updated_at_device, created_by)
             VALUES (?, ?, ?, ?, 'receiving', ?, ?, ?, ?, ?, ?)`,
            [
              input.id,
              input.shopId,
              seq,
              formatReturnCode(seq),
              input.link?.orderId ?? null,
              observed,
              observed === null ? null : observed.trim().replace(/\s+/g, ' ').toUpperCase(),
              input.atDevice,
              input.atDevice,
              uid(),
            ],
          );
          if (input.link) await insertLink(input.shopId, input.id, input.link, input.atDevice);
          await insertLines(input.shopId, input.id, input.lines);
          await insertEvent(input.shopId, input.id, input.eventId, 'created', input.atDevice);
        });
        return mustLoad(input.shopId, input.id);
      }),

    getReturn: (shopId, id) => guarded(() => load(shopId, id)),

    listReturns: (shopId, limit) =>
      guarded(async () => {
        const rows = await db.getAllAsync<CaseRow & { discrepancy_count: number }>(
          `SELECT ${CASE_COLUMNS}, (SELECT COUNT(*) FROM return_discrepancies d WHERE d.return_id = return_cases.id) AS discrepancy_count
           FROM return_cases WHERE shop_id = ? ORDER BY updated_at_device DESC, id DESC LIMIT ?`,
          [shopId, limit],
        );
        return rows.map((r): ReturnSummary => ({
          returnCase: toCase(r),
          discrepancyCount: r.discrepancy_count,
        }));
      }),

    findReturns: (shopId, query) =>
      guarded(async () => {
        const conditions: string[] = [];
        const params: (string | number)[] = [shopId];
        if (query.orderId !== undefined) {
          conditions.push('source_order_id = ?');
          params.push(query.orderId);
        }
        if (query.observedCodeKey !== undefined) {
          conditions.push('observed_code_key = ?');
          params.push(query.observedCodeKey);
        }
        if (conditions.length === 0) return [];
        const rows = await db.getAllAsync<CaseRow & { discrepancy_count: number }>(
          `SELECT ${CASE_COLUMNS}, (SELECT COUNT(*) FROM return_discrepancies d WHERE d.return_id = return_cases.id) AS discrepancy_count
           FROM return_cases WHERE shop_id = ? AND (${conditions.join(' OR ')})
           ORDER BY updated_at_device DESC, id DESC`,
          params,
        );
        return rows.map((r): ReturnSummary => ({
          returnCase: toCase(r),
          discrepancyCount: r.discrepancy_count,
        }));
      }),

    saveExterior: (shopId, id, input) =>
      guarded(async () => {
        const current = await requireCase(shopId, id);
        const status = statusAfterExterior(current.status as ReturnStatus);
        const at = input.exterior.recordedAtDevice;
        await db.withTransactionAsync(async () => {
          await touch(
            shopId,
            id,
            'status = ?, exterior_json = ?, opened_before_json = ?',
            [
              status,
              JSON.stringify(input.exterior),
              input.openedBefore ? JSON.stringify(input.openedBefore) : null,
            ],
            at,
          );
          await insertEvent(shopId, id, input.eventId, 'exterior_saved', at);
          if (input.openedBefore) {
            await insertEvent(
              shopId,
              id,
              input.openedEventId,
              'opened_before_marked',
              input.openedBefore.markedAtDevice,
            );
          }
        });
        return mustLoad(shopId, id);
      }),

    saveOpeningVideoMissing: (shopId, id, input) =>
      guarded(async () => {
        const current = await requireCase(shopId, id);
        const status = statusAfterVideoStep(current.status as ReturnStatus);
        await db.withTransactionAsync(async () => {
          await touch(
            shopId,
            id,
            'status = ?, opening_video_json = ?',
            [
              status,
              JSON.stringify({ kind: 'missing', reason: input.reason, atDevice: input.atDevice }),
            ],
            input.atDevice,
          );
          await insertEvent(shopId, id, input.eventId, 'opening_video_missing', input.atDevice);
        });
        return mustLoad(shopId, id);
      }),

    saveLines: (shopId, id, input) =>
      guarded(async () => {
        const current = await requireCase(shopId, id);
        const status = statusAfterLines(current.status as ReturnStatus);
        const lineIds = new Set(input.lines.map((l) => l.id));
        if (input.discrepancies.some((d) => d.lineId !== null && !lineIds.has(d.lineId))) {
          throw new AppError('RETURN_SAVE_FAILED', { reason: 'discrepancy_line' });
        }
        await db.withTransactionAsync(async () => {
          await db.runAsync(
            'DELETE FROM return_discrepancies WHERE return_id = ? AND shop_id = ?',
            [id, shopId],
          );
          await db.runAsync('DELETE FROM return_lines WHERE return_id = ? AND shop_id = ?', [
            id,
            shopId,
          ]);
          await insertLines(shopId, id, input.lines);
          for (const d of input.discrepancies) {
            await db.runAsync(
              'INSERT INTO return_discrepancies (id, return_id, shop_id, line_id, kind, note, at_device, by_uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [d.id, id, shopId, d.lineId, d.kind, d.note, input.atDevice, uid()],
            );
          }
          await touch(shopId, id, 'status = ?', [status], input.atDevice);
          await insertEvent(shopId, id, input.eventId, 'lines_saved', input.atDevice);
        });
        return mustLoad(shopId, id);
      }),

    confirmReturn: (shopId, id, input) =>
      guarded(async () => {
        const current = await requireCase(shopId, id);
        const count = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM return_lines WHERE return_id = ? AND shop_id = ?',
          [id, shopId],
        );
        assertCanConfirm(current.status as ReturnStatus, count?.n ?? 0);
        await db.withTransactionAsync(async () => {
          await touch(
            shopId,
            id,
            "status = 'confirmed', final_note = ?, confirmed_at_device = ?",
            [input.finalNote, input.atDevice],
            input.atDevice,
          );
          await insertEvent(shopId, id, input.eventId, 'confirmed', input.atDevice);
        });
        return mustLoad(shopId, id);
      }),

    linkSourceOrder: (shopId, id, input) =>
      guarded(async () => {
        const current = await requireCase(shopId, id);
        if (current.source_order_id !== null) throw new AppError('RETURN_ORDER_CONFLICT');
        const count = await db.getFirstAsync<{ n: number }>(
          'SELECT COUNT(*) AS n FROM return_lines WHERE return_id = ? AND shop_id = ?',
          [id, shopId],
        );
        await db.withTransactionAsync(async () => {
          await insertLink(shopId, id, input, input.atDevice);
          if ((count?.n ?? 0) === 0) await insertLines(shopId, id, input.expectedLines);
          await touch(shopId, id, 'source_order_id = ?', [input.orderId], input.atDevice);
          await insertEvent(shopId, id, input.eventId, 'linked', input.atDevice);
        });
        return mustLoad(shopId, id);
      }),

    createMedia: (input) =>
      guarded(async () => {
        const current = await requireCase(input.shopId, input.returnId);
        const existing = await db.getFirstAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ?`,
          [input.id],
        );
        if (existing) {
          if (existing.return_id !== input.returnId || existing.shop_id !== input.shopId) {
            throw new AppError('RETURN_SAVE_FAILED', { reason: 'media_conflict' });
          }
          return toMedia(existing);
        }
        if (current.status === 'confirmed') throw new AppError('RETURN_ALREADY_CONFIRMED');
        await db.runAsync(
          `INSERT INTO return_media (id, return_id, shop_id, kind, state, local_path, size_bytes, sha256_client, created_at_device, updated_at_device, created_by)
           VALUES (?, ?, ?, 'photo', 'recording', NULL, NULL, NULL, ?, ?, ?)`,
          [input.id, input.returnId, input.shopId, input.atDevice, input.atDevice, uid()],
        );
        const created = await db.getFirstAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ?`,
          [input.id],
        );
        if (!created) throw new AppError('RETURN_SAVE_FAILED', { reason: 'media_missing' });
        return toMedia(created);
      }),

    applyMediaEvent: (shopId, id, event, atDevice, patch) =>
      guarded(async () => {
        const row = await db.getFirstAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ? AND shop_id = ?`,
          [id, shopId],
        );
        if (!row) return { ok: false as const, error: 'MEDIA_NOT_FOUND' as const };
        const result = applyMediaEvent(toMedia(row), event, atDevice, patch);
        if (!result.ok) return result;
        const m = result.media;
        await db.runAsync(
          'UPDATE return_media SET state = ?, local_path = ?, size_bytes = ?, sha256_client = ?, updated_at_device = ? WHERE id = ? AND shop_id = ?',
          [m.state, m.localPath, m.sizeBytes, m.sha256Client, m.updatedAtDevice, id, shopId],
        );
        return result;
      }),

    setMediaLocation: (shopId, id, location) =>
      guarded(async () => {
        const row = await db.getFirstAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ? AND shop_id = ?`,
          [id, shopId],
        );
        if (!row) return { ok: false as const, error: 'MEDIA_NOT_FOUND' as const };
        const result = applyMediaLocation(toMedia(row), location);
        if (!result.ok) return result;
        const l = result.media.location;
        // `location_status IS NULL`: ghi một lần ở cả tầng SQL, không ghi đè dù có hai lời gọi chen nhau.
        await db.runAsync(
          'UPDATE return_media SET lat = ?, lng = ?, accuracy_m = ?, location_at_device = ?, location_status = ? WHERE id = ? AND shop_id = ? AND location_status IS NULL',
          [
            l?.lat ?? null,
            l?.lng ?? null,
            l?.accuracyM ?? null,
            l?.atDevice ?? null,
            l?.status ?? null,
            id,
            shopId,
          ],
        );
        return result;
      }),

    checkMediaDeletable: (shopId, id) =>
      guarded(async () => {
        const row = await db.getFirstAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ? AND shop_id = ?`,
          [id, shopId],
        );
        if (!row) return { ok: false as const, error: 'MEDIA_NOT_FOUND' as const };
        return { ok: true as const, media: await assertDeletable(shopId, row) };
      }),

    deleteMedia: (shopId, id, atDevice, eventId) =>
      guarded(async () => {
        let result: DeleteMediaResult = { ok: false, error: 'MEDIA_NOT_FOUND' };
        // Kiểm lại ngay trong giao dịch xóa (không tin lần kiểm trước khi xóa tệp).
        await db.withTransactionAsync(async () => {
          const row = await db.getFirstAsync<MediaRow>(
            `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE id = ? AND shop_id = ?`,
            [id, shopId],
          );
          if (!row) return;
          const media = await assertDeletable(shopId, row);
          await db.runAsync('DELETE FROM return_media WHERE id = ? AND shop_id = ?', [id, shopId]);
          await db.runAsync(
            'UPDATE return_cases SET updated_at_device = ? WHERE id = ? AND shop_id = ?',
            [atDevice, media.returnId, shopId],
          );
          await insertEvent(shopId, media.returnId, eventId, 'photo_deleted', atDevice);
          result = { ok: true, media };
        });
        return result;
      }),

    listReturnsPendingRemote: (shopId, limit, uid) =>
      guarded(async () => {
        // Chỉ hồ sơ do CHÍNH uid tạo (created_by khớp; NULL không bao giờ khớp) và đã có media lưu bền.
        const rows = await db.getAllAsync<CaseRow>(
          `SELECT ${CASE_COLUMNS} FROM return_cases c
           WHERE c.shop_id = ? AND c.created_by = ? AND c.remote_synced_at_device IS NULL
             AND EXISTS (
               SELECT 1 FROM return_media m
               WHERE m.return_id = c.id AND m.shop_id = c.shop_id
                 AND m.state NOT IN ('recording', 'saving_local', 'local_save_failed', 'unrecoverable')
             )
           ORDER BY c.created_at_device, c.rowid
           LIMIT ?`,
          [shopId, uid, limit],
        );
        return rows.map(toCase);
      }),

    markReturnPublished: (shopId, id, atDevice) =>
      guarded(async () => {
        await requireCase(shopId, id);
        await db.runAsync(
          'UPDATE return_cases SET remote_synced_at_device = COALESCE(remote_synced_at_device, ?) WHERE id = ? AND shop_id = ?',
          [atDevice, id, shopId],
        );
      }),

    listMedia: (shopId, returnId) =>
      guarded(async () => {
        const rows = await db.getAllAsync<MediaRow>(
          `SELECT ${MEDIA_COLUMNS} FROM return_media WHERE return_id = ? AND shop_id = ? ORDER BY created_at_device, rowid`,
          [returnId, shopId],
        );
        return rows.map(toMedia);
      }),
  };
}
