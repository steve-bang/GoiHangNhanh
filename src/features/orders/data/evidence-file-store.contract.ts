import type { EvidenceId, SessionId, ShopId } from '@/core/ids';
import type { EvidenceFileStore, NewEvidenceFile } from '@/features/evidence';

import { LOCAL_SHOP_ID } from '../domain/local-shop';
import { buildPackingSession } from '../domain/start-session';
import type { OrderStore } from '../domain/order-store';
import { makeOrder } from './order-store.contract';

export interface EvidenceHarness {
  readonly files: EvidenceFileStore;
  readonly orders: OrderStore;
  /** Đổi tài khoản mà kho đơn ghi làm người tạo phiên (`creatorUid`); `null` = chưa biết (V1-07). */
  readonly signInAs: (uid: string | null) => void;
}

/** Lưu đơn + phiên thật (khóa ngoại của SQLite cần chúng) rồi trả dữ liệu tạo tệp. */
export async function seedFile(
  h: Pick<EvidenceHarness, 'files' | 'orders'>,
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

    it('bộ ba kiện-phiên-đơn phải thuộc nhau và cùng shop: lệch thì ném lỗi và không lưu gì', async () => {
      const h = await make();
      const a = await seedFile(h, 'TRI-A');
      const b = await seedFile(h, 'TRI-B');
      const bad = (patch: Partial<NewEvidenceFile>, id: string) =>
        h.files.create({ ...a, id: id as EvidenceId, ...patch });
      // phiên của đơn khác
      await expect(bad({ sessionId: b.sessionId }, 'ev-t1')).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      // kiện của đơn khác
      await expect(bad({ packageId: b.packageId }, 'ev-t2')).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      // đơn khác với đơn của phiên
      await expect(bad({ orderId: b.orderId }, 'ev-t3')).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      // shop khác với shop của phiên
      await expect(bad({ shopId: 'shop-khac' as ShopId }, 'ev-t4')).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      // phiên không tồn tại
      await expect(bad({ sessionId: 'khong-co' as SessionId }, 'ev-t5')).rejects.toMatchObject({
        code: 'LOCAL_SAVE_UNAVAILABLE',
      });
      for (const id of ['ev-t1', 'ev-t2', 'ev-t3', 'ev-t4', 'ev-t5']) {
        expect(await h.files.get(LOCAL_SHOP_ID, id as EvidenceId)).toBeNull();
        expect(await h.files.get('shop-khac' as ShopId, id as EvidenceId)).toBeNull();
      }
      expect(await h.files.countUnsynced(LOCAL_SHOP_ID)).toBe(0);
    });

    it('cùng id nhưng gắn phiên/kiện/đơn/shop/nhóm/loại khác: ném lỗi, không trả bản cũ trong im lặng', async () => {
      const h = await make();
      const a = await seedFile(h, 'DUP-A');
      const b = await seedFile(h, 'DUP-B');
      const first = await h.files.create(a);
      const attempts: Partial<NewEvidenceFile>[] = [
        { sessionId: b.sessionId, packageId: b.packageId, orderId: b.orderId },
        { sessionId: b.sessionId },
        { packageId: b.packageId },
        { orderId: b.orderId },
        { shopId: 'shop-khac' as ShopId },
        { group: 'return' },
        { kind: 'photo' },
      ];
      for (const patch of attempts) {
        await expect(h.files.create({ ...a, ...patch })).rejects.toMatchObject({
          code: 'LOCAL_SAVE_UNAVAILABLE',
        });
      }
      // Bản cũ không đổi; gọi lại đúng liên kết vẫn trả bản cũ (thử lại an toàn).
      expect(await h.files.get(LOCAL_SHOP_ID, a.id)).toEqual(first);
      expect(await h.files.create({ ...a, createdAtDevice: 99999 })).toEqual(first);
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

    it('chi tiết tệp đã đóng bất biến: mã băm/kích thước/thời lượng chỉ đặt MỘT lần ở sự kiện đóng tệp', async () => {
      const h = await make();
      const input = await seedFile(h, 'IMM');
      await h.files.create(input);
      const apply = (type: string, now: number, patch?: object) =>
        h.files.applyEvent(LOCAL_SHOP_ID, input.id, device(type), now, patch);
      // Không đặt được ở sự kiện không phải đóng tệp.
      expect(await apply('STOP_RECORDING', 1, { sha256Client: 'cd'.repeat(32) })).toEqual({
        ok: false,
        error: 'IMMUTABLE_FIELD',
      });
      expect(await apply('STOP_RECORDING', 1, { sizeBytes: 5 })).toEqual({
        ok: false,
        error: 'IMMUTABLE_FIELD',
      });
      expect((await h.files.get(LOCAL_SHOP_ID, input.id))?.state).toBe('recording'); // không đổi gì
      await apply('STOP_RECORDING', 2, { localPath: 'file:///tmp/1.mp4' });
      await apply('LOCAL_FILE_READABLE', 3, { ...CLOSED, durationMs: 1000 });
      // Sau khi đóng: không đổi được, kể cả qua sự kiện upload hay đóng lại.
      for (const patch of [
        { sha256Client: 'cd'.repeat(32) },
        { sizeBytes: 99 },
        { durationMs: 5 },
        { localPath: 'file:///khac.mp4' },
      ]) {
        expect(await apply('UPLOAD_STARTED', 4, patch)).toEqual({
          ok: false,
          error: 'IMMUTABLE_FIELD',
        });
      }
      expect(await h.files.get(LOCAL_SHOP_ID, input.id)).toMatchObject({
        state: 'queued',
        ...CLOSED,
        durationMs: 1000,
      });
      // Patch số lần thử vẫn đi bình thường.
      expect(await apply('UPLOAD_STARTED', 5, { attemptCount: 1 })).toMatchObject({ ok: true });
    });

    it('vị trí tệp: đặt khi chưa có, ghi vị trí thật khi chuyển tệp (trước khi đóng), không đổi sau khi đóng', async () => {
      const h = await make();
      const input = await seedFile(h, 'LOC');
      await h.files.create(input);
      const apply = (type: string, now: number, patch?: object) =>
        h.files.applyEvent(LOCAL_SHOP_ID, input.id, device(type), now, patch);
      expect(await apply('STOP_RECORDING', 1, { localPath: 'file:///tmp/a.mp4' })).toMatchObject({
        ok: true,
        file: { localPath: 'file:///tmp/a.mp4' },
      });
      // Chuyển sang thư mục bền rồi lỗi: ghi vị trí thật.
      expect(
        await apply('LOCAL_WRITE_FAILED', 2, { localPath: 'file:///evidence/a.mp4' }),
      ).toMatchObject({
        ok: true,
        file: { state: 'local_save_failed', localPath: 'file:///evidence/a.mp4' },
      });
      await apply('RETRY_LOCAL_SAVE', 3);
      // Đóng tệp có thể ghi vị trí bền (khác vị trí tạm đã lưu).
      expect(
        await apply('LOCAL_FILE_READABLE', 4, { ...CLOSED, localPath: 'file:///evidence/b.mp4' }),
      ).toMatchObject({ ok: true, file: { state: 'queued', localPath: 'file:///evidence/b.mp4' } });
      // Đặt lại đúng giá trị cũ là hợp lệ; đổi khác thì không.
      expect(
        await apply('UPLOAD_STARTED', 5, { localPath: 'file:///evidence/b.mp4' }),
      ).toMatchObject({
        ok: true,
      });
      expect(await apply('UPLOAD_FAILED', 6, { localPath: 'file:///x.mp4' })).toEqual({
        ok: false,
        error: 'IMMUTABLE_FIELD',
      });
    });

    it('LOCAL_FILE_MOVED: ghi đường dẫn bền mới khi đang saving_local (trước khi băm), vẫn saving_local, không đóng tệp', async () => {
      const h = await make();
      const input = await seedFile(h, 'MOV');
      await h.files.create(input);
      const apply = (type: string, now: number, patch?: object) =>
        h.files.applyEvent(LOCAL_SHOP_ID, input.id, device(type), now, patch);
      await apply('STOP_RECORDING', 1, { localPath: 'file:///tmp/a.mp4' });
      expect(await apply('LOCAL_FILE_MOVED', 2, { localPath: 'evidence/a.mp4' })).toMatchObject({
        ok: true,
        file: { state: 'saving_local', localPath: 'evidence/a.mp4', sha256Client: null },
      });
      // Không thành chi tiết đã chốt: không đặt được mã băm/kích thước qua sự kiện này.
      expect(await apply('LOCAL_FILE_MOVED', 3, { sha256Client: 'cd'.repeat(32) })).toEqual({
        ok: false,
        error: 'IMMUTABLE_FIELD',
      });
      expect(
        await apply('LOCAL_FILE_READABLE', 4, { ...CLOSED, localPath: 'evidence/a.mp4' }),
      ).toMatchObject({ ok: true, file: { state: 'queued' } });
      // Sau khi đóng (có mã băm) không còn đổi được vị trí, và sự kiện này cũng hết hợp lệ.
      expect(await apply('LOCAL_FILE_MOVED', 5, { localPath: 'evidence/khac.mp4' })).toEqual({
        ok: false,
        error: 'ILLEGAL_TRANSITION',
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

    it('ghi và xóa số lần thử, thời điểm thử lại, mã lỗi; listByStates lọc theo trạng thái', async () => {
      const h = await make();
      const a = await seedFile(h, 'K');
      await h.files.create(a);
      await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('STOP_RECORDING'), 1);
      await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('LOCAL_FILE_READABLE'), 2, CLOSED);
      await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('UPLOAD_STARTED'), 3);
      const failed = await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('UPLOAD_FAILED'), 4, {
        attemptCount: 1,
        nextAttemptAtDevice: 9000,
        lastErrorCode: 'NETWORK',
      });
      expect(failed).toMatchObject({
        ok: true,
        file: { attemptCount: 1, nextAttemptAtDevice: 9000, lastErrorCode: 'NETWORK' },
      });
      expect(await h.files.listByStates(LOCAL_SHOP_ID, ['upload_failed'])).toHaveLength(1);
      expect(await h.files.listByStates(LOCAL_SHOP_ID, ['queued'])).toEqual([]);
      expect(await h.files.listByStates(LOCAL_SHOP_ID, [])).toEqual([]);
      const retry = await h.files.applyEvent(LOCAL_SHOP_ID, a.id, device('RETRY_UPLOAD'), 5, {
        nextAttemptAtDevice: null,
        lastErrorCode: null,
      });
      expect(retry).toMatchObject({
        ok: true,
        file: { state: 'queued', attemptCount: 1, nextAttemptAtDevice: null, lastErrorCode: null },
      });
    });

    it('listShopsWithStates: các shop có tệp ở trạng thái đó (không trùng), rỗng thì rỗng', async () => {
      const h = await make();
      const a = await seedFile(h, 'S1');
      const b = await seedFile(h, 'S2', { id: 'ev-S2', shopId: 'shop-khac' as ShopId });
      await h.files.create(a);
      await h.files.create(b);
      expect([...(await h.files.listShopsWithStates(['recording']))].sort()).toEqual(
        [LOCAL_SHOP_ID, 'shop-khac'].sort(),
      );
      expect(await h.files.listShopsWithStates(['queued'])).toEqual([]);
      expect(await h.files.listShopsWithStates([])).toEqual([]);
    });

    it('listByOrders: tệp của nhiều đơn, cô lập shop, danh sách rỗng thì rỗng', async () => {
      const h = await make();
      const a = await seedFile(h, 'L1');
      const b = await seedFile(h, 'L2', { id: 'ev-L2' });
      await h.files.create(a);
      await h.files.create({ ...b, createdAtDevice: 100 });
      const both = await h.files.listByOrders(LOCAL_SHOP_ID, [a.orderId, b.orderId]);
      expect(both.map((f) => f.id)).toEqual([b.id, a.id]);
      expect(await h.files.listByOrders(LOCAL_SHOP_ID, [b.orderId])).toHaveLength(1);
      expect(await h.files.listByOrders(LOCAL_SHOP_ID, [])).toEqual([]);
      expect(await h.files.listByOrders('shop-khac' as ShopId, [a.orderId])).toEqual([]);
    });

    it('listForUpload (V1-07): chỉ tệp của phiên do CHÍNH uid tạo; NULL, uid rỗng, khác shop, sai trạng thái không có', async () => {
      const h = await make();
      const close = async (input: NewEvidenceFile) => {
        await h.files.create(input);
        await h.files.applyEvent(input.shopId, input.id, device('STOP_RECORDING'), 4000);
        await h.files.applyEvent(
          input.shopId,
          input.id,
          device('LOCAL_FILE_READABLE'),
          4000,
          CLOSED,
        );
      };
      h.signInAs('u-1');
      const mine = await seedFile(h, 'U1', { at: 3000 });
      const mineOld = await seedFile(h, 'U1B', { at: 1000 });
      h.signInAs('u-2');
      const theirs = await seedFile(h, 'U2');
      h.signInAs(null);
      const nobody = await seedFile(h, 'U0');
      h.signInAs('u-1');
      const otherShop = await seedFile(h, 'U1S', { shopId: 'shop-khac' as ShopId });
      for (const f of [mine, mineOld, theirs, nobody, otherShop]) await close(f);
      const queued = ['queued'] as const;
      expect((await h.files.listForUpload(LOCAL_SHOP_ID, queued, 'u-1')).map((f) => f.id)).toEqual([
        mineOld.id,
        mine.id,
      ]);
      expect((await h.files.listForUpload(LOCAL_SHOP_ID, queued, 'u-2')).map((f) => f.id)).toEqual([
        theirs.id,
      ]);
      // Phiên không rõ người tạo không bao giờ khớp, kể cả uid rỗng.
      expect(await h.files.listForUpload(LOCAL_SHOP_ID, queued, '')).toEqual([]);
      expect(await h.files.listForUpload(LOCAL_SHOP_ID, ['uploading'], 'u-1')).toEqual([]);
      expect(await h.files.listForUpload(LOCAL_SHOP_ID, [], 'u-1')).toEqual([]);
      expect(
        (await h.files.listForUpload('shop-khac' as ShopId, queued, 'u-1')).map((f) => f.id),
      ).toEqual([otherShop.id]);
      expect(await h.files.listForUpload('shop-khac' as ShopId, queued, 'u-2')).toEqual([]);
      // Đọc không đổi gì: tệp của người khác vẫn nguyên trạng thái.
      expect((await h.files.get(LOCAL_SHOP_ID, theirs.id))?.state).toBe('queued');
      expect((await h.files.get(LOCAL_SHOP_ID, nobody.id))?.state).toBe('queued');
    });
  });
}
