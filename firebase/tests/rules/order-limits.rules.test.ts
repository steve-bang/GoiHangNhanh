import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';

import type { OrderId, OrderLineId, PackageId, ShopId } from '@/core/ids';
import { buildOrder, type OrderDraft } from '@/features/orders/domain/build-order';
import {
  MAX_CODE_LENGTH,
  MAX_LINE_NAME_LENGTH,
  MAX_LINE_VARIANT_LENGTH,
} from '@/features/orders/domain/codes';
import { orderWrites, type RemoteValues } from '@/features/orders/domain/remote-documents';
import type { OrderDetails } from '@/features/orders/domain/types';

import { createTestEnv, SHOP_A, seed, USERS } from './helpers';

// V1-04 (review PR #44): trần độ dài của APP phải khớp Rules. Giá trị dài nhất app cho nhập phải
// đăng được (nếu không, đơn bị Rules từ chối mãi và video không bao giờ lên); dài hơn 1 bị từ chối.
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

const values: RemoteValues = {
  serverTimestamp: () => serverTimestamp(),
  timestamp: (ms) => Timestamp.fromMillis(ms),
};

function build(orderId: string, draft: Partial<OrderDraft>): OrderDetails {
  let n = 0;
  const result = buildOrder(
    { orderCode: 'DH', source: 'shopee', trackingCode: '', lines: [], ...draft },
    {
      shopId: SHOP_A as ShopId,
      nowDevice: 1_700_000_000_000,
      ids: {
        orderId: () => orderId as OrderId,
        lineId: () => `${orderId}-l${(n += 1)}` as OrderLineId,
        packageId: () => `${orderId}-p` as PackageId,
      },
    },
  );
  if (!result.ok) throw new Error(`app từ chối bản nháp: ${result.error.kind}`);
  return result.details;
}

async function publish(details: OrderDetails) {
  const db = env.authenticatedContext(USERS.packerA).firestore();
  const batch = writeBatch(db);
  for (const w of orderWrites(details, USERS.packerA, values)) batch.set(doc(db, w.path), w.data);
  return batch.commit();
}

// Chữ tiếng Việt dựng sẵn (1 đơn vị UTF-16, 3 byte UTF-8): kiểm Rules đếm ký tự, không đếm byte.
const VN = 'ữ';

describe('trần độ dài app = Rules khi đăng đơn bằng orderWrites()', () => {
  it('giá trị dài nhất app cho nhập (mã đơn, mã vận đơn 64; tên, variant 200, có dấu) đăng được', async () => {
    const details = build('max-1', {
      orderCode: 'X'.repeat(MAX_CODE_LENGTH),
      trackingCode: 'T'.repeat(MAX_CODE_LENGTH),
      lines: [
        {
          name: VN.repeat(MAX_LINE_NAME_LENGTH),
          variant: VN.repeat(MAX_LINE_VARIANT_LENGTH),
          quantity: 99_999,
        },
      ],
    });
    await assertSucceeds(publish(details));
  });

  it('mã đơn 64 ký tự mà viết hoa dài gấp 3 ("ﬃ" -> "FFI") vẫn đăng được', async () => {
    const details = build('max-upper', {
      orderCode: 'ﬃ'.repeat(MAX_CODE_LENGTH),
      trackingCode: 'ﬃ'.repeat(MAX_CODE_LENGTH),
    });
    await assertSucceeds(publish(details));
  });

  it('dài hơn trần 1 ký tự bị Rules từ chối (mã vận đơn, tên, variant, mã đơn)', async () => {
    const base = build('over', { lines: [{ name: 'Áo', variant: 'Đen', quantity: 1 }] });
    const line = base.lines[0];
    if (!line) throw new Error('fixture');
    // Bản đơn mà app KHÔNG cho tạo (vượt trần một ký tự), dựng tay từ bản hợp lệ.
    const cases: OrderDetails[] = [
      {
        ...base,
        order: { ...base.order, trackingCode: 'T'.repeat(MAX_CODE_LENGTH + 1) },
      },
      {
        ...base,
        order: { ...base.order, orderCode: 'X'.repeat(MAX_CODE_LENGTH + 1) },
      },
      {
        ...base,
        lines: [{ ...line, name: VN.repeat(MAX_LINE_NAME_LENGTH + 1) }],
      },
      {
        ...base,
        lines: [{ ...line, variant: VN.repeat(MAX_LINE_VARIANT_LENGTH + 1) }],
      },
    ];
    for (const details of cases) await assertFails(publish(details));
  });
});
