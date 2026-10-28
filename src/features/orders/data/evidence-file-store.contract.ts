import type { EvidenceId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFileStore, NewEvidenceFile } from '@/features/evidence';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildPackingSession } from '../domain/start-session';
import type { OrderStore } from '../domain/order-store';
import { makeOrder } from './order-store.contract';

export interface EvidenceHarness {
  readonly files: EvidenceFileStore;
  readonly orders: OrderStore;
}

/** Lưu đơn + phiên thật (khóa ngoại của SQLite cần chúng) rồi trả dữ liệu tạo tệp. */
export async function seedFile(
  h: EvidenceHarness,
  code: string,
  options: { id?: string; shopId?: ShopId; at?: number } = {},
): Promise<NewEvidenceFile> {
  const shopId = options.shopId ?? LOCAL_SHOP_ID;
  const details = makeOrder(code, { shopId });
  await h.orders.saveNewOrder(details);
  const pkg = details.packages[0];
  if (!pkg) throw new Error('fixture');
  const built = buildPackingSession(details, pkg.id, {
    sessionId: `sess-${code}` as SessionId,
    nowDevice: 2000,
  });
  if (!built.ok) throw new Error('fixture');
  await h.orders.saveSession(built.session);
  return {
    id: (options.id ?? `ev-${code}`) as EvidenceId,
    shopId,
    orderId: details.order.id,
    packageId: pkg.id,
    sessionId: built.session.id,
    group: 'pack',
    kind: 'video',
    createdAtDevice: options.at ?? 3000,
  };
}

const device = (type: string) => ({ type, origin: 'device' }) as never;
const server = (type: string) => ({ type, origin: 'server' }) as never;
const CLOSED = { localPath: 'file:///v/1.mp4', sizeBytes: 1024, sha256Client: 'ab'.repeat(32) };

export function runEvidenceFileStoreContract(name: string, make: () => Promise<EvidenceHarness>) {
  describe(`kho tệp bằng chứng: ${name}`, () => {
    it('tạo tệp ở trạng thái recording, gắn đơn + kiện + phiên, chưa có đường dẫn/mã băm', async () => {
      const h = await make();
      const input = await seedFile(h, 'A');
      const file = await h.files.create(input);
      expect(file).toMatchObject({
        id: input.id,
        orderId: input.orderId,
        packageId: input.packageId,
        sessionId: input.sessionId,
        state: 'recording',
        localPath: null,
        sha256Client: null,
      });
      expect(await h.files.get(LOCAL_SHOP_ID, input.id)).toEqual(file);
    });

    it('tạo lại cùng id không ghi đè (an toàn khi thử lại)', async () => {
      const h = await make();
      const input = await seedFile(h, 'B');
      await h.files.create(input);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('STOP_RECORDING'), 4000);
      const again = await h.files.create(input);
      expect(again.state).toBe('saving_local');
    });

    it('đi hết đường đóng tệp: recording -> saving_local -> queued, lưu chi tiết tệp', async () => {
      const h = await make();
      const input = await seedFile(h, 'C');
      await h.files.create(input);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('STOP_RECORDING'), 4000);
      const closed = await h.files.applyEvent(
        LOCAL_SHOP_ID,
        input.id,
        device('LOCAL_FILE_READABLE'),
        5000,
        { ...CLOSED, durationMs: 60000 },
      );
      expect(closed).toMatchObject({
        ok: true,
        file: { state: 'queued', ...CLOSED, durationMs: 60000, updatedAtDevice: 5000 },
      });
    });

    it('không cho vào hàng đợi khi thiếu đường dẫn, kích thước hoặc mã băm', async () => {
      const h = await make();
      const input = await seedFile(h, 'D');
      await h.files.create(input);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('STOP_RECORDING'), 4000);
      for (const patch of [{}, { localPath: 'f' }, { localPath: 'f', sizeBytes: 5 }]) {
        expect(
          await h.files.applyEvent(
            LOCAL_SHOP_ID,
            input.id,
            device('LOCAL_FILE_READABLE'),
            5000,
            patch,
          ),
        ).toEqual({ ok: false, error: 'MISSING_FILE_DETAILS' });
      }
      expect((await h.files.get(LOCAL_SHOP_ID, input.id))?.state).toBe('saving_local');
    });

    it('chuyển sai bị từ chối và không đổi gì; client không tự tới uploaded/verified', async () => {
      const h = await make();
      const input = await seedFile(h, 'E');
      await h.files.create(input);
      expect(
        await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('UPLOAD_STARTED'), 4000),
      ).toEqual({
        ok: false,
        error: 'ILLEGAL_TRANSITION',
      });
      expect(
        await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('SERVER_VERIFIED'), 4000),
      ).toEqual({
        ok: false,
        error: 'ORIGIN_NOT_ALLOWED',
      });
      expect((await h.files.get(LOCAL_SHOP_ID, input.id))?.state).toBe('recording');
    });

    it('sự kiện từ máy chủ đưa tệp đã tải tới uploaded rồi verified', async () => {
      const h = await make();
      const input = await seedFile(h, 'F');
      await h.files.create(input);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('STOP_RECORDING'), 1);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('LOCAL_FILE_READABLE'), 2, CLOSED);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, device('UPLOAD_STARTED'), 3);
      await h.files.applyEvent(LOCAL_SHOP_ID, input.id, server('SERVER_RECEIVED'), 4);
      const done = await h.files.applyEvent(LOCAL_SHOP_ID, input.id, server('SERVER_VERIFIED'), 5);
      expect(done).toMatchObject({ ok: true, file: { state: 'verified' } });
    });

    it('tệp không tồn tại hoặc của shop khác: FILE_NOT_FOUND / null (cô lập shop)', async () => {
      const h = await make();
      const input = await seedFile(h, 'G');
      await h.files.create(input);
      const other = 'shop-khac' as ShopId;
      expect(await h.files.get(other, input.id)).toBeNull();
      expect(await h.files.applyEvent(other, input.id, device('STOP_RECORDING'), 1)).toEqual({
        ok: false,
        error: 'FILE_NOT_FOUND',
      });
      expect(await h.files.listByOrder(other, input.orderId)).toEqual([]);
      expect(await h.files.countUnsynced(other)).toBe(0);
    });

    it('liệt kê theo đơn và theo phiên, cũ nhất trước', async () => {
      const h = await make();
      const a = await seedFile(h, 'H');
      await h.files.create({ ...a, createdAtDevice: 9000 });
      await h.files.create({
        ...a,
        id: 'ev-H0' as EvidenceId,
        kind: 'photo',
        createdAtDevice: 8000,
      });
      const byOrder = await h.files.listByOrder(LOCAL_SHOP_ID, a.orderId);
      expect(byOrder.map((f) => f.id)).toEqual(['ev-H0', a.id]);
      expect(await h.files.listBySession(LOCAL_SHOP_ID, a.sessionId)).toHaveLength(2);
    });

    it('đếm chưa đồng bộ: uploaded, verified và unrecoverable không tính', async () => {
      const h = await make();
      const a = await seedFile(h, 'I');
      await h.files.create(a);
      expect(await h.files.countUnsynced(LOCAL_SHOP_ID)).toBe(1);
      await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('MARK_UNRECOVERABLE'), 1);
      expect(await h.files.countUnsynced(LOCAL_SHOP_ID)).toBe(0);
      expect(await h.files.countUnsyncedOnDevice()).toBe(0);
      const b = await seedFile(h, 'J', { id: 'ev-J' });
      await h.files.create(b);
      expect(await h.files.countUnsynced(LOCAL_SHOP_ID)).toBe(1);
      expect(await h.files.countUnsyncedOnDevice()).toBe(1);
    });
  });
}
