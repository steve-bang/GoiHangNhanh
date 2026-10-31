import {
  canSubmitDelete,
  DELETE_CONDITION_IDS,
  evaluateDeleteConditions,
  evaluateDeleteGate,
  type DeleteConditionFacts,
} from './delete-account-conditions';

const CLEAN: DeleteConditionFacts = {
  recording: false,
  unsynced: 0,
  openDisputes: 0,
  foreignRecords: 0,
  ownedShops: 0,
};

const byId = (facts: DeleteConditionFacts) =>
  Object.fromEntries(evaluateDeleteConditions(facts).map((c) => [c.id, c]));
const gateOf = (facts: Partial<DeleteConditionFacts>) =>
  evaluateDeleteGate(evaluateDeleteConditions({ ...CLEAN, ...facts }));

describe('evaluateDeleteConditions (PER-22, V1-15)', () => {
  it('luôn đủ năm điều kiện theo thứ tự cố định: chặn, cảnh báo, thông tin', () => {
    const result = evaluateDeleteConditions(CLEAN);
    expect(result.map((c) => c.id)).toEqual([...DELETE_CONDITION_IDS]);
    expect(result.map((c) => c.kind)).toEqual(['blocker', 'blocker', 'blocker', 'warning', 'info']);
  });

  it('sạch: mọi mục đạt (tranh chấp đã có nguồn thật từ kho cục bộ)', () => {
    const c = byId(CLEAN);
    for (const id of DELETE_CONDITION_IDS) expect(c[id]?.status).toBe('met');
  });

  it('có việc: "attention" kèm số', () => {
    const c = byId({
      recording: true,
      unsynced: 3,
      openDisputes: 1,
      foreignRecords: 4,
      ownedShops: 1,
    });
    expect(c['recording']?.status).toBe('attention');
    expect(c['disputes']).toMatchObject({ status: 'attention', count: 1 });
    expect(c['foreign']).toMatchObject({ status: 'attention', count: 4 });
    expect(c['unsynced']).toMatchObject({ status: 'attention', count: 3 });
    expect(c['ownership']).toMatchObject({ status: 'attention', count: 1 });
  });

  it('không đọc được nguồn: "chưa kiểm tra được", KHÔNG coi là đạt', () => {
    const c = byId({
      recording: null,
      unsynced: null,
      openDisputes: null,
      foreignRecords: null,
      ownedShops: null,
    });
    for (const id of DELETE_CONDITION_IDS) expect(c[id]?.status).toBe('unknown');
  });
});

describe('evaluateDeleteGate / canSubmitDelete (V1-15)', () => {
  const consent = { agreed: true, unsyncedAcknowledged: false };

  it('sạch + đã đồng ý: được xóa; chưa đồng ý: không', () => {
    expect(canSubmitDelete(gateOf({}), consent)).toBe(true);
    expect(canSubmitDelete(gateOf({}), { agreed: false, unsyncedAcknowledged: true })).toBe(false);
  });

  it.each([
    ['đang quay', { recording: true }],
    ['còn tranh chấp mở (bất biến 9)', { openDisputes: 1 }],
    ['dữ liệu tài khoản khác trên máy', { foreignRecords: 2 }],
    ['không đọc được trạng thái quay', { recording: null }],
    ['không đọc được tranh chấp', { openDisputes: null }],
    ['không biết dữ liệu tài khoản khác', { foreignRecords: null }],
    ['không biết số tệp chưa tải', { unsynced: null }],
  ] as const)('chặn: %s', (_label, facts) => {
    const gate = gateOf(facts);
    expect(gate.allowed).toBe(false);
    expect(canSubmitDelete(gate, { agreed: true, unsyncedAcknowledged: true })).toBe(false);
  });

  it('còn tệp chưa tải: phải tích xác nhận riêng (R-2 A)', () => {
    const gate = gateOf({ unsynced: 3 });
    expect(gate).toEqual({ allowed: true, unsyncedToLose: 3 });
    expect(canSubmitDelete(gate, consent)).toBe(false);
    expect(canSubmitDelete(gate, { agreed: true, unsyncedAcknowledged: true })).toBe(true);
  });

  it('là chủ cửa hàng hoặc không đọc được danh sách cửa hàng: không chặn (chỉ thông tin)', () => {
    expect(gateOf({ ownedShops: 1 }).allowed).toBe(true);
    expect(gateOf({ ownedShops: null }).allowed).toBe(true);
  });
});
