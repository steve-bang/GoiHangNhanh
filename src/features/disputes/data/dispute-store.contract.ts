import { AppError } from '@/core/errors/app-error';
import type { DisputeId, EvidenceId, OrderId, ReturnCaseId, ShopId } from '@/core/ids';

import type { DisputeStore, NewDisputeInput } from '../domain/dispute-store';

const SHOP = 'shop-a' as ShopId;
const OTHER = 'shop-b' as ShopId;
let counter = 0;

export function makeNewDispute(overrides: Partial<NewDisputeInput> = {}): NewDisputeInput {
  return {
    id: `dsp-${(counter += 1)}` as DisputeId,
    shopId: SHOP,
    subject: { kind: 'order', orderId: 'o1' as OrderId, label: 'DH001' },
    issueType: 'missing_item',
    note: 'Khách báo thiếu',
    createdAtDevice: 1000,
    ...overrides,
  };
}

const ev = (id: string) => id as EvidenceId;

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof AppError ? error.code : 'OTHER';
  }
  return 'NONE';
}

export function runDisputeStoreContract(name: string, make: () => Promise<DisputeStore>) {
  describe(`kho tranh chấp: ${name}`, () => {
    it('tạo hồ sơ mở, mã TC theo thứ tự từng shop, có sự kiện "created"', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      const b = await store.createDispute(makeNewDispute());
      const other = await store.createDispute(makeNewDispute({ shopId: OTHER }));
      expect(a.dispute.code).toBe('TC-00001');
      expect(b.dispute.code).toBe('TC-00002');
      expect(other.dispute.code).toBe('TC-00001');
      expect(a.dispute.status).toBe('open');
      expect(a.events.map((e) => e.kind)).toEqual(['created']);
      expect(a.evidence).toEqual([]);
    });

    it('giữ tham chiếu hồ sơ hoàn và nhãn hạn chế bằng chứng', async () => {
      const store = await make();
      const created = await store.createDispute(
        makeNewDispute({
          subject: {
            kind: 'return',
            returnId: 'r1' as ReturnCaseId,
            label: 'RH-00001',
            orderId: null,
            openingEvidenceLimit: true,
          },
        }),
      );
      const read = await store.getDispute(SHOP, created.dispute.id);
      expect(read?.dispute.subject).toEqual({
        kind: 'return',
        returnId: 'r1',
        label: 'RH-00001',
        orderId: null,
        openingEvidenceLimit: true,
      });
    });

    it('cô lập shop: đọc/sửa bằng ID của shop khác thì như không tồn tại', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      expect(await store.getDispute(OTHER, a.dispute.id)).toBeNull();
      expect(await store.listDisputes(OTHER)).toEqual([]);
      expect(await code(store.addNote(OTHER, a.dispute.id, 'x', 5))).toBe('DISPUTE_SAVE_FAILED');
      expect(await code(store.closeDispute(OTHER, a.dispute.id, '', 5))).toBe(
        'DISPUTE_SAVE_FAILED',
      );
      expect(await store.listHeldEvidenceIds(OTHER)).toEqual([]);
    });

    it('thêm bằng chứng idempotent, ghi một sự kiện cho lần thêm thật', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      await store.addEvidence(SHOP, a.dispute.id, [ev('e1'), ev('e2'), ev('e1')], 2000);
      const again = await store.addEvidence(SHOP, a.dispute.id, [ev('e1')], 3000);
      expect(again.evidence.map((e) => e.evidenceId)).toEqual(['e1', 'e2']);
      expect(again.events.filter((e) => e.kind === 'evidence_added')).toHaveLength(1);
      expect(again.dispute.updatedAtDevice).toBe(2000);
    });

    it('danh sách: mới cập nhật trước, lọc theo trạng thái, đếm bằng chứng', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute({ createdAtDevice: 1000 }));
      const b = await store.createDispute(makeNewDispute({ createdAtDevice: 2000 }));
      await store.addEvidence(SHOP, a.dispute.id, [ev('e1')], 3000);
      await store.closeDispute(SHOP, b.dispute.id, '', 4000);
      const all = await store.listDisputes(SHOP);
      expect(all.map((s) => s.dispute.id)).toEqual([b.dispute.id, a.dispute.id]);
      expect(all[1]?.evidenceCount).toBe(1);
      const open = await store.listDisputes(SHOP, { status: 'open' });
      expect(open.map((s) => s.dispute.id)).toEqual([a.dispute.id]);
    });

    it('đóng hồ sơ: không xóa bằng chứng/lịch sử, rồi không sửa được nữa', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      await store.addEvidence(SHOP, a.dispute.id, [ev('e1')], 2000);
      const closed = await store.closeDispute(SHOP, a.dispute.id, 'Đã thỏa thuận', 3000);
      expect(closed.dispute).toMatchObject({
        status: 'closed',
        closeNote: 'Đã thỏa thuận',
        closedAtDevice: 3000,
      });
      expect(closed.evidence).toHaveLength(1);
      expect(closed.events.map((e) => e.kind)).toEqual(['created', 'evidence_added', 'closed']);
      expect(await code(store.addNote(SHOP, a.dispute.id, 'x', 4000))).toBe('DISPUTE_CLOSED');
      expect(await code(store.addEvidence(SHOP, a.dispute.id, [ev('e2')], 4000))).toBe(
        'DISPUTE_CLOSED',
      );
      expect(await code(store.closeDispute(SHOP, a.dispute.id, '', 4000))).toBe('DISPUTE_CLOSED');
    });

    it('bằng chứng bị giữ chỉ khi hồ sơ còn mở', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      const b = await store.createDispute(makeNewDispute());
      await store.addEvidence(SHOP, a.dispute.id, [ev('e1'), ev('e2')], 2000);
      await store.addEvidence(SHOP, b.dispute.id, [ev('e2')], 2000);
      expect([...(await store.listHeldEvidenceIds(SHOP))].sort()).toEqual(['e1', 'e2']);
      await store.closeDispute(SHOP, a.dispute.id, '', 3000);
      expect(await store.listHeldEvidenceIds(SHOP)).toEqual(['e2']);
    });

    it('đếm hồ sơ đang mở trên CẢ MÁY (mọi shop), hồ sơ đã đóng không tính (V1-15)', async () => {
      const store = await make();
      expect(await store.countOpenOnDevice()).toBe(0);
      const a = await store.createDispute(makeNewDispute());
      await store.createDispute(makeNewDispute({ shopId: OTHER }));
      expect(await store.countOpenOnDevice()).toBe(2);
      await store.closeDispute(SHOP, a.dispute.id, '', 3000);
      expect(await store.countOpenOnDevice()).toBe(1);
    });

    it('ghi chú bổ sung vào lịch sử và cập nhật thời gian', async () => {
      const store = await make();
      const a = await store.createDispute(makeNewDispute());
      const noted = await store.addNote(SHOP, a.dispute.id, 'Đã gọi khách', 2500);
      expect(noted.events.at(-1)).toMatchObject({ kind: 'note_added', note: 'Đã gọi khách' });
      expect(noted.dispute.updatedAtDevice).toBe(2500);
    });

    it('ID trùng báo DISPUTE_SAVE_FAILED', async () => {
      const store = await make();
      const input = makeNewDispute();
      await store.createDispute(input);
      expect(await code(store.createDispute(input))).toBe('DISPUTE_SAVE_FAILED');
    });
  });
}
