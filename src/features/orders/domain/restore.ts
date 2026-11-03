import type { RemoteDocuments, RemoteListedDocument } from '@/api/contract';
import type { EvidenceId, OrderId, OrderLineId, PackageId, SessionId, ShopId } from '@/core/ids';
import { fromRemoteSource } from '@/core/orders/remote-source';

import { isSessionStatus } from './session-status';
import type { OrderDetails, OrderLine, OrderPackage, OrderSnapshot, PackingSession } from './types';

/**
 * Khôi phục dữ liệu từ máy chủ xuống máy (cài lại app, đổi máy). Một chiều máy chủ -> máy, CHỈ phần đã
 * lên máy chủ: đơn có phiên, kiện, phiên đóng gói, siêu dữ liệu bằng chứng đã `uploaded`/`verified`/
 * `hash_mismatch`. Không đăng gì ngược lên, không ghi đè bản ghi đã có trên máy, không tải tệp về
 * (video xem từ máy chủ qua `getEvidenceReadUrl`). Hàng hoàn, tranh chấp, đơn nháp, tệp chưa tải: chưa
 * có trên máy chủ nên không thể khôi phục.
 */

export type RestorePhase = 'orders' | 'sessions' | 'evidence';
export const RESTORE_PHASES: readonly RestorePhase[] = ['orders', 'sessions', 'evidence'];

export interface RestoreProgress {
  /** Con trỏ trang kế; `null` = chưa bắt đầu (hoặc đã hết khi `done`). */
  readonly cursor: string | null;
  readonly done: boolean;
  /** Số bản ghi đã ghi vào máy ở giai đoạn này. */
  readonly imported: number;
}

export const EMPTY_PROGRESS: RestoreProgress = { cursor: null, done: false, imported: 0 };

/** Tệp bằng chứng khôi phục: chỉ siêu dữ liệu, KHÔNG có `local_path` (tệp nằm trên máy chủ). */
export interface RestoredEvidence {
  readonly id: EvidenceId;
  readonly orderId: OrderId;
  readonly packageId: PackageId;
  readonly sessionId: SessionId;
  readonly kind: 'video' | 'photo';
  /** Trạng thái do MÁY CHỦ xác nhận (map `server.state`), không phải do máy này suy ra. */
  readonly state: 'uploaded' | 'verified' | 'hash_mismatch';
  readonly sizeBytes: number | null;
  readonly durationMs: number | null;
  readonly sha256Client: string | null;
  readonly capturedAtDevice: number;
}

export interface RestoredSession {
  readonly session: PackingSession;
  /** Trạng thái phiên ĐANG có trên máy chủ (để bộ đồng bộ không coi là chưa đăng). */
  readonly remoteStatus: string;
}

/** Cổng lưu của khôi phục. Mọi ghi idempotent: bản ghi đã có trên máy thì giữ nguyên, không ghi đè. */
export interface RestoreStore {
  readProgress(shopId: ShopId, uid: string): Promise<Record<RestorePhase, RestoreProgress>>;
  saveProgress(
    shopId: ShopId,
    uid: string,
    phase: RestorePhase,
    progress: RestoreProgress,
    nowDevice: number,
  ): Promise<void>;
  /** Trong `ids`, những đơn ĐÃ có trên máy (để khỏi đọc lại dòng/kiện). */
  existingOrderIds(shopId: ShopId, ids: readonly string[]): Promise<ReadonlySet<string>>;
  /** Trả số bản ghi MỚI được ghi. Đơn ghi kèm dòng + kiện, đánh dấu đã đăng. */
  importOrders(shopId: ShopId, items: readonly OrderDetails[], nowDevice: number): Promise<number>;
  importSessions(shopId: ShopId, items: readonly RestoredSession[]): Promise<number>;
  importEvidence(
    shopId: ShopId,
    items: readonly RestoredEvidence[],
    nowDevice: number,
  ): Promise<number>;
}

export interface RestoreCounts {
  readonly orders: number;
  readonly sessions: number;
  readonly evidence: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null;

/** Mili giây của giá trị thời gian Firestore (`Timestamp` có `toMillis`) hoặc số; `null` nếu không phải. */
export function toMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.toMillis === 'function') {
    const ms = (value.toMillis as () => unknown)();
    return typeof ms === 'number' && Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/** Đơn từ tài liệu máy chủ; thiếu trường bắt buộc hoặc nguồn lạ thì `null` (bỏ qua, không đoán). */
export function parseRemoteOrder(
  doc: RemoteListedDocument,
  shopId: ShopId,
  lines: readonly RemoteListedDocument[],
  packages: readonly RemoteListedDocument[],
): OrderDetails | null {
  const d = doc.data;
  const orderCode = str(d.orderCode);
  const source = fromRemoteSource(d.source);
  if (orderCode === null || source === null) return null;
  const createdAtDevice = toMillis(d.createdAt) ?? 0;
  const createdBy = str(d.createdBy);
  const orderId = doc.id as OrderId;
  const parsedLines: OrderLine[] = [];
  for (const line of lines) {
    const name = str(line.data.name);
    const quantity = line.data.quantity;
    if (name === null || typeof quantity !== 'number' || quantity < 1) continue;
    parsedLines.push({
      id: line.id as OrderLineId,
      orderId,
      name,
      variant: str(line.data.variant),
      quantity,
      position: typeof line.data.position === 'number' ? line.data.position : parsedLines.length,
      dataOrigin: 'entered_by_user',
      createdAtDevice: toMillis(line.data.createdAt) ?? createdAtDevice,
    });
  }
  const parsedPackages: OrderPackage[] = [];
  for (const pkg of packages) {
    const index = pkg.data.index;
    if (typeof index !== 'number' || index < 1) continue;
    const pkgCreatedBy = str(pkg.data.createdBy);
    parsedPackages.push({
      id: pkg.id as PackageId,
      orderId,
      index,
      createdAtDevice: toMillis(pkg.data.createdAt) ?? createdAtDevice,
      ...(pkgCreatedBy ? { createdBy: pkgCreatedBy } : {}),
    });
  }
  return {
    order: {
      id: orderId,
      shopId,
      orderCode,
      source,
      trackingCode: str(d.trackingCode),
      dataOrigin: 'entered_by_user',
      createdAtDevice,
      ...(createdBy ? { createdBy } : {}),
    },
    lines: parsedLines.sort((a, b) => a.position - b.position),
    packages: parsedPackages.sort((a, b) => a.index - b.index),
  };
}

function parseSnapshot(raw: unknown): OrderSnapshot | null {
  if (!isRecord(raw)) return null;
  const orderCode = str(raw.orderCode);
  const source = fromRemoteSource(raw.source);
  const lines = Array.isArray(raw.lines) ? (raw.lines as unknown[]) : null;
  if (
    orderCode === null ||
    source === null ||
    lines === null ||
    typeof raw.packageIndex !== 'number' ||
    typeof raw.packageCount !== 'number'
  ) {
    return null;
  }
  const parsedLines: { name: string; variant: string | null; quantity: number }[] = [];
  for (const item of lines) {
    if (!isRecord(item)) return null;
    const name = str(item.name);
    if (name === null || typeof item.quantity !== 'number') return null;
    parsedLines.push({ name, variant: str(item.variant), quantity: item.quantity });
  }
  return {
    orderCode,
    source,
    trackingCode: str(raw.trackingCode),
    lines: parsedLines,
    packageIndex: raw.packageIndex,
    packageCount: raw.packageCount,
    takenAtDevice: toMillis(raw.takenAtDevice) ?? 0,
  };
}

/**
 * Phiên từ tài liệu máy chủ. Phiên còn `recording` trên máy chủ nghĩa là app cũ không kịp báo kết thúc
 * (bị tắt/mất máy): không biết video có đủ không nên ghi nhận `interrupted`, KHÔNG nhận là đã kết thúc
 * bình thường (bất biến 5, 6, 11). Không thể đang quay trên máy này.
 */
export function parseRemoteSession(
  doc: RemoteListedDocument,
  shopId: ShopId,
): RestoredSession | null {
  const d = doc.data;
  const orderId = str(d.orderId);
  const packageId = str(d.packageId);
  const status = str(d.status);
  const snapshot = parseSnapshot(d.orderSnapshot);
  if (d.kind !== 'packing' || !orderId || !packageId || !status || !snapshot) return null;
  if (!isSessionStatus(status) || status === 'created') return null;
  const createdBy = str(d.createdBy);
  const startedAtDevice = toMillis(d.startedAtDevice) ?? toMillis(d.startedAtServer);
  if (startedAtDevice === null) return null;
  return {
    session: {
      id: doc.id as SessionId,
      shopId,
      orderId: orderId as OrderId,
      packageId: packageId as PackageId,
      startedAtDevice,
      snapshot,
      sessionStatus: status === 'recording' ? 'interrupted' : status,
      ...(createdBy ? { createdBy } : {}),
    },
    remoteStatus: status,
  };
}

const RESTORABLE_SERVER_STATES = ['uploaded', 'verified', 'hash_mismatch'] as const;

/**
 * Bằng chứng đóng gói đã được MÁY CHỦ xác nhận. Chưa có `server.state` (đang tải dở trên máy cũ) thì bỏ
 * qua: tệp đó không có trên máy chủ nên không có gì để khôi phục. Bằng chứng hàng hoàn (`ownerKind`)
 * chưa khôi phục ở đợt này.
 */
export function parseRemoteEvidence(doc: RemoteListedDocument): RestoredEvidence | null {
  const d = doc.data;
  if (d.ownerKind !== undefined) return null;
  const sessionId = str(d.sessionId);
  const orderId = str(d.orderId);
  const packageId = str(d.packageId);
  const kind = d.kind === 'original_video' ? 'video' : d.kind === 'photo' ? 'photo' : null;
  const serverState = isRecord(d.server) ? d.server.state : undefined;
  const state = RESTORABLE_SERVER_STATES.find((s) => s === serverState);
  if (!sessionId || !orderId || !packageId || !kind || !state) return null;
  const capturedAtDevice = toMillis(d.capturedAtDevice) ?? toMillis(d.createdAtServer);
  if (capturedAtDevice === null) return null;
  return {
    id: doc.id as EvidenceId,
    orderId: orderId as OrderId,
    packageId: packageId as PackageId,
    sessionId: sessionId as SessionId,
    kind,
    state,
    sizeBytes: typeof d.sizeBytes === 'number' ? d.sizeBytes : null,
    durationMs: typeof d.durationMs === 'number' ? d.durationMs : null,
    sha256Client: str(d.sha256Client),
    capturedAtDevice,
  };
}

export const RESTORE_PAGE_SIZE = 50;
const SUBCOLLECTION_PAGE_SIZE = 200;

export interface RestoreDeps {
  readonly docs: Pick<RemoteDocuments, 'listPage'>;
  readonly store: RestoreStore;
  readonly now: () => number;
  readonly pageSize?: number;
}

export interface Restorer {
  /**
   * Chạy (hoặc chạy tiếp) khôi phục của `shopId` cho `uid`. Lỗi mạng/máy chủ ném ra ngoài; tiến độ đã
   * ghi nên lần sau chạy tiếp từ trang đang dở. `onProgress` được gọi sau mỗi trang với số đã khôi phục.
   * Trả `true` khi mọi giai đoạn đã hết.
   */
  run(shopId: ShopId, uid: string, onProgress?: (counts: RestoreCounts) => void): Promise<boolean>;
}

async function listAll(
  docs: Pick<RemoteDocuments, 'listPage'>,
  path: string,
  orderByField: string,
): Promise<RemoteListedDocument[]> {
  const all: RemoteListedDocument[] = [];
  let after: string | null = null;
  do {
    const page = await docs.listPage({
      path,
      orderByField,
      pageSize: SUBCOLLECTION_PAGE_SIZE,
      after,
    });
    all.push(...page.docs);
    after = page.next;
  } while (after !== null);
  return all;
}

export function createRestorer({
  docs,
  store,
  now,
  pageSize = RESTORE_PAGE_SIZE,
}: RestoreDeps): Restorer {
  return {
    async run(shopId, uid, onProgress) {
      const progress = await store.readProgress(shopId, uid);
      const counts = {
        orders: progress.orders.imported,
        sessions: progress.sessions.imported,
        evidence: progress.evidence.imported,
      };

      for (const phase of RESTORE_PHASES) {
        let current = progress[phase];
        while (!current.done) {
          const path =
            phase === 'orders'
              ? `shops/${shopId}/orders`
              : phase === 'sessions'
                ? `shops/${shopId}/sessions`
                : `shops/${shopId}/evidence`;
          const orderByField =
            phase === 'orders'
              ? 'createdAt'
              : phase === 'sessions'
                ? 'startedAtServer'
                : 'createdAtServer';
          const page = await docs.listPage({ path, orderByField, pageSize, after: current.cursor });
          const at = now();
          let written = 0;

          if (phase === 'orders') {
            const have = await store.existingOrderIds(
              shopId,
              page.docs.map((d) => d.id),
            );
            const items: OrderDetails[] = [];
            for (const doc of page.docs) {
              if (have.has(doc.id)) continue;
              const base = `${path}/${doc.id}`;
              const [lines, packages] = [
                await listAll(docs, `${base}/lines`, 'createdAt'),
                await listAll(docs, `${base}/packages`, 'createdAt'),
              ];
              const parsed = parseRemoteOrder(doc, shopId, lines, packages);
              if (parsed) items.push(parsed);
            }
            written = await store.importOrders(shopId, items, at);
          } else if (phase === 'sessions') {
            const items = page.docs.flatMap((doc) => {
              const parsed = parseRemoteSession(doc, shopId);
              return parsed ? [parsed] : [];
            });
            written = await store.importSessions(shopId, items);
          } else {
            const items = page.docs.flatMap((doc) => {
              const parsed = parseRemoteEvidence(doc);
              return parsed ? [parsed] : [];
            });
            written = await store.importEvidence(shopId, items, at);
          }

          current = {
            cursor: page.next,
            done: page.next === null,
            imported: current.imported + written,
          };
          await store.saveProgress(shopId, uid, phase, current, at);
          counts[phase] = current.imported;
          onProgress?.({ ...counts });
        }
      }
      return true;
    },
  };
}
