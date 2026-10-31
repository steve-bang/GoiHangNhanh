import { createHash } from 'node:crypto';

import { createTimeSliceYielder, updateCooperatively } from './cooperative-hash';
import { Sha256 } from './sha256';

/**
 * Số đo THAM KHẢO tốc độ băm SHA-256 thuần JS trên Node/V8 (V1-13). KHÔNG đại diện cho Hermes trên
 * điện thoại (thường chậm hơn nhiều lần): số thật đo ở cổng thiết bị G-5 (R-5). Chỉ chạy khi
 * `HASH_BENCH=1` (`HASH_BENCH=1 npx jest --selectProjects unit -- src/core/crypto/sha256.bench.test.ts`)
 * để không làm chậm/chập chờn bộ test thường.
 */
const run = process.env.HASH_BENCH === '1' ? it : it.skip;
const MB = 1024 * 1024;

run(
  'đo MB/giây của Sha256 (liền mạch và có nhường luồng)',
  async () => {
    const sizeMb = Number(process.env.HASH_BENCH_MB ?? 64);
    const chunk = new Uint8Array(MB).map((_, i) => (i * 31) & 0xff);
    const measure = async (cooperative: boolean) => {
      const hash = new Sha256();
      const yielder = createTimeSliceYielder();
      const start = performance.now();
      for (let i = 0; i < sizeMb; i += 1) {
        if (cooperative) await updateCooperatively(hash, chunk, yielder);
        else hash.update(chunk);
      }
      const hex = hash.digestHex();
      return { hex, seconds: (performance.now() - start) / 1000 };
    };
    const reference = createHash('sha256');
    for (let i = 0; i < sizeMb; i += 1) reference.update(chunk);
    const expected = reference.digest('hex');
    const plain = await measure(false);
    const coop = await measure(true);
    expect(plain.hex).toBe(expected);
    expect(coop.hex).toBe(expected);
    process.stdout.write(
      `[HASH_BENCH] ${sizeMb} MB: liền mạch ${(sizeMb / plain.seconds).toFixed(1)} MB/s, ` +
        `có nhường ${(sizeMb / coop.seconds).toFixed(1)} MB/s (Node ${process.version})\n`,
    );
  },
  600_000,
);
