import { createHash, randomBytes } from 'node:crypto';

import {
  createTimeSliceYielder,
  HASH_SLICE_BYTES,
  updateCooperatively,
  type HashYielder,
} from './cooperative-hash';
import { Sha256 } from './sha256';

const nodeHex = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('updateCooperatively', () => {
  it('kết quả khớp node:crypto bất kể cách chia lát (lát lẻ, nhỏ hơn khối, dữ liệu rỗng)', async () => {
    const bytes = new Uint8Array(randomBytes(HASH_SLICE_BYTES * 3 + 77));
    const never: HashYielder = { maybeYield: async () => undefined };
    for (const slice of [1, 63, 64, 65, 4096, HASH_SLICE_BYTES, bytes.length * 2]) {
      const hash = new Sha256();
      await updateCooperatively(hash, bytes.subarray(0, 5000), never, slice);
      await updateCooperatively(hash, bytes.subarray(5000), never, slice);
      expect(hash.digestHex()).toBe(nodeHex(bytes));
    }
    const empty = new Sha256();
    await updateCooperatively(empty, new Uint8Array(), never);
    expect(empty.digestHex()).toBe(nodeHex(new Uint8Array()));
  });

  it('xét nhường sau MỖI lát', async () => {
    let calls = 0;
    const counting: HashYielder = {
      maybeYield: async () => {
        calls += 1;
      },
    };
    await updateCooperatively(new Sha256(), new Uint8Array(10 * 1024), counting, 1024);
    expect(calls).toBe(10);
  });
});

describe('createTimeSliceYielder', () => {
  it('chỉ nhường khi đã chạy liên tục quá ngân sách, rồi đếm lại từ lúc nhường xong', async () => {
    let clock = 0;
    let waits = 0;
    const yielder = createTimeSliceYielder({
      budgetMs: 10,
      now: () => clock,
      wait: async () => {
        waits += 1;
      },
    });
    clock = 9;
    await yielder.maybeYield();
    expect(waits).toBe(0);
    clock = 10;
    await yielder.maybeYield();
    expect(waits).toBe(1);
    clock = 15;
    await yielder.maybeYield();
    expect(waits).toBe(1);
    clock = 20;
    await yielder.maybeYield();
    expect(waits).toBe(2);
  });

  it('mặc định nhường bằng macrotask: hẹn giờ đặt trước chạy XEN giữa lúc băm, không đợi băm xong', async () => {
    const bytes = new Uint8Array(randomBytes(HASH_SLICE_BYTES * 4));
    const order: string[] = [];
    setTimeout(() => order.push('timer'), 0);
    const hash = new Sha256();
    // Ngân sách 0: nhường sau mỗi lát (chỉ để kiểm cơ chế; mặc định là 12 ms).
    await updateCooperatively(hash, bytes, createTimeSliceYielder({ budgetMs: 0 }));
    order.push('hashed');
    expect(order).toEqual(['timer', 'hashed']);
    expect(hash.digestHex()).toBe(nodeHex(bytes));
  });
});
