import type { EvidenceId, OrderId, PackageId, SessionId, ShopId } from '@/core/ids';
import { createMemoryEvidenceFileStore } from '@/features/orders';

import type { UploadGateway, UploadOutcome } from './ports';
import { createUploadQueue } from './upload-queue';
import { evidenceFileSource } from './upload-sources';

/** V1-27: số đo không PII cho mỗi lần tải thành công (thời gian băm, thời gian gửi, số lần băm). */
const SHOP = 'shop-1' as ShopId;
const HASH = 'ab'.repeat(32);
const d = (type: string) => ({ type, origin: 'device' }) as never;

async function setup(metrics: jest.Mock, outcome: UploadOutcome = { kind: 'received' }) {
  const files = createMemoryEvidenceFileStore();
  await files.create({
    id: 'a' as EvidenceId,
    shopId: SHOP,
    orderId: 'o-a' as OrderId,
    packageId: 'p-a' as PackageId,
    sessionId: 's-a' as SessionId,
    group: 'pack',
    kind: 'video',
    createdAtDevice: 1000,
  });
  await files.applyEvent(SHOP, 'a' as EvidenceId, d('STOP_RECORDING'), 1000);
  await files.applyEvent(SHOP, 'a' as EvidenceId, d('LOCAL_FILE_READABLE'), 1000, {
    localPath: 'evidence/a.mp4',
    sizeBytes: 4_000_000,
    sha256Client: HASH,
  });
  let clock = 0;
  const gateway: UploadGateway = {
    upload: async () => {
      clock += 2000;
      return outcome;
    },
    fetchServerStates: async () => new Map(),
  };
  return createUploadQueue({
    sources: [evidenceFileSource(files)],
    gateway,
    hasher: {
      sha256: async () => {
        clock += 1000;
        return { ok: true, sha256: HASH };
      },
    },
    now: () => clock,
    isOnline: () => true,
    metrics,
  });
}

describe('hàng đợi tải lên: số đo (V1-27)', () => {
  it('tải thành công: một bản ghi upload có hashMs, uploadMs, hashCount 1, không ID/đường dẫn', async () => {
    const metrics = jest.fn();
    const queue = await setup(metrics);
    await queue.runOnce(SHOP);
    expect(metrics).toHaveBeenCalledTimes(1);
    expect(metrics.mock.calls[0][0]).toEqual({
      kind: 'upload',
      sizeBytes: 4_000_000,
      hashMs: 1000,
      uploadMs: 2000,
      hashCount: 1,
    });
  });

  it('tải lỗi thì không có bản ghi; reporter ném lỗi không làm hỏng lượt tải', async () => {
    const none = jest.fn();
    await (await setup(none, { kind: 'retryable', code: 'HTTP_500' })).runOnce(SHOP);
    expect(none).not.toHaveBeenCalled();

    const boom = jest.fn(() => {
      throw new Error('x');
    });
    const summary = await (await setup(boom)).runOnce(SHOP);
    expect(summary.received).toBe(1);
  });
});
