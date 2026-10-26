import { assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { ref, getBytes, uploadBytes, deleteObject, getDownloadURL } from 'firebase/storage';

import { createTestEnv, SHOP_A, SHOP_B, USERS } from './helpers';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

const originalPath = (shop: string) => `shops/${shop}/evidence/evidence-1/original`;

// Storage mặc định TỪ CHỐI mọi truy cập từ client (ADR-006, chờ duyệt): tải lên/đọc đi qua Cloud
// Function cấp phiên/URL có thời hạn. Test này bảo đảm không ai - kể cả thành viên đúng shop -
// ghi đè, xóa, hay lấy URL tải vĩnh viễn từ client (CLAUDE.md bất biến #4, #8).
describe('Storage: client không truy cập trực tiếp (QA-11)', () => {
  const cases: [string, string][] = [
    ['thành viên shop A', USERS.packerA],
    ['chủ shop A', USERS.ownerA],
    ['người lạ đã đăng nhập', USERS.stranger],
  ];

  it.each(cases)('%s: không tải lên/đọc/xóa/lấy URL ở shop A hay shop B', async (_name, uid) => {
    const storage = env.authenticatedContext(uid).storage();
    for (const shop of [SHOP_A, SHOP_B]) {
      const r = ref(storage, originalPath(shop));
      await assertFails(uploadBytes(r, new Uint8Array([1, 2, 3]), { contentType: 'video/mp4' }));
      await assertFails(getBytes(r));
      await assertFails(getDownloadURL(r));
      await assertFails(deleteObject(r));
    }
  });

  it('chưa đăng nhập: bị từ chối', async () => {
    const storage = env.unauthenticatedContext().storage();
    const r = ref(storage, originalPath(SHOP_A));
    await assertFails(uploadBytes(r, new Uint8Array([1]), { contentType: 'video/mp4' }));
    await assertFails(getBytes(r));
  });

  it('ghi đè bản gốc đã tồn tại cũng bị từ chối', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), originalPath(SHOP_A)), new Uint8Array([9]), {
        contentType: 'video/mp4',
      });
    });
    const storage = env.authenticatedContext(USERS.ownerA).storage();
    await assertFails(
      uploadBytes(ref(storage, originalPath(SHOP_A)), new Uint8Array([0]), {
        contentType: 'video/mp4',
      }),
    );
  });
});
