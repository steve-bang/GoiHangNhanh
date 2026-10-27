import { suggestProductNames, suggestVariants } from './suggestions';

const history = [
  { name: 'Áo thun cotton', variant: 'Đen / XL', createdAtDevice: 3 },
  { name: 'Áo thun cotton', variant: 'Trắng / L', createdAtDevice: 2 },
  { name: 'áo thun cotton', variant: 'Đen / XL', createdAtDevice: 1 },
  { name: 'Bình giữ nhiệt', variant: '500ml', createdAtDevice: 4 },
  { name: 'Quần', variant: null, createdAtDevice: 0 },
];

describe('gợi ý từ lịch sử', () => {
  it('gợi ý TÊN: mỗi tên một lần (không phân biệt hoa thường), mới nhất trước, không kèm variant', () => {
    expect(suggestProductNames(history, '')).toEqual(['Bình giữ nhiệt', 'Áo thun cotton', 'Quần']);
  });
  it('lọc theo chữ đang gõ và không gợi lại đúng tên đã gõ đủ', () => {
    expect(suggestProductNames(history, 'thun')).toEqual(['Áo thun cotton']);
    expect(suggestProductNames(history, 'Áo thun cotton')).toEqual([]);
    expect(suggestProductNames(history, 'xyz')).toEqual([]);
  });
  it('tôn trọng giới hạn', () => {
    expect(suggestProductNames(history, '', 1)).toEqual(['Bình giữ nhiệt']);
  });
  it('gợi ý VARIANT của đúng sản phẩm đã chọn, mỗi variant một dòng riêng (không gộp)', () => {
    expect(suggestVariants(history, 'Áo thun cotton')).toEqual(['Đen / XL', 'Trắng / L']);
    expect(suggestVariants(history, 'bình giữ nhiệt')).toEqual(['500ml']);
  });
  it('tên chưa có lịch sử hoặc rỗng thì không có gợi ý variant; dòng không variant bị bỏ', () => {
    expect(suggestVariants(history, 'Mũ')).toEqual([]);
    expect(suggestVariants(history, '')).toEqual([]);
    expect(suggestVariants(history, 'Quần')).toEqual([]);
  });
});
