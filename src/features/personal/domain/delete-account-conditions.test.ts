import { evaluateDeleteConditions, DELETE_CONDITION_IDS } from './delete-account-conditions';

const byId = (facts: Parameters<typeof evaluateDeleteConditions>[0]) =>
  Object.fromEntries(evaluateDeleteConditions(facts).map((c) => [c.id, c]));

describe('evaluateDeleteConditions (PER-22)', () => {
  it('luôn đủ bốn điều kiện theo thứ tự cố định', () => {
    const result = evaluateDeleteConditions({ recording: false, unsynced: 0, ownedShops: 0 });
    expect(result.map((c) => c.id)).toEqual([...DELETE_CONDITION_IDS]);
  });

  it('sạch: đạt ba mục có nguồn; mục tranh chấp luôn "chưa kiểm tra được" (không dấu tích giả)', () => {
    const c = byId({ recording: false, unsynced: 0, ownedShops: 0 });
    expect(c['recording']?.status).toBe('met');
    expect(c['unsynced']?.status).toBe('met');
    expect(c['ownership']?.status).toBe('met');
    expect(c['disputes']?.status).toBe('unknown');
  });

  it('đang quay, còn tệp chưa đồng bộ, là chủ cửa hàng: cần xử lý kèm số', () => {
    const c = byId({ recording: true, unsynced: 3, ownedShops: 2 });
    expect(c['recording']?.status).toBe('attention');
    expect(c['unsynced']).toEqual({ id: 'unsynced', status: 'attention', count: 3 });
    expect(c['ownership']).toEqual({ id: 'ownership', status: 'attention', count: 2 });
  });

  it('không đọc được nguồn: "chưa kiểm tra được", KHÔNG coi là đạt', () => {
    const c = byId({ recording: null, unsynced: null, ownedShops: null });
    for (const id of DELETE_CONDITION_IDS) expect(c[id]?.status).toBe('unknown');
  });

  it('mục tranh chấp không đổi theo dữ kiện nào', () => {
    for (const facts of [
      { recording: false, unsynced: 0, ownedShops: 0 },
      { recording: true, unsynced: 5, ownedShops: 1 },
      { recording: null, unsynced: null, ownedShops: null },
    ]) {
      expect(byId(facts)['disputes']).toEqual({ id: 'disputes', status: 'unknown' });
    }
  });
});
