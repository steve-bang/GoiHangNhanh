import { createHash, randomBytes } from 'node:crypto';

import { Sha256 } from './sha256';

const reference = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const hashInChunks = (bytes: Uint8Array, chunk: number) => {
  const h = new Sha256();
  for (let i = 0; i < bytes.length; i += chunk) h.update(bytes.subarray(i, i + chunk));
  return h.digestHex();
};

describe('Sha256', () => {
  it('khớp vectơ chuẩn', () => {
    expect(new Sha256().digestHex()).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(new Sha256().update(new TextEncoder().encode('abc')).digestHex()).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it.each([0, 1, 55, 56, 57, 63, 64, 65, 119, 120, 128, 1000, 100_003])(
    'khớp node:crypto với dữ liệu %i byte, mọi cỡ khối',
    (length) => {
      const bytes = new Uint8Array(randomBytes(length));
      const expected = reference(bytes);
      for (const chunk of [1, 7, 63, 64, 65, 4096, 1_000_000]) {
        expect(hashInChunks(bytes, chunk)).toBe(expected);
      }
    },
  );

  it('digestHex lặp lại cho cùng kết quả; update sau khi chốt bị từ chối', () => {
    const h = new Sha256().update(new Uint8Array([1, 2, 3]));
    const first = h.digestHex();
    expect(h.digestHex()).toBe(first);
    expect(() => h.update(new Uint8Array([4]))).toThrow('sha256_finished');
  });
});
